// Unit tests for the link safety check in js/main.js (safeUrl).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

function loadMochi() {
  const sandbox = {
    URL,
    window: { MOCHI_CONFIG: { gallery: {} }, isSecureContext: true },
    document: { addEventListener() {} },
    navigator: {}
  };
  vm.runInNewContext(fs.readFileSync(root + 'js/main.js', 'utf8'), sandbox, { filename: 'main.js' });
  return sandbox.window.Mochi;
}

test('main.js exposes its helpers', () => {
  const M = loadMochi();
  assert.equal(typeof M.safeUrl, 'function');
});

test('safeUrl accepts https links', () => {
  const { safeUrl } = loadMochi();
  assert.equal(safeUrl('https://www.instagram.com/mochi_the_menace/'), 'https://www.instagram.com/mochi_the_menace/');
  assert.equal(safeUrl('  https://example.com/shop  '), 'https://example.com/shop');
});

test('safeUrl rejects anything that is not https', () => {
  const { safeUrl } = loadMochi();
  for (const bad of ['javascript:alert(1)', 'http://example.com', 'data:text/html,hi', 'ftp://x.com', 'www.example.com', '', '   ', null, undefined, 42]) {
    assert.equal(safeUrl(bad), null, `should reject ${String(bad)}`);
  }
});
