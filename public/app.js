const $ = (id) => document.getElementById(id);

const state = { meta: null, report: null, main: "", sub: "" };

function el(tag, props = {}, children = []) {
  const node = Object.assign(document.createElement(tag), props);
  for (const child of [].concat(children)) if (child != null) node.append(child);
  return node;
}

async function api(path, { method = "GET", body } = {}) {
  const response = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? `요청 실패 (HTTP ${response.status})`);
  }
  return response;
}
const apiJson = async (path, options) => (await api(path, options)).json();

function setStatus(message, { error = false } = {}) {
  const status = $("status");
  status.hidden = !message;
  status.textContent = message ?? "";
  status.classList.toggle("error", error);
}

/** 오래 걸리는 작업 동안 버튼을 잠그고 경과 시간을 보여 준다. */
async function busy(button, label, task) {
  const buttons = document.querySelectorAll("button");
  buttons.forEach((b) => (b.disabled = true));
  const started = Date.now();
  const tick = () => setStatus(`${label} ${Math.round((Date.now() - started) / 1000)}초`);
  tick();
  const timer = setInterval(tick, 1000);
  try {
    const result = await task();
    setStatus("");
    return result;
  } catch (error) {
    setStatus(error.message, { error: true });
    return null;
  } finally {
    clearInterval(timer);
    buttons.forEach((b) => (b.disabled = false));
  }
}

// ---------- 경로 기반 값 읽기·쓰기 ----------
const getPath = (object, path) => path.split(".").reduce((node, key) => node?.[key], object);
function setPath(object, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  keys.reduce((node, key) => (node[key] ??= {}), object)[last] = value;
}
function limitFor(path) {
  const generic = path.replace(/\.\d+(?=\.|$)/g, ".*");
  const found = state.meta.limits.find(([p]) => p === generic);
  return found ? { min: found[1], max: found[2] } : null;
}

