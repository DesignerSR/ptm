/* PTM — Section 7 "Ready to Ship?" + footer
   Screen 1 (form) pins; screen 2 (footer) slides up over it while the form
   softly blurs out — the same hand-over used between hero and section 2.

   Form hints: every field shows a faint example that prints in, holds, then
   rewinds and the next example prints (Bergen → Tokyo, then London → Vienna,
   and so on). Clicking into a field hides its hint so you can type freely;
   it comes back only if you leave the field empty.
   Delivery priority is a custom dropdown with eight delivery types. */
(() => {
  const s7 = document.querySelector('.s7');
  if (!s7) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const range = (v, a, b) => clamp((v - a) / (b - a));
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const seg = (p, a, b, ease = easeOut) => ease(range(p, a, b));
  const setV = (el, name, v) => {
    const k = '_' + name;
    if (el[k] === undefined || Math.abs(el[k] - v) > 0.0005) { el.style.setProperty(name, v.toFixed(4)); el[k] = v; }
  };

  const contact = s7.querySelector('.s7__contact');
  const foot = s7.querySelector('.foot');
  const form = s7.querySelector('.form');

  /* =====================================================================
     Rotating hints
     ===================================================================== */
  const SETS = [
    { company: 'Nordic Salmon AS', email: 'j.bakke@nordicsalmon.no', from: 'Bergen, Norway', to: 'Tokyo, Japan', priority: 'Fast & Urgent' },
    { company: 'Fjordbygg AS', email: 'i.haugen@fjordbygg.no', from: 'London, UK', to: 'Vienna, Austria', priority: 'Heavy & Oversized' },
    { company: 'Arcticom Retail', email: 'd.mensah@arcticom.com', from: 'Berlin, Germany', to: 'Oslo, Norway', priority: 'Same-Day Express' },
    { company: 'Polar Pharma', email: 'k.holt@polarpharma.no', from: 'Rotterdam, NL', to: 'Tromsø, Norway', priority: 'Temperature-Controlled' },
    { company: 'Lumen Foods AB', email: 's.berg@lumenfoods.se', from: 'Gothenburg, Sweden', to: 'Singapore', priority: 'Economy' },
    { company: 'Nordkapp Energy', email: 'm.lie@nordkapp.no', from: 'Houston, USA', to: 'Hammerfest, Norway', priority: 'Scheduled / Time-Definite' },
  ];
  const KEYS = ['company', 'email', 'from', 'to', 'priority'];
  const hints = KEYS.map((key, i) => {
    const field = s7.querySelector(`.field--${key}`);
    return { key, field, el: field.querySelector('.field__hint'), chars: [], delay: i * 0.14 };
  });

  function setHintText(h, text) {
    h.el.textContent = '';
    h.chars = [...text].map((c) => {
      const s = document.createElement('span');
      s.textContent = c;
      s.style.opacity = '0';
      h.el.appendChild(s);
      return s;
    });
  }
  function printHint(h, t, soft = 4) {
    const n = h.chars.length, head = t * (n + soft);
    h.chars.forEach((s, i) => { s.style.opacity = clamp((head - i) / soft); });
  }

  // timeline of one example: type (per field, staggered) → hold → rewind → gap
  const TYPE = 1.1, HOLD = 2.8, ERASE = 0.55, GAP = 0.35;
  const CYCLE = TYPE + 0.6 + HOLD + ERASE + GAP;
  let setIdx = 0, cycleT = 0, hintsOn = false;
  const loadSet = (i) => hints.forEach((h) => setHintText(h, SETS[i][h.key]));
  loadSet(0);

  function stepHints(dt) {
    cycleT += dt;
    if (cycleT >= CYCLE) { cycleT = 0; setIdx = (setIdx + 1) % SETS.length; loadSet(setIdx); }
    hints.forEach((h) => {
      const t = cycleT - h.delay;
      let v;
      if (t < TYPE) v = clamp(t / TYPE);
      else if (t < TYPE + HOLD + 0.6 - h.delay) v = 1;
      else v = 1 - clamp((t - (TYPE + HOLD + 0.6 - h.delay)) / ERASE);
      printHint(h, v);
    });
  }

  /* =====================================================================
     Fields: hide the hint while typing in that field
     ===================================================================== */
  s7.querySelectorAll('.field__input').forEach((input) => {
    const field = input.closest('.field');
    const sync = () => field.classList.toggle('is-filled', input.value.trim() !== '');
    input.addEventListener('focus', () => field.classList.add('is-active'));
    input.addEventListener('blur', () => { field.classList.remove('is-active'); sync(); });
    input.addEventListener('input', () => { sync(); field.classList.remove('is-invalid'); });
  });

  /* =====================================================================
     Custom select
     ===================================================================== */
  const pField = s7.querySelector('.field--priority');
  const pBtn = pField.querySelector('.select');
  const pValue = pField.querySelector('.select__value');
  const pList = pField.querySelector('.select__list');
  const pHidden = pField.querySelector('input[type="hidden"]');
  const options = [...pList.querySelectorAll('li')];
  let hl = 0;
  const highlight = (i) => {
    hl = (i + options.length) % options.length;
    options.forEach((o, j) => o.classList.toggle('is-hl', j === hl));
  };
  const openList = (v) => {
    pField.classList.toggle('is-open', v);
    pField.classList.toggle('is-active', v);
    pBtn.setAttribute('aria-expanded', String(v));
    if (v) highlight(Math.max(0, options.findIndex((o) => o.getAttribute('aria-selected') === 'true')));
  };
  const choose = (o) => {
    options.forEach((x) => x.setAttribute('aria-selected', String(x === o)));
    pValue.textContent = o.textContent;
    pHidden.value = o.textContent;
    pField.classList.add('is-filled');
    openList(false);
    pBtn.focus();
  };
  pBtn.addEventListener('click', () => openList(!pField.classList.contains('is-open')));
  options.forEach((o, i) => {
    o.addEventListener('click', () => choose(o));
    o.addEventListener('mousemove', () => highlight(i));
  });
  pBtn.addEventListener('keydown', (e) => {
    const open = pField.classList.contains('is-open');
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) openList(true);
      else highlight(hl + (e.key === 'ArrowDown' ? 1 : -1));
    } else if ((e.key === 'Enter' || e.key === ' ') && open) {
      e.preventDefault(); choose(options[hl]);
    } else if (e.key === 'Escape') openList(false);
  });
  document.addEventListener('click', (e) => { if (!pField.contains(e.target)) openList(false); });

  /* =====================================================================
     Submit (front-end only for now)
     ===================================================================== */
  const note = s7.querySelector('.form__note');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const company = form.company.value.trim();
    const email = form.email.value.trim();
    let ok = true;
    if (!company) { form.company.closest('.field').classList.add('is-invalid'); ok = false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { form.email.closest('.field').classList.add('is-invalid'); ok = false; }
    note.classList.toggle('is-error', !ok);
    note.textContent = ok
      ? 'Thank you — Andy will get back to you within one business day.'
      : 'Please add your company and a valid email.';
    if (ok) form.reset(), s7.querySelectorAll('.field').forEach((f) => f.classList.remove('is-filled', 'is-invalid')),
      pValue.textContent = '', options.forEach((x) => x.removeAttribute('aria-selected'));
  });

  /* =====================================================================
     Layout + reveal
     ===================================================================== */
  let vh = innerHeight;
  const layout = () => {
    vh = innerHeight;
    // pin the form screen so its bottom edge meets the viewport bottom
    contact.style.top = `${Math.min(0, vh - contact.offsetHeight)}px`;
  };
  addEventListener('resize', layout);
  addEventListener('load', layout);
  if (document.fonts) document.fonts.ready.then(layout);
  layout();

  const title = s7.querySelector('.s7__title > span');
  const avatar = s7.querySelector('.s7__avatar');
  const labels = [...s7.querySelectorAll('.field__label')];
  const rules = [...s7.querySelectorAll('.field__rule')];
  const formFoot = s7.querySelector('.form__foot');
  const groups = [...s7.querySelectorAll('.info__group')];
  const cols = [...s7.querySelectorAll('.foot__col')].map((c) => [...c.children]);
  const bar = s7.querySelector('.foot__bar');
  const glyphs = [...s7.querySelectorAll('.foot__glyph')];

  function render(p, f) {
    setV(title, '--t', seg(p, 0.0, 0.35));
    setV(avatar, '--t', seg(p, 0.2, 0.42, easeInOut));
    labels.forEach((l, i) => setV(l, '--t', seg(p, 0.22 + i * 0.07, 0.42 + i * 0.07)));
    rules.forEach((r, i) => setV(r, '--t', seg(p, 0.26 + i * 0.07, 0.62 + i * 0.07, easeInOut)));
    setV(formFoot, '--t', seg(p, 0.6, 0.8));
    groups.forEach((g, i) => setV(g, '--t', seg(p, 0.35 + i * 0.08, 0.6 + i * 0.08)));
    // footer
    cols.forEach((items, c) => items.forEach((el, i) => setV(el, '--t', seg(f, 0.08 + c * 0.07 + i * 0.03, 0.34 + c * 0.07 + i * 0.03))));
    setV(bar, '--t', seg(f, 0.45, 0.65));
    glyphs.forEach((g, i) => setV(g, '--t', seg(f, 0.5 + i * 0.08, 0.85 + i * 0.05, easeInOut)));
  }

  if (reduced) {
    render(1, 1);
    loadSet(0); hints.forEach((h) => printHint(h, 1));
    return;
  }

  let p = 0, f = 0, last = performance.now();
  function tick(now) {
    const dt = Math.min(64, now - last) / 1000;
    last = now;
    const k = 1 - Math.exp(-dt * 4);

    const top = s7.getBoundingClientRect().top;
    const fTop = foot.getBoundingClientRect().top;
    const pT = range(vh - top, vh * 0.1, vh * 1.0);
    const fT = range(vh - fTop, 0, foot.offsetHeight * 0.95);
    p += (pT - p) * k; f += (fT - f) * k;
    if (Math.abs(pT - p) < 0.0004) p = pT;
    if (Math.abs(fT - f) < 0.0004) f = fT;
    render(p, f);

    // the form softly blurs as the footer covers it
    setV(contact, '--o', easeOut(range(vh - fTop, vh * 0.1, vh * 0.9)));

    // hints run while the form is on screen
    const onScreen = top < vh && fTop > vh * 0.15;
    if (onScreen && p > 0.4) { hintsOn = true; stepHints(dt); }
    else if (hintsOn && !onScreen) { hintsOn = false; }

    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
