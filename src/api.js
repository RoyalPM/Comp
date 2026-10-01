import { createState, publicState, executeTool, approvePacket, buildPacket, applyCorrigendum, assertPacketCurrent, TripwireError } from './core.js';
import { runtimeInfo, runController } from './controller.js';
import { makeZip } from './zip.js';
export const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });

export async function handleApi(request, store, config = {}) {
  const url = new URL(request.url), path = url.pathname;
  try {
    if (request.method === 'GET' && path === '/api/health') return json({ status: 'ok', app: 'TenderTripwire', synthetic: true, runtime: runtimeInfo(config) });
    if (request.method === 'GET' && path === '/api/state') return json({ state: publicState(await store.get(url.searchParams.get('session'))), runtime: runtimeInfo(config) });
    if (request.method === 'GET' && path === '/api/packet') {
      const state = await store.get(url.searchParams.get('session')), packet = state.packets.find(p => p.id === url.searchParams.get('packet'));
      await assertPacketCurrent(state, packet);
      return new Response(makeZip(packet.files), { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="TenderTripwire-Lot-${packet.lot}-revision-${packet.revision}.zip"`, 'Cache-Control': 'no-store' } });
    }
    if (request.method !== 'POST') throw new TripwireError('NOT_FOUND', 'Endpoint not found.', 404);
    const origin = request.headers.get('origin');
    if (origin && origin !== url.origin) throw new TripwireError('ORIGIN_REJECTED', 'Cross-origin state changes are not accepted.', 403);
    if (!request.headers.get('content-type')?.includes('application/json')) throw new TripwireError('JSON_REQUIRED', 'Send an application/json request.', 415);
    const raw = await request.text();
    if (raw.length > 32768) throw new TripwireError('REQUEST_TOO_LARGE', 'Request exceeds the 32 KB limit.', 413);
    let body; try { body = JSON.parse(raw); } catch { throw new TripwireError('INVALID_JSON', 'Request JSON could not be parsed.', 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new TripwireError('INVALID_JSON', 'Request must be an object.', 400);
    if (path === '/api/session') {
      const state = await createState(body.scenario ?? 'baseline'); await store.put(state);
      return json({ state: publicState(state), runtime: runtimeInfo(config) }, 201);
    }
    let extra = {};
    if (path === '/api/run') {
      const before = await store.get(body.session);
      if (before.runs.filter(r => Date.now() - new Date(r.startedAt).getTime() < 60000).length >= 3) throw new TripwireError('RATE_LIMIT', 'Wait a minute before starting another run.', 429);
      extra.run = await runController({ store, session: body.session, goal: body.goal, mode: body.mode ?? 'live', config });
    } else if (path === '/api/evaluate') {
      await store.mutate(body.session, async state => {
        extra.result = await executeTool(state, 'evaluate_lot', { lot: body.lot }, 'human');
        if (extra.result.status === 'suitable') await executeTool(state, 'request_packet_approval', { lot: body.lot }, 'human');
      });
    } else if (path === '/api/approve') {
      await store.mutate(body.session, async state => {
        // A repeated client request reuses exactly the same approved proposal and ZIP.
        let approval;
        if (body.confirmed === true && state.approval?.proposalId === body.proposalId && state.idempotency[body.idempotencyKey]) approval = state.approval;
        else approval = await approvePacket(state, { proposalId: body.proposalId, confirmed: body.confirmed }, 'human');
        const packet = await buildPacket(state, { approvalId: approval.id, idempotencyKey: body.idempotencyKey });
        // Serialize ZIP before committing state; an encoding error cannot leave a successful packet record.
        makeZip(packet.files);
        extra.packet = { id: packet.id, lot: packet.lot, revision: packet.revision, fileCount: Object.keys(packet.files).length };
      });
    } else if (path === '/api/corrigendum') await store.mutate(body.session, async state => { extra.result = await applyCorrigendum(state); });
    else throw new TripwireError('NOT_FOUND', 'Endpoint not found.', 404);
    return json({ state: publicState(await store.get(body.session)), runtime: runtimeInfo(config), ...extra });
  } catch (error) {
    return json({ error: { code: error.code || 'INTERNAL_ERROR', message: error instanceof TripwireError ? error.message : 'The operation failed safely. Existing state was preserved.' } }, error.status || 500);
  }
}
