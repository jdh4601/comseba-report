import { timingSafeEqual } from "node:crypto";

const sameText = (a, b) => {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
};

/**
 * HTTP Basic 인증 헤더를 확인한다. 비밀번호가 설정되지 않았으면(로컬 실행) 모두 통과시킨다.
 * 비교는 길이 차이 외의 시간 차가 나지 않도록 timingSafeEqual을 쓴다.
 */
export function checkBasicAuth(authorization, { user, password }) {
  if (!password) return true;
  if (!String(authorization ?? "").startsWith("Basic ")) return false;
  const decoded = Buffer.from(authorization.slice(6), "base64").toString("utf8");
  const separator = decoded.indexOf(":");
  if (separator === -1) return false;
  return sameText(decoded.slice(0, separator), user) && sameText(decoded.slice(separator + 1), password);
}
