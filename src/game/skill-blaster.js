// Skill Blaster: a tiny canvas game. Loaded on demand (dynamic import) when the Play button is clicked.

const PINK = '#ff2e88';
const CYAN = '#00e5ff';
const PURPLE = '#b66bff';
const COLORS = [PINK, CYAN, PURPLE];

const SKILLS = [
  ['Program management', '$1M–$10M+ programs across a four-hospital health system'],
  ['Multi-workstream delivery', 'Leading 7 of 11 UKG workstreams, 150+ people'],
  ['Risk & dependency management', '200+ StrataJazz integrations, delivered on schedule'],
  ['Go-live under pressure', '90+ Workday integrations to a clean go-live, inherited as a new hire'],
  ['Business cases', 'Wrote the seven-figure Epic Willow case leadership adopted'],
  ['Stakeholder alignment', 'Clinical, IT, finance, HR, supply chain: none report to me'],
  ['AI product delivery', 'Built and shipped ReportForge solo, live in production'],
  ['AI verification & guardrails', 'Every AI-written number checked before a report ships'],
  ['Test harnesses', 'Roughly 3,000 automated tests, plus one built to trick the AI'],
  ['AI-assisted development', 'This site: designed with Claude, built by Claude Code'],
  ['Team leadership', 'Team of 5 across the US, Ireland, and Hong Kong; 96%+ satisfaction'],
  ['Enablement', 'Built a client portal, docs, and training program from scratch'],
];

const CSS = `
.bl-canvas{position:absolute;inset:0;width:100%;height:100%;display:block;outline:none;touch-action:none}
.bl-ui{position:absolute;inset:0;pointer-events:none;font-family:Inter,system-ui,sans-serif}
.bl-count{position:absolute;top:16px;left:16px;font:700 .8rem Orbitron,system-ui,sans-serif;letter-spacing:.08em;color:#fff;text-transform:uppercase;text-shadow:0 0 10px #00e5ff}
.bl-toast{position:absolute;top:56px;left:50%;transform:translateX(-50%);width:min(560px,calc(100% - 32px));text-align:center;padding:10px 16px;border-radius:12px;background:rgba(10,6,24,.9);border:1.5px solid #00e5ff;box-shadow:0 0 18px rgba(0,229,255,.5);opacity:0;transition:opacity .2s}
.bl-toast.on{opacity:1}
.bl-toast b{display:block;font:700 1rem Orbitron,system-ui,sans-serif;color:#ff2e88;text-shadow:0 0 12px #ff2e88}
.bl-toast span{display:block;margin-top:2px;font-size:.95rem;color:#fff}
.bl-panel{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:24px;text-align:center;background:rgba(10,6,24,.82);pointer-events:auto}
.bl-panel.on{display:flex}
.bl-panel h2{margin:0;font:900 clamp(1.4rem,4vw,2.2rem) Orbitron,system-ui,sans-serif;color:#fff;text-shadow:-2px 0 #ff2e88,2px 0 #00e5ff}
.bl-panel p{margin:0;max-width:34em;color:#f1edfa}
.bl-panel .row{display:flex;flex-wrap:wrap;gap:12px;justify-content:center}
.bl-panel .btn{cursor:pointer;font-family:Orbitron,system-ui,sans-serif}
.bl-touch{position:absolute;left:0;right:0;bottom:0;display:none;justify-content:space-between;padding:0 14px 18px;pointer-events:none}
.bl-touch.on{display:flex}
.bl-touch .grp{display:flex;gap:12px;pointer-events:auto}
.bl-touch button{width:68px;height:68px;border-radius:50%;border:2px solid #00e5ff;background:rgba(10,6,24,.7);color:#fff;font-size:1.5rem;touch-action:none;user-select:none;-webkit-user-select:none;box-shadow:0 0 14px rgba(0,229,255,.4)}
.bl-touch button.pk{border-color:#ff2e88;box-shadow:0 0 14px rgba(255,46,136,.5)}
.bl-touch button.down{background:rgba(255,46,136,.35)}
`;

