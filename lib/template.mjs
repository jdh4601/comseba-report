import JSZip from "jszip";
import pptxgen from "pptxgenjs";

import { buildLayout } from "../public/shared/layout.mjs";
import { EMBEDDED_ASSETS } from "./embedded-assets.mjs";

/**
 * 공통 레이아웃(public/shared/layout.mjs)을 pptxgenjs로 그려 3페이지 PPTX를 만든다.
 * 배치를 바꿀 때는 이 파일이 아니라 layout.mjs를 고친다.
 */

const embeddedDataUrl = (ref) => {
  const asset = EMBEDDED_ASSETS[ref];
  return asset ? `${asset.type};base64,${asset.base64}` : null;
};

const toDataUrl = (buffer, type = "image/jpeg") => (buffer ? `${type};base64,${Buffer.from(buffer).toString("base64")}` : null);

const lineOption = (color, width) => (color ? { color, width } : { type: "none" });

function addText(slide, { x, y, w, h, text, style }) {
  const content = Array.isArray(text) ? text.map((item) => ({ text: item.text, options: item.style ?? {} })) : text;
  slide.addText(content, { isTextBox: true, margin: 0, x, y, w, h, ...style });
}

function addElement(pres, slide, element) {
  const { x, y, w, h } = element;
  switch (element.kind) {
    case "text":
      return addText(slide, element);
    case "rect":
      return slide.addShape(element.radius ? pres.shapes.ROUNDED_RECTANGLE : pres.shapes.RECTANGLE, {
        x, y, w, h,
        ...(element.radius ? { rectRadius: element.radius } : {}),
        fill: { color: element.fill },
        line: lineOption(element.line, element.lineWidth),
      });
    case "line":
      return slide.addShape(pres.shapes.LINE, { x, y, w, h, line: { color: element.color, width: element.width } });
    case "image":
      if (element.src) return slide.addImage({ data: element.src, x, y, w, h });
      slide.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: "FFFFFF" }, line: { color: "D8D6D1", width: 0.75 } });
      return addText(slide, { x, y, w, h, text: "사진을 선택해 주세요", style: { fontFace: "나눔고딕", fontSize: 9, color: "666663", align: "center", valign: "middle" } });
    default:
      throw new Error(`알 수 없는 레이아웃 요소입니다: ${element.kind}`);
  }
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

/**
 * @param report 보고서 데이터
 * @param loadImage (ref) => Promise<Buffer | null>. 저장소에 있는 사진을 읽는다. assets/ 이미지는 내장본을 쓴다.
 */
export async function buildDeck(report, { loadImage = async () => null } = {}) {
  const photoSrcs = await Promise.all(
    (report.photos ?? []).map(async (photo) => {
      if (!photo.file) return null;
      return embeddedDataUrl(photo.file) ?? toDataUrl(await loadImage(photo.file));
    }),
  );

  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE";
  pres.title = "컴세바 60분 융합 체험수업 결과보고서";
  for (const elements of buildLayout(report, { logo: embeddedDataUrl("assets/logo.png"), photos: photoSrcs })) {
    const slide = pres.addSlide();
    slide.background = { color: "FFFFFF" };
    for (const element of elements) addElement(pres, slide, element);
  }
  return fixHangulCharset(await pres.write({ outputType: "nodebuffer" }));
}
