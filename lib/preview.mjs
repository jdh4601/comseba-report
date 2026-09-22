import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

const SOFFICE_CANDIDATES = ["/Applications/LibreOffice.app/Contents/MacOS/soffice", "/opt/homebrew/bin/soffice"];
const HOMEBREW_FONTS_CONF = "/opt/homebrew/etc/fonts/fonts.conf";
// 바탕(Batang)은 PowerPoint 앱 안에만 들어 있어서, 미리보기에서도 같은 글꼴로 보이도록 그 폴더를 추가한다.
const POWERPOINT_FONTS = "/Applications/Microsoft PowerPoint.app/Contents/Resources/DFonts";

export function findSoffice() {
  return SOFFICE_CANDIDATES.find((path) => existsSync(path)) ?? null;
}

/**
 * macOS의 LibreOffice는 기본 설정으로 실행하면 한글을 통째로 빠뜨린다.
 * Homebrew fontconfig를 쓰도록 fonts.conf를 만들어 환경변수로 넘긴다.
 */
async function fontEnv(workDir) {
  if (!existsSync(HOMEBREW_FONTS_CONF)) return process.env;
  const extraDir = existsSync(POWERPOINT_FONTS) ? `<dir>${POWERPOINT_FONTS}</dir>` : "";
  const conf = join(workDir, "fonts.conf");
  await writeFile(conf, `<?xml version="1.0"?>\n<!DOCTYPE fontconfig SYSTEM "fonts.dtd">\n<fontconfig><include>${HOMEBREW_FONTS_CONF}</include>${extraDir}</fontconfig>\n`);
  return { ...process.env, FONTCONFIG_FILE: conf, FONTCONFIG_PATH: "/opt/homebrew/etc/fonts" };
}

async function withPdf(pptxBuffer, task) {
  const soffice = findSoffice();
  if (!soffice) throw new Error("LibreOffice가 없어 PDF를 만들 수 없습니다. `brew install --cask libreoffice`로 설치해 주세요.");

  const workDir = await mkdtemp(join(tmpdir(), "report-preview-"));
  try {
    const pptxPath = join(workDir, "deck.pptx");
    await writeFile(pptxPath, pptxBuffer);
    await run(
      soffice,
      ["--headless", "--norestore", `-env:UserInstallation=file://${join(workDir, "profile")}`, "--convert-to", "pdf", "--outdir", workDir, pptxPath],
      { env: await fontEnv(workDir), timeout: 120_000 },
    );
    return await task(join(workDir, "deck.pdf"), workDir);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

/** 인쇄용 3페이지 PDF. LibreOffice 변환이라 문장부호 앞에 공백이 생길 수 있다. */
export async function convertToPdf(pptxBuffer) {
  return withPdf(pptxBuffer, (pdfPath) => readFile(pdfPath));
}

/**
 * PPTX를 슬라이드 PNG(data URL)로 렌더링한다. 2·3페이지만 필요하므로 기본값은 2~3쪽이다.
 * LibreOffice 렌더링이라 PowerPoint와 줄바꿈이 조금 다를 수 있다(문장부호 앞 공백 등).
 */
export async function renderPreview(pptxBuffer, { firstPage = 2, lastPage = 3, dpi = 80 } = {}) {
  return withPdf(pptxBuffer, async (pdfPath, workDir) => {
    await run("pdftoppm", ["-png", "-r", String(dpi), "-f", String(firstPage), "-l", String(lastPage), pdfPath, join(workDir, "slide")], { timeout: 60_000 });
    const images = (await readdir(workDir)).filter((name) => /^slide-\d+\.png$/.test(name)).sort();
    return Promise.all(images.map(async (name) => `data:image/png;base64,${(await readFile(join(workDir, name))).toString("base64")}`));
  });
}
