import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { get, list, put } from "@vercel/blob";

/**
 * 설정·학생 보고서·사진 저장소.
 * 로컬 실행은 data/ 폴더(createFileStore), Vercel은 비공개 Blob 저장소(createBlobStore)를 쓴다.
 * 두 저장소는 같은 메서드를 가지며, 사진은 "photos/<uuid>.jpg" 형태의 ref로 가리킨다.
 */

/** 평문 API 키가 들어가므로 data/settings.json은 반드시 .gitignore 대상이어야 한다. */
export const KEY_FIELDS = ["unsplashKey", "anthropicKey", "openaiKey"];
const DEFAULT_SETTINGS = { provider: "claude-cli", model: "", unsplashKey: "", anthropicKey: "", openaiKey: "" };

const REPORT_ID = /^[\w가-힣.-]+$/;
const PHOTO_REF = /^(?:data\/)?photos\/([\w-]+\.jpe?g)$/;

function safeId(id) {
  if (!REPORT_ID.test(String(id ?? ""))) throw new Error("잘못된 보고서 ID입니다.");
  return id;
}

/** 학생 보고서는 `날짜_이름` ID로 저장한다. 같은 날 같은 이름이면 덮어쓴다. */
export function reportId(report) {
  const date = String(report.student?.date ?? "").replace(/[^\d]/g, "") || "nodate";
  const name = String(report.student?.name ?? "").replace(/[^\w가-힣]/g, "") || "학생";
  return `${date}_${name}`;
}

/** API 키는 새로 입력했을 때만 바꾸고, 비워서 보내면 기존 키를 유지한다(화면에 키를 다시 내려보내지 않기 때문). */
function mergeSettings(current, incoming, { keysWritable }) {
  const keys = Object.fromEntries(
    KEY_FIELDS.map((field) => [field, keysWritable ? String(incoming[field] ?? "").trim() || current[field] : ""]),
  );
  return { provider: incoming.provider, model: String(incoming.model ?? "").trim(), ...keys };
}

const summarize = (id, report) => ({
  id,
  name: report.student?.name ?? "",
  date: report.student?.date ?? "",
  main: report.interest?.main ?? "",
  savedAt: report.savedAt ?? "",
});

export function createFileStore(dataDir, { defaultProvider = DEFAULT_SETTINGS.provider } = {}) {
  const studentsDir = join(dataDir, "students");
  const photosDir = join(dataDir, "photos");
  const settingsPath = join(dataDir, "settings.json");

  const readJson = async (path, fallback) => {
    try {
      return JSON.parse(await readFile(path, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return fallback;
      throw error;
    }
  };

  return {
    keysWritable: true,

    async loadSettings() {
      return { ...DEFAULT_SETTINGS, provider: defaultProvider, ...(await readJson(settingsPath, {})) };
    },

    async saveSettings(settings) {
      const next = mergeSettings(await this.loadSettings(), settings, { keysWritable: true });
      await mkdir(dataDir, { recursive: true });
      await writeFile(settingsPath, JSON.stringify(next, null, 2));
      return next;
    },

    async saveReport(report) {
      const id = reportId(report);
      await mkdir(studentsDir, { recursive: true });
      await writeFile(join(studentsDir, `${id}.json`), JSON.stringify({ ...report, savedAt: new Date().toISOString() }, null, 2));
      return id;
    },

    async listReports() {
      await mkdir(studentsDir, { recursive: true });
      const files = (await readdir(studentsDir)).filter((name) => name.endsWith(".json"));
      const items = await Promise.all(
        files.map(async (file) => summarize(file.replace(/\.json$/, ""), JSON.parse(await readFile(join(studentsDir, file), "utf8")))),
      );
      return items.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
    },

    async loadReport(id) {
      return JSON.parse(await readFile(join(studentsDir, `${safeId(id)}.json`), "utf8"));
    },

    async savePhoto(buffer) {
      const name = `${randomUUID()}.jpg`;
      await mkdir(photosDir, { recursive: true });
      await writeFile(join(photosDir, name), buffer);
      return `photos/${name}`;
    },

    async readPhoto(ref) {
      const match = PHOTO_REF.exec(String(ref ?? ""));
      if (!match) return null;
      try {
        return await readFile(join(photosDir, match[1]));
      } catch (error) {
        if (error.code === "ENOENT") return null;
        throw error;
      }
    },
  };
}

/**
 * Vercel Blob 비공개 저장소. BLOB_READ_WRITE_TOKEN 환경변수로 인증한다.
 * 호스팅에서는 API 키를 저장소에 쓰지 않고 Vercel 환경변수로만 받는다.
 */
export function createBlobStore() {
  const options = { access: "private" };

  const readBlob = async (pathname) => {
    const result = await get(pathname, { ...options, useCache: false });
    if (!result) return null;
    return Buffer.from(await new Response(result.stream).arrayBuffer());
  };
  const readJson = async (pathname) => {
    const buffer = await readBlob(pathname);
    return buffer ? JSON.parse(buffer.toString("utf8")) : null;
  };
  const writeBlob = (pathname, body, contentType) =>
    put(pathname, body, { ...options, contentType, addRandomSuffix: false, allowOverwrite: true });

  return {
    keysWritable: false,

    async loadSettings() {
      return { ...DEFAULT_SETTINGS, provider: "claude-api", ...(await readJson("settings.json")) };
    },

    async saveSettings(settings) {
      const next = mergeSettings(await this.loadSettings(), settings, { keysWritable: false });
      await writeBlob("settings.json", JSON.stringify(next), "application/json");
      return next;
    },

    async saveReport(report) {
      const id = reportId(report);
      await writeBlob(`reports/${id}.json`, JSON.stringify({ ...report, savedAt: new Date().toISOString() }), "application/json");
      return id;
    },

    async listReports() {
      const { blobs } = await list({ prefix: "reports/", limit: 1000 });
      const items = blobs.map((blob) => {
        const id = blob.pathname.replace(/^reports\//, "").replace(/\.json$/, "");
        const [date = "", ...nameParts] = id.split("_");
        const pretty = date.length === 8 ? `${date.slice(0, 4)}.${date.slice(4, 6)}.${date.slice(6)}` : date;
        return { id, name: nameParts.join("_"), date: pretty, main: "", savedAt: new Date(blob.uploadedAt).toISOString() };
      });
      return items.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
    },

    async loadReport(id) {
      const report = await readJson(`reports/${safeId(id)}.json`);
      if (!report) throw new Error(`저장된 보고서를 찾지 못했습니다: ${id}`);
      return report;
    },

    async savePhoto(buffer) {
      const ref = `photos/${randomUUID()}.jpg`;
      await writeBlob(ref, buffer, "image/jpeg");
      return ref;
    },

    async readPhoto(ref) {
      const match = PHOTO_REF.exec(String(ref ?? ""));
      return match ? readBlob(`photos/${match[1]}`) : null;
    },
  };
}
