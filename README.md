# 컴세바 60분 융합 체험수업 보고서 생성기

학생 정보, 관심 분야, 학생이 말한 "해결하고 싶은 문제"를 입력하면 AI가 보고서 내용을 작성하고
3페이지짜리 PPTX 보고서를 만들어 주는 프로그램입니다. 선생님 컴퓨터에서 실행하며, 브라우저 화면으로 사용합니다.

- 1페이지(수업 설계·IT 분야 설명)는 모든 학생이 같습니다.
- 2페이지(문제 정의·해결 아이디어)와 3페이지(진로탐구활동)는 AI가 학생에 맞춰 작성합니다.
- **API 키가 없어도 됩니다.** 선생님 컴퓨터에 로그인된 Claude Code 또는 Codex를 그대로 사용합니다.

## 가장 쉬운 설치: AI에게 붙여넣기

코딩을 몰라도 됩니다. **Claude Code** 또는 **Codex**에 아래 글을 그대로 붙여넣으면, AI가 설치부터 실행까지 알아서 진행합니다.
Claude 데스크톱 앱의 Code 탭, Codex 앱, 터미널의 `claude`·`codex` 어디에 붙여넣어도 됩니다.

1. 아래 회색 상자 오른쪽 위의 복사 버튼을 누릅니다.
2. Claude Code 또는 Codex 대화창에 붙여넣고 보냅니다.
3. AI가 명령을 실행해도 되는지 물으면 허락합니다. 1분 정도 뒤에 브라우저에 보고서 생성기가 열립니다.

```text
컴세바 보고서 생성기(https://github.com/jdh4601/comseba-report)를 내 컴퓨터에 설치하고 실행해 줘. 나는 코딩을 전혀 모르니까, 필요한 일은 네가 직접 하고 결과만 쉬운 말로 알려 줘.

0. 이 프로그램은 터미널의 `claude` 또는 `codex` 명령으로 AI를 부른다. 터미널에서 둘 중 하나라도 실행되는지 확인해. 둘 다 없으면 `curl -fsSL https://claude.ai/install.sh | bash`로 Claude Code를 설치해. 설치한 뒤 로그인이 필요하면, 내가 터미널 앱을 열고 `claude`를 입력해서 로그인하는 방법을 알려 주고, 내가 끝냈다고 하면 이어서 진행해.
1. Node.js 20 이상이 있는지 확인해. 없으면 설치해 줘. Mac에 Homebrew가 있으면 `brew install node`를 쓰고, 없으면 https://nodejs.org 의 LTS 설치 파일을 받아 설치해. 비밀번호 입력처럼 내가 직접 해야 하는 일이 있으면 무엇을 하면 되는지 한 단계씩 알려 줘.
2. 홈 폴더에 `comseba-report` 폴더가 없으면 `git clone https://github.com/jdh4601/comseba-report.git ~/comseba-report`로 받아. git이 없으면 https://github.com/jdh4601/comseba-report/archive/refs/heads/main.zip 을 받아서 `~/comseba-report`에 풀어. 폴더가 이미 있으면 `git pull`로 최신 버전으로 바꿔.
3. `~/comseba-report`에서 `npm install`을 실행해.
4. `npm start`를 백그라운드로 실행해서 서버를 켜. 4180 포트를 이미 다른 프로그램이 쓰고 있으면 `PORT=4181 npm start`처럼 빈 포트를 써.
5. `curl -X POST http://127.0.0.1:4180/api/test-connection`(포트를 바꿨으면 그 포트)으로 AI 연결을 확인해. `"ok":true`가 나와야 성공이야. 실패하면 오류 문구를 읽고 원인을 고쳐 줘(예: claude나 codex에 로그인되어 있지 않음).
6. 브라우저에서 http://127.0.0.1:4180 을 열어 줘.
7. 마지막에 다음 내용을 쉬운 말로 짧게 알려 줘. 터미널 명령어는 보여 주지 마.
   - 설치된 폴더 위치
   - 다음부터 실행하는 방법: Finder에서 홈 폴더의 `comseba-report` 폴더를 열고 `보고서 생성기 시작.command`를 더블클릭한다. 이미 켜져 있으면 브라우저만 열린다.
   - 지금 켜 둔 프로그램은 컴퓨터를 끄거나 다시 시작하면 함께 꺼진다는 점

