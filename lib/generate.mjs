import { buildGeneratePrompt, buildRepairPrompt, buildSectionPrompt, pickGenerated } from "./prompt.mjs";
import { PHOTO_TAGS, SECTIONS } from "./schema.mjs";
import { normalizeReport, validateReport } from "./validate.mjs";

export { pickGenerated };

export class GenerateError extends Error {
  constructor(message, { cause } = {}) {
    super(message, { cause });
    this.name = "GenerateError";
  }
}

/** CLI 출력에서 JSON 객체를 꺼낸다. 코드 블록이나 앞뒤 설명이 섞여 와도 첫 `{`부터 마지막 `}`까지를 쓴다. */
export function extractJson(text) {
  const source = String(text ?? "");
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start === -1 || end <= start) throw new GenerateError("AI 응답에서 JSON을 찾지 못했습니다.");
  try {
    return JSON.parse(source.slice(start, end + 1));
  } catch (error) {
    throw new GenerateError(`AI 응답의 JSON을 해석하지 못했습니다: ${error.message}`, { cause: error });
  }
}

/** 사진은 AI가 설명·검색어만 쓰고, 이미 고른 파일과 출처는 유지한다. */
function mergePhotos(existing = [], generated = []) {
  return PHOTO_TAGS.map((tag, index) => ({
    tag,
    file: existing[index]?.file ?? "",
    source: existing[index]?.source ?? "",
    credit: existing[index]?.credit ?? "",
    caption: generated[index]?.caption ?? existing[index]?.caption ?? "",
    query: generated[index]?.query ?? existing[index]?.query ?? "",
  }));
}

function merge(base, generated, keys) {
  const next = structuredClone(base);
  for (const key of keys) {
    if (!(key in generated)) continue;
    next[key] = key === "photos" ? mergePhotos(base.photos, generated.photos) : generated[key];
  }
  return normalizeReport(next);
}

function reportFromInput(input) {
  return {
    student: input.student,
    interest: input.interest,
    memo: input.memo ?? "",
    problem: { quote: input.problemQuote },
    photos: mergePhotos(),
  };
}

async function askJson(complete, prompt) {
  return extractJson(await complete(prompt));
}

/**
 * 입력 정보로 2·3페이지 전체를 생성한다.
 * 점검에 실패하면 오류 목록을 돌려주며 최대 maxRepairs번 고쳐 쓰게 하고, 그래도 남은 오류는 warnings로 반환한다.
 */
export async function generateReport({ input, complete, maxRepairs = 2 }) {
  const keys = Object.values(SECTIONS).flatMap((section) => section.keys);
  const base = reportFromInput(input);

  let generated = await askJson(complete, buildGeneratePrompt(input));
  let report = merge(base, generated, keys);
  let { errors } = validateReport(report);

  for (let attempt = 0; attempt < maxRepairs && errors.length > 0; attempt += 1) {
    generated = await askJson(complete, buildRepairPrompt(input, pickGenerated(report), errors));
    report = merge(base, generated, keys);
    ({ errors } = validateReport(report));
  }

  return { report, warnings: errors };
}

/** 한 섹션만 다시 쓴다. 다른 섹션은 그대로 두고 참고 자료로만 넘긴다. */
export async function regenerateSection({ report, section, complete, maxRepairs = 1 }) {
  const spec = SECTIONS[section];
  if (!spec) throw new GenerateError(`알 수 없는 섹션입니다: ${section}`);

  let next = merge(report, await askJson(complete, buildSectionPrompt(report, spec.keys, { label: spec.label })), spec.keys);
  let { errors } = validateReport(next, { sections: spec.keys });

  for (let attempt = 0; attempt < maxRepairs && errors.length > 0; attempt += 1) {
    next = merge(next, await askJson(complete, buildSectionPrompt(next, spec.keys, { label: spec.label, errors })), spec.keys);
    ({ errors } = validateReport(next, { sections: spec.keys }));
  }

  return { report: next, warnings: errors };
}