export function createGame(stage, { resumeHref, close }) {
  stage.textContent = '';
  const style = document.createElement('style');
  style.textContent = CSS;
  stage.append(style);

  const canvas = document.createElement('canvas');
  canvas.className = 'bl-canvas';
  canvas.tabIndex = -1;
  canvas.setAttribute('aria-label', 'Skill Blaster game area');
  stage.append(canvas);
  const ctx = canvas.getContext('2d');

  const ui = document.createElement('div');
  ui.className = 'bl-ui';
  ui.innerHTML = `
    <div class="bl-count" aria-live="polite"></div>
    <div class="bl-toast" role="status"><b></b><span></span></div>
    <div class="bl-panel bl-start on">
      <h2>SKILL BLASTER</h2>
      <p>Shoot a skill to see the proof.</p>
      <p class="bl-help"></p>
      <div class="row"><button type="button" class="btn primary" data-a="start">Start</button></div>
    </div>
    <div class="bl-panel bl-end">
      <h2>ALL SKILLS UNLOCKED</h2>
      <div class="row">
        <a class="btn primary" href="${resumeHref}" download>Download resume</a>
        <button type="button" class="btn" data-a="again">Play again</button>
        <button type="button" class="btn" data-a="close">Close</button>
      </div>
    </div>
    <div class="bl-touch">
      <div class="grp"><button type="button" data-k="left" aria-label="Rotate left">◀</button><button type="button" data-k="right" aria-label="Rotate right">▶</button></div>
      <div class="grp"><button type="button" class="pk" data-k="thrust" aria-label="Thrust">▲</button><button type="button" class="pk" data-k="fire" aria-label="Fire">●</button></div>
    </div>`;
  stage.append(ui);

  const $ = (sel) => ui.querySelector(sel);
  const countEl = $('.bl-count');
  const toastEl = $('.bl-toast');
  const startPanel = $('.bl-start');
  const endPanel = $('.bl-end');
  const touchEl = $('.bl-touch');
  const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  $('.bl-help').textContent = isTouch
    ? 'Use the on-screen buttons: rotate, thrust, fire.'
    : 'Left/Right or A/D rotate · Up or W thrust · Space fire';
  touchEl.classList.toggle('on', isTouch);

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const keys = { left: false, right: false, thrust: false, fire: false };
  let W = 0, H = 0, dpr = 1, scale = 1;
  let stars = null;
  let state = 'start';
  let running = false, raf = 0, last = 0, floorT = 0;
  let ship, bullets, rocks, parts, unlocked, fireCd, toastTimer, endTimer;

  const rnd = (a, b) => a + Math.random() * (b - a);
  const floorH = () => Math.min(90, H * 0.16);

  function resize() {
    const r = stage.getBoundingClientRect();
    W = Math.max(1, r.width);
    H = Math.max(1, r.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    scale = Math.min(1, Math.max(0.7, W / 760));
    // Static star layer, drawn once per resize.
    stars = document.createElement('canvas');
    stars.width = canvas.width;
    stars.height = canvas.height;
    const s = stars.getContext('2d');
    s.scale(dpr, dpr);
    for (let i = 0; i < 90; i++) {
      s.globalAlpha = rnd(0.25, 1);
      s.fillStyle = '#fff';
      s.fillRect(rnd(0, W), rnd(0, H - floorH()), Math.random() > 0.8 ? 2 : 1, Math.random() > 0.8 ? 2 : 1);
    }
    if (ship) for (const o of [ship, ...rocks]) { o.x = Math.min(o.x, W); o.y = Math.min(o.y, H); }
  }

  function makeRock(i) {
    const r = 46 * scale;
    let x, y;
    do { x = rnd(0, W); y = rnd(0, H); } while (Math.hypot(x - W / 2, y - H / 2) < 170);
    const sp = rnd(18, 42), dir = rnd(0, Math.PI * 2);
    const n = 10;
    return {
      i, x, y, r,
      vx: Math.cos(dir) * sp, vy: Math.sin(dir) * sp,
      a: rnd(0, 6.28), va: rnd(-0.5, 0.5),
      color: COLORS[i % 3],
      verts: Array.from({ length: n }, (_, k) => [(k / n) * Math.PI * 2, rnd(0.82, 1.1)]),
      lines: wrap(SKILLS[i][0]),
    };
  }

  function wrap(text) {
    const lines = [];
    let cur = '';
    for (const w of text.split(' ')) {
      if (cur && (cur + ' ' + w).length > 13) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w;
    }
    lines.push(cur);
    return lines;
  }

  function reset() {
    ship = { x: W / 2, y: (H - floorH()) / 2, a: -Math.PI / 2, vx: 0, vy: 0, flash: 0, thrusting: false };
    bullets = []; parts = []; unlocked = 0; fireCd = 0;
    rocks = SKILLS.map((_, i) => makeRock(i));
    clearTimeout(toastTimer); clearTimeout(endTimer);
    toastEl.classList.remove('on');
    updateCount();
  }

  const updateCount = () => { countEl.textContent = `Skills unlocked ${unlocked}/${SKILLS.length}`; };

  function showToast(i) {
    toastEl.querySelector('b').textContent = SKILLS[i][0];
    toastEl.querySelector('span').textContent = SKILLS[i][1];
    toastEl.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('on'), 3000);
  }

  function burst(x, y, color) {
    for (let k = 0; k < 20; k++) {
      const a = rnd(0, 6.28), sp = rnd(40, 220);
      parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.7, color });
    }
  }

  const wrapPos = (o, m) => {
    if (o.x < -m) o.x += W + 2 * m; else if (o.x > W + m) o.x -= W + 2 * m;
    if (o.y < -m) o.y += H + 2 * m; else if (o.y > H + m) o.y -= H + 2 * m;
  };

  function update(dt) {
    if (state !== 'play') { for (const r of rocks) drift(r, dt); return; }
    if (keys.left) ship.a -= 4 * dt;
    if (keys.right) ship.a += 4 * dt;
    ship.thrusting = keys.thrust;
    if (keys.thrust) { ship.vx += Math.cos(ship.a) * 280 * dt; ship.vy += Math.sin(ship.a) * 280 * dt; }
    const damp = Math.exp(-0.6 * dt);
    ship.vx *= damp; ship.vy *= damp;
    const sp = Math.hypot(ship.vx, ship.vy);
    if (sp > 380) { ship.vx *= 380 / sp; ship.vy *= 380 / sp; }
    ship.x += ship.vx * dt; ship.y += ship.vy * dt;
    wrapPos(ship, 12);
    ship.flash = Math.max(0, ship.flash - dt);

    fireCd -= dt;
    if (keys.fire && fireCd <= 0) {
      fireCd = 0.22;
      bullets.push({ x: ship.x + Math.cos(ship.a) * 16, y: ship.y + Math.sin(ship.a) * 16, vx: Math.cos(ship.a) * 620 + ship.vx, vy: Math.sin(ship.a) * 620 + ship.vy, life: 1.1 });
    }

    for (const r of rocks) drift(r, dt);
    for (const b of bullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      wrapPos(b, 4);
      for (let k = rocks.length - 1; k >= 0; k--) {
        const r = rocks[k];
        if (Math.hypot(b.x - r.x, b.y - r.y) < r.r) {
          b.life = 0;
          rocks.splice(k, 1);
          burst(r.x, r.y, r.color);
          unlocked++;
          updateCount();
          showToast(r.i);
          if (unlocked === SKILLS.length) endTimer = setTimeout(finish, 1800);
          break;
        }
      }
    }
    bullets = bullets.filter((b) => b.life > 0);

    if (ship.flash <= 0) {
      for (const r of rocks) {
        const d = Math.hypot(ship.x - r.x, ship.y - r.y);
        if (d < r.r + 10) {
          const nx = (ship.x - r.x) / (d || 1), ny = (ship.y - r.y) / (d || 1);
          ship.vx = nx * 320; ship.vy = ny * 320;
          ship.x = r.x + nx * (r.r + 14); ship.y = r.y + ny * (r.r + 14);
          ship.flash = 0.7;
          break;
        }
      }
    }
    for (const p of parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
    parts = parts.filter((p) => p.life > 0);
  }

  function drift(r, dt) {
    r.x += r.vx * dt; r.y += r.vy * dt; r.a += r.va * dt;
    wrapPos(r, r.r);
  }

  function finish() {
    state = 'end';
    toastEl.classList.remove('on');
    endPanel.classList.add('on');
    endPanel.querySelector('.btn').focus();
  }

  function drawFloor() {
    const fh = floorH(), top = H - fh;
    ctx.fillStyle = '#0c041e';
    ctx.fillRect(0, top, W, fh);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,46,136,.8)';
    ctx.beginPath();
    for (let i = -10; i <= 10; i++) { ctx.moveTo(W / 2, top); ctx.lineTo(W / 2 + i * W * 0.14, H); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,229,255,.75)';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const t = (i + floorT) / 8, y = top + fh * t * t;
      ctx.moveTo(0, y); ctx.lineTo(W, y);
    }
    ctx.stroke();
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 2;
    ctx.shadowColor = CYAN; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.moveTo(0, top); ctx.lineTo(W, top); ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0a0618';
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(stars, 0, 0, W, H);
    drawFloor();

    for (const r of rocks) {
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.rotate(r.a);
      ctx.strokeStyle = r.color; ctx.lineWidth = 2;
      ctx.shadowColor = r.color; ctx.shadowBlur = 12;
      ctx.beginPath();
      r.verts.forEach(([ang, k], n) => {
        const px = Math.cos(ang) * r.r * k, py = Math.sin(ang) * r.r * k;
        n ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      });
      ctx.closePath(); ctx.stroke();
      ctx.restore();
      // Label stays upright.
      ctx.shadowBlur = 0;
      ctx.font = `600 ${Math.round(12 * Math.max(scale, 0.9))}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const lh = 14 * Math.max(scale, 0.9), y0 = r.y - ((r.lines.length - 1) * lh) / 2;
      r.lines.forEach((ln, n) => {
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10,6,24,.9)';
        ctx.strokeText(ln, r.x, y0 + n * lh);
        ctx.fillStyle = '#fff';
        ctx.fillText(ln, r.x, y0 + n * lh);
      });
    }

    ctx.shadowColor = CYAN; ctx.shadowBlur = 10; ctx.fillStyle = CYAN;
    for (const b of bullets) { ctx.beginPath(); ctx.arc(b.x, b.y, 2.5, 0, 6.29); ctx.fill(); }
    for (const p of parts) {
      ctx.globalAlpha = Math.max(0, p.life / 0.7);
      ctx.shadowColor = p.color; ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1;

    const blink = ship.flash > 0 && Math.floor(ship.flash * 16) % 2 === 0;
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.a);
    ctx.strokeStyle = blink ? '#fff' : CYAN; ctx.lineWidth = 2;
    ctx.shadowColor = blink ? '#fff' : CYAN; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-11, 10); ctx.lineTo(-6, 0); ctx.lineTo(-11, -10); ctx.closePath(); ctx.stroke();
    if (ship.thrusting && state === 'play') {
      ctx.strokeStyle = PINK; ctx.shadowColor = PINK;
      ctx.beginPath(); ctx.moveTo(-8, 4); ctx.lineTo(-18 - rnd(0, 8), 0); ctx.lineTo(-8, -4); ctx.stroke();
    }
    ctx.restore();
    ctx.shadowBlur = 0;
  }

  function frame(t) {
    if (!running) return;
    const dt = Math.min(0.05, (t - last) / 1000 || 0);
    last = t;
    if (!reduceMotion) floorT = (floorT + dt * 0.6) % 1;
    update(dt);
    draw();
    raf = requestAnimationFrame(frame);
  }

  function begin() {
    if (running || !stage.isConnected || document.hidden) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function halt() {
    running = false;
    cancelAnimationFrame(raf);
  }

  // ----- input -----
  const keyMap = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'thrust', w: 'thrust', W: 'thrust', ' ': 'fire' };
  function onKey(e, down) {
    const k = keyMap[e.key];
    if (!k || state !== 'play') return;
    keys[k] = down;
    e.preventDefault();
  }
  const onKeyDown = (e) => onKey(e, true);
  const onKeyUp = (e) => onKey(e, false);
  const clearKeys = () => { for (const k in keys) keys[k] = false; touchEl.querySelectorAll('.down').forEach((b) => b.classList.remove('down')); };
  const onVis = () => (document.hidden ? halt() : active && begin());

  touchEl.querySelectorAll('button').forEach((b) => {
    const k = b.dataset.k;
    const set = (v) => (e) => { e.preventDefault(); keys[k] = v; b.classList.toggle('down', v); };
    b.addEventListener('pointerdown', (e) => { b.setPointerCapture(e.pointerId); set(true)(e); });
    b.addEventListener('pointerup', set(false));
    b.addEventListener('pointercancel', set(false));
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  });

  function startPlay() {
    reset();
    state = 'play';
    startPanel.classList.remove('on');
    endPanel.classList.remove('on');
    canvas.focus();
  }
  ui.addEventListener('click', (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'start' || a === 'again') startPlay();
    else if (a === 'close') close();
  });

  const ro = new ResizeObserver(() => { if (stage.clientWidth) resize(); });
  let active = false;

  resize();
  reset();

  return {
    resume() {
      active = true;
      resize();
      document.addEventListener('keydown', onKeyDown);
      document.addEventListener('keyup', onKeyUp);
      document.addEventListener('visibilitychange', onVis);
      ro.observe(stage);
      if (state === 'start') startPanel.querySelector('.btn').focus();
      begin();
    },
    pause() {
      active = false;
      halt();
      clearKeys();
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('visibilitychange', onVis);
      ro.disconnect();
    },
  };
}
