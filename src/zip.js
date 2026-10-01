// ZIP STORE format, UTF-8 names, no external dependencies; CRC32 verifies every entry.
const encoder = new TextEncoder();
const table = Array.from({ length: 256 }, (_, n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ n >>> 1 : n >>> 1; return n >>> 0; });
function crc32(bytes) { let c = 0xffffffff; for (const b of bytes) c = table[(c ^ b) & 255] ^ c >>> 8; return (c ^ 0xffffffff) >>> 0; }
function join(parts) { const all = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let offset = 0; for (const p of parts) all.set(p, offset), offset += p.length; return all; }
export function makeZip(files) {
  const local = [], central = []; let offset = 0;
  for (const [path, text] of Object.entries(files).sort(([a], [b]) => a.localeCompare(b))) {
    if (path.includes('..') || path.startsWith('/')) throw new Error('Unsafe ZIP entry');
    const name = encoder.encode(path), bytes = encoder.encode(text), checksum = crc32(bytes), header = new Uint8Array(30), h = new DataView(header.buffer);
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint32(14, checksum, true); h.setUint32(18, bytes.length, true); h.setUint32(22, bytes.length, true); h.setUint16(26, name.length, true);
    local.push(header, name, bytes);
    const cd = new Uint8Array(46), c = new DataView(cd.buffer);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint32(16, checksum, true); c.setUint32(20, bytes.length, true); c.setUint32(24, bytes.length, true); c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
    central.push(cd, name); offset += header.length + name.length + bytes.length;
  }
  const centralBytes = join(central), end = new Uint8Array(22), v = new DataView(end.buffer), count = Object.keys(files).length;
  v.setUint32(0, 0x06054b50, true); v.setUint16(8, count, true); v.setUint16(10, count, true); v.setUint32(12, centralBytes.length, true); v.setUint32(16, offset, true);
  return join([...local, centralBytes, end]);
}
