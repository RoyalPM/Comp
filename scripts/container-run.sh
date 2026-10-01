#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")/.."
RUNTIME_DIR=${RUNTIME_DIR:-"$PWD/runtime"}
SERVER=$(find "$RUNTIME_DIR/bin" -type f -name llama-server -print -quit)
MODEL="$RUNTIME_DIR/Qwen3-1.7B-Q8_0.gguf"
if [[ -z "$SERVER" || ! -f "$MODEL" ]]; then
  echo 'Local model absent. Run bash scripts/setup-local-model.sh first.' >&2
  exit 1
fi
export LD_LIBRARY_PATH="$(dirname "$SERVER")${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export MODEL_BASE_URL=http://127.0.0.1:8082/v1 MODEL_NAME=tendertripwire-1.7b
"$SERVER" --model "$MODEL" --alias "$MODEL_NAME" --host 127.0.0.1 --port 8082 \
  --ctx-size 4096 --threads 2 --threads-batch 2 --parallel 1 --batch-size 256 \
  --ubatch-size 128 --gpu-layers 0 --jinja --reasoning off --offline > /tmp/tendertripwire-model.log 2>&1 &
MODEL_PID=$!
APP_PID=
trap '[[ -z "$APP_PID" ]] || kill "$APP_PID" 2>/dev/null || true; kill "$MODEL_PID" 2>/dev/null || true' EXIT INT TERM
for i in $(seq 1 30); do
  if curl --silent --fail http://127.0.0.1:8082/health >/dev/null; then break; fi
  kill -0 "$MODEL_PID" 2>/dev/null || { cat /tmp/tendertripwire-model.log >&2; exit 1; }
  sleep 1
done
curl --silent --fail http://127.0.0.1:8082/health >/dev/null || { echo 'Model startup timed out.' >&2; exit 1; }
if [[ "${1:-web}" == 'aikart' ]]; then
  node src/aikart.js
else
  node src/server.js & APP_PID=$!
  wait "$APP_PID"
fi
