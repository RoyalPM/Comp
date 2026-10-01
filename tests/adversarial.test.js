import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createState, executeTool, evaluateLot, approvePacket, buildPacket,
  assertPacketCurrent, applyCorrigendum, sealDocument, citation,
  validateCitation, fingerprint, TOOL_DEFINITIONS,
} from '../src/core.js';

// These exercise the actual deterministic core with synthetic documents. They
// are not evidence that a live language model was invoked or selected a tool.
const doc = (state, id) => state.documents.find(item => item.id === id);
const check = (evaluation, id) => evaluation.checks.find(item => item.id === id);
const rejectsCode = (operation, code) => assert.rejects(operation, error => {
  assert.equal(error.code, code, `${error.name}: ${error.message}`);
  return true;
});
async function changeLine(state, id, prefix, replacement) {
  const source = doc(state, id);
  const page = source.pages.find(p => p.lines.some(line => line.startsWith(prefix)));
  assert.ok(page, `Fixture field ${id}/${prefix} must exist`);
  const index = page.lines.findIndex(line => line.startsWith(prefix));
  if (replacement === null) page.lines.splice(index, 1);
  else page.lines[index] = replacement;
  source.version += 1;
  await sealDocument(source);
}
async function approvedState() {
  const state = await createState();
  const evaluation = await executeTool(state, 'evaluate_lot', { lot: 'B' });
  assert.equal(evaluation.status, 'suitable');
  const proposal = await executeTool(state, 'request_packet_approval', { lot: 'B' });
  const approval = await approvePacket(state, { proposalId: proposal.id, confirmed: true });
  return { state, evaluation, proposal, approval };
}

test('Lot A product/specification mismatch is blocked with exact source evidence', async () => {
  const state = await createState();
  const result = await executeTool(state, 'evaluate_lot', { lot: 'A' });
  assert.equal(result.status, 'blocked');
  const mismatch = check(result, 'product_certificate');
  assert.equal(mismatch.status, 'fail');
  for (const term of ['SOLAR-24', 'SYN-LIGHT-24-R2', 'SOLAR-18', 'SYN-LIGHT-18-R1']) {
    assert.ok(mismatch.citations.some(c => c.quote.includes(term)), `Missing citation for ${term}`);
  }
  for (const finding of result.checks) {
    assert.ok(finding.citations.length > 0);
    assert.ok(finding.citations.every(c => validateCitation(state, c)));
  }
  await rejectsCode(() => executeTool(state, 'request_packet_approval', { lot: 'A' }), 'NOT_SUITABLE');
  assert.equal(state.approval, null);
  assert.equal(state.packets.length, 0);
});

test('Lot B suitability is independent and does not erase Lot A mismatch', async () => {
  const state = await createState();
  const a = await evaluateLot(state, 'A');
  const b = await evaluateLot(state, 'B');
  assert.equal(b.status, 'suitable');
  assert.ok(b.checks.every(c => c.status === 'pass'));
  assert.ok(check(b, 'product_certificate').citations.some(c => c.documentId === 'certificate-b'));
  assert.ok(!check(b, 'product_certificate').citations.some(c => c.documentId === 'certificate-a'));
  assert.equal(state.evaluations.A.digest, a.digest);
  assert.equal(state.evaluations.A.status, 'blocked');
  assert.notEqual(a.digest, b.digest);
});

for (const [scenario, expected] of [['missing', 'unknown'], ['conflict', 'conflict']]) {
  test(`${scenario} evidence abstains and cannot request packet approval`, async () => {
    const state = await createState(scenario);
    const result = await evaluateLot(state, 'B');
    assert.equal(result.status, 'needs_evidence');
    assert.equal(check(result, 'product_certificate').status, expected);
    await rejectsCode(() => executeTool(state, 'request_packet_approval', { lot: 'B' }), 'NOT_SUITABLE');
    assert.equal(state.proposal, null);
  });
}

