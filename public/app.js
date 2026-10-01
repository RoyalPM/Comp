/* TenderTripwire: presentation only. All checks, revision gates and packet permissions are enforced by the server. */
'use strict';
const $ = (id) => document.getElementById(id);
const icon = (name, cls = '') => `<svg${cls ? ` class="${cls}"` : ''} aria-hidden="true"><use href="#i-${name}"/></svg>`;
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ui = { state: null, runtime: null, selectedLot: 'A', sourceId: 'tender-main', citation: null, busy: false, running: false, mode: 'fixture', modeChosen: false, sourceKey: '', auditKey: '', sessionSerial: 0, modalProposal: null };
const defaultGoal = $('goal-input').value;
let toastTimer;
function toast(message, error = false) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').classList.toggle('error', error);
  $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, error ? 8500 : 5000);
}
async function api(path, data) {
  const response = await fetch(path, { method: data ? 'POST' : 'GET', headers: data ? { 'Content-Type': 'application/json' } : {}, body: data ? JSON.stringify(data) : undefined });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(payload.error?.message || `Request failed (${response.status}).`); error.code = payload.error?.code; throw error; }
  return payload;
}
function sourceValue(id, key) {
  const doc = ui.state?.documents.find(d => d.id === id);
  return doc?.pages.flatMap(p => p.lines).find(line => line.startsWith(`${key}: `))?.slice(key.length + 2).trim() || '';
}
function setBusy(busy, running = false) {
  ui.busy = busy; ui.running = running;
  document.body.classList.toggle('is-running', running);
  $('run-button').disabled = busy || !ui.state;
  $('run-button').querySelector('span').textContent = running ? 'Checking evidence…' : (ui.state?.revision > 1 ? 'Re-run agent' : 'Run agent');
  $('reset-button').disabled = busy;
  $('scenario-select').disabled = busy;
  $('mode-select').disabled = busy;
  $('evaluate-button').disabled = busy || !ui.state;
  $('amendment-button').disabled = busy || !ui.state || ui.state.documents.some(d => d.id === 'corrigendum-01');
  renderPacket();
}
function acceptPayload(payload, options = {}) {
  if (payload.runtime) {
    ui.runtime = payload.runtime;
    if (!ui.modeChosen) ui.mode = payload.runtime.liveAvailable ? 'live' : 'fixture';
  }
  if (payload.state) ui.state = payload.state;
  if (options.chooseLot) {
    if (ui.state?.proposal?.status === 'pending') ui.selectedLot = ui.state.proposal.lot;
    else if (ui.state?.evaluations?.B) ui.selectedLot = 'B';
  }
  render();
}
async function initialize(scenario = 'baseline', restore = false) {
  setBusy(true);
  $('connection-error').hidden = true;
  const serial = ++ui.sessionSerial;
  try {
    let response;
    const saved = restore ? localStorage.getItem('tendertripwire.session') : null;
    if (saved) {
      try { response = await api(`/api/state?session=${encodeURIComponent(saved)}`); }
      catch { localStorage.removeItem('tendertripwire.session'); }
    }
    if (!response) response = await api('/api/session', { scenario });
    if (serial !== ui.sessionSerial) return;
    ui.selectedLot = response.state?.proposal?.lot || 'A';
    ui.sourceId = 'tender-main'; ui.citation = null; ui.sourceKey = ''; ui.auditKey = '';
    acceptPayload(response);
    localStorage.setItem('tendertripwire.session', ui.state.id);
  } catch (error) {
    $('connection-error').textContent = `The workspace couldn’t load: ${error.message} Check that the app server is running, then choose Reset demo to retry.`;
    $('connection-error').hidden = false;
    $('source-select').innerHTML = '<option>Documents unavailable</option>';
    $('source-document').innerHTML = `<div class="document-empty">${icon('doc')}<p>The source documents haven’t loaded. No evidence checks have been performed.</p></div>`;
  } finally { setBusy(false); }
}
function render() {
  if (!ui.state) return;
  const state = ui.state;
  $('scenario-select').value = state.scenario;
  const runtime = ui.runtime || {};
  const lastRun = state.runs?.at(-1);
  const lastManualCheck = state.audit.filter(event => event.tool === 'evaluate_lot' && event.actor === 'human').at(-1);
  const manualIsLatest = lastManualCheck && (!lastRun || new Date(lastManualCheck.timestamp) > new Date(lastRun.finishedAt || lastRun.startedAt));
  const shownMode = manualIsLatest ? 'manual' : lastRun?.mode || ui.mode;
  const modeText = shownMode === 'manual' ? 'MANUAL CHECK · DETERMINISTIC' : shownMode === 'live' ? `${lastRun ? 'LIVE MODEL' : 'LIVE MODEL CONFIGURED'} · ${lastRun?.model || runtime.model || runtime.provider || 'connected'}` : 'OFFLINE FIXTURE · DETERMINISTIC DEMO';
  $('execution-mode').className = `mode-badge ${shownMode === 'live' ? 'live' : 'offline'}`;
  $('execution-mode').querySelector('span:last-child').textContent = modeText;
  $('execution-mode').title = shownMode === 'manual' ? 'The latest lot check was explicitly initiated by a human and evaluated deterministically.' : shownMode === 'live' ? 'The model chooses tools. Evidence checks and approval gates are deterministic.' : 'Offline demonstration uses a fixed tool sequence. It is not a live model run.';
  $('mode-select').querySelector('option[value="live"]').disabled = !runtime.liveAvailable;
  $('mode-select').value = ui.mode;
  $('mode-select').title = runtime.liveAvailable ? 'Execution mode for the next run. The top badge identifies the last run.' : (runtime.reason || 'No live model is configured. The offline fixture is selected.');
  $('revision-label').textContent = `TT-2026-017 · revision ${state.revision} · ${state.documents.length} source documents`;
  renderDecision(); renderLots(); renderChecklist(); renderPacket(); renderSources(); renderTimeline();
  $('run-warning').hidden = !lastRun || lastRun.status !== 'blocked';
  $('run-warning').textContent = lastRun?.status === 'blocked' ? `Run stopped safely: ${lastRun.error?.message || lastRun.summary}. Completed checks remain visible below.` : '';
  const changed = state.documents.some(d => d.id === 'corrigendum-01');
  $('amendment-button').disabled = ui.busy || changed;
  $('amendment-button').innerHTML = changed ? `${icon('check')}Corrigendum applied` : `Apply corrigendum${icon('arrow')}`;
  $('amendment-description').textContent = changed ? 'Corrigendum 01 is active. Earlier approvals and packets are invalid. The agent must check the current evidence again.' : 'Load a synthetic corrigendum to see how a changed requirement reopens the review.';
  $('run-button').disabled = ui.busy;
  $('run-button').querySelector('span').textContent = ui.running ? 'Checking evidence…' : (changed ? 'Re-run agent' : 'Run agent');
  const currentPacket = state.packets.find(p => p.status === 'current' && p.revision === state.revision);
  $('step-assess').className = `progress-step ${Object.keys(state.evaluations).length ? 'complete' : 'current'}`;
  $('step-review').className = `progress-step ${currentPacket ? 'complete' : state.proposal?.status === 'pending' ? 'current' : ''}`;
  $('step-packet').className = `progress-step ${currentPacket ? 'current' : ''}`;
}
function renderDecision() {
  const state = ui.state;
  const evaluations = Object.values(state.evaluations);
  const stale = evaluations.some(e => e.status === 'stale' || e.revision !== state.revision) && !evaluations.some(e => e.revision === state.revision && ['needs_evidence', 'suitable'].includes(e.status));
  const suitable = evaluations.find(e => e.status === 'suitable' && e.revision === state.revision);
  const unknown = evaluations.find(e => e.status === 'needs_evidence' && e.revision === state.revision);
  const blocked = evaluations.find(e => e.status === 'blocked' && e.revision === state.revision);
  let tone = 'neutral', label = 'READY FOR A CLOSER LOOK', title = 'Good decisions start with the documents', description = 'Run the agent to compare each lot against the supplier’s evidence. No lot has been assessed yet.', glyph = 'shield';
  if (ui.running) { label = ui.mode === 'live' ? 'LIVE MODEL RUN IN PROGRESS' : 'DETERMINISTIC FIXTURE RUN'; title = 'Following the evidence, one check at a time'; description = 'Actual tool calls appear in the audit trail as they happen. Approval remains with you.'; glyph = 'spark'; }
  else if (stale) { tone = 'warning'; label = 'TRIPWIRE TRIGGERED · REVIEW REOPENED'; title = 'The requirement changed. The old decision is stale.'; description = 'Corrigendum 01 adds a mandatory report for Lot B. Previous approvals and packets are invalid. Re-run the agent against the current documents.'; glyph = 'alert'; }
  else if (suitable && blocked) { tone = 'warning'; label = `LOT ${blocked.lot} MISMATCH · ALTERNATIVE FOUND`; title = `Lot ${blocked.lot} doesn’t match. Lot ${suitable.lot} has supporting evidence.`; description = `The supplied certificate fails Lot ${blocked.lot}’s product check. All ${suitable.checks.length} checks for Lot ${suitable.lot} are supported by the synthetic sources. Review the citations before approving packet creation.`; glyph = 'alert'; }
  else if (suitable) { tone = 'success'; label = `LOT ${suitable.lot} · EVIDENCE SUPPORTS PREPARATION`; title = `Lot ${suitable.lot} is ready for your review`; description = 'The available synthetic evidence supports the checked requirements. Inspect the citations, then decide whether to create the preparation packet.'; glyph = 'check'; }
  else if (unknown) { tone = 'warning'; label = 'PREPARATION PAUSED · EVIDENCE NEEDED'; title = state.revision > 1 ? 'A new requirement. A missing piece of evidence.' : 'The documents leave a question open'; description = unknown.checks.find(c => c.status === 'conflict')?.reason || unknown.checks.find(c => c.status === 'unknown')?.reason || 'Unresolved evidence prevents packet approval. The checklist shows what is still needed.'; glyph = 'alert'; }
  else if (blocked) { tone = 'danger'; label = `LOT ${blocked.lot} · DOCUMENT MISMATCH`; title = 'This lot’s requirements aren’t supported'; description = blocked.checks.find(c => c.status === 'fail')?.reason || 'A confirmed evidence mismatch prevents packet preparation.'; glyph = 'alert'; }
  $('decision-callout').className = `decision-callout ${tone}`;
  $('decision-callout').querySelector('.callout-symbol').innerHTML = icon(glyph);
  $('decision-label').textContent = label; $('decision-title').textContent = title; $('decision-description').textContent = description;
}
const statusMap = { suitable: ['Evidence supported', 'supported'], blocked: ['Mismatch', 'mismatch'], needs_evidence: ['Needs evidence', 'missing'], stale: ['Stale', 'stale'] };
function lotStatus(lot) {
  const evaluation = ui.state.evaluations[lot];
  if (!evaluation) return ['Not assessed', 'unassessed'];
  if (evaluation.revision !== ui.state.revision) return statusMap.stale;
  return statusMap[evaluation.status] || ['Not assessed', 'unassessed'];
}
function renderLots() {
  $('lot-cards').innerHTML = ['A', 'B'].map(lot => {
    const [status, cls] = lotStatus(lot), evaluation = ui.state.evaluations[lot];
    const product = sourceValue(`lot-${lot.toLowerCase()}`, 'Product');
    const quantity = sourceValue(`lot-${lot.toLowerCase()}`, 'Quantity');
    const title = ui.state.documents.find(d => d.id === `lot-${lot.toLowerCase()}`)?.title.split(' · ')[1] || `Lot ${lot}`;
    const supported = evaluation?.checks.filter(c => c.status === 'pass').length || 0;
    return `<button type="button" class="lot-card ${cls} ${ui.selectedLot === lot ? 'selected' : ''}" data-lot="${lot}" aria-pressed="${ui.selectedLot === lot}"><div class="lot-card-top"><span class="lot-index">LOT ${lot}</span><span class="status-pill ${cls}">${cls === 'supported' ? icon('check') : cls === 'mismatch' || cls === 'stale' ? icon('alert') : ''}${escape(status)}</span></div><h3>${escape(title)}</h3><p>${escape(product || 'Source not loaded')} ${quantity ? `· ${escape(quantity)} units` : ''}</p><div class="lot-card-bottom"><span>${evaluation ? `${supported}/${evaluation.checks.length} checks supported${cls === 'stale' ? ' · previous revision' : ''}` : 'Awaiting evidence checks'}</span>${icon('arrow')}</div></button>`;
  }).join('');
}
function renderChecklist() {
  const evaluation = ui.state.evaluations[ui.selectedLot];
  const stale = evaluation && (evaluation.status === 'stale' || evaluation.revision !== ui.state.revision);
  $('checklist-title').textContent = `Lot ${ui.selectedLot} · Evidence checklist`;
  $('checklist-subtitle').textContent = evaluation ? `${evaluation.product} · ${evaluation.requiredStandard} · revision ${evaluation.revision}` : 'Requirements and the documents behind them';
  $('checks-summary').textContent = evaluation ? (stale ? 'Stale assessment' : `${evaluation.checks.filter(c => c.status === 'pass').length} / ${evaluation.checks.length} supported`) : 'Not assessed';
  if (!evaluation) {
    $('checklist').innerHTML = `<div class="empty-state"><div class="empty-icon">${icon('link')}</div><h3>A source for every check</h3><p>Start a run to see what’s supported, what’s missing, and where the documents disagree.</p><span class="empty-rule"></span><span class="micro-label">No conclusions without evidence</span></div>`;
    return;
  }
  const statuses = { pass: ['Supported', 'supported', 'check'], fail: ['Mismatch', 'mismatch', 'close'], unknown: ['Missing evidence', 'missing', 'alert'], conflict: ['Conflicting', 'conflict', 'alert'] };
  $('checklist').innerHTML = (stale ? '<div class="check-stale-note">These checks belong to the previous document revision. Re-run before relying on them.</div>' : '') + evaluation.checks.map((check, index) => {
    const [label, cls, glyph] = statuses[check.status] || ['Unassessed', 'missing', 'alert'];
    return `<div class="check-row ${cls}${stale ? ' stale' : ''}"><div class="check-status-icon">${icon(glyph)}</div><div class="check-body"><div class="check-title-row"><h3>${escape(check.title)}</h3><span class="check-status-label">${label}</span></div><p class="check-explanation">${escape(check.reason)}</p><div class="citations">${check.citations.map((citation, citeIndex) => `<button type="button" class="citation-button" data-check-index="${index}" data-cite-index="${citeIndex}" title="${escape(citation.title)} — ${escape(citation.quote)}">${icon('link')}${escape(shortSource(citation.documentId))} · p${citation.page}:L${citation.lineStart}${citation.lineEnd !== citation.lineStart ? `–${citation.lineEnd}` : ''}</button>`).join('')}</div></div></div>`;
  }).join('');
}
function shortSource(id) {
  return ({ 'tender-main': 'Tender', 'lot-a': 'Annexure A', 'lot-b': 'Annexure B', 'supplier-profile': 'Supplier', 'certificate-a': 'Solar cert.', 'certificate-b': 'Study cert.', 'certificate-b-conflict': 'Conflict cert.', 'authorization': 'Authorization', 'corrigendum-01': 'Corrigendum 01', 'supplier-note': 'Untrusted note' })[id] || id;
}
function renderPacket() {
  if (!ui.state) { $('review-button').disabled = true; return; }
  const state = ui.state, proposal = state.proposal;
  const packet = [...state.packets].reverse().find(p => p.lot === ui.selectedLot);
  const current = packet?.status === 'current' && packet.revision === state.revision;
  const evaluation = state.evaluations[ui.selectedLot];
  const canApprove = proposal?.status === 'pending' && proposal.lot === ui.selectedLot && proposal.revision === state.revision && evaluation?.status === 'suitable' && evaluation.revision === state.revision;
  $('review-button').disabled = ui.busy || !canApprove;
  $('review-button').hidden = !!current;
  $('download-button').hidden = !current;
  $('packet-area').classList.toggle('revoked', !!packet && !current);
  if (current) {
    $('packet-title').textContent = `Lot ${packet.lot} preparation ZIP is ready`;
    $('packet-description').textContent = `${packet.fileCount} files · revision ${packet.revision} · approved by you`;
    $('download-button').href = `/api/packet?session=${encodeURIComponent(state.id)}&packet=${encodeURIComponent(packet.id)}`;
    $('download-button').download = `tendertripwire-lot-${packet.lot}-r${packet.revision}.zip`;
  } else if (packet) {
    $('packet-title').textContent = 'Previous packet revoked';
    $('packet-description').textContent = 'The documents changed. Re-check and obtain a fresh approval before creating a new packet.';
    $('download-button').removeAttribute('href');
  } else if (canApprove) {
    $('packet-title').textContent = `Lot ${ui.selectedLot} is waiting for your review`;
    $('packet-description').textContent = 'Inspect the source evidence, then approve packet creation.';
  } else {
    $('packet-title').textContent = 'A reviewable packet. On your say-so.';
    $('packet-description').textContent = evaluation?.status === 'suitable' ? 'The agent must propose a packet for this lot before approval. Run the agent to continue.' : evaluation ? 'Unresolved or stale evidence blocks packet preparation.' : 'Evidence checks must be current before approval.';
  }
}
function renderSources(force = false) {
  const docs = ui.state.documents;
  if (!docs.some(d => d.id === ui.sourceId)) ui.sourceId = docs[0]?.id;
  $('source-count').textContent = String(docs.length).padStart(2, '0');
  const optionsKey = docs.map(d => `${d.id}:${d.version}:${d.hash}`).join('|');
  if ($('source-select').dataset.key !== optionsKey) {
    $('source-select').innerHTML = docs.map(d => `<option value="${escape(d.id)}">${escape(d.title)}</option>`).join('');
    $('source-select').dataset.key = optionsKey;
  }
  $('source-select').value = ui.sourceId;
  const doc = docs.find(d => d.id === ui.sourceId);
  if (!doc) return;
  const c = ui.citation;
  const validCitation = c && c.documentId === doc.id && c.documentHash === doc.hash && c.documentVersion === doc.version;
  const key = `${doc.id}:${doc.hash}:${c ? `${c.page}:${c.lineStart}:${c.lineEnd}` : 'none'}`;
  if (!force && ui.sourceKey === key) return;
  ui.sourceKey = key;
  $('citation-context').hidden = !c;
  $('citation-label').textContent = c ? `${shortSource(c.documentId)} · page ${c.page}, lines ${c.lineStart}–${c.lineEnd}${validCitation ? ' · source verified' : ' · source changed; citation stale'}` : '';
  const kind = doc.role === 'supplier' ? 'SUPPLIER EVIDENCE' : doc.role === 'corrigendum' ? 'REQUIREMENT CHANGE' : 'TENDER DOCUMENT';
  $('source-document').innerHTML = `<div class="document-masthead"><span>${kind}</span><span class="document-stamp">SYNTHETIC</span></div><h3 class="document-title">${escape(doc.title)}</h3><p class="document-meta">${escape(doc.id)} · version ${doc.version}<br>SHA-256 ${escape(doc.hash?.slice(0, 18))}…</p><div class="document-rule"></div>${doc.pages.map((page, pageIndex) => `<section class="${pageIndex ? 'document-section' : ''}" aria-label="Page ${page.number}">${doc.pages.length > 1 ? `<div class="document-section-label">PAGE ${page.number}</div>` : ''}${page.lines.map((line, index) => {
    const highlight = validCitation && c.page === page.number && index + 1 >= c.lineStart && index + 1 <= c.lineEnd;
    return `<p class="document-line${highlight ? ' highlight' : ''}${/^Clause |^Lot: |^Product: |^Required standard: /.test(line) ? ' heading' : ''}" id="source-p${page.number}-l${index + 1}"><span class="document-line-num">${String(index + 1).padStart(2, '0')}</span><span>${escape(line)}</span></p>`;
  }).join('')}</section>`).join('')}<div class="document-footer"><span>DEMONSTRATION DOCUMENT ONLY</span><span>${doc.pages.length} PAGE${doc.pages.length > 1 ? 'S' : ''}</span></div>`;
  const wrap = $('source-document').parentElement;
  if (validCitation) {
    requestAnimationFrame(() => { const target = $(`source-p${c.page}-l${c.lineStart}`); if (target) wrap.scrollTo({ top: Math.max(0, target.offsetTop - $('source-document').offsetTop - 100), behavior: 'smooth' }); });
  } else wrap.scrollTop = 0;
}
function renderTimeline() {
  const events = ui.state.audit || [];
  $('activity-count').textContent = `${events.length} EVENT${events.length === 1 ? '' : 'S'}`;
  const run = ui.state.runs?.at(-1);
  $('run-id-label').textContent = run ? `${run.mode === 'fixture' ? 'Fixture' : 'Live'} · ${run.status} · ${String(run.id || ui.state.runs.length).slice(0, 8)}` : 'No run yet';
  const key = `${ui.state.id}:${events.length}:${JSON.stringify(run || {})}`;
  if (ui.auditKey === key) return;
  ui.auditKey = key;
  const open = new Set([...$('timeline').querySelectorAll('details[open]')].map(d => d.dataset.event));
  $('timeline').innerHTML = events.length ? events.map(event => {
    const result = event.result;
    const description = eventSummary(event);
    const time = new Date(event.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return `<div class="timeline-event${event.tool.includes('error') ? ' error' : ''}"><div class="timeline-marker"><span class="timeline-dot"></span></div><details data-event="${event.id}"${open.has(String(event.id)) ? ' open' : ''}><summary><span class="event-name">${escape(event.tool)}</span><span class="event-tag">${escape(event.actor)}</span><span class="event-time">${escape(time)}</span>${icon('chevron', 'event-chevron')}</summary><p class="event-description">${escape(description)}</p><pre class="event-data">${escape(JSON.stringify({ actor: event.actor, revision: event.revision, arguments: event.args, result }, null, 2))}</pre></details></div>`;
  }).join('') : '<div class="timeline-empty"><span class="timeline-dot"></span><p>Actual tool calls and system events will appear here.</p></div>';
}
function eventSummary(event) {
  const r = event.result;
  if (event.tool === 'initialize') return `${r?.documents || 0} synthetic source documents loaded. No assessment performed.`;
  if (event.tool === 'list_documents') return `${Array.isArray(r) ? r.length : ''} source documents listed with their hashes.`;
  if (event.tool === 'read_document') return `${r?.title || event.args.documentId} · untrusted source content`;
  if (event.tool === 'search_evidence') return `${Array.isArray(r) ? r.length : ''} exact source matches for “${event.args.query}”`;
  if (event.tool === 'evaluate_lot') return `Lot ${r?.lot || event.args.lot}: ${r?.status?.replaceAll('_', ' ') || 'evaluated'} · ${r?.checks?.length || 0} checks`;
  if (event.tool === 'request_packet_approval') return `Lot ${r?.lot || event.args.lot}: preparation packet proposed. Waiting for human approval.`;
  if (event.tool === 'approve_packet') return `Human approved Lot ${r?.lot || ''} packet creation for revision ${event.revision}.`;
  if (event.tool === 'build_packet') return `${r?.fileCount || ''} files created. Approval and sources are revision-bound.`;
  if (event.tool === 'apply_corrigendum') return r?.message || 'New requirement applied; previous approvals and packets invalidated.';
  if (r?.message) return String(r.message);
  if (r?.summary) return String(r.summary);
  if (r?.error) return typeof r.error === 'string' ? r.error : r.error.message || 'Action failed.';
  return typeof r === 'string' ? r : `Revision ${event.revision} · open to inspect the recorded input and result`;
}
async function runAgent() {
  if (ui.busy || !ui.state) return;
  const goal = $('goal-input').value.trim();
  if (!goal) { $('goal-input').focus(); toast('Give the agent an assignment first.', true); return; }
  const session = ui.state.id;
  setBusy(true, true); renderDecision();
  let polling = false;
  const poll = setInterval(async () => {
    if (polling || ui.state.id !== session) return;
    polling = true;
    try { const response = await api(`/api/state?session=${encodeURIComponent(session)}`); if (ui.running && ui.state.id === session) acceptPayload(response); } catch { /* The main request reports any terminal error. */ }
    finally { polling = false; }
  }, 2000);
  try {
    const response = await api('/api/run', { session, goal, mode: ui.mode });
    acceptPayload(response, { chooseLot: true });
    if (response.run?.status === 'blocked') toast(response.run.error?.message || response.run.summary || 'The run stopped safely. Completed observations were preserved.', true);
    else toast(response.state?.proposal?.status === 'pending' ? `Evidence checked. Lot ${response.state.proposal.lot} is ready for your review.` : 'Run finished. Review the checks and recorded tool calls.');
  } catch (error) {
    toast(error.message, true);
    try { acceptPayload(await api(`/api/state?session=${encodeURIComponent(session)}`)); } catch { /* Keep the last confirmed state visible. */ }
  } finally { clearInterval(poll); setBusy(false); render(); }
}
function openApproval() {
  const proposal = ui.state?.proposal;
  if (!proposal || proposal.status !== 'pending' || proposal.lot !== ui.selectedLot || ui.busy) return;
  ui.modalProposal = { id: proposal.id, lot: proposal.lot, revision: proposal.revision, idempotencyKey: crypto.randomUUID() };
  $('approval-title').textContent = `Create Lot ${proposal.lot} preparation ZIP`;
  $('approval-description').textContent = 'Review the evidence checklist and its citations before approving this local packet.';
  const checks = ui.state.evaluations[proposal.lot]?.checks || [];
  $('approval-details').innerHTML = [['Selected lot', `Lot ${proposal.lot} · ${sourceValue(`lot-${proposal.lot.toLowerCase()}`, 'Product')}`], ['Current document revision', `Revision ${proposal.revision}`], ['Evidence checks', `${checks.filter(c => c.status === 'pass').length} / ${checks.length} supported`], ['Action', 'Create a synthetic preparation ZIP']].map(([label, value]) => `<div class="approval-detail-row"><span>${escape(label)}</span><span>${escape(value)}</span></div>`).join('');
  $('approval-checkbox').checked = false;
  $('approval-confirm').disabled = true;
  $('approval-error').hidden = true;
  $('approval-modal').showModal();
}
async function approve() {
  const proposal = ui.modalProposal;
  if (!proposal || !$('approval-checkbox').checked || ui.busy) return;
  setBusy(true);
  $('approval-confirm').disabled = true;
  $('approval-confirm').textContent = 'Building packet…';
  $('approval-error').hidden = true;
  try {
    const response = await api('/api/approve', { session: ui.state.id, proposalId: proposal.id, confirmed: true, idempotencyKey: proposal.idempotencyKey });
    acceptPayload(response);
    $('approval-modal').close();
    toast(`Lot ${proposal.lot} preparation ZIP created. Nothing has been submitted.`);
  } catch (error) {
    $('approval-error').textContent = error.message; $('approval-error').hidden = false;
    try { acceptPayload(await api(`/api/state?session=${encodeURIComponent(ui.state.id)}`)); } catch { /* Preserve last known state. */ }
  } finally {
    setBusy(false);
    $('approval-confirm').innerHTML = `Approve & build packet${icon('arrow')}`;
    $('approval-confirm').disabled = !$('approval-checkbox').checked || ui.state.proposal?.id !== proposal.id || ui.state.proposal?.status !== 'pending';
  }
}
async function applyAmendment() {
  if (ui.busy || !ui.state) return;
  setBusy(true);
  try {
    const response = await api('/api/corrigendum', { session: ui.state.id });
    ui.sourceId = 'corrigendum-01'; ui.citation = null; ui.sourceKey = '';
    acceptPayload(response);
    const doc = ui.state.documents.find(d => d.id === 'corrigendum-01');
    if (doc) { ui.citation = { documentId: doc.id, documentHash: doc.hash, documentVersion: doc.version, page: 1, lineStart: 3, lineEnd: 6 }; renderSources(true); }
    toast(response.result?.message || 'Corrigendum applied. Previous decisions and packets are stale.');
  } catch (error) { toast(error.message, true); }
  finally { setBusy(false); render(); }
}
async function downloadPacket(event) {
  event.preventDefault();
  if (ui.busy || !$('download-button').href || $('download-button').hidden) return;
  const link = $('download-button');
  try {
    const response = await fetch(link.href);
    if (!response.ok) { const data = await response.json(); throw new Error(data.error?.message || 'This packet is no longer current.'); }
    const blob = await response.blob(), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = link.download; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    toast('Preparation ZIP downloaded. It has not been submitted anywhere.');
  } catch (error) { toast(error.message, true); try { acceptPayload(await api(`/api/state?session=${encodeURIComponent(ui.state.id)}`)); } catch { /* Preserve latest confirmed state. */ } }
}
async function evaluateSelectedLot() {
  if (ui.busy || !ui.state) return;
  setBusy(true);
  try {
    const response = await api('/api/evaluate', { session: ui.state.id, lot: ui.selectedLot });
    acceptPayload(response);
    toast(`Lot ${ui.selectedLot} checked directly. This was a human-initiated deterministic check.`);
  } catch (error) { toast(error.message, true); }
  finally { setBusy(false); }
}
$('evaluate-button').addEventListener('click', evaluateSelectedLot);
$('run-button').addEventListener('click', runAgent);
$('reset-button').addEventListener('click', () => { $('goal-input').value = defaultGoal; initialize($('scenario-select').value); });
$('scenario-select').addEventListener('change', () => initialize($('scenario-select').value));
$('mode-select').addEventListener('change', () => { ui.mode = $('mode-select').value; ui.modeChosen = true; render(); });
$('lot-cards').addEventListener('click', event => { const card = event.target.closest('[data-lot]'); if (!card) return; ui.selectedLot = card.dataset.lot; renderLots(); renderChecklist(); renderPacket(); });
$('checklist').addEventListener('click', event => {
  const button = event.target.closest('[data-cite-index]'); if (!button) return;
  const citation = ui.state.evaluations[ui.selectedLot]?.checks[Number(button.dataset.checkIndex)]?.citations[Number(button.dataset.citeIndex)];
  if (!citation) return;
  ui.citation = citation; ui.sourceId = citation.documentId; renderSources(true);
  $('checklist').querySelectorAll('.citation-button.active').forEach(el => el.classList.remove('active'));
  button.classList.add('active');
  if (matchMedia('(max-width: 690px)').matches) $('source-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
$('source-select').addEventListener('change', () => { ui.sourceId = $('source-select').value; ui.citation = null; renderSources(true); });
$('clear-citation').addEventListener('click', () => { ui.citation = null; renderSources(true); $('checklist').querySelectorAll('.citation-button.active').forEach(el => el.classList.remove('active')); });
$('review-button').addEventListener('click', openApproval);
$('approval-checkbox').addEventListener('change', () => { $('approval-confirm').disabled = !$('approval-checkbox').checked || ui.busy; });
$('approval-cancel').addEventListener('click', () => $('approval-modal').close());
$('approval-confirm').addEventListener('click', approve);
$('amendment-button').addEventListener('click', applyAmendment);
$('download-button').addEventListener('click', downloadPacket);
initialize('baseline', true);
