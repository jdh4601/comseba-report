import { CHIPS } from "./schema.mjs";

/**
 * 3페이지 보고서의 배치(좌표·글꼴·색)를 요소 목록으로 만든다.
 * PPTX(pptxgenjs)와 브라우저 미리보기·인쇄(HTML)가 같은 목록을 그리므로, 레이아웃은 이 파일에서만 고친다.
 *
 * 요소 종류
 * - text:  { kind, x, y, w, h, text: string | Run[], style }   Run = { text, style }
 * - rect:  { kind, x, y, w, h, fill, line, lineWidth, radius }
 * - line:  { kind, x, y, w, h, color, width }                  가로선은 h=0, 세로선은 w=0
 * - image: { kind, x, y, w, h, src }                           src가 없으면 자리표시 상자를 그린다
 * 단위는 인치이며 슬라이드는 13.333 × 7.5 인치다. style 이름은 pptxgenjs 옵션과 같다.
 */

export const SLIDE_WIDTH = 13.333;
export const SLIDE_HEIGHT = 7.5;
export const C = { red: "A40F1D", black: "171717", gray: "666663", dark: "333331", line: "D8D6D1", pinkText: "F2B6BC", white: "FFFFFF" };
export const SANS = "나눔고딕";
// 나눔명조는 PowerPoint for Mac PDF 내보내기에서 공백 폭이 1em으로 깨지므로 PowerPoint 내장 바탕을 쓴다.
export const SERIF = "Batang";
export const LATIN_SERIF = "Times New Roman";
const X0 = 0.62;

const text = (x, y, w, h, content, style = {}) => ({ kind: "text", x, y, w, h, text: content, style: { fontFace: SANS, color: C.black, valign: "top", ...style } });
const rect = (x, y, w, h, fill, line = null, extra = {}) => ({ kind: "rect", x, y, w, h, fill, line, lineWidth: 0.75, ...extra });
const hline = (x, y, w, color = C.line, width = 0.75) => ({ kind: "line", x, y, w, h: 0, color, width });
const vline = (x, y, h, color = C.line, width = 0.5) => ({ kind: "line", x, y, w: 0, h, color, width });
const run = (content, style = {}) => ({ text: content, style });

function pageHeader(title, subtitle) {
  return [
    text(X0, 0.38, 5, 0.2, "COMSEBA AI·STEM TRIAL CLASS", { fontSize: 9, bold: true, color: C.red, fontFace: "Arial" }),
    text(X0, 0.66, 9, 0.55, title, { fontSize: 26, bold: true }),
    text(X0, 1.25, 11.5, 0.3, subtitle, { fontSize: 11.5, color: C.gray }),
    hline(0.55, 1.72, 12.23, C.red, 1.25),
  ];
}

function labelBlock({ x, y, w, h, fill, no, title, sub }) {
  return [
    rect(x, y, w, h, fill),
    text(x + 0.2, y + 0.2, w - 0.3, 0.25, no, { fontSize: 12, bold: true, color: C.pinkText }),
    text(x + 0.2, y + 0.5, w - 0.3, 0.35, title, { fontSize: 15, bold: true, color: C.white }),
    text(x + 0.2, y + h - 0.6, w - 0.3, 0.4, sub, { fontSize: 7.5, bold: true, color: C.line, fontFace: "Arial", charSpacing: 1 }),
  ];
}

function sectionHead(x, y, no, title) {
  return [
    rect(x, y, 0.34, 0.34, C.red),
    text(x, y, 0.34, 0.34, no, { fontSize: 10, bold: true, color: C.white, align: "center", valign: "middle", fontFace: "Arial" }),
    text(x + 0.46, y, 5.4, 0.34, title, { fontSize: 13.5, bold: true, valign: "middle" }),
  ];
}

const nameRole = (name, role, nameSize = 11.5) => [
  run(name, { bold: true, fontSize: nameSize, color: C.black, breakLine: true }),
  run(role, { fontSize: 9, color: C.gray }),
];