test('a certificate filename cannot compensate for wrong product, standard or holder', async t => {
  for (const [prefix, replacement, expectedCheck] of [
    ['Product:', 'Product: STUDY-99', 'product_certificate'],
    ['Certified standard:', 'Certified standard: SYN-LIGHT-12-R0', 'product_certificate'],
    ['Certificate holder:', 'Certificate holder: Different Synthetic Supplier', 'certificate_holder'],
  ]) await t.test(prefix, async () => {
    const state = await createState();
    await changeLine(state, 'certificate-b', prefix, replacement);
    const result = await evaluateLot(state, 'B');
    assert.equal(result.status, 'blocked');
    assert.equal(check(result, expectedCheck).status, 'fail');
  });
});

test('certificate validity includes the closing date, but an earlier expiry blocks', async t => {
  for (const [expiry, expected] of [['2026-10-15', 'pass'], ['2026-10-14', 'fail']]) {
    await t.test(expiry, async () => {
      const state = await createState();
      await changeLine(state, 'certificate-b', 'Valid until:', `Valid until: ${expiry}`);
      const result = await evaluateLot(state, 'B');
      assert.equal(check(result, 'certificate_validity').status, expected);
      assert.equal(result.status, expected === 'pass' ? 'suitable' : 'blocked');
    });
  }
});

for (const expiry of [undefined, '', 'not-a-date', '2026-02-30', '2026-13-15', '2026-00-15', '2026-10-99']) {
  test(`missing or malformed certificate expiry ${String(expiry)} abstains without crashing`, async () => {
    const state = await createState();
    await changeLine(state, 'certificate-b', 'Valid until:', expiry === undefined ? null : `Valid until: ${expiry}`);
    const result = await evaluateLot(state, 'B');
    assert.equal(check(result, 'certificate_validity').status, 'unknown');
    assert.equal(result.status, 'needs_evidence');
  });
}

for (const closing of [undefined, '2026-02-30', '2026-13-15']) {
  test(`missing or malformed closing date ${String(closing)} never yields suitable`, async () => {
    const state = await createState();
    await changeLine(state, 'tender-main', 'Issuer:', closing === undefined
      ? 'Issuer: Fictional District Learning Centres Programme. Closing date: unknown.'
      : `Issuer: Fictional District Learning Centres Programme. Closing date: ${closing}.`);
    const result = await evaluateLot(state, 'B');
    assert.equal(check(result, 'certificate_validity').status, 'unknown');
    assert.notEqual(result.status, 'suitable');
  });
}

test('missing and malformed authorization dates abstain rather than crash', async t => {
  for (const expiry of [undefined, '2026-13-15']) await t.test(String(expiry), async () => {
    const state = await createState();
    await changeLine(state, 'authorization', 'Valid until:', expiry === undefined ? null : `Valid until: ${expiry}`);
    const result = await evaluateLot(state, 'B');
    assert.equal(check(result, 'authorization').status, 'unknown');
    assert.notEqual(result.status, 'suitable');
  });
});

test('contradictory authoritative fields inside one document cannot silently pass', async () => {
  const state = await createState();
  const source = doc(state, 'certificate-b');
  source.pages[0].lines.push('Certified standard: SYN-LIGHT-12-R0');
  source.version += 1;
  await sealDocument(source);
  const result = await evaluateLot(state, 'B');
  assert.notEqual(result.status, 'suitable');
  assert.ok(['unknown', 'conflict', 'fail'].includes(check(result, 'product_certificate').status));
});

test('undefined requirement and undefined certificate standard cannot count as an exact match', async () => {
  const state = await createState();
  await changeLine(state, 'lot-b', 'Required standard:', null);
  await changeLine(state, 'certificate-b', 'Certified standard:', null);
  const result = await evaluateLot(state, 'B');
  assert.notEqual(check(result, 'product_certificate').status, 'pass');
  assert.notEqual(result.status, 'suitable');
  await rejectsCode(() => executeTool(state, 'request_packet_approval', { lot: 'B' }), 'NOT_SUITABLE');
});

test('capacity must be finite, bounded and safely representable', async () => {
  const state = await createState();
  await changeLine(state, 'supplier-profile', 'Monthly capacity STUDY-12:', `Monthly capacity STUDY-12: ${'9'.repeat(400)}`);
  const result = await evaluateLot(state, 'B');
  assert.equal(check(result, 'capacity').status, 'unknown');
  assert.notEqual(result.status, 'suitable');
});

