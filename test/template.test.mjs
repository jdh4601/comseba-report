import assert from "node:assert/strict";
import { test } from "node:test";

import JSZip from "jszip";

import { exampleReport } from "../lib/example.mjs";
import { EMBEDDED_ASSETS } from "../lib/embedded-assets.mjs";
import { buildDeck } from "../lib/template.mjs";


async function slideXml(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const names = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort();
  return Promise.all(names.map((name) => zip.file(name).async("string")));
}

test("buildDeck_exampleReport_writesThreeSlidesWithStudentContent", async () => {
  const slides = await slideXml(await buildDeck(exampleReport));
  assert.equal(slides.length, 3);
  assert.match(slides[0], /60분 융합 체험수업/);
  assert.match(slides[1], /급식 시간마다 버려지는 음식이 너무 많아요/);
  assert.match(slides[1], /데이터 분석·시각화/);
  assert.match(slides[2], /문제 해결 아이디어 구체화/);
  assert.match(slides[2], /AI 잔반 예측 모델의 원리/);
  assert.match(slides[2], /570cjk/);
});

test("buildDeck_anyReport_usesHangulCharsetNotGb2312", async () => {
  const slides = await slideXml(await buildDeck(exampleReport));
  for (const xml of slides) assert.doesNotMatch(xml, /charset="-122"/);
});

test("buildDeck_mainOutsideChipList_showsItAsMainChip", async () => {
  const report = structuredClone(exampleReport);
  report.interest = { main: "드론", sub: "빅데이터" };
  const slides = await slideXml(await buildDeck(report));
  assert.match(slides[1], /드론/);
});

test("buildDeck_unsplashPhotos_creditsWithoutCommonsSuffix", async () => {
  const report = structuredClone(exampleReport);
  report.photos = report.photos.map((photo) => ({ ...photo, source: "unsplash", credit: "Jane Doe on Unsplash" }));
  const slides = await slideXml(await buildDeck(report));
  assert.match(slides[2], /Photos: Jane Doe on Unsplash \/ Jane Doe on Unsplash/);
  assert.doesNotMatch(slides[2], /Wikimedia/);
});

test("buildDeck_storedPhoto_loadsImageThroughLoader", async () => {
  const report = structuredClone(exampleReport);
  report.photos[0].file = "photos/abc.jpg";
  const requested = [];
  const loadImage = async (ref) => {
    requested.push(ref);
    return Buffer.from(EMBEDDED_ASSETS["assets/photo_lunch.jpg"].base64, "base64");
  };
  const zip = await JSZip.loadAsync(await buildDeck(report, { loadImage }));
  assert.deepEqual(requested, ["photos/abc.jpg"]);
  assert.ok(Object.keys(zip.files).filter((name) => name.startsWith("ppt/media/")).length >= 3);
});
