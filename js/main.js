/* =====================================================================
   main.js — shared by every page
   - Renders social + affiliate links from config.js
   - Loads Mochi's profile photo with any file extension
   - Footer year
   No innerHTML is used with config values, so a typo in config.js
   can never inject code into the page.
   ===================================================================== */
(function () {
  'use strict';

  const cfg = window.MOCHI_CONFIG || {};
  const gallery = cfg.gallery || {};
  const SVG_NS = 'http://www.w3.org/2000/svg';

  /* ---------- helpers ---------- */

  // Only allow real https links. Anything else (javascript:, typos) is ignored.
  function safeUrl(value) {
    if (typeof value !== 'string' || value.trim() === '') return null;
    try {
      const url = new URL(value.trim());
      return url.protocol === 'https:' ? url.href : null;
    } catch (e) {
      return null;
    }
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  // Simple line icons (generic shapes, not brand logos).
  const ICONS = {
    instagram: [
      ['rect', { x: 3, y: 6, width: 18, height: 14, rx: 4 }],
      ['circle', { cx: 12, cy: 13, r: 3.6 }],
      ['path', { d: 'M8.5 6l1.4-2.2h4.2L15.5 6' }]
    ],
    facebook: [
      ['path', { d: 'M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3.5V17.5H4A1.5 1.5 0 0 1 2.5 16V7A1.5 1.5 0 0 1 4 5.5z' }],
      ['path', { d: 'M7 10.5h10M7 13.5h6' }]
    ],
    youtube: [
      ['circle', { cx: 12, cy: 12, r: 9 }],
      ['path', { d: 'M10 8.6l5.4 3.4-5.4 3.4z' }]
    ],
    shop: [
      ['path', { d: 'M5 8h14l-1.2 11.2a1.5 1.5 0 0 1-1.5 1.3H7.7a1.5 1.5 0 0 1-1.5-1.3z' }],
      ['path', { d: 'M9 8V6.5a3 3 0 0 1 6 0V8' }]
    ],
    link: [
      ['path', { d: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1' }],
      ['path', { d: 'M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1' }]
    ]
  };

  function icon(name) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('class', 'icon');
    (ICONS[name] || ICONS.link).forEach(function (part) {
      const shape = document.createElementNS(SVG_NS, part[0]);
      Object.keys(part[1]).forEach(function (k) { shape.setAttribute(k, part[1][k]); });
      svg.appendChild(shape);
    });
    return svg;
  }

  // Paw print used across the site.
  function paw(className) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 64 64');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('class', className || 'paw');
    [
      ['ellipse', { cx: 32, cy: 42, rx: 13, ry: 11 }],
      ['ellipse', { cx: 15, cy: 27, rx: 5.5, ry: 7, transform: 'rotate(-20 15 27)' }],
      ['ellipse', { cx: 25, cy: 16, rx: 5.5, ry: 7.5 }],
      ['ellipse', { cx: 39, cy: 16, rx: 5.5, ry: 7.5 }],
      ['ellipse', { cx: 49, cy: 27, rx: 5.5, ry: 7, transform: 'rotate(20 49 27)' }]
    ].forEach(function (part) {
      const shape = document.createElementNS(SVG_NS, part[0]);
      Object.keys(part[1]).forEach(function (k) { shape.setAttribute(k, part[1][k]); });
      svg.appendChild(shape);
    });
    return svg;
  }

  /* ---------- photo with extension fallback ----------
     <img data-mochi-photo="1" src="assets/images/moch1.jpg">
     tries .jpg, .jpeg, .png ... and shows a paw placeholder if none exist. */
  function loadPhoto(img, number) {
    const exts = gallery.imageExtensions || ['jpg', 'jpeg', 'png', 'webp'];
    const prefix = gallery.filePrefix || 'moch';
    let i = 0;
    const current = img.getAttribute('src') || '';
    // If the HTML already points at one of the options, start after it.
    exts.forEach(function (ext, idx) {
      if (current.endsWith(prefix + number + '.' + ext)) i = idx + 1;
    });

    function tryNext() {
      if (i >= exts.length) {
        img.removeEventListener('error', tryNext);
        const frame = img.closest('[data-photo-frame]');
        if (frame) frame.classList.add('is-missing');
        return;
      }
      img.src = 'assets/images/' + prefix + number + '.' + exts[i++];
    }
    img.addEventListener('error', tryNext);
    if (img.complete && img.naturalWidth === 0 && current) tryNext();
    if (!current) tryNext();
  }

  function initPhotos() {
    document.querySelectorAll('img[data-mochi-photo]').forEach(function (img) {
      let n = img.getAttribute('data-mochi-photo');
      if (n === 'cover') n = gallery.coverPhoto || 1;
      loadPhoto(img, parseInt(n, 10) || 1);
    });
  }

  /* ---------- social links ---------- */
  function socialItems() {
    return (cfg.social || [])
      .map(function (s) { return Object.assign({}, s, { href: safeUrl(s.url) }); })
      .filter(function (s) { return s.href; });
  }

  function renderSocialList(list) {
    socialItems().forEach(function (s) {
      const li = el('li');
      const a = el('a', 'social-row');
      a.href = s.href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.appendChild(icon(s.id));
      const text = el('span', 'social-row__text');
      text.appendChild(el('span', 'social-row__name', s.label));
      if (s.handle) text.appendChild(el('span', 'social-row__handle', s.handle));
      a.appendChild(text);
      a.appendChild(el('span', 'social-row__go', 'Follow'));
      a.setAttribute('aria-label', 'Follow Mochi on ' + s.label + ' (opens in a new tab)');
      li.appendChild(a);
      list.appendChild(li);
    });
  }

  function renderSocialIcons(list) {
    socialItems().forEach(function (s) {
      const li = el('li');
      const a = el('a', 'social-icon');
      a.href = s.href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.setAttribute('aria-label', 'Mochi on ' + s.label + ' (opens in a new tab)');
      a.appendChild(icon(s.id));
      li.appendChild(a);
      list.appendChild(li);
    });
  }

  /* ---------- affiliate links ---------- */
  function renderAffiliates(section) {
    const list = section.querySelector('[data-affiliate-list]');
    const items = (cfg.affiliates || []).filter(function (a) { return safeUrl(a.url); });

    if (!items.length) {
      section.hidden = true; // nothing to show yet, so no empty section on the live site
      return;
    }

    const disclosure = section.querySelector('[data-affiliate-disclosure]');
    if (disclosure && cfg.affiliateDisclosure) disclosure.textContent = cfg.affiliateDisclosure;

    items.forEach(function (item) {
      const li = el('li', 'shelf-item');
      const body = el('div', 'shelf-item__body');
      body.appendChild(el('h3', 'shelf-item__name', item.name || 'Mochi pick'));
      if (item.note) body.appendChild(el('p', 'shelf-item__note', item.note));
      li.appendChild(body);

      const actions = el('div', 'shelf-item__actions');
      if (item.code) {
        const codeBtn = el('button', 'code-chip');
        codeBtn.type = 'button';
        codeBtn.textContent = 'Code: ' + item.code;
        codeBtn.setAttribute('aria-label', 'Copy discount code ' + item.code);
        codeBtn.addEventListener('click', function () { copyCode(codeBtn, item.code); });
        actions.appendChild(codeBtn);
      }
      const a = el('a', 'btn btn--small');
      a.href = safeUrl(item.url);
      a.target = '_blank';
      a.rel = 'sponsored noopener noreferrer';
      a.appendChild(icon('shop'));
      a.appendChild(document.createTextNode('Shop'));
      a.setAttribute('aria-label', 'Shop ' + (item.name || 'this item') + ' (affiliate link, opens in a new tab)');
      actions.appendChild(a);
      li.appendChild(actions);
      list.appendChild(li);
    });

    section.hidden = false;
  }

  function copyCode(button, code) {
    const original = button.textContent;
    const done = function (msg) {
      button.textContent = msg;
      setTimeout(function () { button.textContent = original; }, 1600);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(code).then(
        function () { done('Copied'); },
        function () { done(code); }
      );
    } else {
      done(code);
    }
  }

  /* ---------- footer disclosure + year ---------- */
  function initFooter() {
    document.querySelectorAll('[data-year]').forEach(function (n) {
      n.textContent = String(new Date().getFullYear());
    });
    const hasAffiliates = (cfg.affiliates || []).some(function (a) { return safeUrl(a.url); });
    document.querySelectorAll('[data-footer-disclosure]').forEach(function (n) {
      n.hidden = !hasAffiliates;
    });
  }

  /* ---------- go ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    initPhotos();
    document.querySelectorAll('[data-social-list]').forEach(renderSocialList);
    document.querySelectorAll('[data-social-icons]').forEach(renderSocialIcons);
    document.querySelectorAll('[data-affiliate-section]').forEach(renderAffiliates);
    initFooter();
  });

  // Shared with photobook.js and ask-form.js
  window.Mochi = { safeUrl: safeUrl, el: el, icon: icon, paw: paw, socialItems: socialItems };
})();