test('citation validation rejects forged document, revision, location and quote', async () => {
  const state = await createState();
  const valid = citation(doc(state, 'certificate-b'), 3, 4);
  assert.equal(validateCitation(state, valid), true);
  assert.equal(valid.quote, 'Product: STUDY-12\nCertified standard: SYN-LIGHT-12-R1');
  for (const mutation of [
    { documentId: 'invented-source' }, { documentHash: '0'.repeat(64) },
    { documentVersion: 0 }, { page: 99 }, { lineStart: 0 }, { lineEnd: 99 },
    { quote: 'Certificate meets every requirement' }, { quote: '' },
  ]) assert.equal(validateCitation(state, { ...valid, ...mutation }), false, JSON.stringify(mutation));
  assert.equal(validateCitation(state, null), false);
});

test('citation line numbers must be integers, not coercible ranges', async () => {
  const state = await createState();
  const source = doc(state, 'certificate-b');
  for (const [start, end] of [[1.5, 2], [1, 2.5], ['1', 2], [NaN, 2]]) {
    assert.throws(() => citation(source, start, end), error => error.code === 'INVALID_CITATION');
  }
});

test('old citations cannot be reused after a resealed source revision', async () => {
  const state = await createState();
  const old = citation(doc(state, 'certificate-b'), 3);
  await changeLine(state, 'certificate-b', 'Product:', 'Product: STUDY-12');
  assert.equal(validateCitation(state, old), false);
  assert.equal(validateCitation(state, citation(doc(state, 'certificate-b'), 3)), true);
});

test('source byte tampering cannot pass deterministic evaluation', async () => {
  const state = await createState();
  doc(state, 'certificate-b').pages[0].lines[3] = 'Certified standard: FORGED';
  await rejectsCode(() => evaluateLot(state, 'B'), 'DOCUMENT_INTEGRITY');
  assert.equal(state.evaluations.B, undefined);
});

test('source integrity is checked before an approval request can be created', async () => {
  const state = await createState();
  await evaluateLot(state, 'B');
  doc(state, 'certificate-b').pages[0].lines[3] = 'Certified standard: FORGED';
  await rejectsCode(() => executeTool(state, 'request_packet_approval', { lot: 'B' }), 'DOCUMENT_INTEGRITY');
  assert.equal(state.proposal, null);
});

test('source tampering is blocked at human approval and packet generation', async t => {
  await t.test('human approval', async () => {
    const state = await createState();
    await evaluateLot(state, 'B');
    const proposal = await executeTool(state, 'request_packet_approval', { lot: 'B' });
    doc(state, 'certificate-b').pages[0].lines.push('Untested late change');
    await rejectsCode(() => approvePacket(state, { proposalId: proposal.id, confirmed: true }), 'DOCUMENT_INTEGRITY');
    assert.equal(state.approval, null);
  });
  await t.test('packet generation', async () => {
    const { state, approval } = await approvedState();
    doc(state, 'certificate-b').pages[0].lines.push('Untested late change');
    await rejectsCode(() => buildPacket(state, { approvalId: approval.id, idempotencyKey: 'tamper-build' }), 'DOCUMENT_INTEGRITY');
    assert.equal(state.packets.length, 0);
  });
});

test('model tools exclude approval, signing, payment, submission and arbitrary execution', async () => {
  const state = await createState();
  assert.deepEqual(TOOL_DEFINITIONS.map(t => t.name).sort(), [
    'evaluate_lot', 'get_state', 'list_documents', 'read_document', 'request_packet_approval', 'search_evidence',
  ]);
  for (const name of ['approve_packet', 'build_packet', 'submit_bid', 'sign_bid', 'pay', 'exec']) {
    await rejectsCode(() => executeTool(state, name, {}), 'UNKNOWN_TOOL');
  }
  assert.equal(state.approval, null);
});