// ---------- Slide 1: 수업 설계 + IT 분야 (모든 학생 공통) ----------
const CLASS_STEPS = [
  ["나의 관심 분야 찾기", "좋아하는 것·잘하는 것·궁금한 것·불편한 것을 적고, 코딩·AI·메이킹 경험 수준을 스스로 점검합니다.", "관심의 방향 · 자기 표현력"],
  ["산업혁명과 기술의 흐름", "1차 기계화부터 4차 AI·융합까지 핵심 기술을 비교하고, 한 물건 속 여러 시대의 기술을 찾아봅니다.", "개념 연결력 · 질문의 깊이"],
  ["IT 기술 심화 탐구", "입력→처리→저장→전송→출력 구조로 서비스를 해부하고, 주요 IT 분야를 사례로 체험합니다.", "구조적 사고 · 실습 태도"],
  ["나의 분야와 로드맵", "해결하고 싶은 문제를 정해 핵심·지원 기술을 고르고, 진로와 연결된 탐구 주제를 설계합니다.", "문제 정의력 · 자기주도성"],
];
const IT_FIELDS = [
  ["ARTIFICIAL\nINTELLIGENCE", "인공지능 (AI)", "데이터의 패턴을 학습해 분류·예측·추천·생성을 수행하는 기술입니다.", "영상 추천 · 번역 · 챗봇"],
  ["SEMICONDUCTOR", "반도체", "전기의 흐름을 조절해 계산과 저장을 담당하는, 모든 전자기기의 두뇌입니다.", "CPU · 메모리 · AI 칩"],
  ["BIG DATA", "빅데이터", "규모가 크고 빠르게 생성되는 다양한 데이터를 모아 의미를 찾는 분야입니다.", "교통 예측 · 스포츠 분석"],
  ["WEB & APP", "웹 & 앱", "화면(프론트엔드)과 서버·DB(백엔드)로 사용자에게 기능과 정보를 제공합니다.", "웹사이트 · 모바일 앱"],
  ["EMBEDDED SYSTEM", "임베디드 시스템", "제품 속 컴퓨터가 센서로 현실을 읽고 모터·LED로 직접 행동하게 합니다.", "로봇 · 스마트홈 · 자동차"],
];

function slide1() {
  const els = pageHeader("60분 융합 체험수업", "학생의 관심에서 출발해 산업혁명 → IT 기술 → 나의 분야까지 연결하는 맞춤형 탐구 수업을 진행합니다.");
  const s1y = 1.98, s1h = 2.12, cw = 2.435, gap = 0.15, cx0 = 2.52;
  els.push(...labelBlock({ x: X0, y: s1y, w: 1.75, h: s1h, fill: C.black, no: "01", title: "수업 설계", sub: "60-MINUTE\nCLASS FLOW" }));
  CLASS_STEPS.forEach(([title, desc, obs], i) => {
    const x = cx0 + i * (cw + gap);
    els.push(
      rect(x, s1y, cw, s1h, C.white, C.line),
      text(x + 0.18, s1y + 0.16, 1.0, 0.2, `STEP ${i + 1}`, { fontSize: 9, bold: true, color: C.red, fontFace: "Arial" }),
      text(x + 0.18, s1y + 0.42, cw - 0.3, 0.3, title, { fontSize: 12.5, bold: true }),
      text(x + 0.18, s1y + 0.78, cw - 0.34, 0.75, desc, { fontSize: 9.5, color: C.dark, lineSpacingMultiple: 1.15 }),
      hline(x + 0.18, s1y + 1.58, cw - 0.36),
      text(x + 0.18, s1y + 1.67, cw - 0.3, 0.25, [run("관찰 포인트  ", { bold: true, color: C.red }), run(obs, { color: C.black })], { fontSize: 9 }),
    );
  });

  const s2y = 4.32, s2h = 2.6, fw = 1.918;
  els.push(...labelBlock({ x: X0, y: s2y, w: 1.75, h: s2h, fill: C.red, no: "02", title: "IT 분야 이해", sub: "FIVE CORE\nIT FIELDS" }));
  IT_FIELDS.forEach(([eng, kor, desc, ex], i) => {
    const x = cx0 + i * (fw + gap);
    els.push(
      rect(x, s2y, fw, s2h, C.white, C.line),
      text(x + 0.16, s2y + 0.16, fw - 0.28, 0.36, eng, { fontSize: 8, bold: true, color: C.red, fontFace: "Arial", charSpacing: 0.5, valign: "bottom" }),
      text(x + 0.16, s2y + 0.58, fw - 0.28, 0.3, kor, { fontSize: 12.5, bold: true }),
      text(x + 0.16, s2y + 0.95, fw - 0.3, 0.9, desc, { fontSize: 9, color: C.dark, lineSpacingMultiple: 1.15 }),
      hline(x + 0.16, s2y + 1.9, fw - 0.32),
      text(x + 0.16, s2y + 2.0, fw - 0.28, 0.3, [run("예시  ", { bold: true, color: C.red }), run(ex, { color: C.black })], { fontSize: 8.5 }),
    );
  });
  return els;
}

