/* PTM — Section 5 "Client reviews"
   Reveal (scroll-driven, smoothed, in the site's vocabulary):
     label prints → the two title lines rise like the hero headline →
     arrows fade in → the visible cards rise out of a mask one after the
     other while their photos settle → the quotes print.
   Slider: 6 reviews, 2 per page on desktop (1 on mobile). Arrows, swipe and
   keyboard. On every page change the track glides with a long ease, the
   arriving photos settle from a slight zoom and their quotes print again. */
(() => {
  const s5 = document.querySelector('.s5');
  if (!s5) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const range = (v, a, b) => clamp((v - a) / (b - a));
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const seg = (p, a, b, ease = easeOut) => ease(range(p, a, b));

  function splitPrint(el) {
    const chars = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
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
    return chars;
  }
  function print(chars, t, soft) {
    const n = chars.length;
    const head = t * (n + soft);
    for (let i = 0; i < n; i++) {
      const o = clamp((head - i) / soft);
      if (chars[i]._o !== o) { chars[i].style.opacity = o; chars[i]._o = o; }
    }
  }
  const setT = (el, t) => {
    if (el._t === undefined || Math.abs(el._t - t) > 0.0005) { el.style.setProperty('--t', t.toFixed(4)); el._t = t; }
  };

  /* ---------- elements ---------- */
  const label = splitPrint(s5.querySelector('.s5__label [data-print]'));
  const lines = [...s5.querySelectorAll('.s5__line > span')];
  const nav = s5.querySelector('.s5__nav');
  const prev = s5.querySelector('.s5__arrow--prev');
  const next = s5.querySelector('.s5__arrow--next');
  const viewport = s5.querySelector('.s5__viewport');
  const track = s5.querySelector('.s5__track');
  const cards = [...s5.querySelectorAll('.review')].map((el) => ({
    el,
    text: splitPrint(el.querySelector('.review__text')),
    reprint: null, // {start} while a page-change print is running
  }));

  /* ---------- slider ---------- */
  const perView = () => (innerWidth < 1024 ? 1 : 2);
  let page = 0;
  const pages = () => Math.ceil(cards.length / perView());
  const visible = () => cards.slice(page * perView(), page * perView() + perView());

  function go(to) {
    to = clamp(to, 0, pages() - 1);
    if (to === page) return;
    page = to;
    track.style.setProperty('--page', page);
    prev.disabled = page === 0;
    next.disabled = page === pages() - 1;
    // arriving cards: photo settles from a slight zoom, the quote prints again
    const now = performance.now();
    visible().forEach((c, i) => {
      c.el.classList.add('is-entering');
      requestAnimationFrame(() => requestAnimationFrame(() => c.el.classList.remove('is-entering')));
      if (!reduced) { c.reprint = now + 380 + i * 160; print(c.text, 0, 8); }
    });
  }
  prev.addEventListener('click', () => go(page - 1));
  next.addEventListener('click', () => go(page + 1));
  s5.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') go(page + 1);
    if (e.key === 'ArrowLeft') go(page - 1);
  });
  addEventListener('resize', () => {
    page = clamp(page, 0, pages() - 1);
    track.style.setProperty('--page', page);
    prev.disabled = page === 0;
    next.disabled = page === pages() - 1;
  });

  // swipe / drag
  let dragX = null, dx = 0;
  viewport.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragX = e.clientX; dx = 0;
  });
  addEventListener('pointermove', (e) => {
    if (dragX === null) return;
    dx = e.clientX - dragX;
    if (Math.abs(dx) > 6) {
      track.classList.add('is-dragging');
      const resist = (page === 0 && dx > 0) || (page === pages() - 1 && dx < 0) ? 0.3 : 1;
      track.style.transform = `translate3d(calc(${page} * -1 * (100% + var(--gap)) + ${dx * resist}px), 0, 0)`;
    }
  });
  const endDrag = () => {
    if (dragX === null) return;
    track.classList.remove('is-dragging');
    track.style.transform = '';
    if (dx < -60) go(page + 1);
    else if (dx > 60) go(page - 1);
    dragX = null;
  };
  addEventListener('pointerup', endDrag);
  addEventListener('pointercancel', endDrag);

  /* ---------- reveal ---------- */
  if (reduced) {
    print(label, 1, 3);
    lines.forEach((l) => setT(l, 1));
    setT(nav, 1);
    cards.forEach((c) => { setT(c.el, 1); print(c.text, 1, 8); });
    return;
  }

  let vh = innerHeight;
  addEventListener('resize', () => { vh = innerHeight; });
  let p = 0, last = performance.now();

  function tick(now) {
    const dt = Math.min(64, now - last) / 1000;
    last = now;

    const top = s5.getBoundingClientRect().top;
    const target = range(vh - top, vh * 0.12, vh * 1.05);
    p += (target - p) * (1 - Math.exp(-dt * 4));
    if (Math.abs(target - p) < 0.0004) p = target;

    print(label, seg(p, 0.0, 0.3, (x) => x), 3);
    lines.forEach((l, i) => setT(l, seg(p, 0.08 + i * 0.08, 0.48 + i * 0.08)));
    setT(nav, seg(p, 0.4, 0.62));

    // cards: the ones on screen rise one after another; the rest just stay open
    const vis = visible();
    cards.forEach((c) => {
      const i = vis.indexOf(c);
      const order = i === -1 ? 0 : i;
      const t = seg(p, 0.36 + order * 0.12, 0.72 + order * 0.12, easeInOut);
      setT(c.el, i === -1 ? Math.max(t, c.el._t || 0) : t);

      if (c.reprint !== null) {
        const rt = clamp((now - c.reprint) / 900);
        print(c.text, rt, 8);
        if (rt >= 1) c.reprint = null;
      } else {
        print(c.text, seg(p, 0.55 + order * 0.12, 0.95 + order * 0.05, (x) => x), 8);
      }
    });

    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
