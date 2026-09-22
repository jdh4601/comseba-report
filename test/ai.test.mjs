import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { writeFileSync } from "node:fs";
import { test } from "node:test";

import { AiError, completeWithCli } from "../lib/ai.mjs";

/** 실제 CLI 대신 정해진 출력을 내는 가짜 자식 프로세스. */
function fakeSpawn({ stdout = "", code = 0, onArgs } = {}) {
  const calls = [];
  const spawnImpl = (command, args) => {
    calls.push({ command, args });
    onArgs?.(args);
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdout.setEncoding = () => {};
    child.stderr.setEncoding = () => {};
    child.kill = () => {};
    let input = "";
    child.stdin = Object.assign(new EventEmitter(), {
      end: (text) => {
        input = text;
        calls.at(-1).input = input;
        setImmediate(() => {
          if (stdout) child.stdout.emit("data", stdout);
          child.emit("close", code);
        });
      },
    });
    return child;
  };
  return { spawnImpl, calls };
}

test("completeWithCli_claude_passesPromptOnStdinAndReturnsStdout", async () => {
  const { spawnImpl, calls } = fakeSpawn({ stdout: "  {\"ok\":true}\n" });
  const text = await completeWithCli({ provider: "claude-cli", model: "sonnet", prompt: "안녕", spawnImpl });
  assert.equal(text, "{\"ok\":true}");
  assert.equal(calls[0].command, "claude");
  assert.ok(calls[0].args.includes("--print"));
  assert.deepEqual(calls[0].args.slice(calls[0].args.indexOf("--model"), calls[0].args.indexOf("--model") + 2), ["--model", "sonnet"]);
  assert.equal(calls[0].input, "안녕");
});

test("completeWithCli_codex_readsLastMessageFile", async () => {
  const { spawnImpl, calls } = fakeSpawn({
    stdout: "진행 로그",
    onArgs: (args) => writeFileSync(args[args.indexOf("--output-last-message") + 1], "최종 답변"),
  });
  const text = await completeWithCli({ provider: "codex-cli", prompt: "질문", spawnImpl });
  assert.equal(text, "최종 답변");
  assert.equal(calls[0].command, "codex");
  assert.equal(calls[0].args[0], "exec");
  assert.ok(!calls[0].args.includes("--model"));
});

test("completeWithCli_nonZeroExit_throwsCliFailed", async () => {
  const { spawnImpl } = fakeSpawn({ code: 1 });
  await assert.rejects(completeWithCli({ provider: "claude-cli", prompt: "x", spawnImpl }), (error) => {
    assert.ok(error instanceof AiError);
    assert.equal(error.code, "cli-failed");
    return true;
  });
});

test("completeWithCli_unknownProvider_throwsBadProvider", async () => {
  await assert.rejects(completeWithCli({ provider: "gpt", prompt: "x" }), /provider/);
});

test("completeWithCli_failureWithErrorLines_reportsLastErrorLineOnly", async () => {
  const { spawnImpl } = fakeSpawn({ code: 1, stdout: "user\n프롬프트 반복\nwarning: 무관한 경고\nERROR: You've hit your usage limit.\n" });
  await assert.rejects(completeWithCli({ provider: "codex-cli", prompt: "x", spawnImpl }), (error) => {
    assert.equal(error.message, "codex 실행이 실패했습니다: You've hit your usage limit.");
    return true;
  });
});

// ---------- API providers ----------
import { PROVIDERS, complete } from "../lib/ai.mjs";

test("complete_openaiApi_sendsBearerKeyAndDefaultModel", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: " 답변 " } }] }) };
  };
  const text = await complete({ provider: "openai-api", prompt: "질문", keys: { openai: "sk-test" }, fetchImpl });
  assert.equal(text, "답변");
  assert.equal(calls[0].url, "https://api.openai.com/v1/chat/completions");
  assert.equal(calls[0].init.headers.Authorization, "Bearer sk-test");
  assert.equal(calls[0].body.model, "gpt-5.4");
  assert.deepEqual(calls[0].body.messages, [{ role: "user", content: "질문" }]);
});

test("complete_openaiApiRejectedKey_throwsAuth", async () => {
  const fetchImpl = async () => ({ ok: false, status: 401, json: async () => ({ error: { message: "Incorrect API key" } }) });
  await assert.rejects(complete({ provider: "openai-api", prompt: "x", keys: { openai: "bad" }, fetchImpl }), (error) => {
    assert.equal(error.code, "auth");
    assert.match(error.message, /Incorrect API key/);
    return true;
  });
});

test("complete_claudeApi_usesSdkWithDefaultModel", async () => {
  const requests = [];
  const createAnthropic = ({ apiKey }) => ({
    messages: {
      create: async (request) => {
        requests.push({ apiKey, request });
        return { stop_reason: "end_turn", content: [{ type: "text", text: "{\"ok\":true}" }] };
      },
    },
  });
  const text = await complete({ provider: "claude-api", prompt: "질문", keys: { anthropic: "sk-ant" }, createAnthropic });
  assert.equal(text, "{\"ok\":true}");
  assert.equal(requests[0].apiKey, "sk-ant");
  assert.equal(requests[0].request.model, "claude-sonnet-5");
  assert.deepEqual(requests[0].request.messages, [{ role: "user", content: "질문" }]);
});

test("complete_claudeApiRefusal_throwsRefusal", async () => {
  const createAnthropic = () => ({ messages: { create: async () => ({ stop_reason: "refusal", content: [] }) } });
  await assert.rejects(complete({ provider: "claude-api", prompt: "x", keys: { anthropic: "k" }, createAnthropic }), /거부/);
});

test("complete_apiWithoutKey_throwsMissingKey", async () => {
  await assert.rejects(complete({ provider: "claude-api", prompt: "x", keys: {} }), (error) => {
    assert.equal(error.code, "missing-key");
    return true;
  });
});

test("complete_claudeCliWithoutModel_usesSonnet", async () => {
  const { spawnImpl, calls } = fakeSpawn({ stdout: "OK" });
  assert.equal(await complete({ provider: "claude-cli", prompt: "x", spawnImpl }), "OK");
  assert.equal(calls[0].command, "claude");
  assert.equal(calls[0].args[calls[0].args.indexOf("--model") + 1], "sonnet");
});

test("PROVIDERS_claudeModels_offerSonnetHaikuOpusWithSonnetFirst", () => {
  for (const id of ["claude-api", "claude-cli"]) {
    const labels = PROVIDERS[id].models.map((model) => model.label);
    assert.deepEqual(labels.map((label) => label.split(" ")[0]), ["Sonnet", "Haiku", "Opus"]);
    assert.equal(PROVIDERS[id].defaultModel, PROVIDERS[id].models[0].id);
  }
});
