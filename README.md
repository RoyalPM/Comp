# TenderTripwire

An evidence-linked tender-preparation agent for a narrow, clearly synthetic procurement scenario. It finds a product-certificate mismatch, checks an alternative lot, asks a reviewer before generating a preparation ZIP, and revokes that packet when a corrigendum changes the requirements.

**All documents, suppliers and standards are fictional. No live tender submission, signature, EMD/payment or private financial data is used.**

## The working loop

1. A local Qwen3-1.7B model interprets the goal as a bounded plan: ordered lots and whether to propose packet preparation. An explicit required-lot directive is validated; an omitted or extra lot gets one model repair attempt, then blocks if still wrong.
2. It selects constrained document-discovery, source-reading, search and evaluation tools. Tool names, document IDs and lot enums are validated.
3. Deterministic tools check exact product/standard/holder/date/capacity/authorization evidence and emit document/page/line/quote/hash citations. Missing or conflicting evidence cannot pass.
4. A suitable result can produce a revision-bound proposal. The model has **no approval tool**.
5. A separate explicit reviewer action grants approval and generates a ZIP. Idempotency keys and serialized state updates prevent duplicate packets.
6. A synthetic corrigendum invalidates evaluations, approvals and packets. A fresh model run identifies the new mandatory test-report gap. Old downloads return HTTP 409.

This is a **bounded model-planned workflow**, not an unconstrained general procurement agent. The model decides a plan and evidence/tool actions; deterministic state gates enforce the plan order, retrieval budgets, completion criteria, approvals and output validity. No fabricated private reasoning is displayed. The audit contains concise model-selected actions, actual tool observations and persisted state changes.

## Run without an API account

Requirements: Linux x86_64, Node.js 24, Bash, curl, tar, SHA-256 utilities; roughly 3 GB available RAM and 3 GB free disk for the model/runtime. A browser is needed for the UI. No account or API key is required.

```sh
bash scripts/setup-local-model.sh
bash scripts/container-run.sh
```

Open `http://127.0.0.1:8787`. The pinned official model download is approximately **1.83 GB** and is verified by SHA-256. Internet is needed for initial setup, not for local inference after setup. The launcher runs the model on localhost only, with two generation threads and a 4096-token context.

On machines where the official GitHub/Hugging Face URLs are unreachable, obtain the exact official artifacts through a permitted download route and verify the listed hashes. Do not bypass security restrictions or substitute unverified binaries. Apple Silicon/Windows require an appropriate official llama.cpp build; the included automatic installer targets Linux x86_64 only.

### Already have a local model server?

```sh
MODEL_BASE_URL=http://127.0.0.1:8082/v1 \
MODEL_NAME=tendertripwire-1.7b \
node src/server.js
```

A compatible remote API can be configured with `MODEL_API_KEY`; that is optional, may incur provider charges, and was not used for the verified demonstration. Never put keys in the browser, repository, public image, YAML manifest or screenshot.

### Supported goal scope

Use an explicit first line to bind the required lot set. The default UI, live acceptance script, container check and manifest use:

```text
Required lots: A, B.
Compare Lot A and Lot B. Request approval for a preparation packet only for a lot that passes every evidence check.
```

For a single-lot recheck use `Required lots: B.` on its own first line. A or B alone, or both once, are supported. The model still chooses the lot order, preparation intent and evidence/tool actions. Its proposed lot set is validated, gets one real corrective inference request if wrong, and otherwise stops before tools. The software never inserts a fabricated successful plan.

Prefix-free free-form goals remain experimental and can omit intended work. An actual CI run over conditional alternative wording completed only Lot A; its required Lot B assertion failed and publication was blocked. The explicit scope contract addresses that specific omission; it does not establish broad natural-language reliability. Historical replay/model measurements predate this scope repair and remain labelled as those recorded runs.

### Deterministic fixture mode

```sh
npm start
```

Without model configuration, the UI explicitly labels its fixture walkthrough. This mode is useful for testing evidence/approval/ZIP mechanics and is **not live AI inference**. A live run that fails never silently switches to fixtures.

## Verify

```sh
npm run check
npm test
npm run demo                   # explicitly labelled deterministic test walkthrough
node scripts/verify-live.js    # requires the local model endpoint; real model calls
```

