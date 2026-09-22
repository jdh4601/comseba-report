import assert from "node:assert/strict";
import { test } from "node:test";

import { exampleReport } from "../lib/example.mjs";
import { normalizeReport, validateReport } from "../lib/validate.mjs";

const clone = (value) => structuredClone(value);
const codes = (result) => result.errors.map((error) => `${error.path}:${error.code}`);

test("validateReport_exampleReport_hasNoErrors", () => {
  assert.deepEqual(validateReport(exampleReport).errors, []);
});

test("validateReport_textOverLimit_reportsTooLong", () => {
  const report = clone(exampleReport);
  report.solution.steps[1].desc = "가".repeat(40);
  assert.ok(codes(validateReport(report)).includes("solution.steps.1.desc:too-long"));
});

test("validateReport_wrongStepCount_reportsCount", () => {
  const report = clone(exampleReport);
  report.solution.steps.push({ name: "추가", desc: "다섯 번째 단계를 넣은 잘못된 결과입니다" });
  assert.ok(codes(validateReport(report)).includes("solution.steps:count"));
});

test("validateReport_missingField_reportsMissing", () => {
  const report = clone(exampleReport);
  delete report.problem.goal;
  assert.ok(codes(validateReport(report)).includes("problem.goal:missing"));
});

test("validateReport_mainFieldAbsentFromSolution_reportsMainMissing", () => {
  const report = clone(exampleReport);
  report.solution.summary = report.solution.summary.replaceAll("AI", "컴퓨터");
  report.solution.steps[2] = { name: "예측", desc: "메뉴·요일·날씨로 다음 날 잔반량을 계산하는 방법 설계" };
  assert.ok(codes(validateReport(report)).includes("solution:main-missing"));
});

test("validateReport_abstractWithoutMath_reportsMathMissing", () => {
  const report = clone(exampleReport);
  report.paper.abstract = report.paper.abstract.replace("수학적", "체계적");
  assert.ok(codes(validateReport(report)).includes("paper.abstract:math-missing"));
});

test("validateReport_sectionFilter_checksOnlyThatSection", () => {
  const report = clone(exampleReport);
  report.paper.intro = "짧다";
  report.problem.quote = "가".repeat(40);
  assert.deepEqual(codes(validateReport(report, { sections: ["paper"] })), ["paper.intro:too-short"]);
});

test("normalizeReport_quoteWithQuotationMarks_stripsThem", () => {
  const report = clone(exampleReport);
  report.problem.quote = "“급식 시간마다 버려지는 음식이 너무 많아요.”";
  assert.equal(normalizeReport(report).problem.quote, "급식 시간마다 버려지는 음식이 너무 많아요.");
});
