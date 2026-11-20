// Tests for the Q&A system: the data file, the FAQ page renderer
// (js/faq.js) and the admin page helpers (js/admin.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (f) => fs.readFileSync(root + f, 'utf8');

function load(file, exportName) {
  const sandbox = { window: {}, TextEncoder, TextDecoder, atob, btoa, Date, Math, JSON, Map, Set };
  vm.runInNewContext(read(file), sandbox, { filename: file });
  return sandbox.window[exportName];
}

const Admin = load('js/admin.js', 'MochiAdmin');
const Faq = load('js/faq.js', 'MochiFaq');

/* ---------- the data file ---------- */

test('assets/data/faq.json is a valid list of Q&As', () => {
  const list = JSON.parse(read('assets/data/faq.json'));
  assert.ok(Array.isArray(list), 'faq.json must be a list: [ ... ]');
  const ids = new Set();
  for (const e of list) {
    assert.equal(typeof e.id, 'string', 'every Q&A has an id');
    assert.ok(!ids.has(e.id), `duplicate id ${e.id}`);
    ids.add(e.id);
    assert.ok(typeof e.question === 'string' && e.question.trim().length >= 5, `question too short in ${e.id}`);
    assert.ok(e.question.length <= Admin.LIMITS.question, `question too long in ${e.id}`);
    assert.ok(typeof e.answer === 'string' && e.answer.trim().length >= 5, `answer too short in ${e.id}`);
    assert.ok(e.answer.length <= Admin.LIMITS.answer, `answer too long in ${e.id}`);
    assert.ok(typeof (e.name ?? '') === 'string' && (e.name ?? '').length <= Admin.LIMITS.name, `bad name in ${e.id}`);
    assert.match(e.date, /^\d{4}-\d{2}-\d{2}$/, `date must look like 2026-11-20 in ${e.id}`);
  }
});

/* ---------- admin helpers ---------- */

test('text survives the trip to GitHub and back, emoji included', () => {
  const text = 'Mochi says héllo 🐾 — "quotes" & <tags>\nnew line';
  assert.equal(Admin.fromBase64(Admin.toBase64(text)), text);
});

test('makeEntry cleans input and fills in the blanks', () => {
  const { entry } = Admin.makeEntry({ name: '  Priya  ', question: ' Can dogs eat mango? ', answer: 'Yes, peeled and without the pit.\u0007', date: '' }, '2026-11-20');
  assert.equal(entry.name, 'Priya');
  assert.equal(entry.question, 'Can dogs eat mango?');
  assert.equal(entry.answer, 'Yes, peeled and without the pit.');
  assert.equal(entry.date, '2026-11-20');
  assert.match(entry.id, /^q-/);
});

test('makeEntry keeps the id when editing and allows a blank name', () => {
  const { entry } = Admin.makeEntry({ id: 'q-abc', name: '', question: 'Is rice okay?', answer: 'Plain cooked rice, yes.', date: '2026-10-01' }, '2026-11-20');
  assert.equal(entry.id, 'q-abc');
  assert.equal(entry.name, '');
  assert.equal(entry.date, '2026-10-01');
});

test('makeEntry refuses empty questions and answers', () => {
  assert.ok(Admin.makeEntry({ question: '', answer: 'Long enough answer' }, '2026-11-20').error);
  assert.ok(Admin.makeEntry({ question: 'A real question?', answer: ' ' }, '2026-11-20').error);
});

test('long text is trimmed to the limits', () => {
  const { entry } = Admin.makeEntry({ name: 'x'.repeat(200), question: 'q'.repeat(900), answer: 'a'.repeat(9000) }, '2026-11-20');
  assert.equal(entry.name.length, Admin.LIMITS.name);
  assert.equal(entry.question.length, Admin.LIMITS.question);
  assert.equal(entry.answer.length, Admin.LIMITS.answer);
});

test('serialize writes newest first, valid JSON and a final newline', () => {
  const out = Admin.serialize([
    { id: 'q-1', question: 'Old one?', answer: 'Old answer', date: '2026-01-01', name: '' },
    { id: 'q-2', question: 'New one?', answer: 'New answer', date: '2026-11-01', name: 'Sam' }
  ]);
  assert.ok(out.endsWith('\n'));
  const back = JSON.parse(out);
  assert.deepEqual(back.map((e) => e.id), ['q-2', 'q-1']);
});

test('diff counts additions, edits and deletions', () => {
  const saved = [{ id: 'a', question: 'Q1?', answer: 'A1' }, { id: 'b', question: 'Q2?', answer: 'A2' }];
  const current = [{ id: 'a', question: 'Q1?', answer: 'A1 changed' }, { id: 'c', question: 'Q3?', answer: 'A3' }];
  const d = Admin.diff(saved, current);
  assert.deepEqual({ added: d.added, edited: d.edited, removed: d.removed, total: d.total }, { added: 1, edited: 1, removed: 1, total: 3 });
  assert.equal(Admin.describeChanges(d), 'add 1, edit 1, delete 1');
});

/* ---------- FAQ page renderer ---------- */

test('answers split into paragraphs on blank lines', () => {
  assert.deepEqual(Array.from(Faq.paragraphs('First.\n\nSecond line one\nline two\n\n\nThird.')), ['First.', 'Second line one\nline two', 'Third.']);
});

test('dates read as month and year, names fall back politely', () => {
  assert.equal(Faq.formatDate('2026-11-20'), 'November 2026');
  assert.equal(Faq.formatDate('nope'), '');
  assert.equal(Faq.askedBy({ name: 'Priya', date: '2026-11-20' }), 'Asked by Priya, November 2026');
  assert.equal(Faq.askedBy({ name: '  ', date: '' }), 'Asked by A dog parent');
});

test('only complete Q&As are shown, newest first', () => {
  const shown = Faq.usable([
    { id: 'q-1', question: 'Old?', answer: 'Yes', date: '2025-01-01' },
    { id: 'q-2', question: 'No answer yet?', answer: '', date: '2026-01-01' },
    { id: 'q-3', question: 'New?', answer: 'Yes', date: '2026-11-01' },
    null
  ]);
  assert.deepEqual(Array.from(shown, (e) => e.id), ['q-3', 'q-1']);
});

/* ---------- pages ---------- */

test('the FAQ page has no built-in questions, just the Q&A list', () => {
  const html = read('diet.html');
  assert.doesNotMatch(html, /<details/, 'diet.html should not contain hard-coded questions');
  assert.match(html, /id="qaList"/);
  assert.match(html, /src="js\/faq\.js"/);
  assert.doesNotMatch(html, /api\.github\.com/, 'the public FAQ page never talks to GitHub');
});

test('admin.html is locked down', () => {
  const html = read('admin.html');
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/, 'hidden from search engines');
  assert.match(html, /connect-src 'self' https:\/\/api\.github\.com;/, 'may only talk to GitHub');
  assert.match(html, /type="password"/, 'token field hides what you type');
  for (const tag of html.match(/<script\b[^>]*>/gi) || []) assert.match(tag, /\ssrc="/, `inline script: ${tag}`);
  assert.doesNotMatch(html, /<[^>]*\son[a-z]+\s*=/i, 'no inline event handlers');
  assert.doesNotMatch(html, /<[^>]*\sstyle\s*=/i, 'no inline styles');
});

test('the deploy step publishes the admin page and the Q&A file', () => {
  const yml = read('.github/workflows/deploy.yml');
  assert.match(yml, /cp -R [^\n]*admin\.html[^\n]* assets _site\//);
});
