import Anthropic from "@anthropic-ai/sdk";
import { spawn as nodeSpawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** 보고서 한 벌을 쓰는 데 1~2분이 걸리므로, 매달린 프로세스만 끊을 만큼 넉넉히 잡는다. */
const cliTimeoutMs = 300_000;

const maxOutputTokens = 16_000;

/** CLI는 별칭(sonnet 등)을, API는 정식 모델 ID를 받는다. 목록의 첫 모델이 기본값이다. */
const CLAUDE_API_MODELS = [
  { id: "claude-sonnet-5", label: "Sonnet 5 (기본 · 균형)" },
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5 (빠름 · 저렴)" },
  { id: "claude-opus-5", label: "Opus 5 (최고 품질)" },
];
const CLAUDE_CLI_MODELS = [
  { id: "sonnet", label: "Sonnet (기본 · 균형)" },
  { id: "haiku", label: "Haiku (빠름)" },
  { id: "opus", label: "Opus (최고 품질)" },
];

/**
 * models가 있으면 화면에서 목록으로 고르고, 없으면 모델 이름을 직접 입력한다(빈칸이면 defaultModel).
 * keyName은 설정의 apiKeys 안의 이름, keyEnv는 설정이 비었을 때 대신 읽는 환경변수.
 */
export const PROVIDERS = {
  "claude-cli": { label: "Claude CLI", kind: "cli", command: "claude", models: CLAUDE_CLI_MODELS, defaultModel: "sonnet" },
  "codex-cli": { label: "Codex CLI", kind: "cli", command: "codex", defaultModel: "" },
  "claude-api": { label: "Claude API", kind: "api", keyName: "anthropic", keyEnv: "ANTHROPIC_API_KEY", models: CLAUDE_API_MODELS, defaultModel: "claude-sonnet-5" },
  "openai-api": { label: "OpenAI API", kind: "api", keyName: "openai", keyEnv: "OPENAI_API_KEY", defaultModel: "gpt-5.4" },
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
  if (!runner) throw new AiError("bad-provider", `알 수 없는 CLI provider입니다: ${provider}`);
  const text = await runner({ model: String(model).trim(), prompt, spawnImpl, timeoutMs });
  if (text === "") throw new AiError("empty-response", `${PROVIDERS[provider].label}가 빈 응답을 반환했습니다.`);
  return text;
}

// ---------- API providers ----------

function httpErrorCode(status) {
  if (status === 401 || status === 403) return "auth";
  if (status === 429) return "rate-limit";
  if (status >= 500) return "upstream";
  return "api";
}

async function completeWithOpenAi({ apiKey, model, prompt, fetchImpl }) {
  let response;
  try {
    response = await fetchImpl("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], max_completion_tokens: maxOutputTokens }),
    });
  } catch (error) {
    throw new AiError("network", `OpenAI에 연결하지 못했습니다: ${error.message}`, { cause: error });
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = body?.error?.message ?? `HTTP ${response.status}`;
    const hint = response.status === 401 ? " 설정에서 OpenAI API 키를 확인해 주세요." : response.status === 429 ? " 사용량 한도나 결제 상태를 확인해 주세요." : "";
    throw new AiError(httpErrorCode(response.status), `OpenAI API 오류: ${detail}.${hint}`);
  }
  return String(body?.choices?.[0]?.message?.content ?? "").trim();
}

function mapAnthropicError(error) {
  if (error instanceof Anthropic.AuthenticationError) return new AiError("auth", `Claude API 키가 거부되었습니다. 설정에서 키를 확인해 주세요. (${error.message})`, { cause: error });
  if (error instanceof Anthropic.RateLimitError) return new AiError("rate-limit", "Claude API 사용량 한도에 걸렸습니다. 잠시 후 다시 시도해 주세요.", { cause: error });
  if (error instanceof Anthropic.APIConnectionError) return new AiError("network", `Anthropic에 연결하지 못했습니다: ${error.message}`, { cause: error });
  if (error instanceof Anthropic.APIError) return new AiError(httpErrorCode(error.status), `Claude API 오류: ${error.message}`, { cause: error });
  return new AiError("api", error.message, { cause: error });
}

async function completeWithClaudeApi({ apiKey, model, prompt, createAnthropic }) {
  let response;
  try {
    response = await createAnthropic({ apiKey }).messages.create({
      model,
      max_tokens: maxOutputTokens,
      messages: [{ role: "user", content: prompt }],
    });
  } catch (error) {
    throw error instanceof AiError ? error : mapAnthropicError(error);
  }
  if (response.stop_reason === "refusal") {
    throw new AiError("refusal", "Claude가 이 요청을 거부했습니다. 입력 내용을 바꿔 다시 시도해 주세요.");
  }
  return response.content.filter((block) => block.type === "text").map((block) => block.text).join("").trim();
}

const defaultAnthropic = ({ apiKey }) => new Anthropic({ apiKey });

/**
 * 설정된 provider로 프롬프트를 보내고 최종 텍스트를 받는다.
 * keys는 { anthropic, openai } 형태이며, 비어 있으면 PROVIDERS의 keyEnv 환경변수를 읽는다.
 */
export async function complete({
  provider,
  model = "",
  prompt,
  keys = {},
  env = process.env,
  fetchImpl = globalThis.fetch,
  createAnthropic = defaultAnthropic,
  spawnImpl = nodeSpawn,
}) {
  const spec = PROVIDERS[provider];
  if (!spec) throw new AiError("bad-provider", `알 수 없는 provider입니다: ${provider}`);
  // 다른 provider에서 쓰던 모델 이름이 남아 있으면 무시하고 이 provider의 기본 모델을 쓴다.
  const typed = String(model).trim();
  const resolvedModel = spec.models && !spec.models.some((item) => item.id === typed) ? spec.defaultModel : typed || spec.defaultModel;
  if (spec.kind === "cli") return completeWithCli({ provider, model: resolvedModel, prompt, spawnImpl });

  const apiKey = String(keys[spec.keyName] || env[spec.keyEnv] || "").trim();
  if (!apiKey) throw new AiError("missing-key", `${spec.label} 키가 없습니다. ⚙ 설정에서 키를 입력해 주세요.`);

  const text =
    provider === "openai-api"
      ? await completeWithOpenAi({ apiKey, model: resolvedModel, prompt, fetchImpl })
      : await completeWithClaudeApi({ apiKey, model: resolvedModel, prompt, createAnthropic });
  if (text === "") throw new AiError("empty-response", `${spec.label}가 빈 응답을 반환했습니다.`);
  return text;
}
