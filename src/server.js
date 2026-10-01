import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { FileStore } from './store.js';
import { handleApi, json } from './api.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const store = new FileStore(process.env.DATA_DIR || join(root, 'data'));
const baseURL = process.env.MODEL_BASE_URL || '';
const config = { baseURL, apiKey: process.env.MODEL_API_KEY || '', model: process.env.MODEL_NAME || '', local: /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(baseURL), maxSteps: Number(process.env.MODEL_MAX_STEPS || 12), runTimeoutMs: 240000, requestTimeoutMs: 90000 };
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
const allowed = new Set(['/', '/index.html', '/styles.css', '/app.js', '/favicon.svg']);
export const server = http.createServer(async (req, res) => {
  let response;
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) {
      const chunks = []; let size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > 33000) { response = json({ error: { code: 'REQUEST_TOO_LARGE', message: 'Request exceeds the 32 KB limit.' } }, 413); break; } chunks.push(chunk); }
      if (!response) {
        const request = new Request(url, { method: req.method, headers: req.headers, ...(req.method === 'GET' || req.method === 'HEAD' ? {} : { body: Buffer.concat(chunks) }) });
        response = await handleApi(request, store, config);
      }
    } else if (req.method === 'GET' && allowed.has(url.pathname)) {
      const path = url.pathname === '/' ? '/index.html' : url.pathname, content = await readFile(join(root, 'public', path));
      const ext = path.slice(path.lastIndexOf('.'));
      response = new Response(content, { headers: { 'Content-Type': mime[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' } });
    } else response = json({ error: { code: 'NOT_FOUND', message: 'Not found.' } }, 404);
  } catch { response = json({ error: { code: 'SERVER_ERROR', message: 'The server could not complete this request.' } }, 500); }
  res.writeHead(response.status, { ...Object.fromEntries(response.headers), 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'" });
  res.end(Buffer.from(await response.arrayBuffer()));
});
const port = Number(process.env.PORT || 8787), host = process.env.HOST || '127.0.0.1';
server.listen(port, host, () => console.log(`TenderTripwire: http://${host}:${port} · ${config.model || 'fixture mode only; live model not configured'}`));
