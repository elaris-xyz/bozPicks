const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const TXLINE_BASE = 'https://txline.txodds.com';

function post(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers },
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function toBase58(buf) {
  const ALPHA = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let n = BigInt('0x' + buf.toString('hex'));
  let r = '';
  while (n > 0n) { r = ALPHA[Number(n % 58n)] + r; n /= 58n; }
  for (const b of buf) { if (b !== 0) break; r = '1' + r; }
  return r;
}

async function main() {
  console.log('\n=== bozPicks TxLINE Setup ===\n');

  // Step 1: Guest JWT
  console.log('Step 1: Getting guest JWT...');
  const authRes = await post(`${TXLINE_BASE}/auth/guest/start`, {});
  console.log('  Status:', authRes.status);
  console.log('  Response:', JSON.stringify(authRes.body).slice(0, 300));

  const jwt = authRes.body?.token ?? (typeof authRes.body === 'string' ? authRes.body : null);
  if (!jwt) { console.error('\nCould not get JWT.'); process.exit(1); }
  console.log('  JWT OK ✓\n');

  // Step 2: Keypair (Ed25519)
  const keypairPath = path.join(__dirname, '.txline-keypair.json');
  let privKey, pubKey;
  if (fs.existsSync(keypairPath)) {
    const saved = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
    privKey = Buffer.from(saved.private, 'hex');
    pubKey  = Buffer.from(saved.public,  'hex');
    console.log('Step 2: Loaded existing keypair');
  } else {
    const kp = crypto.generateKeyPairSync('ed25519');
    privKey = kp.privateKey.export({ type: 'pkcs8', format: 'der' }).slice(-32);
    pubKey  = kp.publicKey.export({ type: 'spki', format: 'der' }).slice(-32);
    fs.writeFileSync(keypairPath, JSON.stringify({ private: privKey.toString('hex'), public: pubKey.toString('hex') }));
    console.log('Step 2: Generated new keypair');
  }
  console.log('  Public key (base58):', toBase58(pubKey), '\n');

  // Step 3: Activation
  const txSig = 'FREE';
  const leagues = [];
  const msg = Buffer.from(`${txSig}:${leagues.join(',')}:${jwt}`);
  const privKeyObj = crypto.createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), privKey]), format: 'der', type: 'pkcs8' });
  const sig = crypto.sign(null, msg, privKeyObj);
  const walletSignature = sig.toString('base64');

  console.log('Step 3: Calling activation endpoint...');
  const actRes = await post(
    `${TXLINE_BASE}/api/token/activate`,
    { txSig, walletSignature, leagues },
    { Authorization: `Bearer ${jwt}` }
  );
  console.log('  Status:', actRes.status);
  console.log('  Response:', JSON.stringify(actRes.body).slice(0, 500));

  const token = actRes.body?.token;
  if (token && token.length > 10) {
    const envPath = path.join(__dirname, '.env');
    let env = fs.readFileSync(envPath, 'utf8');
    env = env.replace('TXLINE_API_KEY=\n', `TXLINE_API_KEY=${token}\n`);
    fs.writeFileSync(envPath, env);
    console.log('\n✅ TXLINE_API_KEY saved to .env!\n');
  } else {
    console.log('\n--- نتیجه بالا رو بفرست ---');
  }
}

main().catch(console.error);