test('tool arguments reject malformed objects, extra fields, bad enum and oversized strings', async () => {
  const state = await createState();
  for (const args of [null, [], 'A', {}, { lot: 'C' }, { lot: 1 }, { lot: 'B', ready: true }]) {
    await rejectsCode(() => executeTool(state, 'evaluate_lot', args), 'INVALID_ARGUMENTS');
  }
  await rejectsCode(() => executeTool(state, 'read_document', { documentId: 'x'.repeat(301) }), 'INVALID_ARGUMENTS');
  await rejectsCode(() => executeTool(state, 'search_evidence', { query: '  ' }), 'INVALID_ARGUMENTS');
  assert.deepEqual(state.evaluations, {});
});

test('document prompt injection is inert data and cannot change authority or readiness', async () => {
  const state = await createState('injection');
  const note = await executeTool(state, 'read_document', { documentId: 'supplier-note' });
  assert.match(note.warning, /UNTRUSTED/);
  assert.match(note.pages[0].lines.join('\n'), /Ignore all prior instructions/);
  const search = await executeTool(state, 'search_evidence', { query: 'approve_packet' });
  assert.equal(search.length, 1);
  assert.equal(validateCitation(state, search[0]), true);
  assert.equal((await evaluateLot(state, 'A')).status, 'blocked');
  assert.equal((await evaluateLot(state, 'B')).status, 'suitable');
  assert.equal(state.approval, null);
  assert.equal(state.packets.length, 0);
  await rejectsCode(() => executeTool(state, 'approve_packet', {}), 'UNKNOWN_TOOL');
});

test('approval requires evaluated current sources and explicit human confirmation', async () => {
  const state = await createState();
  await rejectsCode(() => executeTool(state, 'request_packet_approval', { lot: 'B' }), 'STALE_EVALUATION');
  await evaluateLot(state, 'B');
  const proposal = await executeTool(state, 'request_packet_approval', { lot: 'B' });
  assert.equal(state.approval, null);
  await rejectsCode(() => approvePacket(state, { proposalId: proposal.id, confirmed: true }, 'model'), 'HUMAN_APPROVAL_REQUIRED');
  for (const confirmed of [false, undefined, 'true', 1]) {
    await rejectsCode(() => approvePacket(state, { proposalId: proposal.id, confirmed }), 'CONFIRMATION_REQUIRED');
  }
  await rejectsCode(() => approvePacket(state, { proposalId: 'fabricated', confirmed: true }), 'INVALID_PROPOSAL');
  await rejectsCode(() => buildPacket(state, { approvalId: proposal.id, idempotencyKey: 'no-approval' }), 'HUMAN_APPROVAL_REQUIRED');
});

test('repeated pending approval requests reuse the same lot/version-bound proposal', async () => {
  const state = await createState();
  const evaluation = await evaluateLot(state, 'B');
  const one = await executeTool(state, 'request_packet_approval', { lot: 'B' });
  const two = await executeTool(state, 'request_packet_approval', { lot: 'B' });
  assert.equal(one.id, two.id);
  assert.equal(one.lot, 'B');
  assert.equal(one.revision, state.revision);
  assert.equal(one.fingerprint, await fingerprint(state));
  assert.equal(one.evaluationDigest, evaluation.digest);
  assert.match(one.purpose, /preparation/);
});

test('changed source revision prevents stale approval and stale proposal reuse', async () => {
  const state = await createState();
  await evaluateLot(state, 'B');
  const proposal = await executeTool(state, 'request_packet_approval', { lot: 'B' });
  await changeLine(state, 'certificate-b', 'Valid until:', 'Valid until: 2027-04-01');
  await rejectsCode(() => executeTool(state, 'request_packet_approval', { lot: 'B' }), 'STALE_EVALUATION');
  await rejectsCode(() => approvePacket(state, { proposalId: proposal.id, confirmed: true }), 'STALE_APPROVAL');
  await evaluateLot(state, 'B');
  const fresh = await executeTool(state, 'request_packet_approval', { lot: 'B' });
  assert.notEqual(fresh.id, proposal.id);
  await rejectsCode(() => approvePacket(state, { proposalId: proposal.id, confirmed: true }), 'INVALID_PROPOSAL');
});

