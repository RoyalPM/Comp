import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const target = resolve(process.argv[2] || '../tendertripwire-replay/dist');
await mkdir(target, { recursive: true });
for (const file of ['index.html', 'styles.css', 'app.js', 'favicon.svg']) await copyFile(`public/${file}`, `${target}/${file}`);
const records = {};
for (const scenario of ['baseline', 'missing', 'conflict', 'injection']) {
  try { const record = JSON.parse(await readFile(`artifacts/live/${scenario}.json`, 'utf8')); if (record.result.passed) records[scenario] = { result: record.result, phases: record.phases, snapshots: record.snapshots, provenance: record.provenance }; } catch {}
}
if (!records.baseline?.result.amendment?.passed) throw new Error('A fully successful genuine baseline+amendment recording is required.');
await writeFile(`${target}/recording.json`, JSON.stringify(records));
await copyFile('artifacts/live/preparation-packet.zip', `${target}/preparation-packet.zip`);
let html = await readFile(`${target}/index.html`, 'utf8');
html = html.replace('<title>TenderTripwire', '<title>Recorded replay · TenderTripwire')
  .replace('<script src="/app.js" defer></script>', '<script src="/replay.js" defer></script><script src="/app.js" defer></script>')
  .replace('<body>', '<body><div class="recorded-banner"><b>RECORDED LIVE INFERENCE · READ-ONLY REPLAY</b><span>Real Qwen3-1.7B model/tool events, played faster. No model runs or new approvals occur on this page.</span></div>')
  .replace('Synthetic demo data', 'Synthetic data · recorded run')
  .replace('Find a supported lot for this supplier and prepare an evidence-linked review packet.', records.baseline.result.run.goal)
  .replace('id="goal-input"', 'id="goal-input" readonly')
  .replace('>Run agent<', '>Replay model run<')
  .replace('>Test scenario<', '>Recorded scenario<')
  .replace('<option value="fixture">Offline fixture</option><option value="live">Live model</option>', '<option value="fixture">Recorded live inference</option><option value="live">Unavailable in replay</option>')
  .replace('Review &amp; approve', 'View recorded review').replace('Review & approve', 'View recorded review')
  .replace('>Apply corrigendum<', '>Replay corrigendum<')
  .replace('Approve &amp; build packet', 'View recorded packet').replace('Approve & build packet', 'View recorded packet')
  .replace('I’ve reviewed the current checks and their source evidence.', 'I understand this shows the recorded test-reviewer approval; it creates no new approval.')
  .replace('This creates a local review packet only.', 'This shows a packet created by the automated test reviewer at the explicit human-approval API boundary.')
  .replace('A synthetic decision-support demo. Human review required. No legal eligibility determination or bid submission.', 'Read-only replay of actual local inference and validated tools. The separate runnable app performs live inference. All evidence is synthetic.');
