#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")/.."
mkdir -p runtime/bin
cd runtime
VERSION=b11312
MODEL_REVISION=90862c4b9d2787eaed51d12237eafdfe7c5f6077
MODEL=Qwen3-1.7B-Q8_0.gguf
MODEL_SHA256=061b54daade076b5d3362dac252678d17da8c68f07560be70818cace6590cb1a
ARCHIVE="llama-${VERSION}-bin-ubuntu-x64.tar.gz"
# This hash pins the bytes downloaded from the official release, not an independently verified signature.
RUNTIME_SHA256=c250f4a85fb736b92ab369e531c2c769af4ad6180718c72ac0350e26678008de
if ! printf '%s  %s\n' "$RUNTIME_SHA256" "$ARCHIVE" | sha256sum --check --status 2>/dev/null; then
  curl --fail --location --connect-timeout 20 --max-time 900 --output "$ARCHIVE.part" "https://github.com/ggml-org/llama.cpp/releases/download/${VERSION}/${ARCHIVE}"
  printf '%s  %s\n' "$RUNTIME_SHA256" "$ARCHIVE.part" | sha256sum --check
  mv "$ARCHIVE.part" "$ARCHIVE"
fi
if ! printf '%s  %s\n' "$MODEL_SHA256" "$MODEL" | sha256sum --check --status 2>/dev/null; then
  curl --fail --location --connect-timeout 20 --max-time 1800 --output "$MODEL.part" "https://huggingface.co/Qwen/Qwen3-1.7B-GGUF/resolve/${MODEL_REVISION}/${MODEL}"
  printf '%s  %s\n' "$MODEL_SHA256" "$MODEL.part" | sha256sum --check
  mv "$MODEL.part" "$MODEL"
fi
printf '%s  %s\n' "$MODEL_SHA256" "$MODEL" | sha256sum --check
printf '%s  %s\n' "$RUNTIME_SHA256" "$ARCHIVE" | sha256sum --check
tar --extract --gzip --file "$ARCHIVE" --directory bin --no-same-owner
cp ../licenses/QWEN-APACHE-2.0.txt ./QWEN-APACHE-2.0.txt
printf '%s\n' 'Qwen3-1.7B-GGUF Q8_0, Qwen Team. Apache License 2.0.' \
  'Official source: https://huggingface.co/Qwen/Qwen3-1.7B-GGUF' \
  "Pinned revision: $MODEL_REVISION" "Model SHA-256: $MODEL_SHA256" > MODEL-NOTICE.txt
printf 'Pinned Qwen3-1.7B and llama.cpp are ready. No API key or account is required.\n'
