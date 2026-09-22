import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import sharp from "sharp";

import { cropPhoto, downloadImage, isSafePhotoPath, searchCommons } from "../lib/photos.mjs";

const page = (title, license, extra = {}) => ({
  title,
  imageinfo: [{
    thumburl: `https://upload.example/${title}/thumb.jpg`,
    url: `https://upload.example/${title}`,
    width: 2000,
    height: 1500,
    mime: "image/jpeg",
    extmetadata: { LicenseShortName: { value: license }, Artist: { value: "<a href='x'>Kim</a>" } },
    ...extra,
  }],
});

test("searchCommons_mixedLicenses_keepsOnlyReusableBitmaps", async () => {
  const requested = [];
  const fetchImpl = async (url, init) => {
    requested.push({ url: String(url), init });
    return {
      ok: true,
      json: async () => ({
        query: {
          pages: {
            1: page("File:A.jpg", "CC BY-SA 4.0"),
            2: page("File:B.jpg", "All rights reserved"),
            3: page("File:C.pdf", "Public domain", { mime: "application/pdf" }),
            4: page("File:D.jpg", "CC0"),
          },
        },
      }),
    };
  };
  const results = await searchCommons("school lunch", { fetchImpl });
  assert.deepEqual(results.map((item) => item.title), ["A.jpg", "D.jpg"]);
  assert.equal(results[0].credit, "Kim, CC BY-SA 4.0");
  assert.match(requested[0].url, /filetype%3Abitmap/);
  assert.ok(requested[0].init.headers["User-Agent"]);
});

test("cropPhoto_anyImage_writesTwoToOneJpeg", async () => {
  const dir = await mkdtemp(join(tmpdir(), "photos-test-"));
  try {
    const input = await sharp({ create: { width: 800, height: 800, channels: 3, background: "#888" } }).png().toBuffer();
    const out = join(dir, "x.jpg");
    await cropPhoto(input, out);
    const meta = await sharp(out).metadata();
    assert.equal(meta.format, "jpeg");
    assert.equal(meta.width / meta.height, 2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("isSafePhotoPath_onlyAllowsAssetAndPhotoFolders", () => {
  assert.equal(isSafePhotoPath("data/photos/abc-123.jpg"), true);
  assert.equal(isSafePhotoPath("assets/photo_lunch.jpg"), true);
  assert.equal(isSafePhotoPath("../secret.jpg"), false);
  assert.equal(isSafePhotoPath("/etc/passwd"), false);
  assert.equal(isSafePhotoPath("data/photos/../../x.jpg"), false);
});

test("downloadImage_wikimediaThumbHost_isAllowed", async () => {
  const fetchImpl = async () => ({ ok: true, arrayBuffer: async () => new Uint8Array([1, 2]).buffer });
  const buffer = await downloadImage("https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/x.jpg/1600px-x.jpg", { fetchImpl });
  assert.equal(buffer.length, 2);
  await assert.rejects(downloadImage("https://evil.example/x.jpg", { fetchImpl }), /Wikimedia/);
});
