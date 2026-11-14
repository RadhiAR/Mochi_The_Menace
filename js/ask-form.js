/* =====================================================================
   ask-form.js — "Ask Mochi's mom" form on the Diet page
   - Sends to Formspree if formEndpoint is set in config.js
   - Otherwise opens the visitor's email app (contactEmail)
   - Validates input, blocks simple spam bots, never shows
     visitor text back as HTML.
   ===================================================================== */
(function () {
  'use strict';

  const cfg = window.MOCHI_CONFIG || {};
  const M = window.Mochi;
  const form = document.getElementById('askForm');
  if (!form || !M) return;

  const MAX_LEN = 1500;
  const MIN_LEN = 10;
  const COOLDOWN_MS = 30000;

  const endpoint = M.safeUrl(cfg.formEndpoint);
  const email = typeof cfg.contactEmail === 'string' ? cfg.contactEmail.trim() : '';
  const emailOk = /^[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]{2,}$/;
  const hasEmail = emailOk.test(email);

  const $ = function (id) { return document.getElementById(id); };
  const fields = {
    name: $('askName'),
    email: $('askEmail'),
    dog: $('askDog'),
    message: $('askQuestion'),
    consent: $('askConsent'),
    trap: $('askWebsite')
  };
  const submitBtn = $('askSubmit');
  const statusEl = $('askStatus');
  const counter = $('askCounter');
  let lastSent = 0;

  if (!endpoint && !hasEmail) {
    $('setupNotice').hidden = false;
    submitBtn.disabled = true;
  }

  fields.message.addEventListener('input', function () {
    counter.textContent = fields.message.value.length + ' / ' + MAX_LEN;
  });

  function setError(input, errorId, message) {
    const box = $(errorId);
    box.textContent = message || '';
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
    return !message;
  }

  function setStatus(message, kind) {
    statusEl.textContent = message;
    statusEl.className = 'form-status' + (kind ? ' is-' + kind : '');
  }

  function clean(value, max) {
    // strip control characters and trim to the allowed length
    return String(value || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
  }

  function validate() {
    const mail = clean(fields.email.value, 120);
    const msg = clean(fields.message.value, MAX_LEN);
    let ok = true;

    ok = setError(fields.email, 'askEmailError',
      !mail ? 'Enter your email so Mochi\'s mom can reply.'
        : !emailOk.test(mail) ? 'Check your email address. It should look like name@example.com.'
          : '') && ok;

    ok = setError(fields.message, 'askQuestionError',
      msg.length < MIN_LEN ? 'Write your question in at least ' + MIN_LEN + ' characters.' : '') && ok;

    ok = setError(fields.consent, 'askConsentError',
      !fields.consent.checked ? 'Tick the box to agree to the privacy policy.' : '') && ok;

    if (!ok) {
      const firstBad = form.querySelector('[aria-invalid="true"]');
      if (firstBad) firstBad.focus();
    }
    return ok;
  }

  function payload() {
    return {
      name: clean(fields.name.value, 60),
      email: clean(fields.email.value, 120),
      dog: clean(fields.dog.value, 100),
      message: clean(fields.message.value, MAX_LEN)
    };
  }

  async function sendToEndpoint(data) {
    const body = new FormData();
    body.append('name', data.name);
    body.append('email', data.email);
    body.append('dog', data.dog);
    body.append('message', data.message);
    body.append('_subject', 'New question for Mochi\'s mom');

    const controller = 'AbortController' in window ? new AbortController() : null;
    const timer = controller ? setTimeout(function () { controller.abort(); }, 15000) : null;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        body: body,
        headers: { Accept: 'application/json' },
        signal: controller ? controller.signal : undefined
      });
      return res.ok;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  function openEmailApp(data) {
    const subject = 'Question for Mochi\'s mom';
    const lines = [
      data.message,
      '',
      '---',
      'Name: ' + (data.name || '-'),
      'Dog: ' + (data.dog || '-'),
      'Reply to: ' + data.email
    ];
    window.location.href = 'mailto:' + encodeURIComponent(email) +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(lines.join('\n'));
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    setStatus('');

    // bots fill hidden fields; pretend everything went fine
    if (fields.trap.value) {
      form.reset();
      setStatus('Question sent. Thanks! Mochi\'s mom will reply by email.', 'ok');
      return;
    }

    if (!validate()) return;

    if (Date.now() - lastSent < COOLDOWN_MS) {
      setStatus('You just sent a question. Wait a few seconds before sending another.', 'error');
      return;
    }

    const data = payload();

    if (!endpoint) {
      openEmailApp(data);
      setStatus('Your email app should open with your question ready. Press send there to finish.', 'ok');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';
    try {
      const ok = await sendToEndpoint(data);
      if (!ok) throw new Error('bad response');
      lastSent = Date.now();
      form.reset();
      counter.textContent = '0 / ' + MAX_LEN;
      setStatus('Question sent. Thanks! Mochi\'s mom will reply by email.', 'ok');
    } catch (err) {
      setStatus('Your question didn\'t send. Check your internet connection and try again.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send question';
    }
  });
})();
