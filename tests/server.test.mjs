// Starts the local preview server and checks it serves the site safely.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
let server;
let port;

function request(path, { method = 'GET', headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, method, headers }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

before(async () => {
  const wanted = 6000 + Math.floor(Math.random() * 2000);
  server = spawn(process.execPath, ['scripts/dev-server.mjs'], {
    cwd: root,
    env: { ...process.env, PORT: String(wanted) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  port = await new Promise((resolve, reject) => {
    let out = '';
    const timer = setTimeout(() => reject(new Error('server did not start: ' + out)), 8000);
    server.stdout.on('data', (chunk) => {
      out += chunk;
      const m = out.match(/localhost:(\d+)/);
      if (m) { clearTimeout(timer); resolve(Number(m[1])); }
    });
    server.on('exit', (code) => reject(new Error('server exited early with code ' + code)));
  });
});

after(() => { if (server) server.kill(); });

test('serves the home page', async () => {
  const res = await request('/');
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /text\/html/);
  assert.match(res.body, /Mochi/);
});

test('serves all pages, styles and scripts with the right type', async () => {
  const files = { '/about.html': /text\/html/, '/diet.html': /text\/html/, '/privacy.html': /text\/html/, '/css/styles.css': /text\/css/, '/js/photobook.js': /javascript/, '/assets/icons/favicon.svg': /image\/svg/ };
  for (const [path, type] of Object.entries(files)) {
    const res = await request(path);
    assert.equal(res.status, 200, path);
    assert.match(res.headers['content-type'], type, path);
  }
});

test('missing files return 404 (the photo book relies on this)', async () => {
  const res = await request('/assets/images/moch99999.jpg', { method: 'HEAD' });
  assert.equal(res.status, 404);
});

test('supports byte ranges (Safari needs this for videos)', async () => {
  const res = await request('/index.html', { headers: { Range: 'bytes=0-9' } });
  assert.equal(res.status, 206);
  assert.match(res.headers['content-range'], /^bytes 0-9\/\d+$/);
  assert.equal(res.body.length, 10);
});

test('never serves files outside the site folder', async () => {
  for (const path of ['/../../etc/passwd', '/../../../../etc/hosts', '/%2e%2e/%2e%2e/etc/passwd', '/..%5c..%5cetc%5cpasswd']) {
    const res = await request(path);
    assert.equal(res.status, 404, path);
  }
});

test('never serves hidden files like .git or .gitignore', async () => {
  assert.equal((await request('/.gitignore')).status, 404);
  assert.equal((await request('/.git/config')).status, 404);
});

test('only allows reading, not posting', async () => {
  assert.equal((await request('/', { method: 'POST' })).status, 405);
});
