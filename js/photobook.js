/* =====================================================================
   photobook.js — Home page
   1. Finds assets/images/moch1, moch2 ... and assets/videos/moch1 ...
      automatically (any extension listed in config.js).
   2. Builds a flip book: two-page spreads on tablets/desktop,
      one page at a time on phones.
   3. Builds the "Caught on camera" video section.
   ===================================================================== */
(function () {
  'use strict';

  const site = window.MOCHI_CONFIG || {};
  const cfg = site.gallery || {};
  const M = window.Mochi;

  const PREFIX = cfg.filePrefix || 'moch';
  const IMG_DIR = 'assets/images/';
  const VID_DIR = 'assets/videos/';
  const IMG_EXTS = cfg.imageExtensions || ['jpg', 'jpeg', 'png', 'webp', 'JPG', 'JPEG', 'heic', 'HEIC', 'PNG'];
  const VID_EXTS = cfg.videoExtensions || ['mp4', 'MP4', 'mov', 'MOV', 'webm'];
  const MAX = clampInt(cfg.maxItems, 1, 500, 200);
  const STOP_AFTER = clampInt(cfg.stopAfterMissing, 1, 20, 5);
  const BATCH = 6;
  const captions = cfg.captions || {};
  const videoCaptions = cfg.videoCaptions || {};

  const bookEl = document.getElementById('book');
  const stageEl = document.getElementById('bookStage');
  const prevBtn = document.getElementById('prevPage');
  const nextBtn = document.getElementById('nextPage');
  const statusEl = document.getElementById('bookStatus');
  if (!bookEl || !M) return;

  const singleQuery = window.matchMedia('(max-width: 759px)');
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  let photos = [];
  let pages = [];
  let leaves = [];
  let flipped = 0;        // how many leaves are turned over
  let single = singleQuery.matches;
  const turning = new Map();

  function clampInt(v, min, max, fallback) {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  }

  /* ==================================================================
     1. FIND FILES
     On a web server: a quick HEAD request per file (no full download).
     When opened as a local file: load the file directly.
     ================================================================== */
  const canFetch = /^(https?|capacitor|ionic):$/.test(location.protocol) && 'fetch' in window;

  async function probeWithFetch(src) {
    try {
      const res = await fetch(src, { method: 'HEAD', cache: 'no-cache' });
      if (res.status === 404 || res.status === 410) return false;
      if (!res.ok) return null; // server doesn't like HEAD: try the other way
      const type = (res.headers.get('content-type') || '').toLowerCase();
      return type.indexOf('text/html') === -1; // some hosts answer 404s with a page
    } catch (e) {
      return null;
    }
  }

  function probeWithElement(src, kind) {
    return new Promise(function (resolve) {
      let done = false;
      let node;
      const finish = function (ok) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (kind === 'video') {
          node.removeAttribute('src');
          try { node.load(); } catch (e) { /* ignore */ }
        }
        resolve(ok);
      };
      if (kind === 'image') {
        node = new Image();
        node.onload = function () { finish(true); };
        node.onerror = function () { finish(false); };
      } else {
        node = document.createElement('video');
        node.preload = 'metadata';
        node.muted = true;
        node.addEventListener('loadedmetadata', function () { finish(true); });
        node.addEventListener('error', function () { finish(false); });
      }
      const timer = setTimeout(function () { finish(false); }, 10000);
      node.src = src;
    });
  }

  async function probe(src, kind) {
    if (canFetch) {
      const result = await probeWithFetch(src);
      if (result !== null) return result;
    }
    return probeWithElement(src, kind);
  }

  async function findFile(dir, n, exts, kind) {
    for (const ext of exts) {
      const src = dir + PREFIX + n + '.' + ext;
      if (await probe(src, kind)) return src;
    }
    return null;
  }

  async function discover(dir, exts, kind) {
    const found = [];
    let misses = 0;
    for (let start = 1; start <= MAX && misses < STOP_AFTER; start += BATCH) {
      const nums = [];
      for (let n = start; n < start + BATCH && n <= MAX; n++) nums.push(n);
      const results = await Promise.all(nums.map(function (n) { return findFile(dir, n, exts, kind); }));
      for (let k = 0; k < nums.length; k++) {
        if (results[k]) {
          found.push({ n: nums[k], src: results[k] });
          misses = 0;
        } else if (++misses >= STOP_AFTER) {
          break;
        }
      }
    }
    return found;
  }

  /* ==================================================================
     2. PAGE CONTENT
     ================================================================== */
  function captionFor(n) {
    const c = captions[n];
    return typeof c === 'string' && c.trim() ? c.trim() : 'Exhibit ' + n;
  }

  function coverPhoto() {
    const wanted = parseInt(cfg.coverPhoto, 10) || 1;
    return photos.find(function (p) { return p.n === wanted; }) || photos[0] || null;
  }

  function el(tag, className, text) { return M.el(tag, className, text); }

  function makeImg(src, alt, eager) {
    const img = document.createElement('img');
    img.alt = alt;
    img.decoding = 'async';
    img.draggable = false;
    if (eager) img.src = src;
    else img.dataset.src = src;
    return img;
  }

  function renderPage(page, side, pageNumber) {
    const face = el('div', 'face face--' + side);
    let inner;

    switch (page.type) {
      case 'cover': {
        face.classList.add('face--cover');
        inner = el('div', 'page page--cover');
        inner.appendChild(el('span', 'cover__sticker', 'Handle with treats'));
        const frame = el('div', 'cover__frame');
        frame.setAttribute('data-photo-frame', '');
        const photo = coverPhoto();
        if (photo) {
          const img = makeImg(photo.src, 'Mochi on the cover of her photo book', true);
          img.addEventListener('error', function () { frame.classList.add('is-missing'); });
          frame.appendChild(img);
        } else {
          frame.classList.add('is-missing');
        }
        inner.appendChild(frame);
        inner.appendChild(el('h2', 'cover__title', 'The Menace Diaries'));
        inner.appendChild(el('p', 'cover__sub', 'Photos of Mochi, mostly caught in the act'));
        inner.appendChild(el('span', 'cover__hint', 'Tap to open'));
        break;
      }

      case 'intro': {
        inner = el('div', 'page page--intro');
        inner.appendChild(el('p', 'intro__label', 'This book belongs to'));
        inner.appendChild(el('p', 'intro__name', 'Mochi'));
        inner.appendChild(el('p', 'intro__note',
          'Evidence collected by her mom, one photo at a time. Turn the page to see the record.'));
        inner.appendChild(M.paw('intro__stamp'));
        break;
      }

      case 'photo': {
        const p = page.photo;
        inner = el('div', 'page page--photo');
        const variants = ['', ' snap--b', ' snap--c'];
        const fig = el('figure', 'snap is-loading' + variants[page.index % 3]);
        fig.setAttribute('data-photo-frame', '');
        fig.appendChild(el('span', 'snap__tape'));
        const caption = captionFor(p.n);
        const img = makeImg(p.src, 'Mochi photo: ' + caption, false);
        img.addEventListener('load', function () { fig.classList.remove('is-loading'); });
        img.addEventListener('error', function () {
          fig.classList.remove('is-loading');
          fig.classList.add('is-missing');
        });
        fig.appendChild(img);
        fig.appendChild(el('figcaption', 'snap__caption', caption));
        inner.appendChild(fig);
        break;
      }

      case 'empty': {
        inner = el('div', 'page page--quiet');
        inner.appendChild(M.paw('paw'));
        inner.appendChild(el('p', 'page__title', 'No evidence yet'));
        inner.appendChild(el('p', null, 'Mochi is still choosing her best angles. Check back soon.'));
        break;
      }

      case 'filler': {
        inner = el('div', 'page page--quiet');
        inner.appendChild(M.paw('paw'));
        inner.appendChild(el('p', null, 'Room for the next incident.'));
        break;
      }

      case 'end': {
        inner = el('div', 'page page--quiet');
        inner.appendChild(el('p', 'page__title', 'To be continued'));
        inner.appendChild(el('p', null, 'Mochi commits new crimes daily.'));
        const insta = (M.socialItems() || []).find(function (s) { return s.id === 'instagram'; });
        if (insta) {
          const a = el('a', null, 'See the latest on Instagram');
          a.href = insta.href;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          inner.appendChild(a);
        }
        const again = el('button', 'btn btn--ghost', 'Back to the cover');
        again.type = 'button';
        again.addEventListener('click', function (e) {
          e.stopPropagation();
          goTo(0, false);
          bookEl.focus({ preventScroll: true });
        });
        inner.appendChild(again);
        break;
      }

      case 'back': {
        face.classList.add('face--cover');
        inner = el('div', 'page page--back');
        inner.appendChild(M.paw('paw'));
        inner.appendChild(el('p', null, site.siteName || 'Mochi the Menace'));
        break;
      }

      default: // plain paper (back of a page on phones)
        inner = el('div', 'page');
    }

    if (pageNumber && page.type !== 'cover' && page.type !== 'back') {
      inner.appendChild(el('span', 'page__num', String(pageNumber)));
    }
    face.appendChild(inner);
    return face;
  }

  function buildPages() {
    const list = [{ type: 'cover' }, { type: 'intro' }];
    if (!photos.length) list.push({ type: 'empty' });
    photos.forEach(function (p, i) { list.push({ type: 'photo', photo: p, index: i }); });
    if (single) {
      list.push({ type: 'end' });
    } else {
      // "To be continued" must land on a right-hand page
      if (list.length % 2 === 1) list.push({ type: 'filler' });
      list.push({ type: 'end' }, { type: 'back' });
    }
    return list;
  }

  /* ==================================================================
     3. BOOK
     ================================================================== */
  function build(keepPosition) {
    const oldSingle = bookEl.dataset.mode === 'single';
    const oldFlipped = flipped;

    pages = buildPages();
    bookEl.textContent = '';
    bookEl.dataset.mode = single ? 'single' : 'spread';
    turning.clear();

    bookEl.appendChild(el('div', 'book__base book__base--left'));
    bookEl.appendChild(el('div', 'book__base book__base--right'));

    leaves = [];
    if (single) {
      pages.forEach(function (page, i) {
        const leaf = el('div', 'leaf');
        leaf.appendChild(renderPage(page, 'front', i + 1));
        leaf.appendChild(renderPage({ type: 'paper' }, 'back'));
        leaves.push(leaf);
      });
    } else {
      for (let i = 0; i < pages.length; i += 2) {
        const leaf = el('div', 'leaf');
        leaf.appendChild(renderPage(pages[i], 'front', i + 1));
        leaf.appendChild(renderPage(pages[i + 1], 'back', i + 2));
        leaves.push(leaf);
      }
    }
    leaves.forEach(function (leaf) { bookEl.appendChild(leaf); });

    // Keep roughly the same place when the screen rotates / resizes.
    let target = 0;
    if (keepPosition) {
      if (oldSingle && !single) target = Math.ceil(oldFlipped / 2);
      else if (!oldSingle && single) target = Math.max(0, 2 * oldFlipped - 1);
      else target = oldFlipped;
    }
    flipped = -1; // force a render
    goTo(target, false);
  }

  function maxFlip() { return single ? leaves.length - 1 : leaves.length; }

  function restingZ(i) { return i < flipped ? i + 1 : leaves.length - i; }

  function render() {
    leaves.forEach(function (leaf, i) {
      const isFlipped = i < flipped;
      leaf.classList.toggle('is-flipped', isFlipped);
      if (!turning.has(leaf)) leaf.style.zIndex = String(restingZ(i));
      const visible = single ? i === flipped : i === flipped || i === flipped - 1;
      leaf.inert = !visible;
      leaf.setAttribute('aria-hidden', visible ? 'false' : 'true');
    });
    bookEl.classList.toggle('is-closed', flipped === 0);
    bookEl.classList.toggle('is-finished', !single && flipped === leaves.length);
    loadNearby();
    updateControls();
  }

  // Only load photos close to the open page, to save data.
  function loadNearby() {
    const from = Math.max(0, flipped - 2);
    const to = Math.min(leaves.length - 1, flipped + 3);
    for (let i = from; i <= to; i++) {
      leaves[i].querySelectorAll('img[data-src]').forEach(function (img) {
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
      });
    }
  }

  function updateControls() {
    prevBtn.disabled = flipped <= 0;
    nextBtn.disabled = flipped >= maxFlip();
    let text;
    if (flipped === 0) text = 'Cover';
    else if (!single && flipped === leaves.length) text = 'Back cover';
    else if (single) text = 'Page ' + (flipped + 1) + ' of ' + pages.length;
    else text = 'Pages ' + (2 * flipped) + '–' + (2 * flipped + 1) + ' of ' + pages.length;
    statusEl.textContent = text;
  }

  function goTo(target, animate) {
    target = Math.max(0, Math.min(maxFlip(), target));
    if (target === flipped) return;

    const step = Math.abs(target - flipped) === 1 && flipped !== -1;
    if (animate && step && !motionQuery.matches) {
      const forward = target > flipped;
      const idx = forward ? flipped : target;
      const leaf = leaves[idx];
      // keep the moving page above everything until it lands
      clearTimeout(turning.get(leaf));
      leaf.style.zIndex = String(500 + (forward ? idx : leaves.length - idx));
      turning.set(leaf, setTimeout(function () {
        turning.delete(leaf);
        leaf.style.zIndex = String(restingZ(idx));
      }, 850));
      flipped = target;
      render();
    } else {
      bookEl.classList.add('no-anim');
      turning.forEach(function (t) { clearTimeout(t); });
      turning.clear();
      flipped = target;
      render();
      void bookEl.offsetWidth; // apply instantly, then re-enable animation
      requestAnimationFrame(function () { bookEl.classList.remove('no-anim'); });
    }
  }

  function next() { goTo(flipped + 1, true); }
  function prev() { goTo(flipped - 1, true); }

  /* ---------- input: buttons, tap, swipe, keyboard ---------- */
  let swiped = false;

  function bindEvents() {
    prevBtn.addEventListener('click', prev);
    nextBtn.addEventListener('click', next);

    bookEl.addEventListener('click', function (e) {
      if (swiped) { swiped = false; return; }
      if (e.target.closest('a, button, video')) return;
      const leaf = e.target.closest('.leaf');
      if (!leaf) return;
      if (leaf.classList.contains('is-flipped')) prev();
      else next();
    });

    bookEl.addEventListener('keydown', function (e) {
      if (e.target !== bookEl) return;
      switch (e.key) {
        case 'ArrowRight': case 'PageDown': next(); break;
        case 'ArrowLeft': case 'PageUp': prev(); break;
        case 'Home': goTo(0, false); break;
        case 'End': goTo(maxFlip(), false); break;
        case 'Enter': case ' ': if (flipped === 0) next(); else return; break;
        default: return;
      }
      e.preventDefault();
    });

    let startX = 0, startY = 0, tracking = false;
    stageEl.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse') return;
      tracking = true; startX = e.clientX; startY = e.clientY;
    });
    stageEl.addEventListener('pointerup', function (e) {
      if (!tracking) return;
      tracking = false;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        swiped = true;
        setTimeout(function () { swiped = false; }, 400);
        if (dx < 0) next(); else prev();
      }
    });
    stageEl.addEventListener('pointercancel', function () { tracking = false; });

    const onModeChange = function () {
      single = singleQuery.matches;
      build(true);
    };
    if (singleQuery.addEventListener) singleQuery.addEventListener('change', onModeChange);
    else singleQuery.addListener(onModeChange); // older Safari
  }

  /* ==================================================================
     4. VIDEOS
     ================================================================== */
  function buildVideos(videos) {
    const section = document.getElementById('videos');
    const grid = document.getElementById('videoGrid');
    if (!section || !grid) return;
    if (!videos.length) { section.hidden = true; return; }

    const players = [];
    videos.forEach(function (v) {
      const fig = el('figure', 'video-card');
      const video = document.createElement('video');
      video.controls = true;
      video.preload = 'metadata';
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      video.setAttribute('controlslist', 'nodownload');
      video.src = v.src + '#t=0.1'; // shows the first frame as a preview on iPhone
      const cap = videoCaptions[v.n];
      const text = typeof cap === 'string' && cap.trim() ? cap.trim() : 'Caught on camera #' + v.n;
      video.setAttribute('aria-label', 'Video of Mochi: ' + text);
      video.addEventListener('play', function () {
        players.forEach(function (p) { if (p !== video) p.pause(); });
      });
      video.addEventListener('error', function () { fig.remove(); });
      players.push(video);
      fig.appendChild(video);
      fig.appendChild(el('figcaption', null, text));
      grid.appendChild(fig);
    });
    section.hidden = false;
  }

  /* ==================================================================
     START
     ================================================================== */
  async function start() {
    statusEl.textContent = 'Opening the book…';
    prevBtn.disabled = true;
    nextBtn.disabled = true;

    const [foundPhotos, foundVideos] = await Promise.all([
      discover(IMG_DIR, IMG_EXTS, 'image'),
      discover(VID_DIR, VID_EXTS, 'video')
    ]);

    photos = foundPhotos;
    if (!photos.length && window.console) {
      console.info('[Mochi] No photos found. Add assets/images/mochi1.JPG' + PREFIX + 'mochi2.JPG');
    }
    build(false);
    bindEvents();
    buildVideos(foundVideos);
  }

  start();
})();
