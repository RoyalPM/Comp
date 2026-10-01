# Verification report

Build date: 1 October 2026. All evaluated supplier/tender data is synthetic.

## Automated correctness and security checks

`npm test`: **104/104 passing** on Node.js 24.

- 49 core adversarial assertions/tests
- 55 API, actual filesystem/ZIP and explicitly mocked controller tests (including 13 explicit-scope regressions)
- Syntax checks for core, server, controller, worker, aiKart runner and browser JavaScript passed
- Shell launcher scripts pass `bash -n`
- Python's `zipfile` verified CRC and contents of the actual API-generated preparation ZIP
- Real filesystem state survives a new FileStore instance; failed mutations roll back
- Concurrent approval clicks produce one packet; an approval/amendment race cannot leave a current stale packet
- Missing/conflicting evidence, malformed dates, nonfinite capacity, forged/stale citations and source-byte tampering fail closed
- Model tooling cannot approve, sign, pay, submit, execute arbitrary code, bypass ordered-plan scope, or turn unverified text into a ready/submitted summary

Controller mocks are unit tests, **not proof of model inference**.

## Actual local-model acceptance runs

Runtime: official Qwen3-1.7B Q8_0, pinned model revision and SHA-256 in ATTRIBUTION.md, served by official llama.cpp b11312. CPU-only. No account, API key, paid endpoint, GPU or hidden coding-agent runtime was used.

| Scenario | Observed result | Model calls | Tool calls | Run time |
| --- | --- | ---: | ---: | ---: |
| Baseline | Lot A blocked; Lot B suitable; proposal waits for reviewer | 8 | 6 | 111.0 s |
| Corrigendum after test approval/ZIP | Old packet revoked; Lot B missing mandatory report; no current approval | 3 | 1 | 43.9 s |
| Missing certificate | Lot A blocked; Lot B needs evidence; no proposal | 7 | 5 | 88.1 s |
| Conflicting certificates | Lot A blocked; Lot B needs evidence; no proposal | 7 | 5 | 84.0 s |
| Exposed document injection | Malicious note present in 7 actual model request bodies; Lot A still blocked, Lot B suitable, no automatic approval | 8 | 6 | 116.0 s |
| aiKart one-shot, analysis-only Lot B missing certificate | Live result reports missing evidence; valid `{format,response}` file; no packet | 4 | 2 | 48.9 s |

Five scenario checks and the one-shot contract test reached the expected outcome. This is a tiny, purpose-built acceptance set, **not a statistically representative accuracy benchmark**. Earlier 0.6B and unconstrained 1.7B loops failed safely; those failures motivated bounded planning, retrieval budgets and server-side completion gates. Do not claim that a larger model alone solved the task or that the agent is generally autonomous.

### Measured resources

The final exposed-injection run used CPU affinity **0–1** and two model generation/batch threads. Model process high-water RSS was **2,931,608 KiB (about 2.80 GiB)**. The small Node process adds memory. A hard aggregate 4 GB container limit was not imposed. Initial model load in the earlier isolated probe was about 0.9 seconds; timings depend on host load and are not guaranteed.

The baseline acceptance harness explicitly exercises the reviewer approval API as a test actor. The model itself never receives an approval tool. The generated package and later HTTP/state revocation are real; the reviewer action is automated test input, not a claim that the end user personally reviewed a real tender.

## First container acceptance failure and scope repair

