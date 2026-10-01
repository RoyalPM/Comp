import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createState, publicState } from './core.js';
import { MemoryStore } from './store.js';
import { runController } from './controller.js';

let output;
try {
  const input = JSON.parse(process.env.AIKART_INPUT || await readFile('/aikart/input.json', 'utf8'));
  const scenario = input.scenario || 'baseline', state = await createState(scenario), store = new MemoryStore();
  await store.put(state);
  const run = await runController({ store, session: state.id, goal: input.goal || 'Check Lot A, investigate Lot B if needed, and request human review only when evidence supports preparation.', mode: 'live', config: { baseURL: process.env.MODEL_BASE_URL || 'http://127.0.0.1:8082/v1', model: process.env.MODEL_NAME || 'tendertripwire-local', apiKey: process.env.MODEL_API_KEY || '', local: !process.env.MODEL_API_KEY, maxSteps: 12, runTimeoutMs: 240000 } });
  const final = await store.get(state.id);
  output = { format: 'markdown', response: `# TenderTripwire · synthetic evidence check\n\n${run.summary}\n\nRun: ${run.status}. Mode: ${run.mode}. Model calls: ${run.modelCalls}. Tool calls: ${run.toolCalls}. Duration: ${(run.durationMs / 1000).toFixed(1)} seconds.\n\nNo packet is created in this one-shot runner: a separate explicit human approval is required in the interactive app. All records are synthetic; no bid is submitted.\n\n## Evidence checks\n${Object.entries(final.evaluations).map(([lot, e]) => `\n### Lot ${lot}: ${e.status}\n${e.checks.map(c => `- **${c.title} (${c.status})**: ${c.reason}\n${c.citations.map(v => `  - ${v.documentId}, p${v.page} L${v.lineStart}–${v.lineEnd}: ${v.quote}`).join('\n')}`).join('\n')}`).join('\n')}` };
} catch (error) {
  output = { format: 'markdown', response: `# TenderTripwire could not complete\n\n${error.code || 'INPUT_OR_RUNTIME_ERROR'}: ${error.message}\n\nNo unverified eligibility, approval, or packet was produced.` };
}
const outputPath = process.env.AIKART_OUTPUT_PATH || '/aikart/output.json';
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(output));
console.log(JSON.stringify(output));
