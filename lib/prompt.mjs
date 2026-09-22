import { exampleReport } from "./example.mjs";
import { COUNTS, LIMITS } from "./schema.mjs";

export function inputOf(report) {
  return {
    student: report.student,
    interest: report.interest,
    problemQuote: report.problem?.quote ?? "",
    memo: report.memo ?? "",
  };
}

/** AI가 쓰는 부분만 골라낸다. 사진은 파일·출처를 사람이 고르므로 설명과 검색어만 넘긴다. */
export function pickGenerated(report, keys = ["problem", "coreTech", "supportTech", "reason", "solution", "photos", "paper"]) {
  const picked = {};
  for (const key of keys) {
    if (key === "photos") picked.photos = (report.photos ?? []).map(({ caption, query }) => ({ caption, query }));
    else picked[key] = structuredClone(report[key]);
  }
  return picked;
}

const limitLines = () =>
  LIMITS.map(([path, min, max]) => `- ${path}: ${min}~${max}자`).join("\n") +
  "\n" +
  Object.entries(COUNTS)
    .map(([path, count]) => `- ${path}: 정확히 ${count}개`)
    .join("\n");

const describeInput = (input) => `- 학생: ${input.student?.name ?? ""} / ${input.student?.school ?? ""} / ${input.student?.grade ?? ""}
- MAIN 분야: ${input.interest?.main}
- SUB 분야: ${input.interest?.sub}
- 학생이 해결하고 싶은 문제(학생의 말): ${input.problemQuote}
- 강사 메모: ${input.memo?.trim() || "(없음)"}`;

const RULES = `# 작성 규칙
보고서는 컴세바 코딩학원의 "60분 융합 체험수업" 결과보고서이며 학부모님이 읽습니다. 전문적이면서도 학생이 실제로 한 활동처럼 구체적으로 씁니다.

## 2페이지: 나에게 맞는 IT 분야 찾기
- problem.quote: 학생의 말을 다듬은 한 문장. 학생 말투(~요)를 살리고 따옴표는 붙이지 않습니다.
- problem.target / pain / goal: 대상 / 불편 / 목표. 명사형으로 끝냅니다("~음", "~기", 명사).
- coreTech 3개: 문제를 푸는 핵심 기술. name은 짧은 기술명, role은 이 문제에서 그 기술이 하는 일(명사형 종결). MAIN 분야 기술과 SUB 분야 기술이 반드시 포함되어야 합니다.
- supportTech 2개: 핵심 기술을 돕는 기술(예: 웹 & 앱, IoT 센서). role은 명사형 종결.
- reason: 기술을 선택한 이유. 합니다체 2문장.

## 3페이지 왼쪽: 문제 해결 아이디어 구체화
- solution.summary: 문제를 기술로 어떻게 해결할지 설명하는 글. 합니다체 4문장 안팎. MAIN·SUB 분야가 자연스럽게 드러나야 합니다.
- solution.steps 4개: 해결 과정 단계. name은 짧은 단계명, desc는 그 단계에서 하는 일(명사형 또는 "~하기" 종결). MAIN 분야(예: AI)가 한 단계를 맡아야 합니다.
- photos 2개: [0]은 "문제 상황" 사진, [1]은 "해결 예시" 사진. caption은 한국어 설명, query는 Wikimedia Commons에서 실제 사진을 찾을 수 있는 짧은 영어 검색어(2~5단어, 구체적인 사물 위주).

## 3페이지 오른쪽: 컴세바 진로탐구활동 (탐구 과목: 수학 고정)
- 학생의 문제를 중·고등학생 수준의 수학 개념(평균, 비율, 그래프, 함수, 확률, 통계, 좌표, 경우의 수 등)으로 분석하고, 그 수학이 MAIN·SUB 분야 기술과 어떻게 연결되는지 탐구하는 소논문입니다.
- paper.titleLines: 논문 제목을 자연스럽게 끊은 2줄.
- paper.abstract: "본 탐구에서는"으로 시작하는 논문체(~한다) 3문장. "수학"이라는 단어를 반드시 포함합니다.
- paper.intro: 동기를 밝히는 논문체(~한다, ~하였다) 3문장.

## 공통
- 사실처럼 보이는 구체적 수치·통계·기관명은 지어내지 않습니다.
- 글자 수는 공백과 문장부호를 포함한 수이며, 아래 범위를 반드시 지킵니다. 범위를 벗어나면 슬라이드 칸을 넘칩니다.`;

const OUTPUT_RULE = "# 출력 형식\n설명이나 코드 블록 없이 JSON 객체 하나만 출력합니다.";

export function buildGeneratePrompt(input) {
  return `${RULES}

# 글자 수·개수 범위
${limitLines()}

# 예시 입력
${describeInput(inputOf(exampleReport))}

# 예시 출력
${JSON.stringify(pickGenerated(exampleReport), null, 2)}

# 이번 학생 입력
${describeInput(input)}

${OUTPUT_RULE} 키 구조는 예시 출력과 똑같이 맞춥니다.`;
}

const errorLines = (errors) => errors.map((error) => `- ${error.message}`).join("\n");

export function buildRepairPrompt(input, generated, errors) {
  return `${RULES}

# 글자 수·개수 범위
${limitLines()}

# 학생 입력
${describeInput(input)}

# 직전에 작성한 JSON
${JSON.stringify(generated, null, 2)}

# 고쳐야 할 문제
${errorLines(errors)}

위 문제만 고치고 나머지 내용은 최대한 유지합니다. ${OUTPUT_RULE} 키 구조는 직전 JSON과 똑같이 맞춥니다.`;
}

export function buildSectionPrompt(report, keys, { label, errors = [] }) {
  const others = pickGenerated(report, ["problem", "coreTech", "supportTech", "reason", "solution", "photos", "paper"].filter((key) => !keys.includes(key)));
  return `${RULES}

# 글자 수·개수 범위
${limitLines()}

# 학생 입력
${describeInput(inputOf(report))}

# 이미 확정된 다른 섹션 (내용이 서로 이어지도록 참고만 합니다)
${JSON.stringify(others, null, 2)}

# 지금 섹션의 기존 내용
${JSON.stringify(pickGenerated(report, keys), null, 2)}

"${label}" 섹션을 새로운 표현으로 다시 씁니다. 다른 섹션과 내용이 어긋나지 않게 합니다.${errors.length ? `\n\n# 반드시 해결할 문제\n${errorLines(errors)}` : ""}

${OUTPUT_RULE} 최상위 키는 ${keys.map((key) => `"${key}"`).join(", ")}만 포함합니다.`;
}
