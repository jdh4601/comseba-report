import { exampleReport } from "./example.mjs";
import { COUNTS, LIMITS } from "./schema.mjs";

export const LEVELS = ["초등", "중등", "고등"];
export const DEFAULT_LEVEL = "중등";

/** 학교급별로 탐구활동에서 쓸 수학 개념과 문장 수준. 교육과정 범위를 넘는 개념을 쓰지 않도록 한다. */
const LEVEL_GUIDES = {
  초등: {
    reader: "초등학생 수준",
    math: "사칙연산, 분수와 소수, 평균, 비와 비율(백분율), 막대·꺾은선·원그래프, 표 만들기, 규칙 찾기",
    style: "문장은 짧고 쉬운 낱말로 쓰되 논문체(~한다)는 유지합니다. 전문 용어는 풀어서 씁니다.",
  },
  중등: {
    reader: "중학생 수준",
    math: "평균·중앙값·최빈값, 도수분포표와 히스토그램, 비례와 일차함수, 좌표평면, 경우의 수, 확률, 연립방정식",
    style: "중학생이 직접 탐구할 수 있는 범위에서 개념 이름을 정확히 씁니다.",
  },
  고등: {
    reader: "고등학생 수준",
    math: "수열, 지수·로그함수, 미분(변화율), 확률분포와 정규분포, 조건부확률, 통계적 추정, 회귀(최소제곱법), 벡터와 행렬",
    style: "학술적인 어휘로 쓰고, 수학 개념이 기술의 원리에서 맡는 역할을 구체적으로 밝힙니다.",
  },
};

export const levelOf = (value) => (LEVELS.includes(value) ? value : DEFAULT_LEVEL);

export function inputOf(report) {
  return {
    level: levelOf(report.level),
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

const describeInput = (input) => `- 학교급(난이도): ${levelOf(input.level)}
- 학생: ${input.student?.name ?? ""} / ${input.student?.school ?? ""} / ${input.student?.grade ?? ""}
- MAIN 분야: ${input.interest?.main}
- SUB 분야: ${input.interest?.sub}
- 학생이 해결하고 싶은 문제(학생의 말): ${input.problemQuote}
- 강사 메모: ${input.memo?.trim() || "(없음)"}`;

const rules = (level) => {
  const guide = LEVEL_GUIDES[levelOf(level)];
  return `# 작성 규칙
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
- photos 2개: [0]은 "문제 상황" 사진, [1]은 "해결 예시" 사진. caption은 한국어 설명입니다.
  query는 Unsplash 같은 사진 사이트에서 찾을 영어 검색어입니다. 2~4단어로, 사진에 실제로 찍힐 구체적인 장면·사물을 씁니다(예: "school cafeteria food waste", "pill organizer elderly hands", "robot arm prototype"). "student studying alone"처럼 누구에게나 해당하는 막연한 표현과 추상어(problem, solution, idea)는 피합니다. 컴퓨터·휴대폰 화면을 정면으로 찍은 사진은 엉뚱한 글자가 보이기 쉬우므로, 화면이 필요하면 "student using tablet"처럼 사람과 기기가 함께 보이는 장면으로 씁니다.

## 3페이지 오른쪽: 컴세바 진로탐구활동 (탐구 과목: 수학 고정)
- 학생의 문제를 ${guide.reader}의 수학 개념으로 분석하고, 그 수학이 MAIN·SUB 분야 기술과 어떻게 연결되는지 탐구하는 소논문입니다.
- 이 학생은 ${level} 과정입니다. 쓸 수 있는 수학 개념: ${guide.math}. 이 범위를 넘는 개념은 쓰지 않습니다.
- ${guide.style}
- paper.titleLines: 논문 제목을 자연스럽게 끊은 2줄.
- paper.abstract: "본 탐구에서는"으로 시작하는 논문체(~한다) 3문장. "수학"이라는 단어를 반드시 포함합니다.
- paper.intro: 동기를 밝히는 논문체(~한다, ~하였다) 3문장.

## 공통
- 사실처럼 보이는 구체적 수치·통계·기관명은 지어내지 않습니다.
- 글자 수는 공백과 문장부호를 포함한 수이며, 아래 범위를 반드시 지킵니다. 범위를 벗어나면 슬라이드 칸을 넘칩니다.`;
};

const OUTPUT_RULE = "# 출력 형식\n설명이나 코드 블록 없이 JSON 객체 하나만 출력합니다.";

export function buildGeneratePrompt(input) {
  return `${rules(input.level)}

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
  return `${rules(input.level)}

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
  return `${rules(report.level)}

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