The test suite covers source integrity, exact citations, missing/contradictory evidence, invalid dates, numeric bounds, document injection, model tool restrictions, false-ready summaries, approval binding, concurrency/idempotency, real filesystem persistence, ZIP CRC/content, rollback, cross-origin requests, amendment revocation and run limits. Model mocks are clearly labelled and are separate from real inference acceptance tests.

See `docs/VERIFICATION.md` for measured results and untested boundaries; do not confuse a passing fixture suite with live-model performance.

## Docker and aiKart package

```sh
docker build -f Dockerfile.local-model -t tendertripwire:local .
docker run --rm --cpus=2 --memory=4g -p 127.0.0.1:8787:8787 tendertripwire:local
# Optional persistent demo storage:
docker compose -f deploy/compose.yaml up --build
```

`Dockerfile.local-model` includes the pinned model/runtime at image build time. `Dockerfile` is the smaller app-only image for an external compatible inference server. The first GitHub Actions run built the image and executed the model inside enforced 2-CPU/4-GiB/no-network limits. That run failed the required-Lot-B acceptance check and correctly blocked publication. [Revised run 36827123779](https://github.com/RoyalPM/Comp/actions/runs/36827123779) passed all 104 tests, 33 UI assertions and the real A/B acceptance in 134 seconds total, then pushed the image. Public package visibility and anonymous pull remain unverified.

`deploy/aikart-agent.yaml` follows the official draft guide's JSON/file runner contract, resource limits and no-network mode. Its image is pinned to the successfully pushed/tested digest below. Before organizer use, the owner must make the GHCR package public and anonymous pull must be verified. The one-shot runner reads `/aikart/input.json` or `AIKART_INPUT` and writes `/aikart/output.json` as `{format,response}`. It analyzes and requests review; it cannot create a packet because there is no interactive reviewer approval in that run.

Verified pushed image: `ghcr.io/royalpm/tendertripwire-bharat-agentic@sha256:06da9c58f0a42b6e635514af77a83505fb714412ed6b2547f4c9f9934a99664f`. Runtime source commit: `897ed1087658580510b7a06cd14ac4683004f55b`. This proves a successful registry push, not anonymous availability.

The organizer's sandbox is described as upcoming. This template is not proof of submission, registration, listing approval, or organizer execution. Hosted replay and the runnable local application are independent demonstration options.

## Public recorded demonstration

https://tendertripwire-verified-replay.kundankuber.chatgpt.site

This owner-approved public link contains only fictional source documents and actual recorded model/tool events. It is a read-only accelerated replay, not a live hosted AI service. It creates no new approval or packet. Use the local application for fresh goals and live inference.

## UI and API

- `POST /api/session` creates a synthetic baseline/missing/conflict/injection session
- `POST /api/run` invokes live inference or explicitly chosen fixture mode
- `GET /api/state?session=…` shows persisted state and actual audit events
- `POST /api/evaluate` performs a labelled human-initiated deterministic check
- `POST /api/approve` requires the exact current proposal, explicit confirmation and idempotency key
- `POST /api/corrigendum` applies the synthetic requirement change
- `GET /api/packet?session=…&packet=…` validates current approval and revision before serving a ZIP

The app binds to localhost by default. Its opaque session IDs are not a production authentication system. Do not expose the Node demo publicly without adding authentication, rate limits and operational controls. The thin Cloudflare Worker adapter is exploratory/unverified deployment code; a native model cannot run in a 128 MB Worker isolate.

## Data and package integrity

State is atomically persisted in `data/<session>.json`; the directory is excluded from Git. Source hashes cover canonical UTF-8 JSON `{id,version,pages}` in that order. The ZIP includes `sources.json`, a hash manifest, exact evidence files, evaluation, checklist and audit. The manifest describes the hash scheme so it is reproducible. Source filenames are never accepted as proof of eligibility.

## Scope and limitations

- Hand-authored synthetic selectable-text schema, two lots; no arbitrary PDF upload/OCR
- Exact-match deterministic standards checks; no claim to interpret real procurement law
- Supplier capacity is a statement in the fixture, not independently audited
- Small local model; measured examples do not establish general reliability
- UI screenshot/video may use a **read-only replay of recorded real inference**, visibly labelled; it does not host the live model
- No public repository, image, tender submission or final competition form is sent without owner review

See `docs/ARCHITECTURE.md`, `docs/FOUNDER_GUIDE.md` and `docs/ATTRIBUTION.md` for explanation, demo guidance, licences and AI-assistance disclosure.
