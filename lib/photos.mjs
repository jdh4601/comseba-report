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

const UNSPLASH_API = "https://api.unsplash.com";

/** Unsplash 가로 사진 검색. 출처는 Unsplash 가이드라인 형식("작가 on Unsplash")으로 만든다. */
export async function searchUnsplash(query, { accessKey, fetchImpl = globalThis.fetch, limit = 12 } = {}) {
  const params = new URLSearchParams({ query, per_page: String(limit), orientation: "landscape", content_filter: "high" });
  const response = await fetchImpl(`${UNSPLASH_API}/search/photos?${params}`, {
    headers: { Authorization: `Client-ID ${accessKey}`, "Accept-Version": "v1" },
  });
  if (response.status === 401) throw new Error("Unsplash Access Key가 거부되었습니다. 설정에서 키를 확인해 주세요.");
  if (response.status === 403) throw new Error("Unsplash 시간당 요청 한도를 넘었습니다. 잠시 후 다시 시도해 주세요.");
  if (!response.ok) throw new Error(`Unsplash 검색에 실패했습니다 (HTTP ${response.status}).`);
  const body = await response.json();
  return (body.results ?? []).map((photo) => ({
    title: photo.alt_description || photo.description || "(설명 없음)",
    imageUrl: photo.urls.regular,
    thumbUrl: photo.urls.small,
    credit: `${photo.user?.name ?? "Unknown"} on Unsplash`,
    source: "unsplash",
    downloadLocation: photo.links?.download_location ?? "",
  }));
}

/** Unsplash API 약관상 사진을 실제로 쓸 때 download 엔드포인트를 한 번 호출해야 한다. */
export async function trackUnsplashDownload(downloadLocation, { accessKey, fetchImpl = globalThis.fetch } = {}) {
  if (!/^https:\/\/api\.unsplash\.com\//.test(String(downloadLocation ?? ""))) return;
  await fetchImpl(downloadLocation, { headers: { Authorization: `Client-ID ${accessKey}` } });
}

/** 키가 있으면 Unsplash, 없으면 Wikimedia Commons에서 찾는다. */
export async function searchPhotos(query, { unsplashKey, fetchImpl } = {}) {
  if (unsplashKey) return searchUnsplash(query, { accessKey: unsplashKey, fetchImpl });
  return (await searchCommons(query, { fetchImpl })).map((item) => ({ ...item, thumbUrl: item.imageUrl, source: "wikimedia" }));
}

/** 결과가 없을 때 다시 찾을 더 넓은 검색어. 한 단어짜리는 더 줄일 수 없으므로 빈 문자열을 돌려준다. */
export function shorterQuery(query) {
  const words = String(query ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return "";
  return words.slice(0, Math.max(1, Math.ceil(words.length / 2))).join(" ");
}

/** 사진 칸마다 후보들의 영어 설명을 보여 주고, 사진 설명에 가장 맞는 후보 번호를 고르게 한다. */
export function buildPhotoPickPrompt(slots) {
  const blocks = slots.map((slot, index) => {
    const list = slot.candidates.map((candidate, i) => `${i}. ${candidate.title}`).join("\n");
    return `## 칸 ${index}: ${slot.tag} — "${slot.caption}"\n${list}`;
  });
  return `학부모용 보고서에 넣을 사진을 고릅니다. 각 칸의 설명에 가장 잘 맞고, 학생·학교·일상 맥락에 어울리는 후보 번호를 하나씩 고릅니다. 광고 느낌이 강하거나 설명과 무관한 사진, 화면·문서·간판처럼 글자가 크게 찍힌 사진(screenshot, screen, text, sign 등)은 피합니다.

${blocks.join("\n\n")}

설명 없이 {"picks": [칸0의 번호, 칸1의 번호, ...]} 형식의 JSON만 출력합니다.`;
}

/** AI 답에서 고른 번호를 꺼낸다. 해석할 수 없거나 범위를 벗어나면 첫 번째 후보(0)를 쓴다. */
export function parsePhotoPicks(text, candidateCounts) {
  let picks = [];
  try {
    const source = String(text ?? "");
    picks = JSON.parse(source.slice(source.indexOf("{"), source.lastIndexOf("}") + 1)).picks ?? [];
  } catch {
    picks = [];
  }
  return candidateCounts.map((count, index) => {
    const pick = Number(picks[index]);
    return Number.isInteger(pick) && pick >= 0 && pick < count ? pick : 0;
  });
}

export async function downloadImage(url, { fetchImpl = globalThis.fetch } = {}) {
  // Wikimedia 원본은 upload., 축소본(thumburl)은 thumb. 호스트, Unsplash는 images. 호스트에서 내려온다.
  if (!/^https:\/\/((upload|thumb)\.wikimedia\.org|images\.unsplash\.com)\//.test(url)) throw new Error("Wikimedia·Unsplash 이미지 주소만 받을 수 있습니다.");
  const response = await fetchImpl(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`사진을 내려받지 못했습니다 (HTTP ${response.status}).`);
  return Buffer.from(await response.arrayBuffer());
}

/** 사진을 2:1로 잘라 JPEG 버퍼로 돌려준다. 피사체가 잘리지 않도록 attention 전략으로 중심을 잡는다. */
export async function cropPhoto(input) {
  return sharp(input)
    .rotate()
    .resize(PHOTO_WIDTH, PHOTO_HEIGHT, { fit: "cover", position: sharp.strategy.attention })
    .jpeg({ quality: 86 })
    .toBuffer();
}

/** 보고서 JSON에 들어 있는 사진 경로가 프로젝트의 사진 폴더를 벗어나지 않는지 확인한다. */
export function isSafePhotoPath(file) {
  return /^(assets|(data\/)?photos)\/[\w-]+\.(jpe?g|png)$/i.test(String(file ?? ""));
}
