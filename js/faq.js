/* =====================================================================
   faq.js — shows the published Q&As on the FAQ page (diet.html)
   The Q&As live in assets/data/faq.json and are managed from admin.html.
   Everything is inserted as plain text, never as HTML.
   ===================================================================== */
(function () {
  'use strict';

  const DATA_URL = 'assets/data/faq.json';
  const FALLBACK_NAME = 'A dog parent';

  // Blank lines in an answer start a new paragraph.
  function paragraphs(text) {
    return String(text || '')
      .replace(/\r\n?/g, '\n')
      .split(/\n\s*\n/)
      .map(function (p) { return p.trim(); })
      .filter(Boolean);
  }

  // "2026-11-20" -> "November 2026"
  function formatDate(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    if (!m) return '';
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en', { month: 'long', year: 'numeric' });
  }

  function askedBy(entry) {
    const name = typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : FALLBACK_NAME;
    const when = formatDate(entry.date);
    return 'Asked by ' + name + (when ? ', ' + when : '');
  }

  function usable(list) {
    return (Array.isArray(list) ? list : [])
      .filter(function (e) {
        return e && typeof e.question === 'string' && e.question.trim() &&
          typeof e.answer === 'string' && e.answer.trim();
      })
      .sort(function (a, b) {
        return String(b.date || '').localeCompare(String(a.date || '')) ||
          String(b.id || '').localeCompare(String(a.id || ''));
      });
  }

  window.MochiFaq = { paragraphs: paragraphs, formatDate: formatDate, askedBy: askedBy, usable: usable };

  if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;
  const listEl = document.getElementById('qaList');
  const statusEl = document.getElementById('qaStatus');
  if (!listEl || !statusEl) return;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function render(list) {
    const items = usable(list);
    listEl.textContent = '';

    if (!items.length) {
      statusEl.textContent = 'No questions answered yet. Be the first to ask Mochi\'s mom below!';
      statusEl.className = 'qa-empty';
      statusEl.hidden = false;
      listEl.hidden = true;
      return;
    }

    items.forEach(function (entry) {
      const details = el('details', 'qa');
      const summary = el('summary');
      summary.appendChild(el('span', 'qa__q', entry.question.trim()));
      summary.appendChild(el('span', 'qa__by', askedBy(entry)));
      details.appendChild(summary);

      const answer = el('div', 'faq-answer');
      paragraphs(entry.answer).forEach(function (p) { answer.appendChild(el('p', null, p)); });
      details.appendChild(answer);
      listEl.appendChild(details);
    });

    statusEl.hidden = true;
    listEl.hidden = false;
  }

  fetch(DATA_URL, { cache: 'no-cache' })
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(render)
    .catch(function () {
      statusEl.textContent = 'The questions couldn\'t load. Refresh the page to try again.';
      statusEl.className = 'qa-empty';
      statusEl.hidden = false;
    });
})();
