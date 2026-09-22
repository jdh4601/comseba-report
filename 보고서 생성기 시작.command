#!/bin/zsh
cd "$(dirname "$0")"
[ -d node_modules ] || npm install
(sleep 1.5 && open http://127.0.0.1:4180) &
npm start
