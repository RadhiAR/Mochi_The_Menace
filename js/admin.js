/* =====================================================================
   admin.js — Q&A admin page (admin.html)
   - Unlock with your GitHub token (kept in this tab only).
   - Loads assets/data/faq.json from the alpha branch on GitHub.
   - Add, edit and delete Q&As, then Publish: saves the file to alpha,
     which starts your pipeline (tests -> beta -> your approval -> live).
   Nothing a visitor types is ever inserted as HTML.
   ===================================================================== */
(function () {
  'use strict';

  const adminCfg = (window.MOCHI_CONFIG && window.MOCHI_CONFIG.admin) || {};
  const REPO = adminCfg.repo || 'RadhiAR/Mochi_The_Menace';
  const BRANCH = adminCfg.branch || 'alpha';
  const FILE = adminCfg.faqFile || 'assets/data/faq.json';
  const API = 'https://api.github.com/repos/' + REPO + '/contents/' + FILE;
  const ACTIONS_URL = 'https://github.com/' + REPO + '/actions';
  const TOKEN_KEY = 'mochi-admin-token';
  const LIMITS = { name: 60, question: 500, answer: 4000 };

  /* ---------------- helpers (also used by the unit tests) ---------------- */

  function toBase64(text) {
    const bytes = new TextEncoder().encode(String(text));
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  function fromBase64(b64) {
    const binary = atob(String(b64 || '').replace(/\s/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function cleanText(value, max) {
    return String(value == null ? '' : value)
      .replace(/\r\n?/g, '\n')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .trim()
      .slice(0, max);
  }

  function newId() {
    return 'q-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }

  function todayIso(now) {
    const d = now || new Date();
    const pad = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  // Turns form input into a clean Q&A entry, or explains what's missing.
  function makeEntry(input, today) {
    const src = input || {};
    const question = cleanText(src.question, LIMITS.question);
    const answer = cleanText(src.answer, LIMITS.answer);
    const name = cleanText(src.name, LIMITS.name).replace(/\s+/g, ' ');
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(src.date || '')) ? src.date : today;
    if (question.length < 5) return { error: 'Write the question (at least 5 characters).' };
    if (answer.length < 5) return { error: 'Write your answer (at least 5 characters).' };
    return { entry: { id: src.id || newId(), name: name, question: question, answer: answer, date: date } };
  }

  function sortEntries(list) {
    return list.slice().sort(function (a, b) {
      return String(b.date || '').localeCompare(String(a.date || '')) ||
        String(b.id || '').localeCompare(String(a.id || ''));
    });
  }

  function serialize(list) {
    return JSON.stringify(sortEntries(list), null, 2) + '\n';
  }

  // What changed between the published list and the working list.
  function diff(saved, current) {
    const before = new Map(saved.map(function (e) { return [e.id, JSON.stringify(e)]; }));
    const after = new Map(current.map(function (e) { return [e.id, JSON.stringify(e)]; }));
    let added = 0, removed = 0, edited = 0;
    after.forEach(function (json, id) {
      if (!before.has(id)) added++;
      else if (before.get(id) !== json) edited++;
    });
    before.forEach(function (_, id) { if (!after.has(id)) removed++; });
    return { added: added, removed: removed, edited: edited, total: added + removed + edited };
  }

  function describeChanges(d) {
    const parts = [];
    if (d.added) parts.push('add ' + d.added);
    if (d.edited) parts.push('edit ' + d.edited);
    if (d.removed) parts.push('delete ' + d.removed);
    return parts.join(', ');
  }

  window.MochiAdmin = {
    toBase64: toBase64, fromBase64: fromBase64, cleanText: cleanText, makeEntry: makeEntry,
    sortEntries: sortEntries, serialize: serialize, diff: diff, describeChanges: describeChanges,
    todayIso: todayIso, LIMITS: LIMITS
  };

  /* ---------------- page ---------------- */

  if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return;
  if (!document.querySelector('[data-admin-app]')) return;

  const $ = function (id) { return document.getElementById(id); };
  const ui = {
    unlockCard: $('unlockCard'), unlockForm: $('unlockForm'), tokenInput: $('tokenInput'), unlockBtn: $('unlockBtn'),
    lockBtn: $('lockBtn'), area: $('adminArea'),
    form: $('entryForm'), name: $('entryName'), date: $('entryDate'), question: $('entryQuestion'),
    answer: $('entryAnswer'), error: $('entryError'), submit: $('entrySubmit'), cancel: $('entryCancel'),
    list: $('entryList'), empty: $('listEmpty'), count: $('entryCount'), reload: $('reloadBtn'),
    bar: $('publishBar'), summary: $('changeSummary'), discard: $('discardBtn'), publish: $('publishBtn'),
    status: $('adminStatus')
  };

  let token = '';
  let sha = null;
  let saved = [];     // what's on GitHub
  let current = [];   // what you're editing
  let editingId = null;
  let busy = false;

  function storeToken(value) {
    token = value;
    try {
      if (value) sessionStorage.setItem(TOKEN_KEY, value);
      else sessionStorage.removeItem(TOKEN_KEY);
    } catch (e) { /* private mode: keep it in memory only */ }
  }

  function readStoredToken() {
    try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
  }

  function setStatus(message, kind, link) {
    ui.status.textContent = message || '';
    ui.status.className = 'admin-status' + (kind ? ' is-' + kind : '');
    if (link) {
      ui.status.appendChild(document.createTextNode(' '));
      const a = document.createElement('a');
      a.href = link.href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = link.text;
      ui.status.appendChild(a);
    }
  }

  function setBusy(value) {
    busy = value;
    [ui.unlockBtn, ui.publish, ui.discard, ui.reload, ui.submit].forEach(function (b) { if (b) b.disabled = value; });
  }

  async function github(method, body) {
    const url = method === 'GET' ? API + '?ref=' + encodeURIComponent(BRANCH) + '&t=' + Date.now() : API;
    const headers = {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
    if (body) headers['Content-Type'] = 'application/json';
    return fetch(url, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  }

  function problem(res, action) {
    if (res.status === 401) return 'That token didn\'t work. Check you pasted the whole "Mochi pipeline" token and that it hasn\'t expired.';
    if (res.status === 403) return 'This token isn\'t allowed to ' + action + '. It needs Contents: Read and write on Mochi_The_Menace.';
    if (res.status === 404) return 'The Q&A file wasn\'t found on the ' + BRANCH + ' branch. Push the latest website code first, then try again.';
    if (res.status === 409 || res.status === 422) return 'The Q&As were changed somewhere else since this page loaded. Click Reload, then make your change again.';
    return 'GitHub answered with an error (' + res.status + '). Try again in a minute.';
  }

  async function load() {
    setBusy(true);
    setStatus('Loading Q&As…');
    try {
      const res = await github('GET');
      if (!res.ok) throw new Error(problem(res, 'read the Q&As'));
      const data = await res.json();
      let parsed;
      try { parsed = JSON.parse(fromBase64(data.content)); } catch (e) { parsed = null; }
      if (!Array.isArray(parsed)) throw new Error('The Q&A file on GitHub isn\'t in the expected format.');
      sha = data.sha;
      saved = parsed.filter(function (e) { return e && e.id && e.question && e.answer; });
      current = saved.map(function (e) { return Object.assign({}, e); });
      resetForm();
      render();
      showUnlocked(true);
      setStatus('');
      return true;
    } catch (err) {
      setStatus(err.message || 'GitHub couldn\'t be reached. Check your internet connection.', 'error');
      return false;
    } finally {
      setBusy(false);
    }
  }

  function showUnlocked(on) {
    ui.unlockCard.hidden = on;
    ui.area.hidden = !on;
    ui.lockBtn.hidden = !on;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function render() {
    const savedIds = new Set(saved.map(function (e) { return e.id; }));
    const savedJson = new Map(saved.map(function (e) { return [e.id, JSON.stringify(e)]; }));
    const items = sortEntries(current);

    ui.list.textContent = '';
    ui.count.textContent = '(' + items.length + ')';
    ui.empty.hidden = items.length > 0;

    items.forEach(function (entry) {
      const li = el('li', 'admin-item');
      const body = el('div');
      const q = el('p', 'admin-item__q', entry.question);
      if (!savedIds.has(entry.id)) q.appendChild(el('span', 'badge', 'New'));
      else if (savedJson.get(entry.id) !== JSON.stringify(entry)) q.appendChild(el('span', 'badge', 'Edited'));
      body.appendChild(q);
      body.appendChild(el('p', 'admin-item__meta', 'Asked by ' + (entry.name || 'A dog parent') + ', ' + entry.date));
      body.appendChild(el('p', 'admin-item__a', entry.answer));
      li.appendChild(body);

      const actions = el('div', 'admin-item__actions');
      const edit = el('button', 'btn btn--small btn--ghost', 'Edit');
      edit.type = 'button';
      edit.addEventListener('click', function () { startEdit(entry.id); });
      const del = el('button', 'btn btn--small btn--danger', 'Delete');
      del.type = 'button';
      del.setAttribute('aria-label', 'Delete: ' + entry.question.slice(0, 60));
      del.addEventListener('click', function () { removeEntry(entry.id); });
      actions.appendChild(edit);
      actions.appendChild(del);
      li.appendChild(actions);
      ui.list.appendChild(li);
    });

    const d = diff(saved, current);
    ui.bar.hidden = d.total === 0;
    ui.summary.textContent = d.total === 1 ? '1 unpublished change' : d.total + ' unpublished changes';
  }

  function resetForm() {
    editingId = null;
    ui.form.reset();
    ui.date.value = todayIso();
    ui.error.textContent = '';
    ui.submit.textContent = 'Add to the list';
    ui.cancel.hidden = true;
  }

  function startEdit(id) {
    const entry = current.find(function (e) { return e.id === id; });
    if (!entry) return;
    editingId = id;
    ui.name.value = entry.name || '';
    ui.date.value = entry.date || todayIso();
    ui.question.value = entry.question;
    ui.answer.value = entry.answer;
    ui.error.textContent = '';
    ui.submit.textContent = 'Save changes';
    ui.cancel.hidden = false;
    ui.question.focus();
    ui.form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function removeEntry(id) {
    const entry = current.find(function (e) { return e.id === id; });
    if (!entry) return;
    const preview = entry.question.length > 80 ? entry.question.slice(0, 80) + '…' : entry.question;
    if (!window.confirm('Delete this Q&A?\n\n"' + preview + '"\n\nIt disappears from the FAQ page after you click Publish.')) return;
    current = current.filter(function (e) { return e.id !== id; });
    if (editingId === id) resetForm();
    render();
    setStatus('Deleted from the list. Click Publish to update the FAQ page.', 'ok');
  }

  ui.form.addEventListener('submit', function (e) {
    e.preventDefault();
    const result = makeEntry({
      id: editingId,
      name: ui.name.value,
      date: ui.date.value,
      question: ui.question.value,
      answer: ui.answer.value
    }, todayIso());
    if (result.error) {
      ui.error.textContent = result.error;
      return;
    }
    if (editingId) {
      current = current.map(function (x) { return x.id === editingId ? result.entry : x; });
      setStatus('Changes saved to the list. Click Publish to update the FAQ page.', 'ok');
    } else {
      current.push(result.entry);
      setStatus('Added to the list. Click Publish to put it on the FAQ page.', 'ok');
    }
    resetForm();
    render();
  });

  ui.cancel.addEventListener('click', resetForm);

  ui.discard.addEventListener('click', function () {
    if (!window.confirm('Discard all unpublished changes?')) return;
    current = saved.map(function (x) { return Object.assign({}, x); });
    resetForm();
    render();
    setStatus('Changes discarded.');
  });

  ui.reload.addEventListener('click', function () {
    if (diff(saved, current).total && !window.confirm('Reload from GitHub? Unpublished changes will be lost.')) return;
    load();
  });

  ui.publish.addEventListener('click', async function () {
    const d = diff(saved, current);
    if (!d.total || busy) return;
    setBusy(true);
    setStatus('Publishing…');
    try {
      const res = await github('PUT', {
        message: 'Q&A admin: ' + describeChanges(d),
        content: toBase64(serialize(current)),
        sha: sha,
        branch: BRANCH
      });
      if (!res.ok) throw new Error(problem(res, 'save the Q&As'));
      const data = await res.json();
      sha = data.content && data.content.sha ? data.content.sha : sha;
      saved = current.map(function (x) { return Object.assign({}, x); });
      render();
      setStatus('Published to ' + BRANCH + '. Your pipeline is running: approve it in GitHub Actions and the FAQ page updates a few minutes later.', 'ok',
        { href: ACTIONS_URL, text: 'Open Actions' });
    } catch (err) {
      setStatus(err.message || 'GitHub couldn\'t be reached. Check your internet connection.', 'error');
    } finally {
      setBusy(false);
    }
  });

  ui.unlockForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    const value = ui.tokenInput.value.trim();
    if (!value) {
      setStatus('Paste your token first.', 'error');
      return;
    }
    storeToken(value);
    ui.tokenInput.value = '';
    const ok = await load();
    if (!ok) storeToken('');
  });

  ui.lockBtn.addEventListener('click', function () {
    if (diff(saved, current).total && !window.confirm('Lock the admin page? Unpublished changes will be lost.')) return;
    storeToken('');
    saved = [];
    current = [];
    sha = null;
    showUnlocked(false);
    setStatus('Locked. Your token has been forgotten.');
  });

  window.addEventListener('beforeunload', function (e) {
    if (token && diff(saved, current).total) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // Still unlocked from earlier in this tab?
  const stored = readStoredToken();
  if (stored) {
    token = stored;
    load().then(function (ok) { if (!ok) { storeToken(''); showUnlocked(false); } });
  }
})();
