/* PTM — Section 6 "FAQ"
   Cards show only the question. Hover (focus on keyboard, tap on touch)
   opens the answer: a soft light rises from the bottom, the short rule draws
   left → right and the answer prints in, the way text appears across the
   site. Leaving rewinds it quickly. Card proportions never change.
   Reveal on scroll: title rises like the hero headline, the rule draws, the
   cards rise one after another. */
(() => {
  const s6 = document.querySelector('.s6');
  if (!s6) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;

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
  const setV = (el, name, v) => {
    const k = '_' + name;
    if (el[k] === undefined || Math.abs(el[k] - v) > 0.0005) { el.style.setProperty(name, v.toFixed(4)); el[k] = v; }
  };

  const title = s6.querySelector('.s6__title > span');
  const rule = s6.querySelector('.s6__rule');
  const helpful = s6.querySelector('.helpful');
  const cards = [...s6.querySelectorAll('.qa')].map((el, i) => ({
    el, i,
    answer: splitPrint(el.querySelector('.qa__a')),
    open: 0,       // 0..1 animated
    want: 0,       // target
  }));

  /* ---------- open / close ----------
     Phones and touch screens show every answer: it prints in right after
     its card has appeared (no tapping). With a mouse, hover/focus opens. */
  const phone = () => innerWidth < 768;
  const autoOpen = () => !canHover || phone();
  const setWant = (c, v) => { if (c.want !== v) { c.want = v; c.el.classList.toggle('is-open', v === 1); } };
  cards.forEach((c) => {
    if (canHover) {
      c.el.addEventListener('mouseenter', () => { if (!autoOpen()) setWant(c, 1); });
      c.el.addEventListener('mouseleave', () => { if (!autoOpen() && document.activeElement !== c.el) setWant(c, 0); });
    }
    c.el.addEventListener('focus', () => { if (!autoOpen()) setWant(c, 1); });
    c.el.addEventListener('blur', () => { if (!autoOpen()) setWant(c, 0); });
  });

  /* ---------- "Was this helpful?" ---------- */
  const thanks = helpful.querySelector('.helpful__thanks');
  helpful.querySelectorAll('.helpful__btn').forEach((b) => b.addEventListener('click', () => {
    helpful.querySelectorAll('.helpful__btn').forEach((o) => o.classList.toggle('is-picked', o === b));
    thanks.textContent = b.dataset.vote === 'up' ? 'Thank you!' : 'Thanks, noted';
  }));

  if (reduced) {
    setV(title, '--t', 1); setV(rule, '--t', 1); setV(helpful, '--t', 1);
    cards.forEach((c) => setV(c.el, '--t', 1));
  }

  /* ---------- loop ---------- */
  let vh = innerHeight;
  addEventListener('resize', () => { vh = innerHeight; });
  let p = reduced ? 1 : 0, last = performance.now();
  const STEP = 0.55, DUR = 0.8;   // phones: gap between card starts, rise time (s)
  let queueAt = 0, wasAuto = false;

  function tick(now) {
    const dt = Math.min(64, now - last) / 1000;
    last = now;

    if (!reduced) {
      const top = s6.getBoundingClientRect().top;
      const target = range(vh - top, vh * 0.1, vh * 1.1);
      p += (target - p) * (1 - Math.exp(-dt * 4));
      if (Math.abs(target - p) < 0.0004) p = target;
      setV(title, '--t', seg(p, 0.0, 0.4));
      setV(rule, '--t', seg(p, 0.1, 0.55, easeInOut));
      setV(helpful, '--t', seg(p, 0.25, 0.5));
      // Phones: each card rises once it is on screen, strictly one after
      // another with a short pause, even after a fast flick.
      if (phone()) {
        cards.forEach((c) => {
          const cardTop = top + c.el.offsetTop;
          if (cardTop > vh) { c.trig = null; c.p = 0; }              // below the screen: reset
          else if (c.trig == null && cardTop < vh * 0.88) {
            c.trig = Math.max(now, queueAt);
            queueAt = c.trig + STEP * 1000;
          }
          c.p = c.trig == null ? 0 : easeInOut(clamp((now - c.trig) / (DUR * 1000)));
          setV(c.el, '--t', c.p);
        });
      } else {
      // Cards reveal row by row as each row scrolls into view; within a row
      // they follow one another left → right.
      const cols = innerWidth < 640 ? 1 : innerWidth < 1024 ? 2 : 3;
      const k = 1 - Math.exp(-dt * 4);
      cards.forEach((c) => {
        const col = c.i % cols;
        // layout position (offsetTop ignores the reveal transform)
        const rowTop = top + cards[c.i - col].el.offsetTop;
        // row progress: from entering the screen bottom to ~40% up
        const rp = range(vh * 0.98 - rowTop, 0, vh * 0.55);
        const target = seg(rp, col * 0.22, col * 0.22 + 0.56, easeInOut);
        c.p = (c.p || 0) + (target - (c.p || 0)) * k;
        if (Math.abs(target - c.p) < 0.0004) c.p = target;
        setV(c.el, '--t', c.p);
      });
      }
    }

    // phones / touch: the answer opens as soon as its card is half up
    const auto = autoOpen();
    if (auto) cards.forEach((c) => setWant(c, reduced || (c.p || 0) > 0.5 ? 1 : 0));
    else if (wasAuto) cards.forEach((c) => setWant(c, 0));   // window widened past phone size
    wasAuto = auto;

    // hover state: open slowly (print), close quickly (rewind)
    cards.forEach((c) => {
      if (c.open === c.want) return;
      const speed = c.want > c.open ? 1 / 0.85 : 1 / 0.35;
      c.open = clamp(c.open + Math.sign(c.want - c.open) * dt * speed);
      const e = easeInOut(c.open);
      setV(c.el, '--o', e);
      print(c.answer, reduced ? c.open : clamp((c.open - 0.15) / 0.85), 6);
    });

    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
