// Checks every HTML page for broken links and anything that would
// break the security policy (inline scripts, inline styles, unsafe links).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const PAGES = ['index.html', 'about.html', 'diet.html', 'privacy.html'];
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const tags = (html, name) => html.match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) || [];
const attr = (tag, name) => {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, 'i'));
  return m ? m[1] : null;
};

for (const page of PAGES) {
  test(`${page}: basics are in place`, () => {
    const html = read(page);
    assert.match(html, /^<!DOCTYPE html>/i, 'starts with <!DOCTYPE html>');
    assert.match(html, /<html lang="[a-z-]+"/i, 'has a language');
    assert.match(html, /<title>[^<]{3,}<\/title>/, 'has a title');
    assert.match(html, /<meta name="viewport"/, 'has a mobile viewport tag');
    assert.match(html, /http-equiv="Content-Security-Policy"[^>]*script-src 'self'/, 'has the security policy');
    assert.ok(html.includes('href="privacy.html"') || page === 'privacy.html', 'links to the privacy policy');
  });

  test(`${page}: no inline scripts, handlers or styles (blocked by the security policy)`, () => {
    const html = read(page);
    for (const tag of tags(html, 'script')) {
      assert.ok(attr(tag, 'src'), `inline <script> found: ${tag}`);
    }
    assert.doesNotMatch(html, /<[^>]*\son[a-z]+\s*=/i, 'no onclick=... style handlers');
    assert.doesNotMatch(html, /<[^>]*\sstyle\s*=/i, 'no style="..." attributes');
  });

  test(`${page}: every local file it points to exists`, () => {
    const html = read(page);
    const refs = [...tags(html, 'a'), ...tags(html, 'link'), ...tags(html, 'script'), ...tags(html, 'img')]
      .map((t) => attr(t, 'href') ?? attr(t, 'src'))
      .filter(Boolean)
      .filter((u) => !/^(https?:|mailto:|tel:|data:|#)/i.test(u))
      .map((u) => u.split(/[?#]/)[0])
      // photos and videos are added by you later, so they may not exist yet
      .filter((u) => !u.startsWith('assets/images/') && !u.startsWith('assets/videos/'));
    for (const ref of refs) {
      assert.ok(fs.existsSync(path.join(root, ref)), `${page} points to missing file: ${ref}`);
    }
  });

  test(`${page}: links that open a new tab are safe`, () => {
    for (const a of tags(read(page), 'a')) {
      if (attr(a, 'target') === '_blank') {
        assert.match(attr(a, 'rel') || '', /noopener/, `missing rel="noopener": ${a}`);
      }
    }
  });
}

test('every page has the same three-page menu', () => {
  for (const page of PAGES) {
    const html = read(page);
    for (const target of ['index.html', 'about.html', 'diet.html']) {
      assert.ok(html.includes(`href="${target}"`), `${page} menu links to ${target}`);
    }
  }
});
