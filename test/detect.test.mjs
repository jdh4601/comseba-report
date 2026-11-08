import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { detectCliProvider, isCommandOnPath } from "../lib/ai.mjs";
import { createFileStore } from "../lib/store.mjs";

const installed = (...commands) => (command) => commands.includes(command);

test("detectCliProvider prefers Claude CLI when both CLIs are installed", () => {
  assert.equal(detectCliProvider({ isInstalled: installed("claude", "codex") }), "claude-cli");
});

test("detectCliProvider falls back to Codex CLI when only codex is installed", () => {
  assert.equal(detectCliProvider({ isInstalled: installed("codex") }), "codex-cli");
});

test("detectCliProvider keeps Claude CLI as the default when no CLI is installed", () => {
  assert.equal(detectCliProvider({ isInstalled: installed() }), "claude-cli");
});

test("isCommandOnPath finds an executable file in PATH", () => {
  const dir = mkdtempSync(join(tmpdir(), "detect-"));
  try {
    const bin = join(dir, "codex");
    writeFileSync(bin, "#!/bin/sh\n");
    chmodSync(bin, 0o755);
    assert.equal(isCommandOnPath("codex", { PATH: dir }), true);
    assert.equal(isCommandOnPath("claude", { PATH: dir }), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("file store uses the detected provider until settings are saved", async () => {
  const dir = mkdtempSync(join(tmpdir(), "store-default-"));
  try {
    const store = createFileStore(dir, { defaultProvider: "codex-cli" });
    assert.equal((await store.loadSettings()).provider, "codex-cli");
    await store.saveSettings({ provider: "claude-cli", model: "" });
    assert.equal((await store.loadSettings()).provider, "claude-cli");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
