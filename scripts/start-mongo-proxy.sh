#!/usr/bin/env bash
# Bridge WSL -> Windows MongoDB (Compass localhost:27017).
# MongoDB on Windows binds to 127.0.0.1 only, so WSL cannot reach it directly.

set -euo pipefail

PROXY_JS="C:\\Users\\hp\\mongo-wsl-proxy.js"
NODE_EXE="/mnt/c/Program Files/nodejs/node.exe"
WIN_HOST="$(ip route show | awk '/default/ {print $3; exit}')"
PORT=27018

if ! timeout 1 bash -c "echo >/dev/tcp/${WIN_HOST}/${PORT}" 2>/dev/null; then
  if [[ ! -x "$NODE_EXE" ]]; then
    echo "Windows Node.js not found at $NODE_EXE"
    exit 1
  fi
  "$NODE_EXE" "$PROXY_JS" >/tmp/mongo-wsl-proxy.log 2>&1 &
  sleep 1
fi

echo "Mongo proxy: mongodb://${WIN_HOST}:${PORT}/rag-document -> Windows localhost:27017"
echo "Set MONGODB_URI=mongodb://${WIN_HOST}:${PORT}/rag-document"