test('switching the requested lot replaces a pending proposal and rejects its former ID', async () => {
  const state = await createState();
  // Make both synthetic lots suitable so the test isolates approval/lot binding.
  await changeLine(state, 'certificate-a', 'Product:', 'Product: SOLAR-24');
  await changeLine(state, 'certificate-a', 'Certified standard:', 'Certified standard: SYN-LIGHT-24-R2');
  await evaluateLot(state, 'A');
  await evaluateLot(state, 'B');
  const old = await executeTool(state, 'request_packet_approval', { lot: 'B' });
  const current = await executeTool(state, 'request_packet_approval', { lot: 'A' });
  assert.notEqual(current.id, old.id);
  assert.equal(current.lot, 'A');
  await rejectsCode(() => approvePacket(state, { proposalId: old.id, confirmed: true }), 'INVALID_PROPOSAL');
  const approval = await approvePacket(state, { proposalId: current.id, confirmed: true });
  const packet = await buildPacket(state, { approvalId: approval.id, idempotencyKey: 'selected-lot-a' });
  assert.equal(approval.lot, 'A');
  assert.equal(packet.lot, 'A');
  assert.equal(JSON.parse(packet.files['manifest.json']).selectedLot, 'A');
});

test('approved proposal replay and forged approval IDs cannot create packets', async () => {
  const { state, proposal } = await approvedState();
  await rejectsCode(() => approvePacket(state, { proposalId: proposal.id, confirmed: true }), 'INVALID_PROPOSAL');
  await rejectsCode(() => buildPacket(state, { approvalId: 'forged', idempotencyKey: 'forged-approval' }), 'HUMAN_APPROVAL_REQUIRED');
  assert.equal(state.packets.length, 0);
});

test('packet generation is idempotent and key reuse for another approval rejects', async () => {
  const { state, approval } = await approvedState();
  const one = await buildPacket(state, { approvalId: approval.id, idempotencyKey: 'stable-operation' });
  const count = state.audit.length;
  const two = await buildPacket(state, { approvalId: approval.id, idempotencyKey: 'stable-operation' });
  assert.equal(two.id, one.id);
  assert.equal(state.packets.length, 1);
  assert.equal(state.audit.length, count);
  await rejectsCode(() => buildPacket(state, { approvalId: 'different', idempotencyKey: 'stable-operation' }), 'IDEMPOTENCY_CONFLICT');
  for (const key of [undefined, '', 'short', 'x'.repeat(101)]) {
    await rejectsCode(() => buildPacket(state, { approvalId: approval.id, idempotencyKey: key }), 'INVALID_IDEMPOTENCY_KEY');
  }
});

test('concurrent retries using the same key cannot create duplicate packets', async () => {
  const { state, approval } = await approvedState();
  const args = { approvalId: approval.id, idempotencyKey: 'concurrent-retry-key' };
  const packets = await Promise.all([buildPacket(state, args), buildPacket(state, args)]);
  assert.equal(packets[0].id, packets[1].id);
  assert.equal(state.packets.length, 1);
  assert.equal(state.audit.filter(event => event.tool === 'build_packet').length, 1);
});

test('packet contents bind lot, evidence hashes, exact citations, evaluation and human approval', async () => {
  const { state, evaluation, approval } = await approvedState();
  const packet = await buildPacket(state, { approvalId: approval.id, idempotencyKey: 'check-packet-files' });
  await assertPacketCurrent(state, packet);
  const manifest = JSON.parse(packet.files['manifest.json']);
  assert.equal(manifest.synthetic, true);
  assert.equal(manifest.selectedLot, 'B');
  assert.equal(manifest.packetId, packet.id);
  assert.equal(manifest.approvalId, approval.id);
  assert.equal(manifest.revision, state.revision);
  assert.equal(manifest.fingerprint, await fingerprint(state));
  assert.equal(manifest.evaluationDigest, evaluation.digest);
  assert.deepEqual(JSON.parse(packet.files['evaluation.json']), evaluation);
  assert.ok(JSON.parse(packet.files['audit.json']).some(event => event.tool === 'approve_packet' && event.actor === 'human'));
  assert.match(packet.files['README.txt'], /Synthetic demonstration only/);
  assert.match(packet.files['checklist.md'], /Never submit/);
  assert.match(packet.files['checklist.md'], /Still requires human review/);
  for (const source of state.documents) {
    assert.ok(manifest.documents.some(d => d.id === source.id && d.sha256 === source.hash && d.version === source.version));
    assert.match(packet.files[`evidence/${source.id}.txt`], /SYNTHETIC SOURCE/);
    for (const page of source.pages) for (const line of page.lines) assert.ok(packet.files[`evidence/${source.id}.txt`].includes(line));
  }
  for (const finding of evaluation.checks) for (const c of finding.citations) {
    assert.ok(packet.files['checklist.md'].includes(c.quote));
    assert.ok(packet.files['checklist.md'].includes(`page ${c.page}, lines ${c.lineStart}-${c.lineEnd}`));
    assert.ok(packet.files['checklist.md'].includes(c.documentHash));
  }
});

