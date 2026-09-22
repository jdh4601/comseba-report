import { next } from "@vercel/functions";

import { checkBasicAuth } from "./lib/auth.mjs";

/**
 * Vercel은 public/ 파일을 Express를 거치지 않고 바로 내보내므로, 화면 파일까지 막으려면 라우팅 미들웨어에서도 인증한다.
 * 비밀번호 환경변수가 없으면 공개 상태로 두지 않고 503으로 닫는다.
 */
export const config = { runtime: "nodejs" };

export default function middleware(request) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) {
    return new Response("대시보드 비밀번호(DASHBOARD_PASSWORD)가 설정되지 않았습니다.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  const auth = { user: process.env.DASHBOARD_USER || "comseba", password };
  if (checkBasicAuth(request.headers.get("authorization"), auth)) return next();
  return new Response("인증이 필요합니다.", {
    status: 401,
    headers: { "Content-Type": "text/plain; charset=utf-8", "WWW-Authenticate": 'Basic realm="Comseba Report", charset="UTF-8"' },
  });
}
