import { spawn as nodeSpawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** 보고서 한 벌을 쓰는 데 1~2분이 걸리므로, 매달린 프로세스만 끊을 만큼 넉넉히 잡는다. */
const cliTimeoutMs = 300_000;

export const PROVIDERS = {
  "claude-cli": { label: "Claude CLI", command: "claude" },
  "codex-cli": { label: "Codex CLI", command: "codex" },
};

export class AiError extends Error {
  constructor(code, message, { cause } = {}) {
    super(message, { cause });
    this.name = "AiError";
    this.code = code;
  }
}

/** CLI는 프롬프트 반복·경고까지 출력하므로, `ERROR:` 줄이 있으면 마지막 것만 원인으로 보여 준다. */
function failureDetail(stdout, stderr, code) {
  const output = `${stdout}\n${stderr}`;
  const errorLines = output.split("\n").filter((line) => /^ERROR:/.test(line.trim()));
  if (errorLines.length) return errorLines.at(-1).trim().replace(/^ERROR:\s*/, "");
  return (stderr.trim() || stdout.trim() || `종료 코드 ${code}`).slice(-800);
}

function runCli({ command, args, prompt, spawnImpl, timeoutMs }) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawnImpl(command, args, { stdio: ["pipe", "pipe", "pipe"] });
    } catch (error) {
      reject(new AiError("cli-missing", `${command} 실행에 실패했습니다: ${error.message}`, { cause: error }));
      return;
    }

    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(value);
    };
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      finish(new AiError("timeout", `${command} 응답이 ${timeoutMs / 1000}초를 넘겨 중단했습니다.`));
    }, timeoutMs);

    child.stdout.setEncoding?.("utf8");
    child.stderr.setEncoding?.("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      const missing = error.code === "ENOENT";
      finish(
        new AiError(
          missing ? "cli-missing" : "cli-failed",
          missing ? `${command} 명령을 찾을 수 없습니다. 설치와 PATH를 확인해 주세요.` : `${command} 실행 중 오류: ${error.message}`,
          { cause: error },
        ),
      );
    });
    child.on("close", (code) => {
      if (code === 0) return finish(null, { stdout, stderr });
      return finish(new AiError("cli-failed", `${command} 실행이 실패했습니다: ${failureDetail(stdout, stderr, code)}`));
    });
    child.stdin.on?.("error", () => {
      // 자식이 먼저 종료하면 EPIPE가 나는데, close 핸들러가 실제 원인을 보고한다.
    });
    child.stdin.end(prompt);
  });
}

async function runClaude({ model, prompt, spawnImpl, timeoutMs }) {
  const args = [
    "--print",
    "--output-format",
    "text",
    "--no-session-persistence",
    ...(model ? ["--model", model] : []),
    // 글만 쓰면 되므로 파일 수정·명령 실행 도구를 막는다.
    "--disallowed-tools",
    "Bash",
    "Edit",
    "Write",
    "NotebookEdit",
  ];
  const { stdout } = await runCli({ command: PROVIDERS["claude-cli"].command, args, prompt, spawnImpl, timeoutMs });
  return stdout.trim();
}

async function runCodex({ model, prompt, spawnImpl, timeoutMs }) {
  const workDirectory = await mkdtemp(join(tmpdir(), "report-dashboard-codex-"));
  const lastMessagePath = join(workDirectory, "last-message.txt");
  try {
    const args = [
      "exec",
      "--skip-git-repo-check",
      "--ephemeral",
      "--sandbox",
      "read-only",
      "--color",
      "never",
      "--output-last-message",
      lastMessagePath,
      ...(model ? ["--model", model] : []),
      "-",
    ];
    const { stdout } = await runCli({ command: PROVIDERS["codex-cli"].command, args, prompt, spawnImpl, timeoutMs });
    // codex exec는 진행 로그도 stdout에 찍으므로 최종 메시지 파일을 우선한다.
    try {
      return (await readFile(lastMessagePath, "utf8")).trim();
    } catch {
      return stdout.trim();
    }
  } finally {
    await rm(workDirectory, { force: true, recursive: true });
  }
}

const runners = { "claude-cli": runClaude, "codex-cli": runCodex };

/** 선택한 CLI에 프롬프트를 보내고 최종 텍스트를 받는다. */
export async function completeWithCli({ provider, model = "", prompt, spawnImpl = nodeSpawn, timeoutMs = cliTimeoutMs }) {
  const runner = runners[provider];
  if (!runner) throw new AiError("bad-provider", `알 수 없는 provider입니다: ${provider}`);
  const text = await runner({ model: String(model).trim(), prompt, spawnImpl, timeoutMs });
  if (text === "") throw new AiError("empty-response", `${PROVIDERS[provider].label}가 빈 응답을 반환했습니다.`);
  return text;
}
