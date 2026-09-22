import { COUNTS, FIELD_ALIASES, LIMITS, charCount, resolvePath } from "./schema.mjs";

const QUOTE_MARKS = /^[\s"'“”‘’「」『』]+|[\s"'“”‘’「」『』]+$/g;

/** AI가 흔히 덧붙이는 따옴표·앞뒤 공백을 걷어낸다. 템플릿이 문제 문장에 따옴표를 직접 붙이기 때문이다. */
export function normalizeReport(report) {
  const next = structuredClone(report);
  if (next.problem?.quote) next.problem.quote = next.problem.quote.replace(QUOTE_MARKS, "");
  return next;
}

function fieldTerms(field) {
  return FIELD_ALIASES[field] ?? [field];
}

function mentions(text, field) {
  if (!field) return true;
  return fieldTerms(field).some((term) => text.includes(term));
}

function inSections(path, sectionKeys) {
  if (!sectionKeys) return true;
  return sectionKeys.some((key) => path === key || path.startsWith(`${key}.`));
}

function checkLimits(report, sectionKeys) {
  const errors = [];
  for (const [genericPath, min, max] of LIMITS) {
    if (!inSections(genericPath, sectionKeys)) continue;
    for (const [path, value] of resolvePath(report, genericPath)) {
      if (typeof value !== "string" || value.trim() === "") {
        errors.push({ path, code: "missing", message: `${path} 값이 비어 있습니다.` });
        continue;
      }
      const length = charCount(value);
      if (length > max) errors.push({ path, code: "too-long", message: `${path}: ${length}자 → ${max}자 이하로 줄여야 합니다.` });
      if (length < min) errors.push({ path, code: "too-short", message: `${path}: ${length}자 → ${min}자 이상으로 늘려야 합니다.` });
    }
  }
  return errors;
}

function checkCounts(report, sectionKeys) {
  const errors = [];
  for (const [path, expected] of Object.entries(COUNTS)) {
    if (!inSections(path, sectionKeys)) continue;
    const [[, value]] = resolvePath(report, path);
    const actual = Array.isArray(value) ? value.length : 0;
    if (actual !== expected) errors.push({ path, code: "count", message: `${path}는 정확히 ${expected}개여야 합니다 (현재 ${actual}개).` });
  }
  return errors;
}

function checkConsistency(report, sectionKeys) {
  const errors = [];
  const { main, sub } = report.interest ?? {};

  if (inSections("solution", sectionKeys)) {
    const solutionText = [report.solution?.summary, ...(report.solution?.steps ?? []).flatMap((step) => [step?.name, step?.desc])].join(" ");
    if (!mentions(solutionText, main)) {
      errors.push({ path: "solution", code: "main-missing", message: `해결 아이디어나 과정에 MAIN 분야(${main})가 드러나야 합니다.` });
    }
  }

  if (inSections("coreTech", sectionKeys)) {
    const techText = [...(report.coreTech ?? []), ...(report.supportTech ?? [])].flatMap((tech) => [tech?.name, tech?.role]).join(" ");
    if (!mentions(techText, sub)) {
      errors.push({ path: "coreTech", code: "sub-missing", message: `핵심·지원 기술에 SUB 분야(${sub})가 드러나야 합니다.` });
    }
  }

  if (inSections("paper.abstract", sectionKeys) && typeof report.paper?.abstract === "string" && !report.paper.abstract.includes("수학")) {
    errors.push({ path: "paper.abstract", code: "math-missing", message: "Abstract에 '수학'이라는 단어로 수학과의 연결을 밝혀야 합니다." });
  }
  return errors;
}

/**
 * 글자 수·개수·내용 일관성을 점검한다.
 * sections를 주면 그 섹션에 속한 키만 본다(섹션 재생성 결과 확인용).
 */
export function validateReport(report, { sections } = {}) {
  const sectionKeys = sections ?? null;
  return {
    errors: [...checkCounts(report, sectionKeys), ...checkLimits(report, sectionKeys), ...checkConsistency(report, sectionKeys)],
  };
}
