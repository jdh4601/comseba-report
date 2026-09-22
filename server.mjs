import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";

import { PROVIDERS, completeWithCli } from "./lib/ai.mjs";
import { exampleReport } from "./lib/example.mjs";
import { generateReport, regenerateSection } from "./lib/generate.mjs";
import { DEFAULT_LEVEL, LEVELS } from "./lib/prompt.mjs";
import {
  buildPhotoPickPrompt,
  cropPhoto,
  downloadImage,
  isSafePhotoPath,
  parsePhotoPicks,
  searchPhotos,
  shorterQuery,
  trackUnsplashDownload,
} from "./lib/photos.mjs";
import { convertToPdf, findSoffice, renderPreview } from "./lib/preview.mjs";
import { CHIPS, COUNTS, LIMITS, SECTIONS } from "./lib/schema.mjs";
import { createStore } from "./lib/store.mjs";
import { buildDeck } from "./lib/template.mjs";
import { validateReport } from "./lib/validate.mjs";

const rootDir = dirname(fileURLToPath(import.meta.url));
const photoDir = join(rootDir, "data", "photos");
const store = createStore(join(rootDir, "data"));
const PORT = Number(process.env.PORT ?? 4180);
const HOST = "127.0.0.1";

const app = express();
app.use(express.json({ limit: "25mb" }));
app.use(express.static(join(rootDir, "public")));
app.use("/data/photos", express.static(photoDir));
app.use("/assets", express.static(join(rootDir, "assets")));

/** 비동기 핸들러의 오류를 한곳에서 JSON으로 돌려준다. */
const route = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    console.error(`[${req.method} ${req.path}]`, error);
    res.status(error.status ?? 500).json({ error: error.message, code: error.code ?? "error" });
  }
};

const badRequest = (message) => Object.assign(new Error(message), { status: 400 });

/** 브라우저에서 넘어온 보고서의 사진 경로가 프로젝트 사진 폴더를 벗어나면 비운다. */
function sanitizeReport(report) {
  if (!report || typeof report !== "object") throw badRequest("보고서 데이터가 없습니다.");
  const next = structuredClone(report);
  next.photos = (next.photos ?? []).map((photo) => (isSafePhotoPath(photo.file) ? photo : { ...photo, file: "" }));
  return next;
}

/** 브라우저에는 API 키 자체 대신 등록 여부만 보낸다. */
const publicSettings = ({ unsplashKey, ...rest }) => ({ ...rest, hasUnsplashKey: Boolean(unsplashKey || process.env.UNSPLASH_ACCESS_KEY) });

async function unsplashKey() {
  return (await store.loadSettings()).unsplashKey || process.env.UNSPLASH_ACCESS_KEY || "";
}

async function completer() {
  const settings = await store.loadSettings();
  return (prompt) => completeWithCli({ provider: settings.provider, model: settings.model, prompt });
}

async function savePhotoBuffer(buffer) {
  await mkdir(photoDir, { recursive: true });
  const file = `data/photos/${randomUUID()}.jpg`;
  await cropPhoto(buffer, join(rootDir, file));
  return file;
}

/** 고른 후보를 내려받아 2:1로 저장한다. Unsplash 사진은 약관에 따라 다운로드 이벤트도 보낸다. */
async function savePickedPhoto(candidate, key) {
  const file = await savePhotoBuffer(await downloadImage(String(candidate.imageUrl ?? "")));
  const source = candidate.source === "unsplash" ? "unsplash" : "wikimedia";
  if (source === "unsplash") {
    trackUnsplashDownload(candidate.downloadLocation, { accessKey: key }).catch((error) => console.error("[unsplash download 추적 실패]", error.message));
  }
  return { file, credit: String(candidate.credit ?? ""), source };
}

/** 검색어로 후보를 찾고, 없으면 더 짧은 검색어로 한 번 더 찾는다. */
async function findCandidates(query, key) {
  const first = await searchPhotos(query, { unsplashKey: key });
  if (first.length) return first;
  const broader = shorterQuery(query);
  return broader ? searchPhotos(broader, { unsplashKey: key }) : [];
}

/**
 * 생성 직후 사진 2장을 자동으로 넣는다.
 * 후보들의 영어 설명을 AI에게 보여 주고 사진 설명에 가장 맞는 한 장을 고르게 한다. 실패하면 경고만 남긴다.
 */
async function autoPickPhotos(report, complete) {
  const warnings = [];
  const warn = (code, message) => warnings.push({ path: "photos", code, message });
  const key = await unsplashKey();

  const slots = await Promise.all(
    report.photos.map(async (photo) => {
      try {
        return { photo, candidates: (await findCandidates(photo.query, key)).slice(0, 8) };
      } catch (error) {
        warn("photo-failed", `${photo.tag} 사진을 검색하지 못했습니다: ${error.message}`);
        return { photo, candidates: [] };
      }
    }),
  );

  let picks = slots.map(() => 0);
  if (slots.some((slot) => slot.candidates.length > 1)) {
    try {
      const prompt = buildPhotoPickPrompt(slots.map(({ photo, candidates }) => ({ ...photo, candidates: candidates.length ? candidates : [{ title: "(후보 없음)" }] })));
      picks = parsePhotoPicks(await complete(prompt), slots.map((slot) => Math.max(1, slot.candidates.length)));
    } catch (error) {
      warn("photo-pick-failed", `AI가 사진을 고르지 못해 첫 번째 후보를 넣었습니다: ${error.message}`);
    }
  }

  const photos = await Promise.all(
    slots.map(async ({ photo, candidates }, index) => {
      const chosen = candidates[picks[index]];
      if (!chosen) {
        warn("photo-none", `"${photo.query}" 검색 결과가 없어 ${photo.tag} 사진을 비워 두었습니다.`);
        return photo;
      }
      try {
        return { ...photo, ...(await savePickedPhoto(chosen, key)) };
      } catch (error) {
        warn("photo-failed", `${photo.tag} 사진을 가져오지 못했습니다: ${error.message}`);
        return photo;
      }
    }),
  );
  return { report: { ...report, photos }, warnings };
}

