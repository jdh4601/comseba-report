// pptxgenjs는 ESM·CJS 빌드를 함께 제공한다. Vercel은 서버의 .mjs 파일을 CommonJS로 불러오는데, 그 상태에서
// `import pptxgen from "pptxgenjs"`는 ESM 빌드를 집어 들어 함수가 죽는다. 반대로 createRequire로 감싸면
// Vercel의 의존성 추적이 이 패키지를 찾지 못해 배포 파일에서 빠진다.
// 이 CommonJS 파일을 거치면 추적에는 잡히고(정적 require), 실행할 때는 항상 CJS 빌드가 선택된다.
module.exports = require("pptxgenjs");
