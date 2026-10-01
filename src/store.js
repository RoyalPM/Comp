import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { TripwireError } from './core.js';
const validId = id => { if (!/^[a-f0-9-]{36}$/.test(id ?? '')) throw new TripwireError('INVALID_SESSION', 'Invalid session identifier.', 400); return id; };
export class FileStore {
  constructor(directory) { this.directory = directory; this.queues = new Map(); }
  async put(state) { await mkdir(this.directory, { recursive: true }); const path = join(this.directory, `${validId(state.id)}.json`), temp = `${path}.${crypto.randomUUID()}.tmp`; await writeFile(temp, JSON.stringify(state), { mode: 0o600 }); await rename(temp, path); }
  async get(id) { try { return JSON.parse(await readFile(join(this.directory, `${validId(id)}.json`), 'utf8')); } catch (e) { if (e.code === 'ENOENT') throw new TripwireError('SESSION_NOT_FOUND', 'Session not found. Start a new synthetic scenario.', 404); throw e; } }
  async mutate(id, fn) {
    validId(id); const prior = this.queues.get(id) || Promise.resolve();
    const next = prior.catch(() => {}).then(async () => { const state = await this.get(id); const result = await fn(state); state.updatedAt = new Date().toISOString(); await this.put(state); return result; });
    this.queues.set(id, next); try { return await next; } finally { if (this.queues.get(id) === next) this.queues.delete(id); }
  }
}
export class MemoryStore {
  constructor() { this.states = new Map(); }
  async put(state) { this.states.set(state.id, structuredClone(state)); }
  async get(id) { const state = this.states.get(id); if (!state) throw new TripwireError('SESSION_NOT_FOUND', 'Unknown session', 404); return structuredClone(state); }
  async mutate(id, fn) { const state = await this.get(id), result = await fn(state); await this.put(state); return result; }
}
