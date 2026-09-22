import assert from "node:assert/strict";
import { test } from "node:test";

import { exampleReport } from "../lib/example.mjs";
import { buildGeneratePrompt, buildSectionPrompt, inputOf } from "../lib/prompt.mjs";

const inputWithLevel = (level) => ({ ...inputOf(exampleReport), level });
const thisStudentPart = (prompt) => prompt.slice(prompt.indexOf("# 이번 학생 입력"));

test("buildGeneratePrompt_elementaryLevel_usesElementaryMath", () => {
  const prompt = buildGeneratePrompt(inputWithLevel("초등"));
  assert.match(thisStudentPart(prompt), /학교급\(난이도\): 초등/);
  assert.match(prompt, /초등학생 수준/);
  assert.match(prompt, /분수/);
  assert.doesNotMatch(prompt, /미분/);
});

test("buildGeneratePrompt_highLevel_usesHighSchoolMath", () => {
  const prompt = buildGeneratePrompt(inputWithLevel("고등"));
  assert.match(prompt, /고등학생 수준/);
  assert.match(prompt, /미분/);
});

test("buildGeneratePrompt_missingLevel_defaultsToMiddleSchool", () => {
  const prompt = buildGeneratePrompt(inputWithLevel(undefined));
  assert.match(thisStudentPart(prompt), /학교급\(난이도\): 중등/);
  assert.match(prompt, /중학생 수준/);
});

test("buildSectionPrompt_reportLevel_isPassedThrough", () => {
  const prompt = buildSectionPrompt({ ...exampleReport, level: "고등" }, ["paper"], { label: "탐구" });
  assert.match(prompt, /학교급\(난이도\): 고등/);
  assert.match(prompt, /고등학생 수준/);
});
