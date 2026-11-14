// Local preview server for the Mochi site. Uses only Node itself (no installs).
// npm run dev -> http://localhost:5173   |   npm run dev:phone -> also on your Wi-Fi
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const HOST = args.includes('--host') ? '0.0.0.0' : '127.0.0.1';
let port = Number(process.env.PORT) || 5173;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm'
};

function text(res, code, msg, extra = {}) {
  res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...extra });
  res.end(msg);
}

const server = http.createServer((req, res) => {
  if (['GET', 'HEAD'].includes(req.method) === false) return text(res, 405, 'Method not allowed', { Allow: 'GET, HEAD' });
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { return text(res, 400, 'Bad request'); }
  if (p.endsWith('/')) p += 'index.html';
  // never serve hidden files (.git, .env) or anything outside this folder
  if (p.split(/[\\/]/).some((s) => s.startsWith('.') || s === 'node_modules')) return text(res, 404, 'Not found');
  const file = path.resolve(ROOT, '.' + p);
  if (file.startsWith(ROOT + path.sep) === false) return text(res, 404, 'Not found');

  fs.stat(file, (err, st) => {
    if (err) return text(res, 404, 'Not found');
    if (st.isDirectory()) { res.writeHead(301, { Location: encodeURI(p + '/') }); return res.end(); }
    const headers = {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes'
    };
    let start = 0, end = st.size - 1, code = 200;
    const m = /^bytes=(\d*)-(\d*)$/.exec((req.headers.range || '').trim());
    if (req.headers.range) { // byte ranges: Safari needs these to play videos
      const bad = m === null || (m[1] === '' && m[2] === '');
      if (bad === false && m[1]) { start = +m[1]; if (m[2]) end = Math.min(+m[2], st.size - 1); }
      else if (bad === false) start = Math.max(0, st.size - +m[2]);
      if (bad || start > end) return text(res, 416, 'Range not satisfiable', { 'Content-Range': `bytes */${st.size}` });
      code = 206;
      headers['Content-Range'] = `bytes ${start}-${end}/${st.size}`;
    }
    headers['Content-Length'] = st.size ? end - start + 1 : 0;
    res.writeHead(code, headers);
    if (req.method === 'HEAD' || st.size === 0) return res.end();
    fs.createReadStream(file, { start, end }).on('error', () => res.destroy()).pipe(res);
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE' && port < 5190) return server.listen(++port, HOST);
  console.error('Could not start: ' + err.message);
  process.exit(1);
});

server.on('listening', () => {
  const url = `http://localhost:${port}`;
  console.log(`\n  Mochi the Menace is running\n\n  On this computer:  ${url}`);
  if (HOST === '0.0.0.0') {
    Object.values(os.networkInterfaces()).flat()
      .filter((n) => n && n.family === 'IPv4' && n.internal === false)
      .forEach((n) => console.log(`  On your phone:     http://${n.address}:${port}  (same Wi-Fi)`));
  }
  console.log('\n  Edit a file, then refresh the browser. Press Ctrl+C to stop.\n');
  if (args.includes('--open')) {
    const [cmd, a] = process.platform === 'darwin' ? ['open', [url]]
      : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]];
    spawn(cmd, a, { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
  }
});

server.listen(port, HOST);
