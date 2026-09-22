import { existsSync } from "node:fs";
import { isAbsolute, join } from "node:path";

import JSZip from "jszip";
import pptxgen from "pptxgenjs";

import { CHIPS } from "./schema.mjs";

/**
 * 결과보고서(컴세바_90분_AI_STEM_진단체험_결과보고서) 디자인 계열의 3페이지 덱.
 * 1페이지는 모든 학생이 같고, 2·3페이지는 report 데이터로 채운다.
 */

const C = { red: "A40F1D", black: "171717", gray: "666663", dark: "333331", line: "D8D6D1", pinkText: "F2B6BC", white: "FFFFFF" };
const SANS = "나눔고딕";
// 나눔명조는 PowerPoint for Mac PDF 내보내기에서 공백 폭이 1em으로 깨지므로 PowerPoint 내장 바탕을 쓴다.
const SERIF = "Batang";
const LATIN_SERIF = "Times New Roman";
const X0 = 0.62;

function helpers(pres) {
  const text = (slide, str, opts) =>
    slide.addText(str, { isTextBox: true, margin: 0, fontFace: SANS, color: C.black, valign: "top", ...opts });
  const rect = (slide, x, y, w, h, fill, lineColor) =>
    slide.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: fill }, line: lineColor ? { color: lineColor, width: 0.75 } : { type: "none" } });
  const hline = (slide, x, y, w, color = C.line, width = 0.75) =>
    slide.addShape(pres.shapes.LINE, { x, y, w, h: 0, line: { color, width } });

  const pageHeader = (slide, title, subtitle) => {
    text(slide, "COMSEBA AI·STEM TRIAL CLASS", { x: X0, y: 0.38, w: 5, h: 0.2, fontSize: 9, bold: true, color: C.red, fontFace: "Arial" });
    text(slide, title, { x: X0, y: 0.66, w: 9, h: 0.55, fontSize: 26, bold: true });
    text(slide, subtitle, { x: X0, y: 1.25, w: 11.5, h: 0.3, fontSize: 11.5, color: C.gray });
    hline(slide, 0.55, 1.72, 12.23, C.red, 1.25);
  };
  const labelBlock = (slide, { x, y, w, h, fill, no, title, sub }) => {
    rect(slide, x, y, w, h, fill);
    text(slide, no, { x: x + 0.2, y: y + 0.2, w: w - 0.3, h: 0.25, fontSize: 12, bold: true, color: C.pinkText });
    text(slide, title, { x: x + 0.2, y: y + 0.5, w: w - 0.3, h: 0.35, fontSize: 15, bold: true, color: C.white });
    text(slide, sub, { x: x + 0.2, y: y + h - 0.6, w: w - 0.3, h: 0.4, fontSize: 7.5, bold: true, color: C.line, fontFace: "Arial", charSpacing: 1 });
  };
  const sectionHead = (slide, x, y, no, title) => {
    rect(slide, x, y, 0.34, 0.34, C.red);
    text(slide, no, { x, y, w: 0.34, h: 0.34, fontSize: 10, bold: true, color: C.white, align: "center", valign: "middle", fontFace: "Arial" });
    text(slide, title, { x: x + 0.46, y, w: 5.4, h: 0.34, fontSize: 13.5, bold: true, valign: "middle" });
  };
  const nameRole = (name, role, nameSize = 11.5) => [
    { text: name, options: { bold: true, fontSize: nameSize, color: C.black, breakLine: true } },
    { text: role, options: { fontSize: 9, color: C.gray } },
  ];
  return { text, rect, hline, pageHeader, labelBlock, sectionHead, nameRole };
}

// ---------- Slide 1: 수업 설계 + IT 분야 (고정) ----------
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

