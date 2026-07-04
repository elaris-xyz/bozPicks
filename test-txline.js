const https = require('https');

const TXLINE_BASE = 'https://txline.txodds.com';

function request(method, url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...headers,
      },
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw.slice(0, 300) }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  // 1. Get fresh guest JWT
  const auth = await request('POST', `${TXLINE_BASE}/auth/guest/start`, {});
  const jwt = auth.body?.token;
  console.log('JWT:', jwt ? 'OK' : 'FAIL');

  const H = { Authorization: `Bearer ${jwt}` };

  // 2. Test data endpoints with guest JWT
  const endpoints = [
    ['GET', '/api/fixtures/worldcup'],
    ['GET', '/api/v1/fixtures/worldcup'],
    ['GET', '/api/fixtures'],
    ['GET', '/api/live'],
    ['GET', '/api/matches'],
    ['GET', '/api/events'],
    ['GET', '/api/v1/live'],
    ['GET', '/api/worldcup/fixtures'],
    ['GET', '/api/worldcup/live'],
    ['GET', '/stream/live'],
  ];

  console.log('\n--- Testing endpoints with guest JWT ---');
  for (const [method, path] of endpoints) {
    const r = await request(method, `${TXLINE_BASE}${path}`, null, H);
    const preview = JSON.stringify(r.body).slice(0, 80);
    console.log(`${r.status} ${method} ${path} → ${preview}`);
  }
}

main().catch(console.error);