for (const scenario of ['missing', 'conflict', 'injection']) if (!records[scenario]) html = html.replace(new RegExp(`<option value="${scenario}">[^<]*</option>`), '');
await writeFile(`${target}/index.html`, html);
let app = await readFile(`${target}/app.js`, 'utf8');
app = app.replace("const response = await fetch(path,", "if (window.tripwireReplay) return window.tripwireReplay.handle(path, data);\n  const response = await fetch(path,")
  .replaceAll('tendertripwire.session', 'tendertripwire.replay.session')
  .replaceAll("'Checking evidence…'", "'Replaying recorded tools…'")
  .replaceAll("'Re-run agent'", "'Replay recheck'")
  .replaceAll("'Run agent'", "'Replay model run'")
  .replace("const shownMode = manualIsLatest ? 'manual' : lastRun?.mode || ui.mode;", "const shownMode = 'replay';")
  .replace("const modeText = shownMode === 'manual'", "const modeText = window.tripwireReplay ? 'RECORDED LIVE INFERENCE · REPLAY' : shownMode === 'manual'")
  .replaceAll('DETERMINISTIC FIXTURE RUN', 'REPLAYING RECORDED MODEL RUN')
  .replaceAll('Tool calls appear here as they happen. Approval remains with you.', 'Recorded tool events are replayed here. No new approval is created.')
  .replaceAll('Actual tool calls appear in the audit trail as they happen. Approval remains with you.', 'Recorded model choices and tool events are replayed in the audit trail. No new approval is created.')
  .replaceAll('Review the citations before approving packet creation.', 'Inspect the exact citations and the recorded test-reviewer checkpoint.')
  .replaceAll('Inspect the citations, then decide whether to create the preparation packet.', 'Inspect the citations and view the already-recorded preparation result.')
  .replaceAll('Re-run the agent against the current documents.', 'Replay the recorded recheck against the changed documents.')
  .replaceAll('Offline demonstration uses a fixed tool sequence. It is not a live model run.', 'This is an accelerated replay of a genuine model run. It is not live hosted inference.')
  .replaceAll('waiting for your review', 'recorded at the review checkpoint')
  .replaceAll('Inspect the source evidence, then approve packet creation.', 'Inspect the source evidence, then view the recorded test-reviewer checkpoint.')
  .replaceAll('Human approved Lot', 'Test reviewer exercised the human-approval API for Lot')
  .replaceAll('Run the agent to compare each lot', 'Replay the recorded comparison of each lot')
  .replace("$('mode-select').value = ui.mode;", "$('mode-select').value = 'fixture'; $('mode-select').disabled = true; $('evaluate-button').hidden = true;")
  .replace("${packet.fileCount} files · revision ${packet.revision} · approved by you", "${packet.fileCount} recorded files · revision ${packet.revision} · test-reviewer approval")
  .replace("const response = await fetch(link.href);", "const response = await fetch('/preparation-packet.zip');")
  .replace("Preparation ZIP downloaded. It has not been submitted anywhere.", "Recorded test ZIP downloaded. No new packet was generated or submitted.")
  .replace("Approve creation of a Lot", "View the recorded test approval for Lot")
  .replace('`Create Lot ${proposal.lot} preparation ZIP`', '`Recorded reviewer approval · Lot ${proposal.lot}`')
  .replace('Review the evidence checklist and its citations before approving this local packet.', 'Inspect the original evidence and the recorded test-reviewer checkpoint. Continuing only shows the already-recorded result.')
  .replaceAll('Create a synthetic preparation ZIP', 'View the recorded preparation ZIP')
  .replaceAll('Building packet…', 'Loading recorded packet…')
  .replaceAll('Approve & build packet', 'View recorded packet')
  .replace('`Lot ${proposal.lot} preparation ZIP created. Nothing has been submitted.`', '`Recorded Lot ${proposal.lot} preparation ZIP shown. No new action was taken.`')
  .replace("Apply corrigendum${icon('arrow')}", "Replay corrigendum${icon('arrow')}");
app = app.replace("initialize('baseline', true);", "window.addEventListener('tripwire-replay-state', event => acceptPayload({state:event.detail}));\ninitialize('baseline', false);");
await writeFile(`${target}/app.js`, app);
const css = await readFile(`${target}/styles.css`, 'utf8');
await writeFile(`${target}/styles.css`, `${css}\n.recorded-banner{position:relative;background:#182b33;color:#fff;padding:10px 32px;display:flex;gap:18px;align-items:center;font-size:12px;line-height:1.5}.recorded-banner b{color:#ffd298;letter-spacing:.09em;white-space:nowrap}.recorded-banner span{opacity:.88}#evaluate-button,.mode-field{display:none!important}@media(max-width:750px){.recorded-banner{padding:10px 16px;display:block}.recorded-banner span{display:block;margin-top:3px}}\n`);
await copyFile('scripts/replay-runtime.js', `${target}/replay.js`);
console.log(JSON.stringify({ target, scenarios: Object.keys(records), baselineDurationMs: records.baseline.result.run.durationMs, amendmentDurationMs: records.baseline.result.amendment.run.durationMs }));
