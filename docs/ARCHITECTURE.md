# Architecture and trust boundaries

## One core, separate adapters

- `src/fixtures.js`: fictional source documents and one corrigendum, selectable text with stable page/line coordinates
- `src/core.js`: canonical source hashing, evidence parser/validator, citations, state mutations, approval, ZIP content and revocation
- `src/controller.js`: independent inference adapter, model-generated bounded plan, dynamically constrained tool actions, run limits and safe summaries
- `src/store.js`: atomically replaced JSON files and per-session mutation queue; in-memory adapter for tests
- `src/api.js`: same-origin JSON endpoints, validation, explicit approval and current-packet download checks
- `src/server.js`: dependency-free Node HTTP/static server
- `src/zip.js`: ZIP STORE writer, UTF-8 names, CRC32 and safe paths
- `src/aikart.js`: one-shot input/output contract
- `src/worker.js`: optional D1/Worker adapter, not a native-model hosting solution
- `public/`: self-contained responsive product UI

## Model versus deterministic authority

The default goal contains an explicit `Required lots: A, B.` first line. That user-visible directive binds the required lot set, while the model chooses the order, preparation intent and permitted evidence/tool actions. A model plan that omits or broadens explicit scope receives one corrective model request; a second mismatch stops before tools. Every planning request and rejected scope is audited. Prefix-free lot selection remains experimental and model-interpreted. A state machine narrows choices based on the model's ordered plan, completed actions, known document IDs and exhausted retrieval budgets. It does not manufacture model responses or replace failed inference with fixtures.

The model cannot assert a passed check, invent a source, grant approval, generate an arbitrary file, run a shell, contact a supplier, submit a tender or pay. Evaluations are computed from bounded synthetic document fields. Unknown data, conflicting authoritative fields and invalid dates produce a non-suitable state. The displayed completion summary is derived from verified state; unverified model prose cannot say a failed lot is ready or a bid was submitted.

## Immutable references and revision changes

Each source is sealed with SHA-256 over `{id,version,pages}`. Citations bind source ID, hash, version, page, integer line range and exact quote. Before evaluation, approval and packet generation, document bytes are checked against the stored hash. Approval binds selected lot, current source fingerprint, evaluation digest, revision, purpose and actor. Packet retrieval repeats those gates.

Applying a corrigendum occurs inside one serialized mutation: increment revision, add the source, mark evaluations stale, revoke proposal/approval and revoke every packet. A new model run cannot reuse the prior evaluation. Repeat amendments are idempotent.

## Concurrency and persistence

FileStore serializes per-session mutations, copies state, applies the mutation and atomically renames a mode-0600 JSON file. Failed mutations leave the previous file intact. A ZIP is encoded successfully before the successful state is committed. Duplicate human clicks reuse the same idempotency key/result; reuse for a different approval is rejected. Tests also exercise approval racing an amendment.

The optional D1 adapter uses optimistic version comparison. It is source-reviewed but not cloud-deployment-tested. Multi-process Node access to the same directory is outside the demo's supported configuration.

## Safety and production gaps

Source text is explicitly untrusted, including the injection fixture. Tools are allowlisted and argument-validated. Requests and goals are bounded. Runs are rate-limited, have a tool budget, detect loops and use a wall-clock deadline. Source-to-UI text is escaped.

The local demo has no production identity layer, encrypted database, retention policy, multi-tenant isolation, arbitrary-document extraction, external verifier or official procurement-portal integration. These are future engineering requirements, not delivered capabilities.
