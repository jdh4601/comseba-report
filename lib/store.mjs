import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const DEFAULT_SETTINGS = { provider: "claude-cli", model: "", unsplashKey: "" };

export function createStore(dataDir) {
  const studentsDir = join(dataDir, "students");
  const settingsPath = join(dataDir, "settings.json");

  const safeId = (id) => {
    if (!/^[\w가-힣.-]+$/.test(String(id ?? ""))) throw new Error("잘못된 보고서 ID입니다.");
    return id;
  };

  return {
    async loadSettings() {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(await readFile(settingsPath, "utf8")) };
      } catch (error) {
        if (error.code === "ENOENT") return { ...DEFAULT_SETTINGS };
        throw error;
      }
    },

    /** API 키는 새로 입력했을 때만 바꾸고, 비워서 보내면 기존 키를 유지한다(화면에 키를 다시 내려보내지 않기 때문). */
    async saveSettings(settings) {
      const current = await this.loadSettings();
      const typedKey = String(settings.unsplashKey ?? "").trim();
      const next = {
        provider: settings.provider,
        model: String(settings.model ?? "").trim(),
        unsplashKey: settings.clearUnsplashKey ? "" : typedKey || current.unsplashKey,
      };
      await mkdir(dataDir, { recursive: true });
      await writeFile(settingsPath, JSON.stringify(next, null, 2));
      return next;
    },

    /** 학생 보고서를 `날짜_이름` ID로 저장한다. 같은 날 같은 이름이면 덮어쓴다. */
    async saveReport(report) {
      const date = String(report.student?.date ?? "").replace(/[^\d]/g, "") || "nodate";
      const name = String(report.student?.name ?? "").replace(/[^\w가-힣]/g, "") || "학생";
      const id = `${date}_${name}`;
      await mkdir(studentsDir, { recursive: true });
      await writeFile(join(studentsDir, `${id}.json`), JSON.stringify({ ...report, savedAt: new Date().toISOString() }, null, 2));
      return id;
    },

    async listReports() {
      await mkdir(studentsDir, { recursive: true });
      const files = (await readdir(studentsDir)).filter((name) => name.endsWith(".json"));
      const items = await Promise.all(
        files.map(async (file) => {
          const report = JSON.parse(await readFile(join(studentsDir, file), "utf8"));
          return { id: file.replace(/\.json$/, ""), name: report.student?.name ?? "", date: report.student?.date ?? "", main: report.interest?.main ?? "", savedAt: report.savedAt ?? "" };
        }),
      );
      return items.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
    },

    async loadReport(id) {
      return JSON.parse(await readFile(join(studentsDir, `${safeId(id)}.json`), "utf8"));
    },
  };
}
