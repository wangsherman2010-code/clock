(function () {
  'use strict';
  // Written in plain ES5 so it runs on old Android / WebView browsers.
  var SIZES = { half: 0.5, normal: 1, xl: 1.5 };
  var SIZE_LABELS = { half: 'Half', normal: 'Normal', xl: 'Extra large (150%)' };
  var DEFAULTS = {
    style: 'digital', fontScale: null, seconds: true, showSep: true, h24: true, ticks: true,
    sizeHour: 'normal', sizeMinute: 'normal', sizeSecond: 'normal',
    colors: {
      digital: { hour: '#ff5a5f', minute: '#4cc9f0', second: '#ffd166', sep: '#aaaaaa', bg: '#000000' },
      analog:  { hour: '#ff9f1c', minute: '#2ec4b6', second: '#e71d36', sep: '#aaaaaa', bg: '#0b0b14' }
    }
  };
  var KEY = 'clock-settings-v2';
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function extend(a, b) { for (var k in b) if (b.hasOwnProperty(k)) a[k] = b[k]; return a; }

  var s = clone(DEFAULTS);
  try {
    var saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    extend(s, saved);
    s.colors = {
      digital: extend(clone(DEFAULTS.colors.digital), (saved.colors || {}).digital),
      analog:  extend(clone(DEFAULTS.colors.analog),  (saved.colors || {}).analog)
    };
  } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }

  function $(id) { return document.getElementById(id); }
  var face = $('face'), panel = $('panel'), gear = $('gear');
  var NS = 'http://www.w3.org/2000/svg';
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function col() { return s.colors[s.style]; }
  function each(list, fn) { for (var i = 0; i < list.length; i++) fn(list[i], i); }
  function toggle(node, cls, on) {
    var has = (' ' + node.className + ' ').indexOf(' ' + cls + ' ') > -1;
    if (on && !has) node.className += ' ' + cls;
    if (!on && has) node.className = (' ' + node.className + ' ').replace(' ' + cls + ' ', ' ').replace(/^\s+|\s+$/g, '');
  }

  var hands = null, digits = null, digitalEl = null;

  /* ---------- digital ---------- */
  function buildDigital() {
    face.innerHTML = '';
    var d = digitalEl = document.createElement('div');
    d.className = 'digital';
    d.innerHTML = '<span data-h></span><span data-sep1 class="sep">:</span><span data-m></span>' +
      (s.seconds ? '<span data-sep2 class="sep">:</span><span data-s></span>' : '') +
      '<span class="ampm" data-ap></span>';
    face.appendChild(d);
    function q(a) { return d.querySelector('[' + a + ']'); }
    digits = { h: q('data-h'), m: q('data-m'), s: q('data-s'), ap: q('data-ap'),
               sep1: q('data-sep1'), sep2: q('data-sep2') };
    hands = null;
    applyStyleVars();
  }

  /* ---------- analog ---------- */
  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function buildAnalog() {
    face.innerHTML = '';
    digitalEl = null;
    var wrap = document.createElement('div');
    wrap.className = 'analog';
    var svg = el('svg', { viewBox: '-100 -100 200 200' }, wrap);
    el('circle', { r: 97, fill: 'none', stroke: '#888', 'stroke-width': 1.5 }, svg);
    for (var i = 0; i < 60; i++) {
      var major = i % 5 === 0;
      if (!s.ticks && !major) continue;
      var a = i * 6 * Math.PI / 180, r1 = major ? 84 : 90, r2 = 95;
      el('line', { x1: Math.sin(a) * r1, y1: -Math.cos(a) * r1, x2: Math.sin(a) * r2, y2: -Math.cos(a) * r2,
        stroke: '#aaa', 'stroke-width': major ? 2.5 : 1 }, svg);
    }
    if (s.ticks) for (var n = 1; n <= 12; n++) {
      var b = n * 30 * Math.PI / 180;
      el('text', { x: Math.sin(b) * 70, y: -Math.cos(b) * 70 + 5, 'text-anchor': 'middle',
        'font-size': 14, fill: '#ccc', 'font-weight': 600 }, svg).textContent = n;
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
  function em(k) { return SIZES[k] + 'em'; }
  function applyStyleVars() {
    var c = col();
    document.body.style.background = c.bg;
    document.documentElement.style.background = c.bg;
    document.querySelector('meta[name=theme-color]').setAttribute('content', c.bg);
    if (digits) {
      digits.h.style.color = c.hour;   digits.h.style.fontSize = em(s.sizeHour);
      digits.m.style.color = c.minute; digits.m.style.fontSize = em(s.sizeMinute);
      digits.sep1.style.fontSize = em(s.sizeMinute);
      if (digits.s) {
        digits.s.style.color = c.second; digits.s.style.fontSize = em(s.sizeSecond);
        digits.sep2.style.fontSize = em(s.sizeSecond);
      }
      digits.ap.style.color = c.hour;
      each([digits.sep1, digits.sep2], function (sp) {
        if (!sp) return;
        sp.style.color = c.sep; sp.style.display = s.showSep ? '' : 'none';
      });
      fit();
    }
    if (hands) {
      hands.h.setAttribute('stroke', c.hour);
      hands.m.setAttribute('stroke', c.minute);
      if (hands.s) {
        each(hands.s.querySelectorAll('line'), function (l) { l.setAttribute('stroke', c.second); });
        hands.s.querySelector('circle').setAttribute('fill', c.second);
      }
    }
  }

  var curScale = 1;
  function setScale(k) {
    var t = k === 1 ? '' : 'scale(' + k + ')';
    face.style.transform = t; face.style.webkitTransform = t;
  }
  function fillScale() {            // scale at which the digital clock fills the screen
    setScale(1);
    var r = digitalEl.getBoundingClientRect();
    return Math.min(window.innerWidth * 0.98 / r.width, window.innerHeight * 0.98 / r.height);
  }
  // Auto mode shrinks the digital clock if it would overflow; manual mode uses s.fontScale.
  function fit() {
    setScale(1);
    curScale = 1;
    if (digitalEl) {
      if (s.fontScale) curScale = s.fontScale;
      else {
        var w = digitalEl.getBoundingClientRect().width;
        curScale = Math.min(1, window.innerWidth * 0.96 / w);
      }
      setScale(curScale);
    }
    var zv = $('zoomVal');
    if (zv) zv.textContent = Math.round(curScale * 100) + '%' + (s.fontScale ? '' : ' (auto)');
  }
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', function () { setTimeout(fit, 100); setTimeout(fit, 400); });

  function build() {
    if (s.style === 'analog') buildAnalog(); else buildDigital();
    tick();
    fit();
  }

  /* ---------- ticking ---------- */
  function rot(node, deg) {
    var t = 'rotate(' + deg + ')';
    node.setAttribute('transform', t);
  }
  function tick() {
    var now = new Date();
    var H = now.getHours(), M = now.getMinutes(), S = now.getSeconds(), ms = now.getMilliseconds();
    if (digits) {
      var h = H, ap = '';
      if (!s.h24) { ap = H >= 12 ? 'PM' : 'AM'; h = H % 12 || 12; }
      digits.h.textContent = s.h24 ? pad(h) : h;
      digits.m.textContent = pad(M);
      if (digits.s) digits.s.textContent = pad(S);
      if (digits.ap.textContent !== ap) { digits.ap.textContent = ap; fit(); }
    } else if (hands) {
      var sec = S + ms / 1000, min = M + sec / 60;
      rot(hands.h, ((H % 12) + min / 60) * 30);
      rot(hands.m, min * 6);
      if (hands.s) rot(hands.s, sec * 6);
    }
  }
  var raf = null, timer = null;
  var raf_ = window.requestAnimationFrame || window.webkitRequestAnimationFrame;
  var caf_ = window.cancelAnimationFrame || window.webkitCancelAnimationFrame;
  function loop() {
    tick();
    if (s.style === 'analog' && s.seconds && raf_) raf = raf_(loop);
    else timer = setTimeout(loop, s.style === 'analog' && s.seconds ? 100 : 1000 - (Date.now() % 1000) + 5);
  }
  function restart() { if (raf && caf_) caf_(raf); clearTimeout(timer); raf = null; loop(); }

  /* ---------- settings UI ---------- */
  var SIZE_IDS = ['sizeHour', 'sizeMinute', 'sizeSecond'];
  each(SIZE_IDS, function (id) {
    for (var k in SIZES) {
      var o = document.createElement('option'); o.value = k; o.text = SIZE_LABELS[k];
      $(id).appendChild(o);
    }
  });

  function syncUI() {
    var digital = s.style === 'digital', c = col();
    document.querySelector('input[name=style][value=' + s.style + ']').checked = true;
    $('seconds').checked = s.seconds; $('showSep').checked = s.showSep;
    $('h24').checked = s.h24; $('ticks').checked = s.ticks;
    each(SIZE_IDS, function (id) { $(id).value = s[id]; });
    $('colorHour').value = c.hour; $('colorMinute').value = c.minute;
    $('colorSecond').value = c.second; $('colorSep').value = c.sep; $('colorBg').value = c.bg;
    $('colorLegend').textContent = 'Colors (' + s.style + ')';
    toggle($('sizeSet'), 'dim', !digital);
    toggle($('secSizeRow'), 'dim', !s.seconds);
    toggle($('secColorRow'), 'dim', !s.seconds);
    toggle($('sepRow'), 'dim', !digital);
    toggle($('sepColorRow'), 'dim', !digital || !s.showSep);
    toggle($('h24row'), 'dim', !digital);
    toggle($('tickRow'), 'dim', digital);
  }
  function change(patch, rebuild) {
    extend(s, patch); save(); syncUI();
    if (rebuild) { build(); restart(); } else applyStyleVars();
  }

  each(document.querySelectorAll('input[name=style]'), function (i) {
    i.onchange = function () { change({ style: i.value }, true); };
  });
  $('seconds').onchange = function (e) { change({ seconds: e.target.checked }, true); };
  $('showSep').onchange = function (e) { change({ showSep: e.target.checked }, false); };
  $('h24').onchange = function (e) { change({ h24: e.target.checked }, false); };
  $('ticks').onchange = function (e) { change({ ticks: e.target.checked }, true); };
  each(SIZE_IDS, function (id) {
    $(id).onchange = function (e) { var p = {}; p[id] = e.target.value; change(p, false); };
  });
  function zoomBy(f) {
    if (!digitalEl) return;
    s.fontScale = Math.max(0.05, curScale * f); save(); fit();
  }
  $('zoomIn').onclick = function () { zoomBy(1.15); };
  $('zoomOut').onclick = function () { zoomBy(1 / 1.15); };
  $('zoomFit').onclick = function () {
    if (!digitalEl) return;
    s.fontScale = fillScale(); save(); fit();
  };
  $('zoomAuto').onclick = function () { s.fontScale = null; save(); fit(); };
  var colMap = { colorHour: 'hour', colorMinute: 'minute', colorSecond: 'second', colorSep: 'sep', colorBg: 'bg' };
  each(Object.keys(colMap), function (id) {
    $(id).oninput = function (e) { col()[colMap[id]] = e.target.value; save(); applyStyleVars(); };
  });

  function setPanel(open) { panel.hidden = !open; $('floatDone').hidden = !open; gear.setAttribute('aria-expanded', open); }
  gear.onclick = function () { setPanel(panel.hidden); };
  $('close').onclick = function () { setPanel(false); };
  $('floatDone').onclick = function () { setPanel(false); };
  $('reset').onclick = function () {
    var st = s.style; s = clone(DEFAULTS); s.style = st; save(); syncUI(); build(); restart();
  };
  var root = document.documentElement;
  var reqFs = root.requestFullscreen || root.webkitRequestFullscreen || root.mozRequestFullScreen;
  $('fs').onclick = function () {
    var fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (fsEl) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); }
    else if (reqFs) { try { reqFs.call(root); } catch (e) {} }
    else alert('Fullscreen is not supported in this browser.');
  };
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' || e.keyCode === 27) setPanel(false);
    else if (e.key === '+' || e.key === '=') zoomBy(1.15);
    else if (e.key === '-' || e.key === '_') zoomBy(1 / 1.15);
  });
  face.addEventListener('dblclick', function () { $('fs').onclick(); });

  var idle;
  function wake() {
    toggle(document.body, 'idle', false); clearTimeout(idle);
    idle = setTimeout(function () { if (panel.hidden) toggle(document.body, 'idle', true); }, 4000);
  }
  each(['mousemove', 'touchstart', 'keydown'], function (ev) { window.addEventListener(ev, wake, false); });
  wake();

  // Keep the screen on. Modern browsers: Screen Wake Lock API.
  // Old browsers without it: loop a tiny silent hidden video (needs one tap to start).
  var lock = null, videoOn = false;
  function wakeLock() {
    try {
      if (navigator.wakeLock) {
        var p = navigator.wakeLock.request('screen');
        if (p && p.then) p.then(function (l) { lock = l; }, function () {});
        return;
      }
    } catch (e) {}
    startVideo();
  }
  function startVideo() {
    var v = $('awake');
    if (!v || videoOn) return;
    try {
      var p = v.play();
      if (p && p.then) p.then(function () { videoOn = true; }, function () {});
      else videoOn = true;
    } catch (e) {}
  }
  if (!navigator.wakeLock) {
    var kick = function () { startVideo(); };
    each(['touchstart', 'touchend', 'click', 'mousedown'], function (ev) {
      document.addEventListener(ev, kick, false);
    });
  }
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) { videoOn = false; wakeLock(); restart(); }
  });
  wakeLock();

  syncUI(); build(); restart();
  if ('serviceWorker' in navigator) {
    try { var r = navigator.serviceWorker.register('sw.js'); if (r && r.catch) r.catch(function () {}); } catch (e) {}
  }
})();
