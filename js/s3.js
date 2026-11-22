/* PTM — Section 3 "Services"
   The dark sheet slides up over the bridge film and pins full-screen. From
   there the page scroll drives a slow, smoothed timeline:
     head  — "WHAT WE DO" prints like the hero tags, "Services." rises like
             the hero headline, the square spins in (as the sheet arrives);
     rows  — one at a time: the camera glides to the service, its number,
             title, photo and description appear, then the sub-service chips
             one by one, then the divider draws slowly left → right.
             Only when that line is complete does the next service begin. */
(() => {
  const s3 = document.querySelector('.s3');
  if (!s3) return;
  const inner = s3.querySelector('.s3__inner');
  const track = s3.querySelector('.s3__track');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // scroll budget per service, in viewport heights (≈ 6–7 wheel notches)
  const PER_ROW = 0.75;
  const LEAD_IN = 0.15; // a breath after the sheet settles, before row 1

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const range = (v, a, b) => clamp((v - a) / (b - a));
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

  /* ---------- text helpers ---------- */
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
  const seg = (p, a, b, ease = easeOut) => ease(range(p, a, b));

  /* ---------- head ---------- */
  const headEl = s3.querySelector('.s3__head');
  const labelChars = splitPrint(s3.querySelector('.s3__label [data-print]'));
  const word = s3.querySelector('.s3__word > span');
  const square = s3.querySelector('.s3__square');

  function renderHead(p) {
    print(labelChars, seg(p, 0.0, 0.55, (x) => x), 3); // same soft print as the hero tags
    setT(word, seg(p, 0.15, 0.85));                    // same curve as the hero headline
    setT(square, seg(p, 0.5, 1.0, easeInOut));
  }

  /* ---------- rows ---------- */
  const rows = [...s3.querySelectorAll('.svc__row')].map((el) => ({
    el,
    rule: el.querySelector('.svc__rule'),
    num: el.querySelector('.svc__num > span'),
    name: el.querySelector('.svc__name > span'),
    text: splitPrint(el.querySelector('.svc__text')),
    sub: el.querySelector('.svc__sublabel'),
    chips: [...el.querySelectorAll('.chip')],
    media: el.querySelector('.svc__media'),
    stop: 0,
  }));

  function renderRow(r, p) {
    // 1. the service
    setT(r.num, seg(p, 0.06, 0.24));
    setT(r.name, seg(p, 0.08, 0.28, easeOutQuart));
    setT(r.media, seg(p, 0.08, 0.36, easeInOut));
    print(r.text, seg(p, 0.14, 0.42, (x) => x), 8);
    // 2. its sub-services, one by one
    setT(r.sub, seg(p, 0.38, 0.48));
    r.chips.forEach((c, i) => setT(c, seg(p, 0.42 + i * 0.07, 0.54 + i * 0.07, easeOutQuart)));
    // 3. the divider draws slowly, left → right
    setT(r.rule, seg(p, 0.64, 1.0, easeInOutSine));
    r.media.classList.toggle('is-shown', p > 0.36);
  }

  /* ---------- layout ---------- */
  let vh = innerHeight, H = 0, maxShift = 0, budget = 1;
  function layout() {
    vh = innerHeight;
    H = track.offsetHeight;
    maxShift = Math.max(0, H - vh);
    budget = (LEAD_IN + rows.length * PER_ROW) * vh;
    s3.style.height = `${vh + budget}px`;
    // camera stop for each row: centre it in the screen (within bounds)
    rows.forEach((r) => {
      const c = r.el.offsetTop + r.el.offsetHeight / 2 - vh * 0.5;
      r.stop = clamp(c, 0, maxShift);
    });
  }

  if (reduced) {
    s3.classList.add('is-static');
    inner.style.setProperty('--r', 0);
    renderHead(1);
    rows.forEach((r) => renderRow(r, 1));
    return;
  }

  /* ---------- loop ---------- */
  let g = 0, headP = 0, last = performance.now(), lastR = -1, lastY = '';

  function tick(now) {
    const dt = Math.min(64, now - last) / 1000;
    last = now;

    const top = s3.getBoundingClientRect().top;

    // Sheet slide-over: rounded top flattens as it reaches the top
    const r = 1 - easeInOut(range(vh - top, 0, vh));
    if (Math.abs(r - lastR) > 0.0005) { inner.style.setProperty('--r', r.toFixed(4)); lastR = r; }

    // Head plays while the sheet rises into place
    const headTarget = range(vh - top, vh * 0.25, vh * 1.05);
    headP += (headTarget - headP) * (1 - Math.exp(-dt * 4));
    renderHead(headP);

    // Pinned timeline (smoothed for a gliding, weighty feel)
    const target = range(-top, 0, budget);
    g += (target - g) * (1 - Math.exp(-dt * 3.2));
    if (Math.abs(target - g) < 0.00005) g = target;

    const t = g * (LEAD_IN + rows.length * PER_ROW); // in "row units" incl. lead-in
    let cam = 0;
    rows.forEach((row, i) => {
      const start = LEAD_IN + i * PER_ROW;
      const p = range(t, start, start + PER_ROW);
      renderRow(row, p);
      // camera eases from the previous stop to this row during its first third
      const prev = i === 0 ? 0 : rows[i - 1].stop;
      if (t >= start) cam = prev + (row.stop - prev) * easeInOut(range(p, 0, 0.3));
    });
    const y = `translate3d(0, ${(-cam).toFixed(2)}px, 0)`;
    if (y !== lastY) { track.style.transform = y; lastY = y; }

    requestAnimationFrame(tick);
  }

  addEventListener('resize', layout);
  addEventListener('load', layout);
  if (document.fonts) document.fonts.ready.then(layout);
  layout();
  requestAnimationFrame(tick);
})();
