# Founder explanation and demo guide

## A 20-second explanation

“TenderTripwire helps a small supplier catch a disqualifying document mismatch before preparing a bid. It checks exact evidence, looks at a suitable alternative, asks for human review, and withdraws the old packet when an amendment changes the requirements. This prototype uses fictional documents and a model running locally without an API account.”

## What to explain in your own words

1. **Why this problem:** requirements are spread across tender annexures, certificates and corrigenda. A filename or superficially similar certificate is not proof that the required product/revision is covered.
2. **Why an agent:** the model interprets an assignment, forms a bounded plan and selects evidence/tool actions across a changing state. It is not merely answering a question from one text prompt.
3. **Why deterministic checks:** product codes, standards, dates and quantities need exact validation. The model cannot turn a failing check into a passing one.
4. **Why approval:** the assistant can propose preparation; only a separate explicit reviewer action can create the package. No model tool grants that approval.
5. **Why the tripwire matters:** a changed source invalidates the evaluation, approval and output. A green label from yesterday is not trustworthy after a corrigendum.
6. **Why local inference:** no API account, key or per-call paid endpoint is needed after downloading the model. The measured small model has limitations, so the workflow is deliberately narrow and guarded.

## The live application sequence

1. Start the local model/application and open the UI. Confirm that the badge identifies the actual local model rather than fixture mode.
2. Choose **Baseline documents**. The initial screen must show unassessed lots.
3. Run: “Check Lot A. If its certificate does not satisfy the tender, investigate and evaluate Lot B as an alternative. Request approval for a preparation packet only if that alternative passes all evidence checks.”
4. Inspect Lot A’s product check. Show `lot-a` page 1 lines 3–4 against `certificate-a` page 1 lines 3–4: `SOLAR-24 / SYN-LIGHT-24-R2` versus `SOLAR-18 / SYN-LIGHT-18-R1`.
5. Inspect Lot B’s supported checklist and exact citations. Explain that “suitable” means suitable for this synthetic preparation task, not a legal eligibility guarantee.
6. Open the human-review dialog. Confirm the selected lot and document revision, then create the ZIP. Show the manifest, checklist and evidence index.
7. Apply Corrigendum 01. The old packet is revoked immediately; its prior URL fails with HTTP 409.
8. Re-run for Lot B. The new mandatory lumen-maintenance test report is absent. The model run finishes with a specific evidence gap and no valid approval.

The model may take roughly one to two minutes for the baseline on the measured two-thread CPU setup. If the video is accelerated, label the acceleration. Never replace a failed live inference with a fixture while keeping a live-model label.

## The hosted replay sequence

The owner-approved public replay Site is a presentation aid built from actual recorded model/tool/state events. It is visibly labelled **Recorded live inference · read-only replay**. It does not host the model, grant a new approval, regenerate files or accept new user goals. Its approval scene shows the automated acceptance test's reviewer boundary. The runnable application is the live deliverable.

Use accurate narration: “This is an accelerated replay of a real local-model run.” Do not call it a live hosted agent. Screenshots should preserve the replay and synthetic-data labels.

## Likely judge questions

**Is the AI actually running?**
Yes, the separate local application calls a self-hosted Qwen3-1.7B model through llama.cpp. The recorded acceptance evidence includes model choices, actual tool calls, timings and resulting state. Fixture tests and the hosted replay are labelled separately.

**Is the workflow hard-coded?**
The document schema and validation rules are deliberately bounded, and the state machine constrains safe transitions. The model generates the ordered lot plan and selects allowed evidence/actions. Completed steps, retrieval limits, unknown evidence and approvals narrow its choices. We do not claim unconstrained autonomy or support for arbitrary real tenders.

**What happens if it hallucinates?**
Unknown tools and invalid arguments are rejected. Readiness is computed from source evidence. The model's prose cannot override it. The application derives its displayed result from validated state. Source hashes, exact citations, human approval and stale-packet checks add independent controls.

**Does it resist prompt injection?**
The prototype has a malicious supplier-note fixture, deterministic tool-boundary tests and a real-model exposure test. It never gives the model approval/submission/payment tools. That is evidence for these tested cases, not a universal security guarantee.

**Can an MSME use it with a real tender today?**
Not safely as a procurement decision maker. This prototype needs arbitrary-document extraction, authentic portal/corrigendum retrieval, stronger evaluations, access controls, human review and domain validation before real use.

**What did the team contribute?**
Explain the product choice, scope, synthetic scenario design, risk prioritization, review decisions and understanding of the code. Disclose AI coding assistance and reused model/runtime libraries. Do not invent human contributions that did not occur.

**How would it make money?**
A per-packet or small-supplier/consultant subscription is a hypothesis to validate. No customer traction, revenue, accuracy in real tenders or monetary savings has been established.

## Submission review checklist

- Confirm registration and the organizer's actual deadline/timezone separately
- Review repository contents, no credentials/private supplier data/model weights
- Docker build and constrained real inference passed in GitHub Actions run 36827123779 (134 seconds, 2 CPUs, 4 GiB, no network)
- The YAML pins the tested public image digest; anonymous full-image pull passed separately in run 36829529273
- Review the five-slide deck and 2–3 minute video for truthful mode/timing claims
- Ensure judges have access to required links; an owner-private replay is not a public judge link
- Public repository, replay and image sharing were owner-approved; final competition form submission still requires owner review
