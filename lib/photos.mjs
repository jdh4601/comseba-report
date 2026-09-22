import sharp from "sharp";

const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
// Wikimedia는 연락처가 담긴 User-Agent가 없는 요청을 차단한다.
const USER_AGENT = "comseba-report-dashboard/0.1 (local tool; contact via comseba)";
const REUSABLE_LICENSE = /^(CC BY|CC0|Public domain|PD)/i;

/** 템플릿 사진 칸(2.9 × 1.45in)과 같은 2:1 비율. */
const PHOTO_WIDTH = 1200;
const PHOTO_HEIGHT = 600;

const stripTags = (html) => String(html ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

/** 재사용 가능한 라이선스의 비트맵 사진만 골라 후보 목록으로 돌려준다. */
export async function searchCommons(query, { fetchImpl = globalThis.fetch, limit = 12 } = {}) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrnamespace: "6",
    gsrlimit: String(limit),
    gsrsearch: `filetype:bitmap ${query}`,
    prop: "imageinfo",
    iiprop: "url|size|mime|extmetadata",
    iiurlwidth: "1600",
    iiextmetadatafilter: "LicenseShortName|Artist",
  });
  const response = await fetchImpl(`${COMMONS_API}?${params}`, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`Wikimedia 검색에 실패했습니다 (HTTP ${response.status}).`);
  const body = await response.json();

  return Object.values(body?.query?.pages ?? {})
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .flatMap((page) => {
      const info = page.imageinfo?.[0];
      const license = info?.extmetadata?.LicenseShortName?.value ?? "";
      if (!info || !/^image\/(jpeg|png|webp)$/.test(info.mime ?? "") || !REUSABLE_LICENSE.test(license)) return [];
      const fullArtist = stripTags(info.extmetadata?.Artist?.value) || "Unknown";
      const artist = [...fullArtist].length > 40 ? `${[...fullArtist].slice(0, 38).join("")}…` : fullArtist;
      return [{
        title: page.title.replace(/^File:/, ""),
        imageUrl: info.thumburl ?? info.url,
        width: info.width,
        height: info.height,
        license,
        credit: `${artist}, ${license}`,
      }];
    });
}

export async function downloadImage(url, { fetchImpl = globalThis.fetch } = {}) {
  // 원본은 upload., 축소본(thumburl)은 thumb. 호스트에서 내려온다.
  if (!/^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(url)) throw new Error("Wikimedia 이미지 주소만 받을 수 있습니다.");
  const response = await fetchImpl(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`사진을 내려받지 못했습니다 (HTTP ${response.status}).`);
  return Buffer.from(await response.arrayBuffer());
}

/** 사진을 2:1로 잘라 JPEG로 저장한다. 피사체가 잘리지 않도록 attention 전략으로 중심을 잡는다. */
export async function cropPhoto(input, outPath) {
  await sharp(input)
    .rotate()
    .resize(PHOTO_WIDTH, PHOTO_HEIGHT, { fit: "cover", position: sharp.strategy.attention })
    .jpeg({ quality: 88 })
    .toFile(outPath);
}

/** 보고서 JSON에 들어 있는 사진 경로가 프로젝트의 사진 폴더를 벗어나지 않는지 확인한다. */
export function isSafePhotoPath(file) {
  return /^(assets|data\/photos)\/[\w-]+\.(jpe?g|png)$/i.test(String(file ?? ""));
}