function buildSlide1(pres, h) {
  const s = pres.addSlide();
  s.background = { color: C.white };
  h.pageHeader(s, "60분 융합 체험수업", "학생의 관심에서 출발해 산업혁명 → IT 기술 → 나의 분야까지 연결하는 맞춤형 탐구 수업을 진행합니다.");

  const s1y = 1.98, s1h = 2.12, cw = 2.435, gap = 0.15, cx0 = 2.52;
  h.labelBlock(s, { x: X0, y: s1y, w: 1.75, h: s1h, fill: C.black, no: "01", title: "수업 설계", sub: "60-MINUTE\nCLASS FLOW" });
  CLASS_STEPS.forEach(([title, desc, obs], i) => {
    const x = cx0 + i * (cw + gap);
    h.rect(s, x, s1y, cw, s1h, C.white, C.line);
    h.text(s, `STEP ${i + 1}`, { x: x + 0.18, y: s1y + 0.16, w: 1.0, h: 0.2, fontSize: 9, bold: true, color: C.red, fontFace: "Arial" });
    h.text(s, title, { x: x + 0.18, y: s1y + 0.42, w: cw - 0.3, h: 0.3, fontSize: 12.5, bold: true });
    h.text(s, desc, { x: x + 0.18, y: s1y + 0.78, w: cw - 0.34, h: 0.75, fontSize: 9.5, color: C.dark, lineSpacingMultiple: 1.15 });
    h.hline(s, x + 0.18, s1y + 1.58, cw - 0.36);
    h.text(s, [{ text: "관찰 포인트  ", options: { bold: true, color: C.red } }, { text: obs, options: { color: C.black } }], { x: x + 0.18, y: s1y + 1.67, w: cw - 0.3, h: 0.25, fontSize: 9 });
  });

  const s2y = 4.32, s2h = 2.6, fw = 1.918;
  h.labelBlock(s, { x: X0, y: s2y, w: 1.75, h: s2h, fill: C.red, no: "02", title: "IT 분야 이해", sub: "FIVE CORE\nIT FIELDS" });
  IT_FIELDS.forEach(([eng, kor, desc, ex], i) => {
    const x = cx0 + i * (fw + gap);
    h.rect(s, x, s2y, fw, s2h, C.white, C.line);
    h.text(s, eng, { x: x + 0.16, y: s2y + 0.16, w: fw - 0.28, h: 0.36, fontSize: 8, bold: true, color: C.red, fontFace: "Arial", charSpacing: 0.5, valign: "bottom" });
    h.text(s, kor, { x: x + 0.16, y: s2y + 0.58, w: fw - 0.28, h: 0.3, fontSize: 12.5, bold: true });
    h.text(s, desc, { x: x + 0.16, y: s2y + 0.95, w: fw - 0.3, h: 0.9, fontSize: 9, color: C.dark, lineSpacingMultiple: 1.15 });
    h.hline(s, x + 0.16, s2y + 1.9, fw - 0.32);
    h.text(s, [{ text: "예시  ", options: { bold: true, color: C.red } }, { text: ex, options: { color: C.black } }], { x: x + 0.16, y: s2y + 2.0, w: fw - 0.28, h: 0.3, fontSize: 8.5 });
  });
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

function drawChips(s, pres, h, x0, width, { main, sub }) {
  h.text(s, [
    { text: "■ ", options: { color: C.red } }, { text: "MAIN   ", options: { color: C.gray } },
    { text: "■ ", options: { color: C.black } }, { text: "SUB", options: { color: C.gray } },
  ], { x: x0 + 3.9, y: 1.95, w: 2.0, h: 0.34, fontSize: 8.5, align: "right", valign: "middle", fontFace: "Arial" });
  const chipW = (width - 0.3) / 4;
  chipList(main, sub).forEach((chip, i) => {
    const x = x0 + (i % 4) * (chipW + 0.1);
    const y = 2.42 + Math.floor(i / 4) * 0.6;
    const role = chip === main ? "MAIN" : chip === sub ? "SUB" : "";
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x, y, w: chipW, h: 0.48, rectRadius: 0.24, fill: { color: role === "MAIN" ? C.red : role === "SUB" ? C.black : C.white },
      line: role ? { type: "none" } : { color: C.line, width: 0.75 },
    });
    const label = role
      ? [{ text: `${chip}  `, options: {} }, { text: role, options: { fontSize: 7.5, color: role === "MAIN" ? C.pinkText : C.line, fontFace: "Arial" } }]
      : chip;
    h.text(s, label, { x, y, w: chipW, h: 0.48, fontSize: 11, bold: Boolean(role), color: role ? C.white : C.gray, align: "center", valign: "middle" });
  });
}

