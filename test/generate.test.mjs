import assert from "node:assert/strict";
import { test } from "node:test";

import { exampleReport } from "../lib/example.mjs";
import { extractJson, generateReport, pickGenerated, regenerateSection } from "../lib/generate.mjs";

const input = {
  student: exampleReport.student,
  interest: exampleReport.interest,
  problemQuote: exampleReport.problem.quote,
  memo: "",
};

const generatedJson = () => JSON.stringify(pickGenerated(exampleReport));

test("extractJson_fencedOutputWithProse_returnsObject", () => {
  const text = "다음과 같습니다.\n```json\n{\"a\": {\"b\": 1}}\n```\n끝";
  assert.deepEqual(extractJson(text), { a: { b: 1 } });
});

test("extractJson_noJson_throws", () => {
  assert.throws(() => extractJson("JSON이 없습니다"), /JSON/);
});

test("generateReport_validFirstAnswer_mergesInputAndGenerated", async () => {
  const prompts = [];
  const result = await generateReport({
    input,
    complete: async (prompt) => {
      prompts.push(prompt);
      return generatedJson();
    },
  });
  assert.equal(prompts.length, 1);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.report.student.name, "[ 학생명 ]");
  assert.equal(result.report.solution.steps.length, 4);
  assert.equal(result.report.photos[0].tag, "문제 상황");
  assert.match(prompts[0], /급식 시간마다/);
});

test("generateReport_invalidThenFixed_repairsWithErrorFeedback", async () => {
  const broken = pickGenerated(exampleReport);
  broken.solution.steps = broken.solution.steps.slice(0, 3);
  const answers = [JSON.stringify(broken), generatedJson()];
  const prompts = [];
  const result = await generateReport({
    input,
    complete: async (prompt) => {
      prompts.push(prompt);
      return answers.shift();
    },
  });
  assert.equal(prompts.length, 2);
  assert.match(prompts[1], /solution\.steps/);
  assert.deepEqual(result.warnings, []);
});

test("generateReport_stillInvalidAfterRepairs_returnsWarnings", async () => {
  const broken = pickGenerated(exampleReport);
  broken.reason = "짧음";
  const result = await generateReport({ input, maxRepairs: 1, complete: async () => JSON.stringify(broken) });
  assert.ok(result.warnings.some((warning) => warning.path === "reason"));
});

test("regenerateSection_paper_replacesOnlyPaper", async () => {
  const newPaper = structuredClone(exampleReport.paper);
  newPaper.titleLines = ["새로운 제목 첫째 줄을 이렇게 씁니다", "둘째 줄입니다"];
  const result = await regenerateSection({
    report: exampleReport,
    section: "paper",
    complete: async () => JSON.stringify({ paper: newPaper }),
  });
  assert.equal(result.report.paper.titleLines[0], "새로운 제목 첫째 줄을 이렇게 씁니다");
  assert.deepEqual(result.report.problem, exampleReport.problem);
});
