#!/bin/zsh
cd "$(dirname "$0")"
URL="http://127.0.0.1:${PORT:-4180}"
if curl -s -o /dev/null "${URL}/api/meta"; then
  echo "보고서 생성기가 이미 켜져 있습니다. 브라우저를 엽니다: ${URL}"
  open "${URL}"
  exit 0
fi
[ -d node_modules ] || npm install
(sleep 1.5 && open "${URL}") &
npm start
