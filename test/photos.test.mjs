import assert from "node:assert/strict";
import { test } from "node:test";

import sharp from "sharp";

import { buildPhotoPickPrompt, cropPhoto, downloadImage, isSafePhotoPath, parsePhotoPicks, searchCommons, searchUnsplash, shorterQuery } from "../lib/photos.mjs";

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

test("cropPhoto_anyImage_returnsTwoToOneJpeg", async () => {
  const input = await sharp({ create: { width: 800, height: 800, channels: 3, background: "#888" } }).png().toBuffer();
  const meta = await sharp(await cropPhoto(input)).metadata();
  assert.equal(meta.format, "jpeg");
  assert.equal(meta.width / meta.height, 2);
});

test("isSafePhotoPath_onlyAllowsAssetAndPhotoFolders", () => {
  assert.equal(isSafePhotoPath("data/photos/abc-123.jpg"), true);
  assert.equal(isSafePhotoPath("photos/abc-123.jpg"), true);
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

test("searchUnsplash_results_mapsToCandidatesWithAttribution", async () => {
  const requested = [];
  const fetchImpl = async (url, init) => {
    requested.push({ url: String(url), init });
    return {
      ok: true,
      json: async () => ({
        results: [{
          id: "abc",
          alt_description: "a boy studying at desk",
          description: null,
          urls: { regular: "https://images.unsplash.com/photo-1?w=1080", small: "https://images.unsplash.com/photo-1?w=400" },
          user: { name: "Jane Doe" },
          links: { download_location: "https://api.unsplash.com/photos/abc/download" },
        }],
      }),
    };
  };
  const [first] = await searchUnsplash("student desk", { accessKey: "KEY", fetchImpl });
  assert.equal(first.title, "a boy studying at desk");
  assert.equal(first.credit, "Jane Doe on Unsplash");
  assert.equal(first.source, "unsplash");
  assert.equal(first.thumbUrl, "https://images.unsplash.com/photo-1?w=400");
  assert.equal(requested[0].init.headers.Authorization, "Client-ID KEY");
  assert.match(requested[0].url, /orientation=landscape/);
});

test("downloadImage_unsplashHost_isAllowed", async () => {
  const fetchImpl = async () => ({ ok: true, arrayBuffer: async () => new Uint8Array([1]).buffer });
  const buffer = await downloadImage("https://images.unsplash.com/photo-1?w=1080", { fetchImpl });
  assert.equal(buffer.length, 1);
});

test("shorterQuery_longQuery_dropsWordsFromTheEnd", () => {
  assert.equal(shorterQuery("student studying alone laptop"), "student studying");
  assert.equal(shorterQuery("robot"), "");
});

test("parsePhotoPicks_validAnswer_clampsToCandidateRange", () => {
  assert.deepEqual(parsePhotoPicks('{"picks":[2, 9]}', [3, 4]), [2, 0]);
  assert.deepEqual(parsePhotoPicks("엉뚱한 답", [3, 4]), [0, 0]);
});

test("buildPhotoPickPrompt_listsCaptionsAndCandidateDescriptions", () => {
  const prompt = buildPhotoPickPrompt([
    { tag: "문제 상황", caption: "버려지는 급식", candidates: [{ title: "food waste in bin" }, { title: "a cat" }] },
  ]);
  assert.match(prompt, /버려지는 급식/);
  assert.match(prompt, /1\. a cat/);
});
