import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { exampleReport } from "../lib/example.mjs";
import { createFileStore } from "../lib/store.mjs";

async function withStore(run) {
  const dir = await mkdtemp(join(tmpdir(), "store-test-"));
  try {
    await run(createFileStore(dir));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("fileStore_savePhoto_readsBackByRef", () =>
  withStore(async (store) => {
    const ref = await store.savePhoto(Buffer.from("jpeg-bytes"));
    assert.match(ref, /^photos\/[\w-]+\.jpg$/);
    assert.equal((await store.readPhoto(ref)).toString(), "jpeg-bytes");
    assert.equal(await store.readPhoto("photos/missing.jpg"), null);
  }));

test("fileStore_saveReport_listsAndLoads", () =>
  withStore(async (store) => {
    const report = { ...structuredClone(exampleReport), student: { ...exampleReport.student, name: "김민준" } };
    const id = await store.saveReport(report);
    assert.equal(id, "20260922_김민준");
    const [item] = await store.listReports();
    assert.equal(item.id, id);
    assert.equal((await store.loadReport(id)).student.name, "김민준");
  }));

test("fileStore_saveSettingsWithBlankKey_keepsPreviousKey", () =>
  withStore(async (store) => {
    await store.saveSettings({ provider: "claude-api", model: "", anthropicKey: "first" });
    const saved = await store.saveSettings({ provider: "claude-api", model: "claude-opus-5", anthropicKey: "" });
    assert.equal(saved.anthropicKey, "first");
    assert.equal(saved.model, "claude-opus-5");
  }));