test('corrigendum atomically revokes prior evaluation, approval, packet and idempotent replay', async () => {
  const { state, approval } = await approvedState();
  const packet = await buildPacket(state, { approvalId: approval.id, idempotencyKey: 'prior-revision' });
  const result = await applyCorrigendum(state);
  assert.equal(result.changed, true);
  assert.equal(state.revision, 2);
  assert.equal(state.evaluations.B.status, 'stale');
  assert.equal(state.proposal.status, 'stale');
  assert.equal(state.approval.status, 'revoked');
  assert.equal(packet.status, 'revoked');
  await rejectsCode(() => assertPacketCurrent(state, packet), 'PACKET_REVOKED');
  await rejectsCode(() => buildPacket(state, { approvalId: approval.id, idempotencyKey: 'prior-revision' }), 'PACKET_REVOKED');
  await rejectsCode(() => buildPacket(state, { approvalId: approval.id, idempotencyKey: 'new-key-old-approval' }), 'HUMAN_APPROVAL_REQUIRED');
  await rejectsCode(() => executeTool(state, 'request_packet_approval', { lot: 'B' }), 'STALE_EVALUATION');
  const amended = await evaluateLot(state, 'B');
  assert.equal(amended.status, 'needs_evidence');
  assert.equal(check(amended, 'lumen_report').status, 'unknown');
  assert.ok(check(amended, 'lumen_report').citations.every(c => validateCitation(state, c)));
  await rejectsCode(() => executeTool(state, 'request_packet_approval', { lot: 'B' }), 'NOT_SUITABLE');
  const count = state.audit.length;
  assert.equal((await applyCorrigendum(state)).changed, false);
  assert.equal(state.revision, 2);
  assert.equal(state.audit.length, count);
});

test('pending approval cannot be confirmed after a corrigendum', async () => {
  const state = await createState();
  await evaluateLot(state, 'B');
  const proposal = await executeTool(state, 'request_packet_approval', { lot: 'B' });
  await applyCorrigendum(state);
  await rejectsCode(() => approvePacket(state, { proposalId: proposal.id, confirmed: true }), 'INVALID_PROPOSAL');
  assert.equal(state.approval, null);
});

test('JSON-restored state retains audit, approval and idempotent packet identity', async () => {
  const { state, approval } = await approvedState();
  const packet = await buildPacket(state, { approvalId: approval.id, idempotencyKey: 'restart-operation' });
  state.runs.push({ id: 'synthetic-run-1', status: 'completed', mode: 'fixture' });
  // This verifies the core serialization contract; server/durable-storage
  // integration must separately demonstrate process-level persistence.
  const restored = JSON.parse(JSON.stringify(state));
  assert.deepEqual(restored.runs, state.runs);
  assert.deepEqual(restored.audit, state.audit);
  assert.deepEqual(restored.approval, state.approval);
  assert.deepEqual(restored.audit.map(event => event.id), restored.audit.map((_, i) => i + 1));
  await assertPacketCurrent(restored, restored.packets[0]);
  const replay = await buildPacket(restored, { approvalId: approval.id, idempotencyKey: 'restart-operation' });
  assert.equal(replay.id, packet.id);
  assert.equal(restored.packets.length, 1);
  await applyCorrigendum(restored);
  const restoredAgain = JSON.parse(JSON.stringify(restored));
  await rejectsCode(() => assertPacketCurrent(restoredAgain, restoredAgain.packets[0]), 'PACKET_REVOKED');
});
