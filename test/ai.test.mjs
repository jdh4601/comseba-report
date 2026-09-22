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