app.get("/api/meta", route(async (_req, res) => {
  res.json({
    chips: CHIPS,
    levels: LEVELS,
    defaultLevel: DEFAULT_LEVEL,
    limits: LIMITS,
    counts: COUNTS,
    sections: SECTIONS,
    providers: PROVIDERS,
    settings: publicSettings(await store.loadSettings()),
    example: exampleReport,
    previewAvailable: Boolean(findSoffice()),
  });
}));

app.put("/api/settings", route(async (req, res) => {
  if (!PROVIDERS[req.body?.provider]) throw badRequest("provider는 claude-cli 또는 codex-cli여야 합니다.");
  res.json(publicSettings(await store.saveSettings(req.body)));
}));

app.post("/api/test-connection", route(async (_req, res) => {
  const complete = await completer();
  const started = Date.now();
  const reply = await complete("연결 확인용 요청입니다. 다른 말 없이 OK라고만 답하세요.");
  res.json({ ok: true, reply: reply.slice(0, 100), seconds: Math.round((Date.now() - started) / 1000) });
}));

app.post("/api/generate", route(async (req, res) => {
  const input = req.body?.input;
  if (!input?.interest?.main || !input?.interest?.sub || !input?.problemQuote?.trim()) {
    throw badRequest("MAIN·SUB 분야와 해결하고 싶은 문제는 꼭 입력해야 합니다.");
  }
  const complete = await completer();
  const generated = await generateReport({ input, complete });
  const withPhotos = await autoPickPhotos(generated.report, complete);
  const id = await store.saveReport(withPhotos.report);
  res.json({ id, report: withPhotos.report, warnings: [...generated.warnings, ...withPhotos.warnings] });
}));

app.post("/api/regenerate", route(async (req, res) => {
  const { section } = req.body ?? {};
  if (!SECTIONS[section]) throw badRequest(`알 수 없는 섹션입니다: ${section}`);
  res.json(await regenerateSection({ report: sanitizeReport(req.body.report), section, complete: await completer() }));
}));

app.post("/api/validate", route(async (req, res) => {
  res.json(validateReport(sanitizeReport(req.body?.report)));
}));

app.get("/api/photos/search", route(async (req, res) => {
  const query = String(req.query.q ?? "").trim();
  if (!query) throw badRequest("검색어를 입력해 주세요.");
  res.json({ results: await searchPhotos(query, { unsplashKey: await unsplashKey() }) });
}));

app.post("/api/photos/pick", route(async (req, res) => {
  res.json(await savePickedPhoto(req.body ?? {}, await unsplashKey()));
}));

app.post("/api/photos/upload", route(async (req, res) => {
  const match = /^data:image\/(png|jpe?g|webp|heic);base64,(.+)$/.exec(String(req.body?.dataUrl ?? ""));
  if (!match) throw badRequest("PNG·JPG·WEBP 이미지만 올릴 수 있습니다.");
  const file = await savePhotoBuffer(Buffer.from(match[2], "base64"));
  res.json({ file, credit: "", source: "upload" });
}));

app.post("/api/preview", route(async (req, res) => {
  const buffer = await buildDeck(sanitizeReport(req.body?.report), { rootDir });
  res.json({ images: await renderPreview(buffer) });
}));

app.post("/api/pdf", route(async (req, res) => {
  const pdf = await convertToPdf(await buildDeck(sanitizeReport(req.body?.report), { rootDir }));
  res.setHeader("Content-Type", "application/pdf");
  res.send(pdf);
}));

app.post("/api/pptx", route(async (req, res) => {
  const report = sanitizeReport(req.body?.report);
  const buffer = await buildDeck(report, { rootDir });
  const name = String(report.student?.name ?? "학생").replace(/[^\w가-힣]/g, "") || "학생";
  const filename = `컴세바_60분융합체험수업_${name}.pptx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
  res.send(buffer);
}));

app.get("/api/reports", route(async (_req, res) => {
  res.json({ reports: await store.listReports() });
}));

app.get("/api/reports/:id", route(async (req, res) => {
  res.json({ report: await store.loadReport(req.params.id) });
}));

app.post("/api/reports", route(async (req, res) => {
  res.json({ id: await store.saveReport(sanitizeReport(req.body?.report)) });
}));

app.listen(PORT, HOST, () => {
  console.log(`컴세바 보고서 대시보드: http://${HOST}:${PORT}`);
});
