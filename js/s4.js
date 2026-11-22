/* PTM — Section 4 "Innovation / Synergy"
   Scroll-driven and smoothed, in the site's vocabulary:
   - each card opens like a window (clip from the centre) while its photo
     settles from a slight zoom — left card first, right card a beat later;
   - three dots pop in, the tags print (like the hero tags), the title rises
     out of its mask (like the hero headline), the description prints,
     the corner square spins in;
   - the photos drift with a gentle parallax; on hover they zoom softly. */
(() => {
  const s4 = document.querySelector('.s4');
  if (!s4) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const range = (v, a, b) => clamp((v - a) / (b - a));
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const seg = (p, a, b, ease = easeOut) => ease(range(p, a, b));

  function splitPrint(el) {
    const chars = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const frag = document.createDocumentFragment();
      for (const c of node.nodeValue) {
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
  const setT = (el, t, prop = '--t') => {
    const key = '_' + prop;
    if (el[key] === undefined || Math.abs(el[key] - t) > 0.0005) { el.style.setProperty(prop, t.toFixed(4)); el[key] = t; }
  };

  const cards = [...s4.querySelectorAll('.pillar')].map((el, i) => ({
    el,
    delay: i * 0.12,               // the right card follows a beat later
    dots: [...el.querySelectorAll('.pillar__dots i')],
    tags: splitPrint(el.querySelector('.pillar__tags [data-print]')),
    title: el.querySelector('.pillar__title > span'),
    text: splitPrint(el.querySelector('.pillar__text')),
    square: el.querySelector('.pillar__square'),
    p: 0,
    py: null,
  }));

  function render(c, p) {
    setT(c.el, seg(p, 0.0, 0.42, easeInOut));
    c.dots.forEach((d, i) => setT(d, seg(p, 0.3 + i * 0.04, 0.42 + i * 0.04, easeOutQuart)));
    print(c.tags, seg(p, 0.32, 0.6, (x) => x), 3);
    setT(c.title, seg(p, 0.38, 0.72));
    print(c.text, seg(p, 0.5, 0.92, (x) => x), 8);
    setT(c.square, seg(p, 0.75, 1.0, easeInOut));
    c.el.classList.toggle('is-open', p > 0.45);
  }

  if (reduced) { cards.forEach((c) => render(c, 1)); return; }

  let vh = innerHeight;
  addEventListener('resize', () => { vh = innerHeight; });
  let last = performance.now();

  function tick(now) {
    const dt = Math.min(64, now - last) / 1000;
    last = now;
    const k = 1 - Math.exp(-dt * 4);

    for (const c of cards) {
      const r = c.el.getBoundingClientRect();
      // opens as the card rises from the bottom edge to ~15% from the top
      const raw = range(vh - r.top, vh * 0.05, vh * 0.8);
      const delay = innerWidth < 1024 ? 0 : c.delay; // stacked on mobile: no stagger needed
      const target = clamp((raw - delay) / (1 - delay));
      c.p += (target - c.p) * k;
      if (Math.abs(target - c.p) < 0.0004) c.p = target;
      render(c, c.p);

      // parallax: image drifts against the scroll (≈ ±5% of card height)
      const center = r.top + r.height / 2 - vh / 2;
      const py = clamp(-center * 0.08, -r.height * 0.05, r.height * 0.05);
      if (c.py === null || Math.abs(py - c.py) > 0.2) { c.el.style.setProperty('--py', py.toFixed(1) + 'px'); c.py = py; }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
