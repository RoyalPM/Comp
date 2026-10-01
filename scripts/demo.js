import { createState, executeTool, approvePacket, buildPacket, applyCorrigendum } from '../src/core.js';
import { makeZip } from '../src/zip.js';
import { mkdir, writeFile } from 'node:fs/promises';
const s = await createState();
console.log('DETERMINISTIC TEST WALKTHROUGH — NOT A LIVE MODEL RUN');
for (const lot of ['A', 'B']) { const e = await executeTool(s, 'evaluate_lot', { lot }, 'fixture'); console.log(`Lot ${lot}: ${e.status}`); }
const p = await executeTool(s, 'request_packet_approval', { lot: 'B' }, 'fixture');
console.log('Simulating the human approval API boundary for this test fixture only.');
const a = await approvePacket(s, { proposalId: p.id, confirmed: true });
const packet = await buildPacket(s, { approvalId: a.id, idempotencyKey: 'test-fixture-packet' });
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/deterministic-test-packet.zip', makeZip(packet.files));
await applyCorrigendum(s); console.log(`After corrigendum: ${(await executeTool(s, 'evaluate_lot', { lot: 'B' }, 'fixture')).status}; prior packet ${packet.status}`);
await writeFile('artifacts/deterministic-test-trace.json', JSON.stringify(s, null, 2));