API 키는 필요 없어. 이 컴퓨터에 로그인된 Claude Code 또는 Codex를 그대로 써.
```

설치가 끝난 뒤에는 Finder에서 홈 폴더의 `comseba-report` 폴더를 열고 `보고서 생성기 시작.command`를 더블클릭하면 실행됩니다.
AI에게 붙여넣기가 어렵거나 직접 설치하고 싶다면 아래 순서를 따릅니다.

## 직접 설치하기 (처음 한 번만)

### 1. Node.js 설치

[nodejs.org](https://nodejs.org/ko)에서 **LTS** 버전을 내려받아 설치합니다(20 이상이면 됩니다).
설치되었는지는 터미널에서 다음 명령으로 확인합니다.

```bash
node --version
```

### 2. AI 프로그램 설치와 로그인 (둘 중 하나만 있으면 됩니다)

**Claude Code** (Claude Pro·Max 구독 또는 Anthropic 계정)

```bash
curl -fsSL https://claude.ai/install.sh | bash
claude        # 처음 실행하면 브라우저가 열리고 로그인합니다. 로그인 후 /exit 로 나옵니다.
```

**Codex CLI** (ChatGPT Plus·Pro 등 구독 또는 OpenAI 계정)

```bash
npm install -g @openai/codex
codex         # 처음 실행하면 로그인 화면이 나옵니다. 로그인 후 종료합니다.
```

로그인까지 마쳤다면 이 프로그램은 별도 설정 없이 바로 연결됩니다.
둘 다 설치되어 있으면 Claude Code를 먼저 쓰고, 오른쪽 위 **⚙ 설정**에서 언제든 바꿀 수 있습니다.

### 3. 이 프로그램 내려받기

터미널에서 받는 방법입니다.

```bash
git clone https://github.com/jdh4601/comseba-report.git
cd comseba-report
```

git을 쓰지 않는다면 GitHub 페이지에서 **Code → Download ZIP**으로 받아 압축을 풀어도 됩니다.

## 실행하기

**Mac:** 폴더 안의 `보고서 생성기 시작.command`를 더블클릭합니다.
처음 실행할 때 필요한 부품을 자동으로 설치하고, 브라우저에서 http://127.0.0.1:4180 을 엽니다.

> "확인되지 않은 개발자" 경고가 나오면 파일을 **마우스 오른쪽 클릭 → 열기**로 실행합니다.
> 그래도 막히면 아래 터미널 방법을 씁니다.

**터미널:**

```bash
npm install   # 처음 한 번
npm start     # 실행 후 브라우저에서 http://127.0.0.1:4180 접속
```

> Mac에서 확인한 방법입니다. Windows에서는 아직 확인하지 않았습니다.

프로그램을 끄려면 실행 중인 터미널 창에서 `Ctrl + C`를 누르거나 창을 닫습니다.

### 연결 확인

오른쪽 위 **⚙ 설정 → AI 연결 확인**을 누릅니다. 몇 초 뒤 "OK" 응답이 오면 준비가 끝난 것입니다.

## 사용 방법

1. 학생 정보와 난이도(초등·중등·고등)를 입력하고, MAIN·SUB 분야를 고릅니다.
   난이도는 3페이지 진로탐구활동에서 쓰는 수학 개념의 범위와 문장 수준을 정합니다.
2. **해결하고 싶은 문제**에 학생이 한 말을 그대로 적습니다.
   칸 아래의 예시 버튼(교실 온도, 매점 줄 등)을 누르면 예시 문장이 채워집니다.
3. **보고서 생성**을 누르면 약 1분 뒤 2·3페이지 내용과 사진 2장이 채워집니다.
4. 칸별로 직접 고치거나 섹션별로 **다시 생성**합니다. 사진은 **사진 검색** 또는 **직접 올리기**로 바꿉니다.
5. **미리보기**로 확인한 뒤 **PPTX 다운로드**를 누르고, PowerPoint에서 PDF로 내보냅니다.
   바로 출력하려면 **인쇄**를 누릅니다.

만든 보고서는 `data/students/` 폴더에 저장되고, 오른쪽 위 **저장된 보고서 불러오기**에서 다시 열 수 있습니다.
학생 자료는 이 컴퓨터에만 저장되며 GitHub에 올라가지 않습니다.

## 선택 설정

모두 오른쪽 위 **⚙ 설정**에서 합니다. 입력한 키는 `data/settings.json`에만 저장되고 GitHub에 올라가지 않습니다.

| 항목 | 설명 |
|---|---|
| AI 연결 방식 | Claude CLI, Codex CLI(키 필요 없음) 또는 Claude API, OpenAI API(키 필요, 사용량만큼 과금) |
| 모델 | Claude는 Sonnet(기본)·Haiku·Opus 중에서 고릅니다. Codex·OpenAI는 이름을 직접 입력하고, 비우면 기본 모델을 씁니다. |
| Unsplash Access Key | 넣으면 Unsplash 사진을 씁니다. 없으면 Wikimedia Commons 사진을 씁니다. |

환경변수 `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `UNSPLASH_ACCESS_KEY`도 인식합니다.

## 문제가 생겼을 때

| 증상 | 해결 방법 |
|---|---|
| `claude 명령을 찾을 수 없습니다` 또는 `codex 명령을 찾을 수 없습니다` | 2단계 설치를 다시 확인합니다. 설치 직후라면 터미널을 새로 열고 실행합니다. |
| AI 연결 확인이 실패함 | 터미널에서 `claude` 또는 `codex`를 직접 실행해 로그인되어 있는지 확인합니다. |
| `npm`을 찾을 수 없음 | 1단계 Node.js 설치를 확인하고 터미널을 새로 엽니다. |
| 4180 포트를 이미 사용 중 | 이미 켜져 있는 창이 있는지 확인하거나 `PORT=4181 npm start`로 다른 포트를 씁니다. |
| PPTX 글꼴이 다르게 보임 | 3페이지는 바탕(Batang) 글꼴을 씁니다. PowerPoint(Mac은 PowerPoint for Mac)에서 열면 됩니다. |

미리보기와 인쇄는 브라우저가 직접 그리므로, 줄바꿈 위치가 PowerPoint와 조금 다를 수 있습니다.
최종본은 PPTX를 PowerPoint에서 PDF로 내보내는 편이 가장 정확합니다.

## 우리 학원에 맞게 바꾸기

- 로고와 예시 사진: `assets/` 폴더의 파일을 바꾼 뒤, 아래 **내장 이미지 다시 만들기** 명령을 실행합니다.
- 문제 예시 버튼: `public/app.js`의 `PROBLEM_EXAMPLES` 목록을 고칩니다.
- 분야 목록과 글자 수 상한: `lib/schema.mjs`를 고칩니다.

## 라이선스

MIT License. 자세한 내용은 [LICENSE](LICENSE)를 참고하세요.

## (선택) Vercel에 올려서 쓰기

여러 선생님이 인터넷 주소 하나로 함께 쓰려면 Vercel에 배포할 수 있습니다. 배포본은 아이디·비밀번호로 보호됩니다.

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

## 개발자용 안내

### 구조

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

### 테스트

```bash
npm test
```