function buildSlide2(pres, h, report) {
  const s = pres.addSlide();
  s.background = { color: C.white };
  h.pageHeader(s, "나에게 맞는 IT 분야 찾기", "해결하고 싶은 문제에서 출발해 핵심 기술과 지원 기술을 구분했습니다.");
  const LX = X0, LW = 5.9, RX = 6.81, RW = 5.9;

  h.sectionHead(s, LX, 1.95, "01", "관심 분야 선택");
  drawChips(s, pres, h, LX, LW, report.interest);

  h.sectionHead(s, LX, 4.45, "02", "내가 해결하고 싶은 문제");
  h.rect(s, LX, 4.87, LW, 2.08, C.white, C.line);
  h.text(s, `“${report.problem.quote}”`, { x: LX + 0.28, y: 5.08, w: LW - 0.5, h: 0.32, fontSize: 14, bold: true });
  h.hline(s, LX + 0.28, 5.6, LW - 0.56);
  [["대상", report.problem.target], ["불편", report.problem.pain], ["목표", report.problem.goal]].forEach(([k, v], i) => {
    h.text(s, [{ text: `${k}   `, options: { bold: true, color: C.red } }, { text: v, options: { color: C.dark } }], { x: LX + 0.28, y: 5.76 + i * 0.36, w: LW - 0.5, h: 0.28, fontSize: 10.5 });
  });

  h.sectionHead(s, RX, 1.95, "03", "핵심 기술 3개");
  report.coreTech.forEach(({ name, role }, i) => {
    const y = 2.42 + i * 0.64;
    h.rect(s, RX, y, RW, 0.56, C.white, C.line);
    h.rect(s, RX, y, 0.52, 0.56, C.black);
    h.text(s, String(i + 1), { x: RX, y, w: 0.52, h: 0.56, fontSize: 14, bold: true, color: C.white, align: "center", valign: "middle", fontFace: "Arial" });
    h.text(s, h.nameRole(name, role), { x: RX + 0.68, y, w: RW - 0.8, h: 0.56, valign: "middle" });
  });

  h.sectionHead(s, RX, 4.45, "04", "지원 기술 2개");
  report.supportTech.forEach(({ name, role }, i) => {
    const x = RX + i * (RW / 2 + 0.075);
    h.rect(s, x, 4.87, RW / 2 - 0.075, 0.72, C.white, C.line);
    h.text(s, h.nameRole(name, role), { x: x + 0.2, y: 4.87, w: RW / 2 - 0.35, h: 0.72, valign: "middle" });
  });

  h.sectionHead(s, RX, 5.74, "05", "기술을 선택한 이유");
  h.rect(s, RX, 6.16, RW, 0.79, C.white, C.line);
  h.text(s, report.reason, { x: RX + 0.2, y: 6.16, w: RW - 0.4, h: 0.79, fontSize: 9.5, color: C.dark, valign: "middle", lineSpacingMultiple: 1.2 });
}

// ---------- Slide 3: 문제 해결 아이디어 + 진로탐구활동 ----------

function photoCredit(photos) {
  const credits = photos.map((photo) => photo.credit).filter(Boolean);
  if (credits.length === 0) return "";
  const viaCommons = photos.some((photo) => photo.credit && photo.source === "wikimedia");
  return `Photos: ${credits.join(" / ")}${viaCommons ? ", via Wikimedia Commons" : ""}`;
}

function drawSolution(s, h, report, rootDir) {
  const LW = 5.9;
  h.text(s, "PROBLEM SOLVING", { x: X0, y: 0.45, w: 3, h: 0.2, fontSize: 9, bold: true, color: C.red, fontFace: "Arial", charSpacing: 1 });
  h.text(s, "문제 해결 아이디어 구체화", { x: X0, y: 0.72, w: LW, h: 0.48, fontSize: 24, bold: true });
  h.text(s, report.solution.summary, { x: X0, y: 1.36, w: LW, h: 0.95, fontSize: 10.5, color: C.dark, lineSpacingMultiple: 1.3, align: "left" });

  h.sectionHead(s, X0, 2.45, "01", "문제와 해결 아이디어");
  const photoW = (LW - 0.1) / 2, photoH = 1.45, photoY = 2.89;
  report.photos.forEach((photo, i) => {
    const x = X0 + i * (photoW + 0.1);
    const path = photo.file ? (isAbsolute(photo.file) ? photo.file : join(rootDir, photo.file)) : "";
    if (path && existsSync(path)) {
      s.addImage({ path, x, y: photoY, w: photoW, h: photoH });
    } else {
      h.rect(s, x, photoY, photoW, photoH, C.white, C.line);
      h.text(s, "사진을 선택해 주세요", { x, y: photoY, w: photoW, h: photoH, fontSize: 9, color: C.gray, align: "center", valign: "middle" });
    }
    h.text(s, [{ text: `${photo.tag}  `, options: { bold: true, color: C.red } }, { text: photo.caption, options: { color: C.dark } }], { x, y: photoY + photoH + 0.07, w: photoW, h: 0.22, fontSize: 9 });
  });

  h.sectionHead(s, X0, 4.8, "02", "문제 해결 과정");
  const rowH = 0.4;
  report.solution.steps.forEach(({ name, desc }, i) => {
    const y = 5.22 + i * (rowH + 0.06);
    h.rect(s, X0, y, LW, rowH, C.white, C.line);
    h.text(s, String(i + 1), { x: X0 + 0.14, y, w: 0.25, h: rowH, fontSize: 11, bold: true, color: C.red, fontFace: "Arial", valign: "middle" });
    h.text(s, name, { x: X0 + 0.42, y, w: 1.0, h: rowH, fontSize: 10, bold: true, valign: "middle" });
    h.text(s, desc, { x: X0 + 1.45, y, w: LW - 1.6, h: rowH, fontSize: 9.5, color: C.dark, valign: "middle" });
  });

  const credit = photoCredit(report.photos);
  if (credit) h.text(s, credit, { x: X0, y: 7.08, w: LW, h: 0.16, fontSize: 6.5, color: C.gray });
}

