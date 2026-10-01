/* READ-ONLY RECORDED REPLAY. This file never calls inference or grants new approval. */
'use strict';
window.tripwireReplay = (() => {
  const recordsPromise = fetch('/recording.json').then(r => { if (!r.ok) throw new Error('Verified recording unavailable'); return r.json(); });
  let selected = 'baseline', current = null;
  const clone = value => structuredClone(value);
  const runtime = { liveAvailable: false, model: 'Qwen3-1.7B · recorded', provider: 'Read-only replay', label: 'Recorded live inference', reason: 'This Site replays a verified local-model run. Use the separate runnable package for live inference.' };
  async function handle(path, data) {
    const records = await recordsPromise, record = records[selected];
    if (path.startsWith('/api/session')) {
      if (data?.scenario && !records[data.scenario]) throw new Error('No verified recording for that scenario is included in this version.');
      selected = data?.scenario || 'baseline';
      current = clone(records[selected].phases.find(p => p.name === 'initial').state);
      return { state: clone(current), runtime };
    }
    if (!current) current = clone(record.phases[0].state);
    if (path.startsWith('/api/state')) return { state: clone(current), runtime };
    if (path === '/api/run') {
      const amended = current.revision > 1, run = amended ? record.result.amendment?.run : record.result.run;
      if (!run) throw new Error('This recording contains no amended run. Choose the baseline recording.');
      const snapshots = record.snapshots.filter(s => s.runs.at(-1)?.id === run.id);
      for (const snapshot of snapshots) {
        current = clone(snapshot);
        window.dispatchEvent(new CustomEvent('tripwire-replay-state', { detail: clone(current) }));
        await new Promise(resolve => setTimeout(resolve, 650));
      }
      const phase = record.phases.find(p => p.name === (amended ? 'amended_evaluated' : 'evaluated'));
      current = clone(phase.state);
      return { state: clone(current), run, runtime };
    }
    if (path === '/api/approve') {
      const phase = record.phases.find(p => p.name === 'approved_packet');
      if (!phase || current.revision !== 1 || current.proposal?.status !== 'pending') throw new Error('No recorded reviewer-approved packet exists for this state.');
      current = clone(phase.state);
      return { state: clone(current), packet: current.packets[0], runtime };
    }
    if (path === '/api/corrigendum') {
      const phase = record.phases.find(p => p.name === 'corrigendum_stale');
      if (!phase) throw new Error('Use the baseline recording to inspect the corrigendum.');
      if (!current.packets.some(p => p.status === 'current')) throw new Error('Replay the evidence check and recorded reviewer approval first.');
      current = clone(phase.state);
      return { state: clone(current), result: { message: 'Recorded corrigendum event: the old packet was revoked by the live application.' }, runtime };
    }
    throw new Error('This is a read-only recording. Run the application package to create new results.');
  }
  return { handle };
})();
