/* PTM — Preloader
   Black screen, no split (a nod to the "Glitch & Grit" reference):
   1. "P  T  M" — the monogram — grows letter by letter into
      PLANES  TRUCKS  MARITIME  (air, road, sea: any vehicle);
   2. the words drift apart to the edges of the screen and slip away;
   3. the counter at the top tracks the real loading of the hero film;
   4. the slogan prints in the centre, like the rest of the site;
   5. the black lifts and the hero's empty hangar fades up behind it. */
(() => {
  const root = document.documentElement;
  const pl = document.querySelector('.preloader');
  if (!pl) { root.classList.remove('is-loading'); return; }

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const count = pl.querySelector('.pl__count');
  const wordsBox = pl.querySelector('.pl__words');
  const words = [...pl.querySelectorAll('.pl__w')];
  const slogan = pl.querySelector('.pl__slogan');

  const NEED = 0.5;        // share of hero frames needed before entering (rest streams in)
  const MAX_WAIT = 9000;   // never hold the visitor longer than this
  const t0 = performance.now();

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeIn = (t) => t * t * t;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const tween = (ms, fn, ease = easeInOut) => new Promise((res) => {
    const s = performance.now();
    const step = (now) => {
      const t = clamp((now - s) / ms);
      fn(ease(t), t);
      t < 1 ? requestAnimationFrame(step) : res();
    };
    requestAnimationFrame(step);
  });

  /* ---------- real loading progress ---------- */
  let fontsReady = false;
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { fontsReady = true; });
  const target = () => {
    if (performance.now() - t0 > MAX_WAIT) return 1;
    const frames = clamp((window.__ptmProgress || 0) / NEED);
    return clamp(frames * 0.9 + (fontsReady ? 0.1 : 0));
  };
  // smoothed display value, drives the counter
  let shown = 0;
  let countOn = true;
  (function loop() {
    shown += (target() - shown) * 0.08;
    if (target() >= 1 && shown > 0.995) shown = 1;
    const v = String(Math.round(shown * 100)).padStart(3, '0');
    if (count.textContent !== v) count.textContent = v;
    if (countOn) requestAnimationFrame(loop);
  })();
  const loaded = () => new Promise((res) => {
    const check = () => (shown >= 1 ? res() : requestAnimationFrame(check));
    check();
  });

  /* ---------- build the words ---------- */
  words.forEach((w) => {
    const word = w.dataset.word.toUpperCase();
    w.textContent = '';
    [...word].forEach((c, i) => {
      const s = document.createElement('span');
      s.textContent = c;
      if (i > 0) s.className = 'x';
      w.appendChild(s);
    });
  });

  /* ---------- slogan chars ---------- */
  const sChars = [...slogan.textContent].map((c) => {
    const s = document.createElement('span');
    s.className = 'ch';
    s.textContent = c;
    return s;
  });
  slogan.textContent = '';
  sChars.forEach((s) => slogan.appendChild(s));
  const print = (t, soft = 6) => {
    const n = sChars.length, head = t * (n + soft);
    sChars.forEach((s, i) => { s.style.opacity = clamp((head - i) / soft); });
  };

  /* ---------- hand-over to the site ---------- */
  async function enter() {
    root.classList.remove('is-loading');
    root.classList.add('is-entered');
    dispatchEvent(new CustomEvent('ptm:enter'));
    pl.classList.add('is-done');
    await tween(1100, (e) => {
      pl.style.opacity = String(1 - e);
    }, easeInOut);
    countOn = false;
    pl.remove();
  }

  /* ---------- timeline ---------- */
  async function run() {
    if (reduced) { await loaded(); return enter(); }

    wordsBox.style.opacity = '0';
    count.style.opacity = '0';
    await wait(250);
    await tween(500, (e) => { wordsBox.style.opacity = e; count.style.opacity = e; }, easeOut);
    await wait(350);

    // 1. P T M → PLANES TRUCKS MARITIME, one letter per beat in every word
    const hidden = words.map((w) => [...w.querySelectorAll('.x')]);
    const steps = Math.max(...hidden.map((h) => h.length));
    for (let i = 0; i < steps; i++) {
      hidden.forEach((h) => h[i] && h[i].classList.add('on'));
      await wait(95);
    }
    await wait(380);

    // 2. drift apart to the edges
    const pad = parseFloat(getComputedStyle(pl).getPropertyValue('--pad')) || 20;
    const [a, b, c] = words.map((w) => w.getBoundingClientRect());
    const dxL = pad - a.left;
    const dxR = innerWidth - pad - c.right;
    await tween(1000, (e) => {
      words[0].style.transform = `translateX(${dxL * e}px)`;
      words[2].style.transform = `translateX(${dxR * e}px)`;
    });
    await wait(200);

    // 3. the words slip away (and we make sure the hero is ready)
    const exit = tween(650, (e) => {
      words[0].style.transform = `translateX(${dxL - (a.right + 40) * e}px)`;
      words[2].style.transform = `translateX(${dxR + (innerWidth - c.left + 40) * e}px)`;
      words[1].style.opacity = String(Math.max(0, 1 - e * 2.5));
      words[1].style.letterSpacing = `${0.6 * e}em`;
    }, easeIn);
    await exit;
    wordsBox.style.opacity = '0';
    await loaded();
    await wait(250);

    // 4. the slogan prints
    await tween(1050, (e, t) => print(t), (x) => x);
    await wait(650);

    // 5. lift the black
    tween(700, (e) => {
      slogan.style.opacity = String(1 - e);
      slogan.style.transform = `translateY(calc(-50% - ${18 * e}px))`;
      count.style.opacity = String(1 - e);
    }, easeIn);
    await wait(260);
    await enter();
  }

  run();
})();