function drawPaper(s, pres, h, report, rootDir) {
  s.addShape(pres.shapes.RECTANGLE, { x: 7.0, y: 0.32, w: 6.0, h: 6.86, fill: { color: C.white }, line: { color: C.line, width: 0.5 } });
  const PX = 7.35, PW = 5.3;
  const { student, interest, paper } = report;
  s.addImage({ path: join(rootDir, "assets/logo.png"), x: PX, y: 0.55, w: 1.14, h: 0.3 });
  h.text(s, "CAREER  EXPLORATION", { x: PX + 2.8, y: 0.6, w: 2.5, h: 0.2, fontSize: 8, color: C.gray, fontFace: LATIN_SERIF, align: "right", charSpacing: 2 });
  h.text(s, "컴세바 진로탐구활동", { x: PX, y: 1.02, w: PW, h: 0.4, fontSize: 18, bold: true, fontFace: SERIF, align: "center" });
  h.text(s, [student.name, student.school, student.grade, student.date].filter(Boolean).join(" · "), { x: PX, y: 1.45, w: PW, h: 0.22, fontSize: 9, color: C.gray, fontFace: SERIF, align: "center" });

  const rows = [
    ["로드맵 설정", [
      { text: "MAIN ", options: { bold: true, color: C.red, fontFace: LATIN_SERIF } }, { text: interest.main, options: { bold: true } },
      { text: "     /     ", options: { color: C.gray } },
      { text: "SUB ", options: { bold: true, color: C.red, fontFace: LATIN_SERIF } }, { text: interest.sub, options: { bold: true } },
    ]],
    ["탐구 과목", [{ text: "수학 ", options: { bold: true } }, { text: "Mathematics", options: { italic: true, color: C.gray, fontFace: LATIN_SERIF } }]],
  ];
  h.hline(s, PX, 1.8, PW, C.line, 0.5);
  rows.forEach(([k, v], i) => {
    const y = 1.84 + i * 0.44;
    s.addShape(pres.shapes.LINE, { x: PX + 1.15, y: y + 0.08, w: 0, h: 0.26, line: { color: C.line, width: 0.5 } });
    h.text(s, k, { x: PX, y, w: 1.15, h: 0.4, fontSize: 9.5, bold: true, fontFace: SERIF, align: "center", valign: "middle" });
    h.text(s, v, { x: PX + 1.3, y, w: PW - 1.4, h: 0.4, fontSize: 10, fontFace: SERIF, valign: "middle" });
    h.hline(s, PX, y + 0.42, PW, C.line, 0.5);
  });

  const body = { fontSize: 9.5, fontFace: SERIF, align: "justify", lineSpacingMultiple: 1.3, color: C.black };
  h.text(s, paper.titleLines.join("\n"), { x: PX, y: 2.9, w: PW, h: 0.62, fontSize: 14.5, bold: true, fontFace: SERIF, align: "center", lineSpacingMultiple: 1.15 });
  h.text(s, "Abstract", { x: PX, y: 3.66, w: PW, h: 0.24, fontSize: 11, bold: true, italic: true, fontFace: LATIN_SERIF, align: "center" });
  h.text(s, paper.abstract, { x: PX + 0.3, y: 3.95, w: PW - 0.6, h: 1.3, ...body });
  h.text(s, "Ⅰ. Introduction", { x: PX, y: 5.36, w: PW, h: 0.24, fontSize: 11, bold: true, fontFace: SERIF, align: "center" });
  h.text(s, paper.intro, { x: PX + 0.3, y: 5.66, w: PW - 0.6, h: 1.4, ...body });
}

function buildSlide3(pres, h, report, rootDir) {
  const s = pres.addSlide();
  s.background = { color: C.white };
  drawSolution(s, h, report, rootDir);
  drawPaper(s, pres, h, report, rootDir);
}

/** pptxgenjs는 동아시아 글꼴에 GB2312 charset(-122)을 적는데, 한글 문서이므로 Hangul(-127)로 바꾼다. */
async function fixHangulCharset(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const xmlNames = Object.keys(zip.files).filter((name) => name.endsWith(".xml"));
  for (const name of xmlNames) {
    const xml = await zip.file(name).async("string");
    if (xml.includes('charset="-122"')) zip.file(name, xml.replaceAll(/(<a:ea\b[^>]*?)charset="-122"/g, '$1charset="-127"'));
  }
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

export async function buildDeck(report, { rootDir }) {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE";
  pres.title = "컴세바 60분 융합 체험수업 결과보고서";
  const h = helpers(pres);
  buildSlide1(pres, h);
  buildSlide2(pres, h, report);
  buildSlide3(pres, h, report, rootDir);
  return fixHangulCharset(await pres.write({ outputType: "nodebuffer" }));
}
