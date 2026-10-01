# Build and third-party attribution

TenderTripwire's application, synthetic documents, deterministic validators, controller, UI, packet generator and tests were created fresh on 1 October 2026 for this hackathon work. The team must review the code, contribute its own product decisions, and be able to explain the implementation. Do not claim unaided human authorship.

## AI assistance

OpenAI-powered coding/research assistants contributed architecture, implementation, testing, documentation, and presentation preparation. Their engineering model is distinct from the standalone runtime model. No assistant subscription, private coding endpoint, or hidden credential is used by the runnable application.

## Runtime model and engine

- Qwen3-1.7B-GGUF Q8_0, Qwen team, Apache-2.0: https://huggingface.co/Qwen/Qwen3-1.7B-GGUF
- Pinned model revision: `90862c4b9d2787eaed51d12237eafdfe7c5f6077`
- Model SHA-256: `061b54daade076b5d3362dac252678d17da8c68f07560be70818cace6590cb1a`
- Model size: 1,834,426,016 bytes. Model weights are downloaded separately, not included in the source repository.
- llama.cpp b11312, ggml authors, MIT: https://github.com/ggml-org/llama.cpp
- Official release: https://github.com/ggml-org/llama.cpp/releases/tag/b11312
- Runtime archive SHA-256: `c250f4a85fb736b92ab369e531c2c769af4ad6180718c72ac0350e26678008de`
- Runtime checksum records the official-download bytes used. A release signature/attestation was not independently verified.
- Earlier development experiments used official Qwen3-0.6B Q8_0; integrated workflow quality was insufficient. Failed traces are retained in development evidence, not represented as successful demonstrations.

## Other components

- Node.js 24 and its standard library (HTTP, crypto, test runner, filesystem)
- The application has no npm runtime dependencies
- Docker official Node base image, Debian packages and system runtime dependencies, when building the optional container
- Browser system fonts and original inline SVG icons; no stock images or external font services
- Sites hosts the separately labelled, owner-approved public read-only replay; it is not the native model server

All supplier/tender identifiers and standards beginning `SYN-` are fictional. No authentic certificate, official tender, supplier contact, signature, payment detail or procurement submission is included.

## Demo narration

The accompanying demo audio, when included, uses local Piper v1.2.0 and the stock en_US-ljspeech-high voice. Piper is MIT; the voice repository is MIT and identifies the LJ Speech training dataset as public domain. Piper bundles eSpeak NG under GPLv3, so the generated audio is delivered without redistributing that runtime bundle. No custom voice clone, paid TTS endpoint or account was used. Full audio-production provenance is supplied with the media package.
