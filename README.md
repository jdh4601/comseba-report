# 컴세바 60분 융합 체험수업 보고서 생성기

학생 정보·관심 분야·해결하고 싶은 문제를 입력하면 AI(Claude CLI 또는 Codex CLI)가
2·3페이지를 작성하고, 3페이지짜리 PPTX 보고서를 만드는 로컬 대시보드입니다.
1페이지(수업 설계·IT 분야 설명)는 모든 학생이 같습니다.

## 실행

`보고서 생성기 시작.command`를 더블클릭하거나 터미널에서 실행합니다.

```bash
npm install   # 처음 한 번
npm start     # http://127.0.0.1:4180
```

## 필요한 것

- Node.js 20 이상
- AI 연결 4가지 중 하나. 오른쪽 위 **⚙ 설정**에서 고릅니다.
  - Claude CLI / Codex CLI: 이 컴퓨터에 로그인된 CLI를 씁니다. 키가 필요 없습니다.
  - Claude API / OpenAI API: API 키를 설정 창에 입력합니다(사용량만큼 과금). 환경변수 `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`도 인식합니다.
  - Claude는 Sonnet(기본)·Haiku·Opus 중에서 고릅니다. OpenAI는 모델 이름을 직접 입력하고, 비우면 `gpt-5.4`를 씁니다.
- (권장) Unsplash Access Key: **⚙ 설정**에 한 번 입력하면 `data/settings.json`(git 제외)에 저장됩니다.
  없으면 Wikimedia Commons 사진을 씁니다. 환경변수 `UNSPLASH_ACCESS_KEY`도 인식합니다.
- PowerPoint for Mac: 탐구활동의 바탕(Batang) 글꼴이 PowerPoint 안에 들어 있습니다.

## 사용 흐름

1. 학생 정보, 난이도(초등·중등·고등), MAIN·SUB 분야, 학생이 한 문제 문장(+선택 메모)을 입력합니다.
   난이도는 3p 진로탐구활동에서 쓰는 수학 개념의 범위와 문장 수준을 정합니다.
2. **보고서 생성** → 약 1분 뒤 2·3페이지 내용과 사진 2장이 채워집니다.
   사진은 후보들의 설명을 AI가 비교해 사진 설명에 가장 맞는 것을 고릅니다.
3. 칸별로 고치거나 섹션별 **다시 생성**, 사진은 **사진 검색**/**직접 올리기**로 바꿉니다.
4. **미리보기**로 확인하고 **PPTX 다운로드** → PowerPoint에서 PDF로 내보냅니다.
   바로 출력할 때는 **인쇄**(브라우저에서 슬라이드를 실제 크기로 그려 인쇄 창을 엽니다).

미리보기·인쇄는 브라우저가 직접 그리므로 예전처럼 문장부호 앞에 공백이 생기지 않습니다.
다만 글꼴이 달라 줄바꿈 위치가 PowerPoint와 조금 다를 수 있어, 최종본은 PPTX를 PowerPoint에서 PDF로 내보내는 편이 가장 정확합니다.

## Vercel 배포본

주소: https://comseba-report.vercel.app (아이디·비밀번호로 보호)

로컬 실행과 다른 점은 다음과 같습니다.

| 항목 | 로컬 | Vercel |
|---|---|---|
| AI 연결 | Claude/Codex CLI, Claude/OpenAI API | Claude API, OpenAI API만 (서버에 CLI가 없음) |
| API 키 | 설정 창에서 입력 → `data/settings.json` | 환경변수만: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `UNSPLASH_ACCESS_KEY` |
| 보고서·사진 저장 | `data/` 폴더 | Vercel Blob 비공개 저장소 |
| 미리보기·인쇄 | 브라우저에서 그림 | 같음 (LibreOffice 필요 없음) |
| 접속 보호 | 없음(내 컴퓨터) | `DASHBOARD_USER`, `DASHBOARD_PASSWORD`로 로그인 |

환경변수를 바꿀 때는 다음처럼 등록한 뒤 다시 배포합니다.

```bash
printf 'sk-ant-...' | vercel env add ANTHROPIC_API_KEY production --sensitive
vercel deploy --prod
```

`DASHBOARD_PASSWORD`가 없으면 화면은 503으로 닫힙니다(공개 상태로 열리지 않습니다).
학생 자료는 `.vercelignore`로 배포 대상에서 제외하므로, 로컬 `data/` 내용은 올라가지 않습니다.

## 구조

| 파일 | 역할 |
|---|---|
| `lib/schema.mjs` | 칸별 글자 수 상한·개수·섹션 정의 (템플릿 레이아웃에서 역산) |
| `lib/example.mjs` | 급식 잔반 예시. 테스트 기준값이자 프롬프트 모범 답안 |
| `lib/prompt.mjs` | 생성·수정·섹션 재생성 프롬프트, 학교급별 수학 개념 범위(`LEVEL_GUIDES`) |
| `lib/generate.mjs` | 생성 → 점검 → 오류 피드백으로 최대 2회 고쳐 쓰기 |
| `lib/validate.mjs` | 글자 수·개수·MAIN/SUB/수학 연결 점검 |
| `lib/ai.mjs` | Claude/Codex CLI, Claude API(SDK), OpenAI API 호출과 모델 목록 |
| `lib/photos.mjs` | Unsplash/Wikimedia 사진 검색, AI 사진 선택 프롬프트, 2:1 자르기 |
| `lib/template.mjs` | pptxgenjs 3페이지 템플릿 (한글 charset 보정 포함) |
| `public/shared/layout.mjs` | PPTX와 브라우저가 함께 쓰는 3페이지 배치 정의 |
| `public/slides.mjs` | 공통 배치를 브라우저에서 그리는 미리보기·인쇄 렌더러 |
| `server.mjs` | Express API, `public/` 화면, 환경에 맞는 저장소·provider 선택 |
| `lib/auth.mjs`, `middleware.js` | 비밀번호 보호(Express + Vercel 라우팅 미들웨어) |
| `lib/pptxgen.cjs` | pptxgenjs를 CommonJS로 불러오는 얇은 껍데기 (Vercel 호환) |
| `lib/embedded-assets.mjs` | 로고·예시 사진을 base64로 담은 자동 생성 파일 |
| `data/` | 로컬 실행용 보고서 JSON, 사진, 설정·API 키 (git·배포 제외) |

### 내장 이미지 다시 만들기

`assets/`의 로고나 예시 사진을 바꾸면 다음을 실행해 `lib/embedded-assets.mjs`를 다시 만듭니다.

```bash
node -e 'const fs=require("fs");const files={"assets/logo.png":"image/png","assets/photo_lunch.jpg":"image/jpeg","assets/photo_bin.jpg":"image/jpeg"};let out="export const EMBEDDED_ASSETS = {\n";for(const [f,t] of Object.entries(files))out+=`  ${JSON.stringify(f)}: { type: ${JSON.stringify(t)}, base64: ${JSON.stringify(fs.readFileSync(f).toString("base64"))} },\n`;out+="};\n";fs.writeFileSync("lib/embedded-assets.mjs",out)'
```

슬라이드 배치는 `public/shared/layout.mjs` 한 곳에서만 고칩니다. PPTX와 브라우저 미리보기·인쇄가 이 파일을 함께 씁니다.

글자 수 상한이나 레이아웃을 바꿀 때는 `lib/schema.mjs`와 `lib/template.mjs`를 함께 고칩니다.

## 테스트

```bash
npm test
```