// ---------- 입력 패널 ----------
function today() {
  const d = new Date();
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function renderChips() {
  for (const kind of ["main", "sub"]) {
    const box = $(`${kind}Chips`);
    box.replaceChildren(
      ...state.meta.chips.map((chip) => {
        // 각 줄은 자기 선택만 강조하고, 다른 줄에서 고른 분야는 흐리게 표시해 중복 선택을 막는다.
        const other = kind === "main" ? state.sub : state.main;
        const cls = chip === state[kind] ? kind : chip === other ? "taken" : "";
        const button = el("button", { className: `chip ${cls}`, textContent: chip, type: "button" });
        button.addEventListener("click", () => {
          state[kind] = chip;
          $(`${kind}Custom`).value = "";
          renderChips();
        });
        return button;
      }),
    );
  }
}

function collectInput() {
  const main = $("mainCustom").value.trim() || state.main;
  const sub = $("subCustom").value.trim() || state.sub;
  return {
    student: {
      name: $("studentName").value.trim() || "[ 학생명 ]",
      school: $("studentSchool").value.trim() || "[ 학교 ]",
      grade: $("studentGrade").value.trim() || "[ 학년 ]",
      date: $("studentDate").value.trim() || today(),
    },
    interest: { main, sub },
    problemQuote: $("problemQuote").value.trim(),
    memo: $("memo").value.trim(),
  };
}

function fillInput(report) {
  const blankIfPlaceholder = (value) => (/^\[.*\]$/.test(value ?? "") ? "" : value ?? "");
  $("studentName").value = blankIfPlaceholder(report.student?.name);
  $("studentSchool").value = blankIfPlaceholder(report.student?.school);
  $("studentGrade").value = blankIfPlaceholder(report.student?.grade);
  $("studentDate").value = report.student?.date ?? today();
  for (const kind of ["main", "sub"]) {
    const value = report.interest?.[kind] ?? "";
    const inList = state.meta.chips.includes(value);
    state[kind] = inList ? value : "";
    $(`${kind}Custom`).value = inList ? "" : value;
  }
  $("problemQuote").value = report.problem?.quote ?? "";
  $("memo").value = report.memo ?? "";
  renderChips();
}

/** 결과를 수정한 뒤에도 왼쪽의 학생 정보·분야 변경이 반영되도록, 내보내기 직전에 합친다. */
function currentReport() {
  const input = collectInput();
  return { ...state.report, student: input.student, interest: input.interest, memo: input.memo };
}

// ---------- 결과 섹션 ----------
function field(path, label, { multiline = false, rows = 3 } = {}) {
  const limit = limitFor(path);
  const input = multiline ? el("textarea", { rows }) : el("input");
  input.value = getPath(state.report, path) ?? "";
  const count = el("span", { className: "count" });
  const updateCount = () => {
    const length = [...input.value].length;
    count.textContent = limit ? `${length} / ${limit.max}` : String(length);
    count.classList.toggle("bad", Boolean(limit) && (length > limit.max || length < limit.min));
  };
  input.addEventListener("input", () => {
    setPath(state.report, path, input.value);
    updateCount();
  });
  updateCount();
  return el("div", { className: "field" }, [el("label", {}, [label, input]), count]);
}

function pairRow(basePath, nameLabel, descKey, descLabel) {
  return el("div", { className: "row" }, [field(`${basePath}.name`, nameLabel), field(`${basePath}.${descKey}`, descLabel)]);
}

function sectionCard(key, children) {
  const button = el("button", { className: "ghost small", textContent: "다시 생성", type: "button" });
  button.addEventListener("click", () => regenerate(key));
  return el("div", { className: "section" }, [
    el("div", { className: "section-head" }, [el("h3", { textContent: state.meta.sections[key].label }), button]),
    el("div", { className: "section-body" }, children),
  ]);
}

function photoCard(index) {
  const photo = state.report.photos[index];
  const frame = el("div", { className: "photo-frame", textContent: photo.file ? "" : "사진 없음" });
  if (photo.file) frame.style.backgroundImage = `url("/${photo.file}")`;
  const query = el("input", { type: "text", value: photo.query ?? "", placeholder: "영어 검색어" });
  const search = el("button", { className: "ghost small", textContent: "사진 검색", type: "button" });
  const upload = el("input", { type: "file", accept: "image/*", hidden: true });
  const uploadButton = el("button", { className: "ghost small", textContent: "직접 올리기", type: "button" });
  const candidates = el("div", { className: "candidates" });

  const applyPhoto = ({ file, credit, source }) => {
    Object.assign(state.report.photos[index], { file, credit, source });
    renderSections();
  };
  search.addEventListener("click", async () => {
    state.report.photos[index].query = query.value;
    const data = await busy(search, "사진 검색 중", () => apiJson(`/api/photos/search?q=${encodeURIComponent(query.value)}`));
    if (!data) return;
    candidates.replaceChildren(
      ...(data.results.length ? data.results.slice(0, 9) : []).map((item) => {
        const button = el("button", { type: "button", title: `${item.title}\n${item.credit}` });
        button.style.backgroundImage = `url("${item.imageUrl}")`;
        button.addEventListener("click", async () => {
          const picked = await busy(button, "사진 저장 중", () => apiJson("/api/photos/pick", { method: "POST", body: item }));
          if (picked) applyPhoto(picked);
        });
        return button;
      }),
    );
    if (!data.results.length) candidates.replaceChildren(el("span", { className: "credit", textContent: "검색 결과가 없습니다. 다른 검색어를 써 보세요." }));
  });
  uploadButton.addEventListener("click", () => upload.click());
  upload.addEventListener("change", () => {
    const [file] = upload.files;
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const saved = await busy(uploadButton, "사진 올리는 중", () => apiJson("/api/photos/upload", { method: "POST", body: { dataUrl: reader.result } }));
      if (saved) applyPhoto(saved);
    };
    reader.readAsDataURL(file);
  });

  const credit = el("input", { value: photo.credit ?? "", placeholder: "출처 (직접 올린 사진은 비워도 됨)" });
  credit.addEventListener("input", () => (state.report.photos[index].credit = credit.value));

  return el("div", { className: "photo-card" }, [
    el("div", { className: "sub-title", textContent: photo.tag }),
    frame,
    field(`photos.${index}.caption`, "사진 설명"),
    el("div", { className: "photo-actions" }, [query, search, uploadButton, upload]),
    candidates,
    el("label", {}, ["출처 표기", credit]),
  ]);
}

function renderSections() {
  const r = state.report;
  $("sections").replaceChildren(
    sectionCard("problem", [
      field("problem.quote", "문제 한 문장 (따옴표 없이)"),
      field("problem.target", "대상"),
      field("problem.pain", "불편"),
      field("problem.goal", "목표"),
    ]),
    sectionCard("tech", [
      el("div", { className: "sub-title", textContent: "핵심 기술 3개" }),
      ...r.coreTech.map((_, i) => pairRow(`coreTech.${i}`, `핵심 기술 ${i + 1}`, "role", "하는 일")),
      el("div", { className: "sub-title", textContent: "지원 기술 2개" }),
      ...r.supportTech.map((_, i) => pairRow(`supportTech.${i}`, `지원 기술 ${i + 1}`, "role", "하는 일")),
      field("reason", "기술을 선택한 이유", { multiline: true }),
    ]),
    sectionCard("solution", [
      field("solution.summary", "문제 해결 방법 (4줄)", { multiline: true, rows: 4 }),
      el("div", { className: "sub-title", textContent: "문제 해결 과정 4단계" }),
      ...r.solution.steps.map((_, i) => pairRow(`solution.steps.${i}`, `${i + 1}단계`, "desc", "하는 일")),
      el("div", { className: "sub-title", textContent: "사진" }),
      el("div", { className: "photos" }, [photoCard(0), photoCard(1)]),
    ]),
    sectionCard("paper", [
      field("paper.titleLines.0", "탐구 제목 1줄"),
      field("paper.titleLines.1", "탐구 제목 2줄"),
      field("paper.abstract", "Abstract", { multiline: true, rows: 5 }),
      field("paper.intro", "Ⅰ. Introduction", { multiline: true, rows: 5 }),
    ]),
  );
}

