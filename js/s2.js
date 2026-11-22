/* PTM — Section 2 "No limits"
   Screen A slides up over the pinned hero, then pins:
     1. the headline prints in,
     2. only then the three cards arrive around it, one by one.
   Screen B (the bridge film) scrolls in below it, pins full screen and the
   trucks drive across as you scroll (image sequence from "2 screen.mp4"). */
(() => {
  const s2 = document.querySelector('.s2');
  if (!s2) return;
  const intro = s2.querySelector('.s2__intro');
  const stage = s2.querySelector('.s2__stage');
  const driveEl = s2.querySelector('.s2__drive');
  const film = s2.querySelector('.s2__film');
  const canvas = s2.querySelector('.s2__canvas');
  const dotsHost = s2.querySelector('.s2__dots');
  const heroPin = document.querySelector('.hero__pin');
  const ctx = canvas.getContext('2d', { alpha: false });

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FRAMES = 120;
  const INTRO = 1.7;   // × vh of pinned scroll for headline + cards (unhurried)
  const DRIVE = 1.0;   // × vh of pinned scroll for the trucks
  const isMobile = () => innerWidth < 1024;

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const range = (v, a, b) => clamp((v - a) / (b - a));
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10); // smootherstep
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  /* ---------- grid dots (design px inside the 1440 × 700 composition) ---------- */
  const COLS = [23.5, 164.7, 718, 1273, 1414];
  const ROWS = [227, 371, 516];
  const dots = [];
  for (const y of ROWS) for (const x of COLS) {
    if (x === 718 && y === 371) continue; // behind the headline
    const i = document.createElement('i');
    i.style.left = `calc(${x} * var(--u))`;
    i.style.top = `calc(${y} * var(--u))`;
    dotsHost.appendChild(i);
    dots.push({ el: i, x, y, v: -1 });
  }

  /* ---------- headline typewriter ---------- */
  const SOFT = 9; // glyphs mid-fade at once — a wide, soft printing edge
  const lines = [...s2.querySelectorAll('[data-type2]')].map((el) => {
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
    el.setAttribute('aria-label', el.textContent);
    return { el, chars, v: -1 };
  });
  function type(line, t) {
    const n = line.chars.length;
    const head = t * (n + SOFT);
    for (let i = 0; i < n; i++) {
      const o = clamp((head - i) / SOFT);
      const s = line.chars[i];
      if (s._o !== o) { s.style.opacity = o; s._o = o; }
    }
  }

  const cards = [...s2.querySelectorAll('.card')].map((el) => ({ el, v: -1 }));

  /* ---------- frames ---------- */
  let set = isMobile() ? 'm' : 'd';
  let images = [];
  let started = false;

  function loadSet() {
    const list = new Array(FRAMES);
    images = list;
    const token = set;
    const load = (i) => new Promise((res) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = async () => {
        try { await img.decode(); } catch (e) { /* noop */ }
        if (token === set) { list[i] = img; dirty = true; }
        res();
      };
      img.onerror = res;
      img.src = `assets/frames2/${set}_${String(i).padStart(3, '0')}.webp`;
    });
    const order = [0];
    for (let s = 8; s >= 1; s >>= 1) for (let i = 0; i < FRAMES; i += s) if (!order.includes(i)) order.push(i);
    let k = 0;
    const worker = async () => { while (k < order.length && token === set) await load(order[k++]); };
    for (let w = 0; w < 5; w++) worker();
  }
  function startLoading() { if (!started) { started = true; loadSet(); } }

  /* ---------- canvas ---------- */
  let cw = 0, ch = 0, dirty = true, lastF = -1;
  function sizeCanvas() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const r = film.getBoundingClientRect();
    cw = Math.max(1, Math.round(r.width * dpr));
    ch = Math.max(1, Math.round(r.height * dpr));
    canvas.width = cw; canvas.height = ch;
    ctx.fillStyle = '#fafafa'; ctx.fillRect(0, 0, cw, ch);
    dirty = true;
  }
  function cover(img, a) {
    const s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    ctx.globalAlpha = a;
    ctx.drawImage(img, (cw - w) / 2, ch - h, w, h); // anchored to the bottom: the bridge
  }
  function draw(f) {
    if (!dirty && Math.abs(f - lastF) < 0.002) return;
    let lo = Math.floor(f), hi = Math.ceil(f);
    while (lo > 0 && !images[lo]) lo--;
    while (hi < FRAMES - 1 && !images[hi]) hi++;
    if (!images[lo] && !images[hi]) return;
    const a = hi > lo ? (f - lo) / (hi - lo) : 0;
    if (hi - lo > 2) {
      // frames still streaming: show the nearest one rather than a ghosted blend
      cover(images[a < 0.5 && images[lo] ? lo : hi] || images[lo], 1);
    } else {
      const A = images[lo] || images[hi];
      cover(A, 1);
      const B = images[hi];
      if (B && B !== A && a > 0.01) cover(B, a);
    }
    ctx.globalAlpha = 1;
    lastF = f; dirty = false;
  }

  /* ---------- procedural clouds (WebGL) ----------
     Domain-warped fractal noise, lit from the upper right: bright rims,
     soft blue-grey undersides. Rendered at reduced resolution (clouds are
     soft) and only while the film is on screen. */
  const cloudCanvas = s2.querySelector('.s2__clouds');
  const clouds = (() => {
    const gl = cloudCanvas.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false });
    if (!gl) return null;
    const vs = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;
    const fs = `
      precision highp float;
      uniform vec2 uRes; uniform float uTime; uniform float uShift; uniform float uAspect;
      float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float noise(vec2 p){
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      float fbm(vec2 p){
        float v = 0.0, a = 0.5;
        mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
        for (int i = 0; i < 6; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
        return v;
      }
      // Cumulus built like the real thing: each cloud is a cluster of round
      // puffs (domed in the middle, flat at the base), eroded by noise at the
      // edges and lit from the upper right.
      uniform vec4 uC[6];   // x, y (uv, y up), size (fraction of height), seed
      float drift(){ return -(uShift * 0.22 + uTime * 0.006); }
      float field(vec2 q, out float hgt){
        float d = 0.0, best = 0.0; hgt = 0.5;
        for (int k = 0; k < 6; k++) {
          vec4 c = uC[k];
          vec2 cc = vec2(mod(c.x * uAspect + drift() + 0.6, uAspect + 1.2) - 0.6, c.y);
          float base = cc.y - 0.18 * c.z;
          float dk = 0.0;
          for (int j = 0; j < 11; j++) {
            float fj = float(j);
            float hx = hash(vec2(c.w, fj * 1.37)) * 2.0 - 1.0;
            float hy = hash(vec2(fj * 2.11, c.w + 3.1));
            vec2 o = vec2(hx * 1.55, hy * 0.9 * (1.0 - 0.6 * abs(hx))) * c.z;
            float r = c.z * (0.55 + 0.38 * hash(vec2(c.w + fj, 7.7))) * (1.0 - 0.35 * abs(hx));
            float dist = length(q - cc - o) / r;
            dk += smoothstep(1.2, 0.0, dist) * 0.8;
          }
          dk *= smoothstep(base - 0.04 * c.z, base + 0.22 * c.z, q.y); // flat base
          d += dk;
          if (dk > best) { best = dk; hgt = clamp((q.y - base) / (c.z * 1.25), 0.0, 1.0); }
        }
        return d;
      }
      void main(){
        vec2 uv = gl_FragCoord.xy / uRes;                  // y up
        vec2 q = vec2(uv.x * uAspect, uv.y);
        float h;
        float d = field(q, h);
        // erode edges into cauliflower detail
        vec2 nq = q * 12.0 + vec2(-uTime * 0.03 + drift() * 12.0, 0.0);
        float n = fbm(nq) * 0.75 + fbm(nq * 2.3 + 7.0) * 0.25;
        float de = d - (n - 0.5) * 1.0;
        float cov = smoothstep(-0.02, 0.75, de) * 0.62;   // translucent
        // light from the upper right: density falls toward the sun on lit rims
        float hL;
        float dL = field(q + vec2(0.015, 0.025), hL) - (fbm(nq + vec2(0.14, 0.22)) - 0.5) * 1.0;
        float lit = clamp(0.62 + (de - dL) * 1.2, 0.0, 1.0);
        lit *= mix(0.72, 1.06, h);                              // softer, flatter undersides
        lit = clamp(lit + 0.22 * (1.0 - smoothstep(0.2, 1.5, de)), 0.0, 1.0); // thin parts glow
        vec3 shadow = vec3(0.855, 0.87, 0.9);               // light, airy undersides
        vec3 light  = vec3(1.0);
        vec3 col = mix(shadow, light, smoothstep(0.0, 1.0, lit));
        // A soft, cool sky so the sunlit cloud tops read white against it.
        // Fades to pure white at the frame edges → seamless with the page.
        float skyAmt = smoothstep(1.0, 0.74, uv.y) * smoothstep(0.06, 0.42, uv.y);
        vec3 sky = mix(vec3(1.0), vec3(0.875, 0.895, 0.93), skyAmt * 0.9);
        sky = mix(sky, vec3(0.94, 0.95, 0.965), smoothstep(0.55, 0.0, uv.y) * skyAmt * 0.6); // paler toward the horizon
        // where the sky fades to white, clouds fade with it (no grey smudges)
        cov *= 0.15 + 0.85 * smoothstep(0.0, 0.6, skyAmt);
        gl_FragColor = vec4(mix(sky, col, cov), 1.0);
      }`;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
    const v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs);
    if (!v || !f) return null;
    const prog = gl.createProgram();
    gl.attachShader(prog, v); gl.attachShader(prog, f); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = (n) => gl.getUniformLocation(prog, n);
    const uRes = U('uRes'), uTime = U('uTime'), uShift = U('uShift'), uAspect = U('uAspect');
    // Cloud placement (uv, y up): open sky to the right of the truck and high
    // on the left above the bridge deck.
    gl.uniform4fv(U('uC'), new Float32Array([
      0.86, 0.58, 0.200, 1.3,   // large cumulus, right
      0.50, 0.79, 0.120, 4.7,   // above the trailer
      0.07, 0.80, 0.120, 7.9,   // left, rising from behind the deck
      1.00, 0.80, 0.100, 2.2,   // far right
      0.31, 0.84, 0.105, 5.5,   // centre-left
      0.74, 0.30, 0.090, 9.1,   // low right
    ]));
    film.classList.add('has-clouds');
    return {
      size() {
        const r = cloudCanvas.getBoundingClientRect();
        const scale = 0.5; // soft subject → half resolution is plenty
        cloudCanvas.width = Math.max(2, Math.round(r.width * scale));
        cloudCanvas.height = Math.max(2, Math.round(r.height * scale));
        gl.viewport(0, 0, cloudCanvas.width, cloudCanvas.height);
        gl.uniform2f(uRes, cloudCanvas.width, cloudCanvas.height);
        gl.uniform1f(uAspect, r.width / Math.max(1, r.height));
      },
      render(time, shift) {
        gl.uniform1f(uTime, time);
        gl.uniform1f(uShift, shift);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
    };
  })();

  /* ---------- layout ---------- */
  let vh = innerHeight;
  function layout() {
    vh = innerHeight;
    const next = isMobile() ? 'm' : 'd';
    if (next !== set) { set = next; if (started) loadSet(); }
    intro.style.height = `${stage.offsetHeight + INTRO * vh}px`;
    // + one screen during which the Services sheet slides over the film
    driveEl.style.height = `${film.offsetHeight + DRIVE * vh + vh}px`;
    sizeCanvas();
    if (clouds) clouds.size();
  }

  /* ---------- loop ---------- */
  let A = null, B = null;      // smoothed tops of the two screens
  let aS = null;               // extra-smoothed intro progress
  let lastCover = -1;
  let last = performance.now();
  let lastR = -1, lastO = -1, lastCam = '';

  function tick(now) {
    const dt = Math.min(64, now - last) / 1000;
    last = now;
    const k = 1 - Math.exp(-dt * 9);

    const rawA = intro.getBoundingClientRect().top;
    const rawB = driveEl.getBoundingClientRect().top;
    if (A === null) { A = rawA; B = rawB; }
    A += (rawA - A) * k; if (Math.abs(rawA - A) < 0.05) A = rawA;
    B += (rawB - B) * k; if (Math.abs(rawB - B) < 0.05) B = rawB;

    if (A < vh * 3) startLoading();

    // Slide-over: hero recedes, the sheet's rounded top flattens
    const rise = reduced ? 1 : range(vh - A, 0, vh);
    if (Math.abs(rise - lastO) > 0.0005) {
      heroPin && heroPin.style.setProperty('--o', easeOut(rise).toFixed(4));
      lastO = rise;
    }
    const r = 1 - easeInOut(rise);
    if (Math.abs(r - lastR) > 0.0005) { stage.style.setProperty('--r', r.toFixed(4)); lastR = r; }

    // Grid dots sweep in while the sheet rises
    for (const d of dots) {
      const t = reduced ? 1 : easeOut(range(rise, 0.35 + (d.y / 700) * 0.2 + (d.x / 1440) * 0.25, 0.6 + (d.y / 700) * 0.2 + (d.x / 1440) * 0.25));
      if (Math.abs(t - d.v) > 0.001) { d.el.style.setProperty('--t', t.toFixed(3)); d.v = t; }
    }

    // Pinned screen A: a = 0 → 1 over INTRO × vh of scroll.
    // The headline starts printing as the sheet settles and finishes first;
    // the cards follow strictly after, one by one.
    // Extra, slower easing on top of the scroll smoothing: the print and the
    // cards glide rather than track the wheel 1:1.
    const aTarget = reduced ? 1 : range(-A, -0.15 * vh, INTRO * vh);
    if (aS === null) aS = aTarget;
    aS += (aTarget - aS) * (1 - Math.exp(-dt * 3.2));
    if (Math.abs(aTarget - aS) < 0.0002) aS = aTarget;
    const a = aS;
    lines.forEach((line, i) => {
      const t = smoother(range(a, 0.0 + i * 0.17, 0.38 + i * 0.17));
      if (Math.abs(t - line.v) > 0.0005) { type(line, t); line.v = t; }
    });
    cards.forEach((c, i) => {
      const t = smoother(range(a, 0.56 + i * 0.13, 0.80 + i * 0.1));
      if (Math.abs(t - c.v) > 0.0005) { c.el.style.setProperty('--t', t.toFixed(4)); c.v = t; }
    });

    // Screen B: once the film reaches the top, scroll drives the trucks
    const drive = reduced ? 0 : range(-B, 0, DRIVE * vh);
    draw(drive * (FRAMES - 1));

    // Film recedes into the dark as Services slides over it
    const recede = reduced ? 0 : easeOut(range(-B - DRIVE * vh, 0, vh));
    if (Math.abs(recede - lastCover) > 0.0005) {
      film.style.setProperty('--o', recede.toFixed(4));
      lastCover = recede;
    }

    // Clouds: only while the film is on screen
    if (clouds && B < vh && B > -(film.offsetHeight + DRIVE * vh + vh)) {
      clouds.render(reduced ? 0 : now / 1000, drive * 0.55);
    }

    // camera: settles as the film rises into place, slow push-in during the drive
    const arrive = easeOut(range(vh - B, 0, vh));
    const scale = 1.06 - 0.06 * arrive + 0.03 * easeInOut(drive);
    const cam = `scale(${scale.toFixed(4)})`;
    if (cam !== lastCam) { canvas.style.transform = cam; lastCam = cam; }

    requestAnimationFrame(tick);
  }

  addEventListener('resize', layout);
  addEventListener('load', () => { layout(); setTimeout(startLoading, 1500); });
  if (document.fonts) document.fonts.ready.then(layout);
  layout();
  requestAnimationFrame(tick);
})();
