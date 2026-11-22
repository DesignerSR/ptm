/* PTM — Hero
   Scroll-scrubbed image sequence (extracted from BG.mp4) drawn to canvas,
   with inertial smoothing, frame cross-blending and scroll-linked UI reveal. */
(() => {
  const hero = document.getElementById('hero');
  const pin = hero.querySelector('.hero__pin');
  const canvas = hero.querySelector('.hero__canvas');
  const grade = hero.querySelector('.hero__grade');
  const cue = hero.querySelector('.cue');
  const loaderBar = hero.querySelector('.loader__bar');
  const ctx = canvas.getContext('2d', { alpha: false });

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

  // Always open on the empty hangar — never restore a mid-animation scroll.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  // `load` fires late (after the frame sequence), so only snap back to the
  // top if the visitor hasn't started scrolling by then.
  let touched = false;
  for (const ev of ['wheel', 'touchstart', 'keydown', 'pointerdown']) {
    addEventListener(ev, () => { touched = true; }, { once: true, passive: true });
  }
  const toTop = () => { if (!location.hash && !touched) scrollTo(0, 0); };
  toTop();
  addEventListener('load', toTop);
  addEventListener('pageshow', (e) => { if (e.persisted) toTop(); });

  const FRAMES = 120;
  const FILM_END = 0.8;   // share of the scroll used by the drive-in
  // The film is fast at the start (truck rushes in) and slow at the end.
  // Warping scroll → time spreads the rush over more scroll so the truck
  // moves at an even, heavy pace under the wheel.
  const FILM_WARP = 1.45;
  const mobileSet = () => innerWidth < 768;

  // Mobile frames are a pre-cropped portrait window of the film (x 15%–65%).
  let set = mobileSet() ? 'm' : 'd';
  const framing = { d: { x: 0.5, y: 0.5 }, m: { x: 0.6, y: 0.5 } };

  /* ---------- helpers ---------- */
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const range = (v, a, b) => clamp((v - a) / (b - a));
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const smooth = (t) => t * t * (3 - 2 * t);

  /* ---------- frames ---------- */
  let images = [];
  let loaded = 0;

  function src(i) {
    return `assets/frames/${set}_${String(i).padStart(3, '0')}.webp`;
  }

  function loadSet() {
    const list = new Array(FRAMES);
    images = list;
    loaded = 0;
    const token = set;

    const load = (i) => new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = async () => {
        try { await img.decode(); } catch (e) { /* drawn anyway */ }
        if (token !== set) return resolve();
        list[i] = img;
        loaded++;
        loaderBar.style.setProperty('--p', loaded / FRAMES);
        window.__ptmProgress = loaded / FRAMES; // read by the preloader
        dispatchEvent(new CustomEvent('ptm:progress', { detail: loaded / FRAMES }));
        if (loaded === FRAMES) document.documentElement.classList.add('is-loaded');
        needsDraw = true;
        resolve();
      };
      img.onerror = resolve;
      img.src = src(i);
    });

    // First frame immediately, then a coarse pass (every 8th) so scrubbing
    // works early, then fill the gaps.
    load(0).then(() => {
      document.documentElement.classList.add('is-ready');
      introStart = performance.now();
      // no preloader on the page → enter straight away
      if (!document.querySelector('.preloader')) document.documentElement.classList.add('is-entered');
      const order = [];
      for (let s = 8; s >= 1; s = s >> 1) {
        for (let i = 0; i < FRAMES; i += s) if (!order.includes(i) && i !== 0) order.push(i);
      }
      let cursor = 0;
      const worker = async () => {
        while (cursor < order.length && token === set) await load(order[cursor++]);
      };
      for (let k = 0; k < 6; k++) worker();
    });
  }

  function nearest(i) {
    if (images[i]) return images[i];
    for (let d = 1; d < FRAMES; d++) {
      if (images[i - d]) return images[i - d];
      if (images[i + d]) return images[i + d];
    }
    return null;
  }

  /* ---------- canvas ---------- */
  let cw = 0, ch = 0, dpr = 1;
  let needsDraw = true;

  function resize() {
    const next = mobileSet() ? 'm' : 'd';
    if (next !== set) { set = next; loadSet(); }
    dpr = Math.min(devicePixelRatio || 1, 2);
    const r = pin.getBoundingClientRect();
    cw = Math.round(r.width * dpr);
    ch = Math.round(r.height * dpr);
    canvas.width = cw;
    canvas.height = ch;
    needsDraw = true;
    measure();
  }

  function drawCover(img, alpha) {
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const s = Math.max(cw / iw, ch / ih);
    const w = iw * s, h = ih * s;
    const f = framing[set];
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, (cw - w) * f.x, (ch - h) * f.y, w, h);
  }

  let lastFrame = -1;
  function draw(frame) {
    if (!needsDraw && Math.abs(frame - lastFrame) < 0.002) return;
    // Blend between the closest loaded frames on either side. With the full
    // set that is i / i+1 (sub-frame smoothness); while frames are still
    // streaming in it bridges the gaps instead of snapping.
    let lo = Math.floor(frame), hi = Math.ceil(frame);
    while (lo > 0 && !images[lo]) lo--;
    while (hi < FRAMES - 1 && !images[hi]) hi++;
    const A = images[lo] || nearest(lo);
    if (!A) return;
    drawCover(A, 1);
    const B = images[hi];
    const a = hi > lo ? (frame - lo) / (hi - lo) : 0;
    if (B && B !== A && a > 0.01) drawCover(B, a);
    ctx.globalAlpha = 1;
    lastFrame = frame;
    needsDraw = false;
  }

  /* ---------- scroll ---------- */
  let heroTop = 0, travel = 1;
  function measure() {
    const rect = hero.getBoundingClientRect();
    heroTop = rect.top + scrollY;
    // the last screen of the hero belongs to section 2 sliding over it
    travel = Math.max(1, hero.offsetHeight - 2 * pin.offsetHeight);
  }
  const rawProgress = () => clamp((scrollY - heroTop) / travel);

  /* ---------- reveal targets ---------- */
  const reveals = [...hero.querySelectorAll('.rv')].map((el) => {
    const [a, b] = el.dataset.r.split(',').map(Number);
    return { el, a, b, v: -1 };
  });

  /* ---------- typewriter targets ---------- */
  const SOFT = 3; // how many glyphs are mid-fade at once — keeps the print soft
  const typers = [...hero.querySelectorAll('[data-type]')].map((el) => {
    const [a, b] = el.dataset.type.split(',').map(Number);
    const chars = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) if (walker.currentNode.nodeValue.trim()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const frag = document.createDocumentFragment();
      for (const c of node.nodeValue.replace(/\s+/g, ' ')) {
        const s = document.createElement('span');
        s.className = 'ch';
        s.textContent = c;
        frag.appendChild(s);
        chars.push(s);
      }
      node.replaceWith(frag);
    }
    el.setAttribute('aria-label', el.textContent);
    return { el, a, b, chars, v: -1 };
  });

  function type(r, t) {
    const n = r.chars.length;
    const head = t * (n + SOFT); // fractional index of the printing head
    for (let i = 0; i < n; i++) {
      const o = clamp((head - i) / SOFT);
      const s = r.chars[i];
      if (s._o !== o) { s.style.opacity = o; s._o = o; }
    }
  }

  /* ---------- pointer parallax ---------- */
  let mx = 0, my = 0, tx = 0, ty = 0;
  if (finePointer) {
    addEventListener('pointermove', (e) => {
      tx = (e.clientX / innerWidth) * 2 - 1;
      ty = (e.clientY / innerHeight) * 2 - 1;
    }, { passive: true });
  }

  /* ---------- inertial page scroll ----------
     Mouse wheels move in 100px notches, which makes any scrubbed animation
     start-stop. On fine pointers the wheel drives a target instead, and the
     page glides to it every frame. Touch, keyboard and scrollbar stay native. */
  const smoothWheel = finePointer && !reduced;
  let sTarget = 0, sCurrent = 0, sActive = false;

  if (smoothWheel) {
    addEventListener('wheel', (e) => {
      if (document.documentElement.classList.contains('is-loading')) { e.preventDefault(); return; }
      if (e.ctrlKey || e.defaultPrevented) return; // pinch-zoom etc.
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      let d = e.deltaY;
      if (e.deltaMode === 1) d *= 16;
      else if (e.deltaMode === 2) d *= innerHeight;
      if (!sActive) sTarget = sCurrent = scrollY;
      // window.__ptmScrollMax: a temporary stop set by s2.js (phone card gate)
      const max = Math.min(document.documentElement.scrollHeight - innerHeight, window.__ptmScrollMax ?? Infinity);
      sTarget = clamp(sTarget + d, 0, max);
      sActive = true;
    }, { passive: false });

    // Any scroll we didn't cause (keys, scrollbar, find-in-page) takes over
    addEventListener('scroll', () => {
      if (sActive && Math.abs(scrollY - Math.round(sCurrent)) > 2) sActive = false;
      if (!sActive) sTarget = sCurrent = scrollY;
    }, { passive: true });
  }

  function smoothScrollStep(dt) {
    if (!sActive) return;
    if (window.__ptmScrollMax !== undefined) sTarget = Math.min(sTarget, window.__ptmScrollMax);
    sCurrent += (sTarget - sCurrent) * (1 - Math.exp(-dt * 6));
    if (Math.abs(sTarget - sCurrent) < 0.4) { sCurrent = sTarget; sActive = false; }
    scrollTo(0, sCurrent);
  }

  /* ---------- loop ---------- */
  let p = reduced ? 1 : 0;
  let introStart = performance.now();
  // the preloader hands over: replay the camera push-in as the site appears
  addEventListener('ptm:enter', () => { introStart = performance.now(); });
  let last = performance.now();
  let lastGrade = -1, lastCue = -1, lastCam = '';

  function tick(now) {
    const dt = Math.min(64, now - last) / 1000;
    last = now;

    smoothScrollStep(dt);

    // Inertial smoothing — gives the scrub a sense of weight
    const target = reduced ? 1 : rawProgress();
    const k = 1 - Math.exp(-dt * 7);
    p += (target - p) * k;
    if (Math.abs(target - p) < 0.00005) p = target;

    // Film
    const film = range(p, 0, FILM_END);
    draw(Math.pow(film, FILM_WARP) * (FRAMES - 1));

    // Camera: slow dolly-out as the truck arrives + intro push + parallax
    const intro = reduced ? 1 : easeOut(clamp((now - introStart) / 2600));
    mx += (tx - mx) * (1 - Math.exp(-dt * 3));
    my += (ty - my) * (1 - Math.exp(-dt * 3));
    const scale = 1.02 + 0.07 * (1 - easeInOut(film)) + 0.06 * (1 - intro);
    const cam = `translate3d(${(-mx * 9).toFixed(2)}px, ${(-my * 6).toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
    if (cam !== lastCam) { canvas.style.transform = cam; lastCam = cam; }

    // Lights down: the hangar dims into the design's grade as the UI arrives
    const g = smooth(range(p, 0.22, 0.78));
    if (Math.abs(g - lastGrade) > 0.0005) {
      grade.style.setProperty('--g', g.toFixed(4));
      canvas.style.filter = `brightness(${(1 - 0.03 * g).toFixed(3)}) contrast(${(1 + 0.06 * g).toFixed(3)}) saturate(${(1 - 0.12 * g).toFixed(3)})`;
      lastGrade = g;
    }

    // UI
    for (const r of reveals) {
      const t = reduced ? 1 : easeOut(range(p, r.a, r.b));
      if (Math.abs(t - r.v) > 0.0005) {
        r.el.style.setProperty('--t', t.toFixed(4));
        r.v = t;
      }
    }

    for (const r of typers) {
      const t = reduced ? 1 : range(p, r.a, r.b);
      if (Math.abs(t - r.v) > 0.0005) { type(r, t); r.v = t; }
    }

    // gone the moment scrolling starts (first ~40px), back at the very top
    const c = Math.min(1 - range(p, 0.005, 0.06), 1 - range(scrollY, 0, 40));
    if (Math.abs(c - lastCue) > 0.001) { cue.style.setProperty('--o', c.toFixed(3)); lastCue = c; }

    requestAnimationFrame(tick);
  }

  /* ---------- init ---------- */
  addEventListener('resize', resize);
  addEventListener('load', measure);
  if (document.fonts) document.fonts.ready.then(measure);
  resize();
  loadSet();
  requestAnimationFrame(tick);
})();
