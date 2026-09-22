/**
 * 2·3페이지 보고서 데이터의 형태와 칸별 글자 수 상한.
 * 상한은 템플릿 레이아웃(글꼴 크기 × 칸 너비)에서 역산한 값이라, 넘기면 줄바꿈이 밀려 칸을 벗어난다.
 */

export const CHIPS = ["AI", "빅데이터", "웹", "모바일 앱", "게임", "AR·VR", "IoT·센서", "로봇", "클라우드", "통신", "보안", "디자인"];

/** 분야 이름이 본문에 그대로 나오지 않아도 같은 분야로 인정할 표현들. */
export const FIELD_ALIASES = {
  AI: ["AI", "인공지능", "머신러닝", "딥러닝"],
  빅데이터: ["데이터"],
  웹: ["웹", "홈페이지", "사이트"],
  "모바일 앱": ["앱", "모바일"],
  게임: ["게임"],
  "AR·VR": ["AR", "VR", "증강", "가상"],
  "IoT·센서": ["IoT", "센서"],
  로봇: ["로봇"],
  클라우드: ["클라우드", "서버"],
  통신: ["통신", "네트워크", "무선"],
  보안: ["보안", "암호", "해킹"],
  디자인: ["디자인", "UX", "UI"],
};

export const PHOTO_TAGS = ["문제 상황", "해결 예시"];

/** [경로, 최소 글자, 최대 글자]. 경로의 `*`는 배열의 모든 원소를 뜻한다. */
export const LIMITS = [
  ["problem.quote", 8, 26],
  ["problem.target", 4, 32],
  ["problem.pain", 8, 32],
  ["problem.goal", 8, 32],
  ["coreTech.*.name", 2, 12],
  ["coreTech.*.role", 12, 38],
  ["supportTech.*.name", 2, 9],
  ["supportTech.*.role", 8, 22],
  ["reason", 50, 100],
  ["solution.summary", 130, 185],
  ["solution.steps.*.name", 2, 7],
  ["solution.steps.*.desc", 12, 36],
  ["photos.*.caption", 6, 18],
  ["photos.*.query", 2, 60],
  ["paper.titleLines.*", 8, 22],
  ["paper.abstract", 170, 235],
  ["paper.intro", 160, 230],
];

export const COUNTS = {
  coreTech: 3,
  supportTech: 2,
  "solution.steps": 4,
  photos: 2,
  "paper.titleLines": 2,
};

/** 섹션 재생성 단위. 각 섹션이 AI가 다시 쓰는 최상위 키 목록. */
export const SECTIONS = {
  problem: { label: "2p 해결하고 싶은 문제", keys: ["problem"] },
  tech: { label: "2p 핵심·지원 기술과 선택 이유", keys: ["coreTech", "supportTech", "reason"] },
  solution: { label: "3p 해결 아이디어·과정·사진 설명", keys: ["solution", "photos"] },
  paper: { label: "3p 진로탐구활동(제목·Abstract·Introduction)", keys: ["paper"] },
};

export const GENERATED_KEYS = Object.values(SECTIONS).flatMap((section) => section.keys);

export function charCount(value) {
  return [...String(value ?? "")].length;
}

/** "a.*.b" 같은 경로를 실제 값들의 [구체 경로, 값] 목록으로 펼친다. */
export function resolvePath(object, path) {
  const walk = (node, parts, prefix) => {
    if (parts.length === 0) return [[prefix.join("."), node]];
    const [head, ...rest] = parts;
    if (head === "*") {
      if (!Array.isArray(node)) return [];
      return node.flatMap((item, index) => walk(item, rest, [...prefix, String(index)]));
    }
    if (node == null || typeof node !== "object") return [[[...prefix, head, ...rest].join("."), undefined]];
    return walk(node[head], rest, [...prefix, head]);
  };
  return walk(object, path.split("."), []);
}

export function limitFor(concretePath) {
  const generic = concretePath.replace(/\.\d+(?=\.|$)/g, ".*");
  const found = LIMITS.find(([path]) => path === generic);
  return found ? { min: found[1], max: found[2] } : null;
}
