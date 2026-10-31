// Namecoin Core dashboard for umbrelOS — zero dependencies.
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3000);
const RPC_HOST = process.env.RPC_HOST || 'namecoind';
const RPC_PORT = Number(process.env.RPC_PORT || 8336);
const DATA_DIR = process.env.NAMECOIN_DATA || '/data';
const CRED_FILE = path.join(DATA_DIR, 'rpc-credentials.env');
const PUBLIC = path.join(__dirname, 'public');

function readCreds() {
  try {
    const out = {};
    for (const line of fs.readFileSync(CRED_FILE, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z_]+)=(.*)$/);
      if (m) out[m[1]] = m[2].trim();
    }
    if (out.RPC_USER && out.RPC_PASSWORD) return { user: out.RPC_USER, pass: out.RPC_PASSWORD };
  } catch (_) { /* node not initialised yet */ }
  return null;
}

let rpcId = 0;
function rpc(method, params = []) {
  const creds = readCreds();
  if (!creds) return Promise.reject(Object.assign(new Error('Node is still starting (no RPC credentials yet)'), { starting: true }));
  const body = JSON.stringify({ jsonrpc: '1.0', id: ++rpcId, method, params });
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: RPC_HOST, port: RPC_PORT, method: 'POST', path: '/',
      auth: `${creds.user}:${creds.pass}`,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 15000,
    }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        let json;
        try { json = JSON.parse(data); } catch (_) {
          return reject(new Error(`RPC HTTP ${res.statusCode}`));
        }
        if (json.error) {
          const e = new Error(json.error.message || 'RPC error');
          e.code = json.error.code;
          if (e.code === -28) e.starting = true; // warming up
          return reject(e);
        }
        resolve(json.result);
      });
    });
    req.on('timeout', () => req.destroy(new Error('RPC timeout')));
    req.on('error', (e) => reject(Object.assign(e, { starting: true })));
    req.end(body);
  });
}

function send(res, code, obj) {
  const s = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(s);
}

async function status() {
  const [chain, net, mempool, peers, uptime] = await Promise.all([
    rpc('getblockchaininfo'),
    rpc('getnetworkinfo'),
    rpc('getmempoolinfo'),
    rpc('getpeerinfo'),
    rpc('uptime'),
  ]);
  return {
    chain: chain.chain,
    blocks: chain.blocks,
    headers: chain.headers,
    progress: chain.verificationprogress,
    ibd: chain.initialblockdownload,
    sizeOnDisk: chain.size_on_disk,
    pruned: chain.pruned,
    bestHash: chain.bestblockhash,
    time: chain.time,
    version: 'Namecoin Core ' + (((net.subversion || '').match(/:([\d.]+)/) || [])[1] || ''),
    protocol: net.protocolversion,
    connections: net.connections,
    connectionsIn: net.connections_in,
    connectionsOut: net.connections_out,
    mempoolTx: mempool.size,
    mempoolBytes: mempool.bytes,
    peers: peers.slice(0, 50).map((p) => ({
      addr: p.addr, subver: p.subver, inbound: p.inbound, height: p.synced_blocks, ping: p.pingtime,
    })),
    uptime,
    warnings: net.warnings,
  };
}

const NAME_RE = /^[\x20-\x7e]{1,255}$/; // printable ASCII; namespace like d/ or id/

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname === '/api/status') return send(res, 200, await status());

    if (url.pathname === '/api/name') {
      const name = (url.searchParams.get('name') || '').trim();
      if (!NAME_RE.test(name)) return send(res, 400, { error: 'Enter a name such as d/example or id/alice' });
      try {
        const r = await rpc('name_show', [name]);
        return send(res, 200, { found: true, name: r.name, value: r.value, height: r.height, expiresIn: r.expires_in, expired: r.expired, address: r.address, txid: r.txid });
      } catch (e) {
        if (e.code === -4) return send(res, 200, { found: false, name, message: e.message });
        if (e.code === -10) return send(res, 503, { error: 'Your node is still syncing. Name lookups work once it has caught up.', starting: true });
        throw e;
      }
    }

    if (url.pathname === '/api/credentials') {
      const c = readCreds();
      if (!c) return send(res, 503, { error: 'Not ready yet' });
      return send(res, 200, { user: c.user, password: c.pass, rpcPort: RPC_PORT, p2pPort: 8334 });
    }

    // static files
    let file = url.pathname === '/' ? '/index.html' : url.pathname;
    file = path.normalize(file).replace(/^(\.\.[/\\])+/, '');
    const full = path.join(PUBLIC, file);
    if (!full.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
    fs.readFile(full, (err, buf) => {
      if (err) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
      res.end(buf);
    });
  } catch (e) {
    send(res, e.starting ? 503 : 500, { error: e.message, starting: !!e.starting });
  }
});

server.listen(PORT, () => console.log(`Namecoin dashboard on :${PORT} -> RPC ${RPC_HOST}:${RPC_PORT}`));
