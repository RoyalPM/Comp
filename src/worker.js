import { createState, TripwireError } from './core.js';
import { handleApi, json } from './api.js';

class D1Store {
  constructor(db) { this.db = db; }
  async put(state) { await this.db.prepare('INSERT INTO sessions (id, version, state) VALUES (?, 1, ?)').bind(state.id, JSON.stringify(state)).run(); }
  async row(id) {
    if (!/^[a-f0-9-]{36}$/.test(id ?? '')) throw new TripwireError('INVALID_SESSION', 'Invalid session identifier.', 400);
    const row = await this.db.prepare('SELECT version, state FROM sessions WHERE id = ?').bind(id).first();
    if (!row) throw new TripwireError('SESSION_NOT_FOUND', 'Session not found.', 404); return row;
  }
  async get(id) { return JSON.parse((await this.row(id)).state); }
  async mutate(id, fn) {
    const row = await this.row(id), state = JSON.parse(row.state), result = await fn(state);
    state.updatedAt = new Date().toISOString();
    const saved = await this.db.prepare('UPDATE sessions SET state = ?, version = version + 1 WHERE id = ? AND version = ?').bind(JSON.stringify(state), id, row.version).run();
    if (saved.meta.changes !== 1) throw new TripwireError('CONCURRENT_CHANGE', 'State changed during this action. Reload before trying again.');
    return result;
  }
}
export default { async fetch(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
  if (!env.DB) return json({ error: { code: 'STORAGE_NOT_CONFIGURED', message: 'Persistent storage is not configured.' } }, 503);
  return handleApi(request, new D1Store(env.DB), { baseURL: env.MODEL_BASE_URL || '', apiKey: env.MODEL_API_KEY || '', model: env.MODEL_NAME || '', maxSteps: 12 });
} };