// ---------- Slide 2: 나에게 맞는 IT 분야 찾기 ----------

/** 12칸 칩에 MAIN·SUB가 없으면 뒤쪽 칩을 그 분야로 바꿔 끼운다. */
export function chipList(main, sub) {
  const chips = [...CHIPS];
  let slot = chips.length - 1;
  for (const field of [sub, main]) {
    if (!field || chips.includes(field)) continue;
    while (chips[slot] === main || chips[slot] === sub) slot -= 1;
    chips[slot] = field;
    slot -= 1;
  }
  return chips;
}

function chips(x0, width, { main, sub }) {
  const els = [
    text(x0 + 3.9, 1.95, 2.0, 0.34, [
      run("■ ", { color: C.red }), run("MAIN   ", { color: C.gray }),
      run("■ ", { color: C.black }), run("SUB", { color: C.gray }),
    ], { fontSize: 8.5, align: "right", valign: "middle", fontFace: "Arial" }),
  ];
  const chipW = (width - 0.3) / 4;
  chipList(main, sub).forEach((chip, i) => {
    const x = x0 + (i % 4) * (chipW + 0.1);
    const y = 2.42 + Math.floor(i / 4) * 0.6;
    const role = chip === main ? "MAIN" : chip === sub ? "SUB" : "";
    els.push(rect(x, y, chipW, 0.48, role === "MAIN" ? C.red : role === "SUB" ? C.black : C.white, role ? null : C.line, { radius: 0.24 }));
    const label = role ? [run(`${chip}  `), run(role, { fontSize: 7.5, color: role === "MAIN" ? C.pinkText : C.line, fontFace: "Arial" })] : chip;
    els.push(text(x, y, chipW, 0.48, label, { fontSize: 11, bold: Boolean(role), color: role ? C.white : C.gray, align: "center", valign: "middle" }));
  });
  return els;
}