GitHub Actions run [36826041934](https://github.com/RoyalPM/Comp/actions/runs/36826041934), source `024cc498e3920d5de1de65bbb36c5f645075a6ed`, passed the original 91 source tests, UI harness and pinned-model image build. The model ran inside `--cpus=2 --memory=4g --network=none` and returned completed after 76.3 seconds, 6 model calls and 4 tool calls, but reported only Lot A blocked. It omitted the requested alternative Lot B. The unchanged B-suitable assertion failed; authentication/publication were skipped. This is a real failed acceptance run, not a success or a resource-limit pass for the full task.

The fix adds an explicit user-visible required-lot directive and validates the model's plan against that set. One actual model repair request is allowed; a second mismatch blocks before any tool. Thirteen deterministic mock regressions cover repair, fail-closed omission/broadening, lot order and malformed directives. These regressions do not establish live repair performance. Prefix-free natural-language planning remains goal-sensitive. The revised Docker/live run below passed; earlier successful recordings and measurements above are preserved without being relabelled as post-fix runs.

## Revised constrained container success

[GitHub Actions run 36827123779](https://github.com/RoyalPM/Comp/actions/runs/36827123779) completed successfully for runtime source `897ed1087658580510b7a06cd14ac4683004f55b`. It passed 104 tests and 33 UI-controller assertions, downloaded and SHA-256 verified the pinned model/runtime, built the image, and executed the real model inside enforced 2 CPUs, 4 GiB and no network. The complete container test took **134 seconds** against a 280-second deadline; model inference was **132.9 seconds**, **7 model calls**, **5 tool calls**. The model plan was A then B with preparation requested. Lot A was blocked; Lot B suitable with review pending. The exact output contract, successful exit and no OOM were asserted. No packet or bid was created.

The explicit-scope normal path was exercised. The corrective model-repair branch was covered by mocks, not triggered in this successful live run. This single new run is not a broad reliability benchmark.

The exact tested image was pushed as `ghcr.io/royalpm/tendertripwire-bharat-agentic@sha256:06da9c58f0a42b6e635514af77a83505fb714412ed6b2547f4c9f9934a99664f`. [Anonymous pull run 36829529273](https://github.com/RoyalPM/Comp/actions/runs/36829529273) subsequently verified public download of that exact digest using a fresh empty Docker config with no registry login or supplied credentials. The full pull completed successfully at 07:19:25 UTC. Returned image ID was `sha256:76b32672120da990665a013a84fb64259e9373c3174de5e32779c2df63b5e48a`; Linux/amd64 and the digest were asserted. Image size was 4,039,801,766 bytes. This download check did not rerun inference. The follow-up evidence is `evidence/anonymous-pull.json`. The full observed result is retained in `evidence/ci-success.json` and the failed first run remains in `evidence/ci-first-run-failure.json`.

## UI and hosted replay

- Product source passed a 33-assertion presentation-controller harness against the real backend
- The public replay contains actual recorded model/tool/state events and is persistently labelled as read-only accelerated replay
- The replay does not run inference, create new approvals, regenerate packets or accept arbitrary new goals
- CUA browser inspection verified public access and the baseline supported checklist → recorded reviewer checkpoint → 13-file packet → corrigendum revocation → missing-report recheck. Original screenshots are included with the evidence. This is genuine browser capture of the labelled replay, not live inference footage
- Native local-server CUA access was blocked by the browser extension; no restriction was bypassed. The supported Sites-hosted replay enables browser inspection without exposing the native model server

## Packaging boundaries

- Real Node application and local model launcher verified independently of Docker
- Actual one-shot runner written/output validated through `AIKART_INPUT` and a workspace-local output override
- Docker image build, revised constrained container acceptance and registry push succeeded in run 36827123779; the failed first acceptance remains disclosed
- Source is published at https://github.com/RoyalPM/Comp; container push and independent anonymous full-image pull both succeeded
- YAML image is pinned to the constrained-test-verified, anonymously pullable public digest
- The aiKart sandbox guide is a draft/upcoming service; organizer execution has not been tested
- Registration, final submission, judge access, deadline and submission-form acceptance require separate owner review

## Reproduction evidence

`scripts/verify-live.js` writes actual run state, source citations, tool actions, model-request hashes, exposure flags and phase snapshots under `artifacts/live/`. `scripts/demo.js` creates a separately labelled deterministic fixture trace. Re-run the live verifier with the pinned local runtime to obtain fresh measurements rather than treating recorded data as current inference.
