// Local-only fault/volume harness. Never point this at a production API.
const http = require('node:http');
const fs = require('node:fs');
const modeFile = process.argv[2];
if (!modeFile) throw new Error('Pass the path to a JSON mode file.');
const origin = 'http://127.0.0.1:3002';
const upstream = 'http://localhost:5295';
const expand = (rows, count, mutate) => rows.length ? Array.from({ length: count }, (_, i) => mutate({ ...rows[i % rows.length], id: `stress-${i}` }, i)) : [];
http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }
  let config = {};
  try { config = JSON.parse(fs.readFileSync(modeFile, 'utf8')); } catch {}
  const applies = !config.path || req.url.startsWith(config.path);
  if (applies && config.mode === 'offline') { req.socket.destroy(); return; }
  if (applies && config.mode === 'stall') { res.on('close', () => res.destroy()); return; }
  if (applies && config.mode === 'malformed') { res.writeHead(200, { 'Content-Type': 'application/json' }).end('<html>Invalid upstream response</html>'); return; }
  if (applies && config.status) { res.writeHead(config.status, { 'Content-Type': 'application/problem+json' }).end(JSON.stringify({ detail: config.message || 'Simulated unavailable service.' })); return; }
  // Volume mode cannot mutate synthetic catalogue/history records.
  if (config.mode === 'volume' && req.method !== 'GET' && !req.url.startsWith('/api/auth/')) { res.writeHead(409, { 'Content-Type': 'application/json' }).end(JSON.stringify({ detail: 'Synthetic stress data is read-only.' })); return; }
  try {
    const buffers = []; for await (const chunk of req) buffers.push(chunk);
    const result = await fetch(upstream + req.url, {
      method: req.method,
      headers: { ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}), ...(req.headers['content-type'] ? { 'Content-Type': req.headers['content-type'] } : {}) },
      ...(!['GET', 'HEAD'].includes(req.method) ? { body: Buffer.concat(buffers) } : {}),
    });
    let text = await result.text();
    if (config.mode === 'volume' && result.ok && req.method === 'GET') {
      let data = JSON.parse(text);
      if (req.url === '/api/premises') data = expand(data, 1000, (row, i) => ({ ...row, name: `Stress venue ${i} ${'W'.repeat(180)}`, address: 'A'.repeat(500), description: 'D'.repeat(1000), imageUrl: null, capacity: 100000, pricePerHour: 1000000 }));
      if (req.url === '/api/services') data = expand(data, 100, (row, i) => ({ ...row, name: `Service ${i} ${'S'.repeat(80)}`, description: 'D'.repeat(1000), price: 1000000 }));
      if (req.url === '/api/orders') data = expand(data, 2000, (row, i) => {
        const pricing = i < 10 ? { ...row.pricing, durationHours: 8760, rental: { name: 'W'.repeat(200), unitPrice: 1000000, amount: 8760000000 }, services: Array.from({ length: 100 }, (_, j) => ({ id: `line-${j}`, name: 'S'.repeat(100), category: 'EquipmentRental', quantity: 100000, unitPrice: 1000000, amount: 100000000000 })), totalAmount: 10008760000000 } : row.pricing;
        return { ...row, pricing, venue: `Stress venue ${i} ${'W'.repeat(180)}`, address: 'A'.repeat(500), client: 'C'.repeat(100), totalAmount: pricing?.totalAmount || row.totalAmount };
      });
      if (req.url === '/api/users/clients') data = expand(data, 1000, row => ({ ...row, name: 'C'.repeat(100), email: 'long@example.test', phone: '+77001234567' }));
      text = JSON.stringify(data);
    }
    res.writeHead(result.status, { 'Content-Type': result.headers.get('content-type') || 'application/json' }).end(text);
  } catch { if (!res.destroyed) res.writeHead(502, { 'Content-Type': 'application/json' }).end(JSON.stringify({ detail: 'Preview API unavailable.' })); }
}).listen(5296, '127.0.0.1', () => console.log('Local stress proxy listening on 127.0.0.1:5296'));
