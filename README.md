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
- 미리보기: LibreOffice (`brew install --cask libreoffice`), poppler(`pdftoppm`)
- PowerPoint for Mac: 탐구활동의 바탕(Batang) 글꼴이 PowerPoint 안에 들어 있습니다.

## 사용 흐름

1. 학생 정보, 난이도(초등·중등·고등), MAIN·SUB 분야, 학생이 한 문제 문장(+선택 메모)을 입력합니다.
   난이도는 3p 진로탐구활동에서 쓰는 수학 개념의 범위와 문장 수준을 정합니다.
2. **보고서 생성** → 약 1분 뒤 2·3페이지 내용과 사진 2장이 채워집니다.
   사진은 후보들의 설명을 AI가 비교해 사진 설명에 가장 맞는 것을 고릅니다.
3. 칸별로 고치거나 섹션별 **다시 생성**, 사진은 **사진 검색**/**직접 올리기**로 바꿉니다.
4. **미리보기**로 확인하고 **PPTX 다운로드** → PowerPoint에서 PDF로 내보냅니다.
   바로 출력할 때는 **인쇄**(LibreOffice로 만든 PDF를 브라우저 인쇄 창으로 엽니다).

미리보기·인쇄는 LibreOffice 렌더링이라 문장부호 앞에 공백이 보일 수 있지만, PPTX에는 없습니다.
학부모님께 드리는 최종본은 PPTX를 PowerPoint에서 PDF로 내보내는 편이 가장 깔끔합니다.

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
| `lib/preview.mjs` | LibreOffice로 인쇄용 PDF와 2·3페이지 PNG 미리보기 |
| `server.mjs` | Express API, `public/` 화면 |
| `data/` | 학생별 보고서 JSON, 사진, 설정·API 키 (git 제외) |

글자 수 상한이나 레이아웃을 바꿀 때는 `lib/schema.mjs`와 `lib/template.mjs`를 함께 고칩니다.

## 테스트

```bash
npm test
```
