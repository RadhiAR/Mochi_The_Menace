// Checks js/config.js so a typo there can't break the live site.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

function loadConfig() {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(root + 'js/config.js', 'utf8'), sandbox, { filename: 'config.js' });
  return sandbox.window.MOCHI_CONFIG;
}

const isHttpsOrEmpty = (value) => value === '' || (typeof value === 'string' && /^https:\/\/[^\s]+$/.test(value));

test('config.js loads and defines MOCHI_CONFIG', () => {
  const cfg = loadConfig();
  assert.equal(typeof cfg, 'object');
  assert.ok(cfg.siteName, 'siteName is set');
});

test('social links are https or empty, and have labels', () => {
  const { social } = loadConfig();
  assert.ok(Array.isArray(social), 'social is a list');
  for (const s of social) {
    assert.ok(s.label, `social item ${s.id} has a label`);
    assert.ok(isHttpsOrEmpty(s.url), `social "${s.label}" url must start with https:// or be empty, got: ${s.url}`);
  }
});

test('Instagram link is a proper instagram.com profile link', () => {
  const insta = loadConfig().social.find((s) => s.id === 'instagram');
  assert.ok(insta, 'Instagram entry exists');
  if (insta.url === '') return;
  const url = new URL(insta.url);
  assert.match(url.hostname, /^(www\.)?instagram\.com$/, 'Instagram link must be on instagram.com');
  assert.match(url.pathname, /^\/[A-Za-z0-9._]+\/?$/, 'Instagram link should point to a profile, like https://www.instagram.com/yourname/');
});

test('affiliate links are https or empty, and have names', () => {
  const { affiliates } = loadConfig();
  assert.ok(Array.isArray(affiliates), 'affiliates is a list');
  for (const a of affiliates) {
    assert.ok(a.name, 'every affiliate item has a name');
    assert.ok(isHttpsOrEmpty(a.url), `affiliate "${a.name}" url must start with https:// or be empty, got: ${a.url}`);
    assert.equal(typeof (a.code ?? ''), 'string', `affiliate "${a.name}" code is text`);
  }
});

test('form settings are valid', () => {
  const { formEndpoint, contactEmail } = loadConfig();
  assert.ok(isHttpsOrEmpty(formEndpoint), `formEndpoint must start with https:// or be empty, got: ${formEndpoint}`);
  assert.ok(
    contactEmail === '' || /^[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]{2,}$/.test(contactEmail),
    `contactEmail must be a valid email or empty, got: ${contactEmail}`
  );
  if (formEndpoint) {
    const host = new URL(formEndpoint).host;
    const diet = fs.readFileSync(root + 'diet.html', 'utf8');
    assert.ok(diet.includes(host), `diet.html Content-Security-Policy must allow ${host}`);
  }
});

test('gallery settings are valid', () => {
  const { gallery } = loadConfig();
  assert.ok(Number.isInteger(gallery.coverPhoto) && gallery.coverPhoto >= 1, 'coverPhoto is a whole number from 1 up');
  assert.match(gallery.filePrefix, /^[a-z0-9_-]+$/i, 'filePrefix is plain letters/numbers');
  for (const [key, value] of Object.entries({ ...gallery.captions, ...gallery.videoCaptions })) {
    assert.match(key, /^\d+$/, `caption key "${key}" must be a number like 1, 2, 3`);
    assert.equal(typeof value, 'string', `caption ${key} must be text`);
  }
});