function showWarnings(warnings) {
  const box = $("warnings");
  box.hidden = warnings.length === 0;
  box.replaceChildren(
    el("b", { textContent: "확인이 필요한 부분" }),
    el("ul", {}, warnings.map((warning) => el("li", { textContent: warning.message }))),
  );
}

function showReport(report, { id, warnings = [] } = {}) {
  state.report = report;
  $("empty").hidden = true;
  $("result").hidden = false;
  $("previewBox").hidden = true;
  $("savedLabel").textContent = id ? `저장됨: ${id}` : "";
  showWarnings(warnings);
  renderSections();
}

// ---------- 동작 ----------
async function generate() {
  const input = collectInput();
  if (!input.interest.main || !input.interest.sub) return setStatus("MAIN과 SUB 분야를 선택해 주세요.", { error: true });
  if (input.interest.main === input.interest.sub) return setStatus("MAIN과 SUB는 서로 다른 분야여야 합니다.", { error: true });
  if (!input.problemQuote) return setStatus("해결하고 싶은 문제를 입력해 주세요.", { error: true });
  const data = await busy($("generate"), "AI가 2·3페이지를 작성하고 사진을 찾는 중…", () => apiJson("/api/generate", { method: "POST", body: { input } }));
  if (!data) return;
  showReport(data.report, data);
  refreshSaved();
}

async function regenerate(section) {
  const data = await busy(null, `"${state.meta.sections[section].label}" 다시 생성 중…`, () =>
    apiJson("/api/regenerate", { method: "POST", body: { report: currentReport(), section } }),
  );
  if (!data) return;
  showReport(data.report, { warnings: data.warnings });
}

async function preview() {
  const data = await busy($("preview"), "미리보기 만드는 중…", () => apiJson("/api/preview", { method: "POST", body: { report: currentReport() } }));
  if (!data) return;
  const box = $("previewBox");
  box.hidden = false;
  box.replaceChildren(el("div", { className: "sub-title", textContent: "미리보기 (LibreOffice 렌더링이라 문장부호 앞 공백 등 PowerPoint와 조금 다를 수 있습니다)" }), ...data.images.map((src) => el("img", { src })));
  box.scrollIntoView({ behavior: "smooth" });
}

async function download() {
  const report = currentReport();
  const response = await busy($("download"), "PPTX 만드는 중…", () => api("/api/pptx", { method: "POST", body: { report } }));
  if (!response) return;
  const blob = await response.blob();
  const name = /filename\*=UTF-8''([^;]+)/.exec(response.headers.get("Content-Disposition") ?? "")?.[1];
  const link = el("a", { href: URL.createObjectURL(blob), download: name ? decodeURIComponent(name) : "report.pptx" });
  link.click();
  URL.revokeObjectURL(link.href);
  save();
}

async function save() {
  const data = await apiJson("/api/reports", { method: "POST", body: { report: currentReport() } }).catch((error) => setStatus(error.message, { error: true }));
  if (data) $("savedLabel").textContent = `저장됨: ${data.id}`;
  refreshSaved();
}

async function refreshSaved() {
  const { reports } = await apiJson("/api/reports");
  $("savedReports").replaceChildren(
    el("option", { value: "", textContent: "저장된 보고서" }),
    ...reports.map((item) => el("option", { value: item.id, textContent: `${item.date} ${item.name} (${item.main})` })),
  );
}

async function loadSaved(id) {
  if (!id) return;
  const { report } = await apiJson(`/api/reports/${encodeURIComponent(id)}`);
  fillInput(report);
  showReport(report, { id });
}

async function saveSettings() {
  await apiJson("/api/settings", { method: "PUT", body: { provider: $("provider").value, model: $("model").value } });
}

async function init() {
  state.meta = await apiJson("/api/meta");
  $("provider").replaceChildren(...Object.entries(state.meta.providers).map(([value, p]) => el("option", { value, textContent: p.label })));
  $("provider").value = state.meta.settings.provider;
  $("model").value = state.meta.settings.model;
  $("studentDate").value = today();
  renderChips();
  refreshSaved();

  $("provider").addEventListener("change", saveSettings);
  $("model").addEventListener("change", saveSettings);
  $("testConnection").addEventListener("click", async () => {
    const data = await busy($("testConnection"), "연결 확인 중…", () => apiJson("/api/test-connection", { method: "POST" }));
    if (data) setStatus(`연결 성공 (${data.seconds}초): ${data.reply}`);
  });
  $("generate").addEventListener("click", generate);
  $("preview").addEventListener("click", preview);
  $("download").addEventListener("click", download);
  $("save").addEventListener("click", save);
  $("savedReports").addEventListener("change", (event) => loadSaved(event.target.value));
  $("loadExample").addEventListener("click", () => {
    fillInput(state.meta.example);
    showReport(structuredClone(state.meta.example));
  });
  if (!state.meta.previewAvailable) $("preview").title = "LibreOffice가 없어 미리보기를 쓸 수 없습니다.";
}

init().catch((error) => setStatus(`초기화 실패: ${error.message}`, { error: true }));
