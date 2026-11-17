(() => {
  'use strict';
  const DEFAULTS = {
    style: 'digital', size: 'normal', seconds: true, h24: true, ticks: true,
    colorHour: '#ff5a5f', colorMinute: '#4cc9f0', colorSecond: '#ffd166', colorBg: '#000000'
  };
  const KEY = 'clock-settings-v1';
  let s;
  try { s = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { s = { ...DEFAULTS }; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} };

  const $ = id => document.getElementById(id);
  const face = $('face'), panel = $('panel'), gear = $('gear');
  const NS = 'http://www.w3.org/2000/svg';
  const pad = n => String(n).padStart(2, '0');

  /* ---------- builders ---------- */
  let hands = null, digits = null;

  function buildDigital() {
    face.innerHTML = '';
    const d = document.createElement('div');
    d.className = 'digital';
    d.innerHTML = '<span data-h></span><span class="sep">:</span><span data-m></span>' +
      (s.seconds ? '<span class="sep">:</span><span data-s></span>' : '') + '<span class="ampm" data-ap></span>';
    face.appendChild(d);
    digits = { h: d.querySelector('[data-h]'), m: d.querySelector('[data-m]'),
               s: d.querySelector('[data-s]'), ap: d.querySelector('[data-ap]') };
    hands = null;
    applyColors();
  }

  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    parent && parent.appendChild(e);
    return e;
  }

  function buildAnalog() {
    face.innerHTML = '';
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
      const t = el('text', { x: Math.sin(a) * 70, y: -Math.cos(a) * 70 + 5, 'text-anchor': 'middle',
        'font-size': 14, fill: '#ccc', 'font-weight': 600 }, svg);
      t.textContent = i;
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
    applyColors();
  }

  function applyColors() {
    document.documentElement.style.setProperty('--bg', s.colorBg);
    document.querySelector('meta[name=theme-color]').content = s.colorBg;
    if (digits) {
      digits.h.style.color = s.colorHour;
      digits.m.style.color = s.colorMinute;
      if (digits.s) digits.s.style.color = s.colorSecond;
      digits.ap.style.color = s.colorHour;
    }
    if (hands) {
      hands.h.setAttribute('stroke', s.colorHour);
      hands.m.setAttribute('stroke', s.colorMinute);
      if (hands.s) {
        hands.s.querySelectorAll('line').forEach(l => l.setAttribute('stroke', s.colorSecond));
        hands.s.querySelector('circle').setAttribute('fill', s.colorSecond);
      }
    }
  }

  function build() {
    face.classList.toggle('half', s.size === 'half');
    s.style === 'analog' ? buildAnalog() : buildDigital();
    tick();
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
      digits.ap.textContent = ap;
    } else if (hands) {
      const sec = S + ms / 1000;
      const min = M + sec / 60;
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
  function restart() {
    cancelAnimationFrame(raf); clearTimeout(raf);
    loop();
  }

  /* ---------- settings UI ---------- */
  function syncUI() {
    document.querySelector(`input[name=style][value=${s.style}]`).checked = true;
    document.querySelector(`input[name=size][value=${s.size}]`).checked = true;
    $('seconds').checked = s.seconds; $('h24').checked = s.h24; $('ticks').checked = s.ticks;
    $('colorHour').value = s.colorHour; $('colorMinute').value = s.colorMinute;
    $('colorSecond').value = s.colorSecond; $('colorBg').value = s.colorBg;
    $('secColorRow').classList.toggle('dim', !s.seconds);
    $('h24row').classList.toggle('dim', s.style !== 'digital');
    $('ticks').closest('.row').classList.toggle('dim', s.style !== 'analog');
  }
  function change(patch, rebuild) {
    Object.assign(s, patch); save(); syncUI();
    if (rebuild) { build(); restart(); } else applyColors();
  }

  document.querySelectorAll('input[name=style]').forEach(i => i.onchange = () => change({ style: i.value }, true));
  document.querySelectorAll('input[name=size]').forEach(i => i.onchange = () => change({ size: i.value }, true));
  $('seconds').onchange = e => change({ seconds: e.target.checked }, true);
  $('h24').onchange = e => change({ h24: e.target.checked }, false);
  $('ticks').onchange = e => change({ ticks: e.target.checked }, true);
  for (const k of ['colorHour', 'colorMinute', 'colorSecond', 'colorBg'])
    $(k).oninput = e => change({ [k]: e.target.value }, false);

  const setPanel = open => { panel.hidden = !open; gear.setAttribute('aria-expanded', open); };
  gear.onclick = () => setPanel(panel.hidden);
  $('close').onclick = () => setPanel(false);
  $('reset').onclick = () => change({ ...DEFAULTS }, true);
  $('fs').onclick = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setPanel(false); });
  face.addEventListener('dblclick', () => $('fs').click());

  // fade gear when idle
  let idle;
  const wake = () => { document.body.classList.remove('idle'); clearTimeout(idle);
    idle = setTimeout(() => panel.hidden && document.body.classList.add('idle'), 4000); };
  ['mousemove', 'touchstart', 'keydown'].forEach(ev => addEventListener(ev, wake, { passive: true }));
  wake();

  // keep screen awake
  let lock;
  async function wakeLock() { try { lock = await navigator.wakeLock?.request('screen'); } catch {} }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { wakeLock(); restart(); } });
  wakeLock();

  syncUI(); build(); restart();

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