function slide2(report) {
  const els = pageHeader("나에게 맞는 IT 분야 찾기", "해결하고 싶은 문제에서 출발해 핵심 기술과 지원 기술을 구분했습니다.");
  const LX = X0, LW = 5.9, RX = 6.81, RW = 5.9;
  const problem = report.problem ?? {};

  els.push(...sectionHead(LX, 1.95, "01", "관심 분야 선택"), ...chips(LX, LW, report.interest ?? {}));

  els.push(
    ...sectionHead(LX, 4.45, "02", "내가 해결하고 싶은 문제"),
    rect(LX, 4.87, LW, 2.08, C.white, C.line),
    text(LX + 0.28, 5.08, LW - 0.5, 0.32, `“${problem.quote ?? ""}”`, { fontSize: 14, bold: true }),
    hline(LX + 0.28, 5.6, LW - 0.56),
  );
  [["대상", problem.target], ["불편", problem.pain], ["목표", problem.goal]].forEach(([k, v], i) => {
    els.push(text(LX + 0.28, 5.76 + i * 0.36, LW - 0.5, 0.28, [run(`${k}   `, { bold: true, color: C.red }), run(v ?? "", { color: C.dark })], { fontSize: 10.5 }));
  });

  els.push(...sectionHead(RX, 1.95, "03", "핵심 기술 3개"));
  (report.coreTech ?? []).forEach(({ name, role }, i) => {
    const y = 2.42 + i * 0.64;
    els.push(
      rect(RX, y, RW, 0.56, C.white, C.line),
      rect(RX, y, 0.52, 0.56, C.black),
      text(RX, y, 0.52, 0.56, String(i + 1), { fontSize: 14, bold: true, color: C.white, align: "center", valign: "middle", fontFace: "Arial" }),
      text(RX + 0.68, y, RW - 0.8, 0.56, nameRole(name, role), { valign: "middle" }),
    );
  });

  els.push(...sectionHead(RX, 4.45, "04", "지원 기술 2개"));
  (report.supportTech ?? []).forEach(({ name, role }, i) => {
    const x = RX + i * (RW / 2 + 0.075);
    els.push(rect(x, 4.87, RW / 2 - 0.075, 0.72, C.white, C.line), text(x + 0.2, 4.87, RW / 2 - 0.35, 0.72, nameRole(name, role), { valign: "middle" }));
  });

  els.push(
    ...sectionHead(RX, 5.74, "05", "기술을 선택한 이유"),
    rect(RX, 6.16, RW, 0.79, C.white, C.line),
    text(RX + 0.2, 6.16, RW - 0.4, 0.79, report.reason ?? "", { fontSize: 9.5, color: C.dark, valign: "middle", lineSpacingMultiple: 1.2 }),
  );
  return els;
}

// ---------- Slide 3: 문제 해결 아이디어 + 진로탐구활동 ----------

export function photoCredit(photos = []) {
  const credits = photos.map((photo) => photo.credit).filter(Boolean);
  if (credits.length === 0) return "";
  const viaCommons = photos.some((photo) => photo.credit && photo.source === "wikimedia");
  return `Photos: ${credits.join(" / ")}${viaCommons ? ", via Wikimedia Commons" : ""}`;
}

function solution(report, photoSrcs) {
  const LW = 5.9;
  const els = [
    text(X0, 0.45, 3, 0.2, "PROBLEM SOLVING", { fontSize: 9, bold: true, color: C.red, fontFace: "Arial", charSpacing: 1 }),
    text(X0, 0.72, LW, 0.48, "문제 해결 아이디어 구체화", { fontSize: 24, bold: true }),
    text(X0, 1.36, LW, 0.95, report.solution?.summary ?? "", { fontSize: 10.5, color: C.dark, lineSpacingMultiple: 1.3, align: "left" }),
    ...sectionHead(X0, 2.45, "01", "문제와 해결 아이디어"),
  ];
  const photoW = (LW - 0.1) / 2, photoH = 1.45, photoY = 2.89;
  (report.photos ?? []).forEach((photo, i) => {
    const x = X0 + i * (photoW + 0.1);
    els.push(
      { kind: "image", x, y: photoY, w: photoW, h: photoH, src: photoSrcs[i] ?? null },
      text(x, photoY + photoH + 0.07, photoW, 0.22, [run(`${photo.tag}  `, { bold: true, color: C.red }), run(photo.caption ?? "", { color: C.dark })], { fontSize: 9 }),
    );
  });

  els.push(...sectionHead(X0, 4.8, "02", "문제 해결 과정"));
  const rowH = 0.4;
  (report.solution?.steps ?? []).forEach(({ name, desc }, i) => {
    const y = 5.22 + i * (rowH + 0.06);
    els.push(
      rect(X0, y, LW, rowH, C.white, C.line),
      text(X0 + 0.14, y, 0.25, rowH, String(i + 1), { fontSize: 11, bold: true, color: C.red, fontFace: "Arial", valign: "middle" }),
      text(X0 + 0.42, y, 1.0, rowH, name, { fontSize: 10, bold: true, valign: "middle" }),
      text(X0 + 1.45, y, LW - 1.6, rowH, desc, { fontSize: 9.5, color: C.dark, valign: "middle" }),
    );
  });

  const credit = photoCredit(report.photos);
  if (credit) els.push(text(X0, 7.08, LW, 0.16, credit, { fontSize: 6.5, color: C.gray }));
  return els;
}

