import { SLIDE_HEIGHT, SLIDE_WIDTH, buildLayout } from "./shared/layout.mjs";

/**
 * 공통 레이아웃을 HTML로 그린다. 미리보기(축소)와 인쇄(실제 크기)에 같이 쓴다.
 * 좌표는 인치, 글자 크기는 pt로 PPTX와 같은 값을 그대로 쓴다.
 */

export const SLIDE_PX_WIDTH = SLIDE_WIDTH * 96;

// PPTX 글꼴 이름 → 브라우저 글꼴. 바탕은 PowerPoint 전용이라 나눔명조 웹폰트로 대신한다.
const FONT_STACKS = {
  나눔고딕: "'Nanum Gothic', NanumGothic, 'Apple SD Gothic Neo', sans-serif",
  Batang: "'Nanum Myeongjo', Batang, AppleMyungjo, serif",
  Arial: "Arial, Helvetica, sans-serif",
  "Times New Roman": "'Times New Roman', Times, serif",
};
const JUSTIFY = { top: "flex-start", middle: "center", bottom: "flex-end" };
// PowerPoint의 "1줄" 간격은 글자 크기의 약 1.2배다.
const LINE_HEIGHT = 1.2;

const inch = (value) => `${value}in`;
const hex = (value) => `#${value}`;

function applyTextStyle(node, style = {}) {
  if (style.fontFace) node.style.fontFamily = FONT_STACKS[style.fontFace] ?? style.fontFace;
  if (style.fontSize) node.style.fontSize = `${style.fontSize}pt`;
  if (style.color) node.style.color = hex(style.color);
  if (style.bold !== undefined) node.style.fontWeight = style.bold ? "700" : "400";
  if (style.italic) node.style.fontStyle = "italic";
  if (style.charSpacing) node.style.letterSpacing = `${style.charSpacing}pt`;
}

function positioned(tag, { x, y, w, h }) {
  const node = document.createElement(tag);
  Object.assign(node.style, { position: "absolute", left: inch(x), top: inch(y), width: inch(w), height: inch(h) });
  return node;
}

function renderText(element) {
  const box = positioned("div", element);
  const { style } = element;
  Object.assign(box.style, { display: "flex", flexDirection: "column", justifyContent: JUSTIFY[style.valign] ?? "flex-start" });
  const paragraph = document.createElement("div");
  applyTextStyle(paragraph, style);
  Object.assign(paragraph.style, {
    textAlign: style.align ?? "left",
    lineHeight: String((style.lineSpacingMultiple ?? 1) * LINE_HEIGHT),
    whiteSpace: "pre-wrap",
    wordBreak: "keep-all",
    overflowWrap: "anywhere",
  });
  if (Array.isArray(element.text)) {
    for (const item of element.text) {
      const span = document.createElement("span");
      span.textContent = item.text;
      applyTextStyle(span, item.style);
      paragraph.append(span);
      if (item.style?.breakLine) paragraph.append(document.createElement("br"));
    }
  } else {
    paragraph.textContent = element.text;
  }
  box.append(paragraph);
  return box;
}

function renderRect(element) {
  const box = positioned("div", element);
  Object.assign(box.style, {
    boxSizing: "border-box",
    background: hex(element.fill),
    border: element.line ? `${element.lineWidth}pt solid ${hex(element.line)}` : "none",
    borderRadius: element.radius ? inch(element.radius) : "0",
  });
  return box;
}

function renderLine(element) {
  const line = positioned("div", element);
  const border = `${element.width}pt solid ${hex(element.color)}`;
  if (element.h === 0) Object.assign(line.style, { height: "0", borderTop: border });
  else Object.assign(line.style, { width: "0", borderLeft: border });
  return line;
}

function renderImage(element) {
  if (element.src) {
    const img = positioned("img", element);
    img.src = element.src;
    img.alt = "";
    img.style.objectFit = "cover";
    return img;
  }
  const box = positioned("div", element);
  Object.assign(box.style, { boxSizing: "border-box", border: "0.75pt solid #D8D6D1", display: "grid", placeItems: "center", color: "#666663", fontSize: "9pt" });
  box.textContent = "사진을 선택해 주세요";
  return box;
}

const RENDERERS = { text: renderText, rect: renderRect, line: renderLine, image: renderImage };

export function renderSlide(elements) {
  const slide = document.createElement("div");
  slide.className = "slide";
  Object.assign(slide.style, { position: "relative", width: inch(SLIDE_WIDTH), height: inch(SLIDE_HEIGHT), background: "#fff", overflow: "hidden", color: "#171717" });
  for (const element of elements) slide.append(RENDERERS[element.kind](element));
  return slide;
}

/** @param photoUrl (ref) => 이미지 주소 */
export function renderReportSlides(report, { photoUrl, logoUrl }) {
  const photos = (report.photos ?? []).map((photo) => (photo.file ? photoUrl(photo.file) : null));
  return buildLayout(report, { logo: logoUrl, photos }).map(renderSlide);
}

/** 슬라이드를 주어진 폭에 맞게 축소한 틀에 넣는다. */
export function scaledSlide(slide, width) {
  const scale = width / SLIDE_PX_WIDTH;
  const frame = document.createElement("div");
  frame.className = "slide-frame";
  Object.assign(frame.style, { width: `${width}px`, height: `${width * (SLIDE_HEIGHT / SLIDE_WIDTH)}px`, overflow: "hidden" });
  Object.assign(slide.style, { transform: `scale(${scale})`, transformOrigin: "top left" });
  frame.append(slide);
  return frame;
}

/** 슬라이드 안의 이미지가 모두 로드될 때까지 기다린다(인쇄 전에 빈 사진이 찍히지 않도록). */
export function whenImagesLoaded(root) {
  const images = [...root.querySelectorAll("img")];
  const settle = (img) =>
    new Promise((resolve) => {
      img.addEventListener("load", resolve, { once: true });
      img.addEventListener("error", resolve, { once: true });
    });
  return Promise.all(images.filter((img) => !img.complete).map(settle));
}
