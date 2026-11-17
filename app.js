(() => {
  'use strict';
  const SIZES = { half: 0.5, normal: 1, xl: 1.5 };
  const SIZE_LABELS = { half: 'Half', normal: 'Normal', xl: 'Extra large (150%)' };
  const DEFAULTS = {
    style: 'digital', seconds: true, showSep: true, h24: true, ticks: true,
    sizeHour: 'normal', sizeMinute: 'normal', sizeSecond: 'normal',
    colors: {
      digital: { hour: '#ff5a5f', minute: '#4cc9f0', second: '#ffd166', sep: '#aaaaaa', bg: '#000000' },
      analog:  { hour: '#ff9f1c', minute: '#2ec4b6', second: '#e71d36', sep: '#aaaaaa', bg: '#0b0b14' }
    }
  };
  const KEY = 'clock-settings-v2';
  const clone = o => JSON.parse(JSON.stringify(o));
  let s = clone(DEFAULTS);
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    Object.assign(s, saved);
    s.colors = { digital: { ...DEFAULTS.colors.digital, ...(saved.colors || {}).digital },
                 analog:  { ...DEFAULTS.colors.analog,  ...(saved.colors || {}).analog } };
  } catch {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} };

  const $ = id => document.getElementById(id);
  const face = $('face'), panel = $('panel'), gear = $('gear');
  const NS = 'http://www.w3.org/2000/svg';
  const pad = n => String(n).padStart(2, '0');
  const col = () => s.colors[s.style];

  let hands = null, digits = null, digitalEl = null;

  /* ---------- digital ---------- */
  function buildDigital() {
    face.innerHTML = '';
    const d = digitalEl = document.createElement('div');
    d.className = 'digital';
    d.innerHTML = '<span data-h></span><span data-sep1 class="sep">:</span><span data-m></span>' +
      (s.seconds ? '<span data-sep2 class="sep">:</span><span data-s></span>' : '') + '<span class="ampm" data-ap></span>';
    face.appendChild(d);
    const q = a => d.querySelector(`[${a}]`);
    digits = { h: q('data-h'), m: q('data-m'), s: q('data-s'), ap: q('data-ap'),
               sep1: q('data-sep1'), sep2: q('data-sep2') };
    hands = null;
    applyStyleVars();
  }

  /* ---------- analog ---------- */
  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    parent && parent.appendChild(e);
    return e;
  }
  function buildAnalog() {
    face.innerHTML = '';
    digitalEl = null;
    const wrap = document.createElement('div');
    wrap.className = 'analog';
    const svg = el('svg', { viewBox: '-100 -100 200 200' }, wrap);
    el('circle', { r: 97, fill: 'none', stroke: '#888', 'stroke-width': 1.5 }, svg);
    for (let i = 0; i < 60; i++) {
      const major = i % 5 === 0;
      if (!s.ticks && !major) continue;
      const a = i * 6 * Math.PI / 180, r1 = major ? 84 : 90, r2 = 95;
      el('line', { x1: Math.sin(a) * r1, y1: -Math.cos(a) * r1, x2: Math.sin(a) * r2, y2: -Math.cos(a) * r2,
        stroke: '#aaa', 'stroke-width': major ? 2.5 : 1 }, svg);
    }
    if (s.ticks) for (let i = 1; i <= 12; i++) {
      const a = i * 30 * Math.PI / 180;
      el('text', { x: Math.sin(a) * 70, y: -Math.cos(a) * 70 + 5, 'text-anchor': 'middle',
        'font-size': 14, fill: '#ccc', 'font-weight': 600 }, svg).textContent = i;
    }
    hands = {
      h: el('line', { y2: -48, 'stroke-width': 6, 'stroke-linecap': 'round' }, svg),
      m: el('line', { y2: -72, 'stroke-width': 4, 'stroke-linecap': 'round' }, svg),
      s: s.seconds ? el('g', {}, svg) : null
    };
    if (hands.s) {
      el('line', { y1: 14, y2: -80, 'stroke-width': 1.6, 'stroke-linecap': 'round' }, hands.s);
      el('circle', { r: 3.5 }, hands.s);
    }
    el('circle', { r: 3, fill: '#fff' }, svg);
    face.appendChild(wrap);
    digits = null;
    applyStyleVars();
  }

  /* ---------- colours & sizes ---------- */
  function applyStyleVars() {
    const c = col();
    document.documentElement.style.setProperty('--bg', c.bg);
    document.querySelector('meta[name=theme-color]').content = c.bg;
    if (digits) {
      digits.h.style.color = c.hour;   digits.h.style.setProperty('--k', SIZES[s.sizeHour]);
      digits.m.style.color = c.minute; digits.m.style.setProperty('--k', SIZES[s.sizeMinute]);
      digits.sep1.style.setProperty('--k', SIZES[s.sizeMinute]);
      if (digits.s) {
        digits.s.style.color = c.second; digits.s.style.setProperty('--k', SIZES[s.sizeSecond]);
        digits.sep2.style.setProperty('--k', SIZES[s.sizeSecond]);
      }
      digits.ap.style.color = c.hour;
      for (const sp of [digits.sep1, digits.sep2]) if (sp) {
        sp.style.color = c.sep; sp.style.display = s.showSep ? '' : 'none';
      }
      fit();
    }
    if (hands) {
      hands.h.setAttribute('stroke', c.hour);
      hands.m.setAttribute('stroke', c.minute);
      if (hands.s) {
        hands.s.querySelectorAll('line').forEach(l => l.setAttribute('stroke', c.second));
        hands.s.querySelector('circle').setAttribute('fill', c.second);
      }
    }
  }

  // shrink the digital clock if the chosen sizes would overflow the screen
  function fit() {
    face.style.transform = '';
    if (!digitalEl) return;
    const w = digitalEl.getBoundingClientRect().width;
    const k = Math.min(1, innerWidth * 0.96 / w);
    if (k < 1) face.style.transform = `scale(${k})`;
  }
  addEventListener('resize', fit);

  function build() {
    s.style === 'analog' ? buildAnalog() : buildDigital();
    tick();
    fit();
  }

  /* ---------- ticking ---------- */
  function tick() {
    const now = new Date();
    const H = now.getHours(), M = now.getMinutes(), S = now.getSeconds(), ms = now.getMilliseconds();
    if (digits) {
      let h = H, ap = '';
      if (!s.h24) { ap = H >= 12 ? 'PM' : 'AM'; h = H % 12 || 12; }
      digits.h.textContent = s.h24 ? pad(h) : h;
      digits.m.textContent = pad(M);
      if (digits.s) digits.s.textContent = pad(S);
      if (digits.ap.textContent !== ap) { digits.ap.textContent = ap; fit(); }
    } else if (hands) {
      const sec = S + ms / 1000, min = M + sec / 60;
      hands.h.setAttribute('transform', `rotate(${((H % 12) + min / 60) * 30})`);
      hands.m.setAttribute('transform', `rotate(${min * 6})`);
      if (hands.s) hands.s.setAttribute('transform', `rotate(${sec * 6})`);
    }
  }
  let raf;
  function loop() {
    tick();
    if (s.style === 'analog' && s.seconds) raf = requestAnimationFrame(loop);
    else raf = setTimeout(loop, 1000 - (Date.now() % 1000) + 5);
  }
  function restart() { cancelAnimationFrame(raf); clearTimeout(raf); loop(); }

  /* ---------- settings UI ---------- */
  for (const id of ['sizeHour', 'sizeMinute', 'sizeSecond'])
    for (const k in SIZES) $(id).add(new Option(SIZE_LABELS[k], k));

  function syncUI() {
    const digital = s.style === 'digital', c = col();
    document.querySelector(`input[name=style][value=${s.style}]`).checked = true;
    $('seconds').checked = s.seconds; $('showSep').checked = s.showSep; $('h24').checked = s.h24; $('ticks').checked = s.ticks;
    for (const id of ['sizeHour', 'sizeMinute', 'sizeSecond']) $(id).value = s[id];
    $('colorHour').value = c.hour; $('colorMinute').value = c.minute;
    $('colorSecond').value = c.second; $('colorSep').value = c.sep; $('colorBg').value = c.bg;
    $('colorLegend').textContent = `Colors (${s.style})`;
    $('sizeSet').classList.toggle('dim', !digital);
    $('secSizeRow').classList.toggle('dim', !s.seconds);
    $('secColorRow').classList.toggle('dim', !s.seconds);
    $('sepRow').classList.toggle('dim', !digital);
    $('sepColorRow').classList.toggle('dim', !digital || !s.showSep);
    $('h24row').classList.toggle('dim', !digital);
    $('ticks').closest('.row').classList.toggle('dim', digital);
  }
  function change(patch, rebuild) {
    Object.assign(s, patch); save(); syncUI();
    if (rebuild) { build(); restart(); } else applyStyleVars();
  }

  document.querySelectorAll('input[name=style]').forEach(i => i.onchange = () => change({ style: i.value }, true));
  $('seconds').onchange = e => change({ seconds: e.target.checked }, true);
  $('showSep').onchange = e => change({ showSep: e.target.checked }, false);
  $('h24').onchange = e => change({ h24: e.target.checked }, false);
  $('ticks').onchange = e => change({ ticks: e.target.checked }, true);
  for (const id of ['sizeHour', 'sizeMinute', 'sizeSecond'])
    $(id).onchange = e => change({ [id]: e.target.value }, false);
  const colMap = { colorHour: 'hour', colorMinute: 'minute', colorSecond: 'second', colorSep: 'sep', colorBg: 'bg' };
  for (const id in colMap)
    $(id).oninput = e => { col()[colMap[id]] = e.target.value; save(); applyStyleVars(); };

  const setPanel = open => { panel.hidden = !open; gear.setAttribute('aria-expanded', open); };
  gear.onclick = () => setPanel(panel.hidden);
  $('close').onclick = () => setPanel(false);
  $('reset').onclick = () => { const st = s.style; s = clone(DEFAULTS); s.style = st; save(); syncUI(); build(); restart(); };
  $('fs').onclick = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setPanel(false); });
  face.addEventListener('dblclick', () => $('fs').click());

  let idle;
  const wake = () => { document.body.classList.remove('idle'); clearTimeout(idle);
    idle = setTimeout(() => panel.hidden && document.body.classList.add('idle'), 4000); };
  ['mousemove', 'touchstart', 'keydown'].forEach(ev => addEventListener(ev, wake, { passive: true }));
  wake();

  async function wakeLock() { try { await navigator.wakeLock?.request('screen'); } catch {} }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { wakeLock(); restart(); } });
  wakeLock();

  syncUI(); build(); restart();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