function paper(report, logoSrc) {
  const PX = 7.35, PW = 5.3;
  const student = report.student ?? {};
  const interest = report.interest ?? {};
  const p = report.paper ?? {};
  const els = [
    rect(7.0, 0.32, 6.0, 6.86, C.white, C.line, { lineWidth: 0.5 }),
    { kind: "image", x: PX, y: 0.55, w: 1.14, h: 0.3, src: logoSrc },
    text(PX + 2.8, 0.6, 2.5, 0.2, "CAREER  EXPLORATION", { fontSize: 8, color: C.gray, fontFace: LATIN_SERIF, align: "right", charSpacing: 2 }),
    text(PX, 1.02, PW, 0.4, "컴세바 진로탐구활동", { fontSize: 18, bold: true, fontFace: SERIF, align: "center" }),
    text(PX, 1.45, PW, 0.22, [student.name, student.school, student.grade, student.date].filter(Boolean).join(" · "), { fontSize: 9, color: C.gray, fontFace: SERIF, align: "center" }),
    hline(PX, 1.8, PW, C.line, 0.5),
  ];
  const rows = [
    ["로드맵 설정", [
      run("MAIN ", { bold: true, color: C.red, fontFace: LATIN_SERIF }), run(interest.main ?? "", { bold: true }),
      run("     /     ", { color: C.gray }),
      run("SUB ", { bold: true, color: C.red, fontFace: LATIN_SERIF }), run(interest.sub ?? "", { bold: true }),
    ]],
    ["탐구 과목", [run("수학 ", { bold: true }), run("Mathematics", { italic: true, color: C.gray, fontFace: LATIN_SERIF })]],
  ];
  rows.forEach(([k, v], i) => {
    const y = 1.84 + i * 0.44;
    els.push(
      vline(PX + 1.15, y + 0.08, 0.26),
      text(PX, y, 1.15, 0.4, k, { fontSize: 9.5, bold: true, fontFace: SERIF, align: "center", valign: "middle" }),
      text(PX + 1.3, y, PW - 1.4, 0.4, v, { fontSize: 10, fontFace: SERIF, valign: "middle" }),
      hline(PX, y + 0.42, PW, C.line, 0.5),
    );
  });

  const body = { fontSize: 9.5, fontFace: SERIF, align: "justify", lineSpacingMultiple: 1.3, color: C.black };
  els.push(
    text(PX, 2.9, PW, 0.62, (p.titleLines ?? []).join("\n"), { fontSize: 14.5, bold: true, fontFace: SERIF, align: "center", lineSpacingMultiple: 1.15 }),
    text(PX, 3.66, PW, 0.24, "Abstract", { fontSize: 11, bold: true, italic: true, fontFace: LATIN_SERIF, align: "center" }),
    text(PX + 0.3, 3.95, PW - 0.6, 1.3, p.abstract ?? "", body),
    text(PX, 5.36, PW, 0.24, "Ⅰ. Introduction", { fontSize: 11, bold: true, fontFace: SERIF, align: "center" }),
    text(PX + 0.3, 5.66, PW - 0.6, 1.4, p.intro ?? "", body),
  );
  return els;
}

/**
 * @param report 보고서 데이터
 * @param images { logo: src, photos: [src | null, src | null] } — PPTX는 data URL, 브라우저는 이미지 주소
 * @returns 슬라이드 3장의 요소 목록
 */
export function buildLayout(report, images = {}) {
  return [slide1(), slide2(report), [...solution(report, images.photos ?? []), ...paper(report, images.logo ?? null)]];
}
