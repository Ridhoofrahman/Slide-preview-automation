/*!
 * Slideshot hero animation — flying slides (Canvas 2D, no dependencies)
 *
 * Usage:
 *   const hero = SlideshotHero.mount(document.getElementById('hero'), { theme: 'pastel' });
 *   // after sign-in succeeds:
 *   hero.destroy();
 *
 * Options: theme 'blue' | 'light' (white slides) | 'pastel' (default 'pastel'), height px (default 160), fps (default 30)
 * API: setTheme(theme), pause(), resume(), destroy()
 */
(function (root) {
  'use strict';

  var C = {
    brand: '#00308D',
    blue: { bg: ['#1A4FC4', '#00277A'] },
    light: { bg: ['#F6F7F9', '#F6F7F9'] },
    pastel: { bg: ['#F6F7F9', '#F6F7F9'] },
    pastels: [
      ['#DCE7FF', '#9DB5EE'], ['#E6E0FF', '#B3A6EC'], ['#D6F1E6', '#8FCDB4'],
      ['#FFE5D6', '#EDB296'], ['#FBDDE8', '#E7A1BB'], ['#FFF1C9', '#E3C878']
    ]
  };
  var MG = 4; // overlap margin

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function back(t) { var c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
  function yOv(a, b, m) { return a.y0 < b.y0 + b.h + m && b.y0 < a.y0 + a.h + m; }
  function ov(a, b, m) { return a.x < b.x + b.w + m && b.x < a.x + a.w + m && yOv(a, b, m); }

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function mount(container, opts) {
    opts = opts || {};
    function pick(t) { return t === 'light' || t === 'blue' ? t : 'pastel'; }
    var theme = pick(opts.theme);
    var H = opts.height || 160;
    var frameMs = 1000 / (opts.fps || 30);

    var canvas = document.createElement('canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Slides flying across');
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = H + 'px';
    container.appendChild(canvas);
    var ctx = canvas.getContext('2d');

    var W = 0, dpr = 1, S = [], T = 0, raf = 0, lastTick = 0, acc = 0;
    var paused = false, destroyed = false;
    var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    var reduce = !!(mq && mq.matches);

    function makeSlide(z) {
      var w = 34 + 54 * z;
      return { z: z, w: w, h: w * 0.5625, v0: 14 + 46 * z, vx: 14 + 46 * z,
        x: -999, y0: 0, vy: 0, ph: rnd(0, 6.28), pal: Math.floor(Math.random() * 6), wait: true, done: false, cs: 0 };
    }
    function live(s) { return !s.wait; }
    function partners(s) {
      var c = 0;
      for (var i = 0; i < S.length; i++) { var o = S[i]; if (o !== s && live(o) && ov(s, o, MG)) c++; }
      return c;
    }
    function tryPlace(s, xMin, xMax) {
      for (var k = 0; k < 12; k++) {
        s.x = rnd(xMin, xMax); s.y0 = rnd(8, H - s.h - 8);
        var ok = true;
        for (var i = 0; i < S.length; i++) { var o = S[i]; if (o !== s && live(o) && ov(s, o, MG + 10)) { ok = false; break; } }
        if (ok) { s.wait = false; s.done = false; s.vx = s.v0; s.vy = 0; return true; }
      }
      s.wait = true; s.x = -999; return false;
    }

    function build() {
      var n = Math.max(8, Math.min(22, Math.round(12 * W / 340)));
      S = [];
      for (var i = 0; i < n; i++) S.push(makeSlide(Math.pow(Math.random(), 0.8) * 0.7 + 0.3));
      S.sort(function (a, b) { return a.z - b.z; });
      S.forEach(function (s) { tryPlace(s, -s.w, W - 20); });
      T = 0;
      for (var j = 0; j < 300; j++) step(0.05); // pre-warm so the first frame is already populated
    }

    function smooth(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }

    // Water-like motion: slides glide on eased velocities. When a faster slide
    // approaches one it may not overlap, it is gently slowed and drifted aside
    // by a soft force that grows with proximity, then damped like drag in water.
    var LOOK = 70, DRAG = 2.2, PUSH = 26;
    function step(dt) {
      T += dt;
      var P = new Map();
      S.forEach(function (s) { P.set(s, live(s) ? partners(s) : 0); });
      var order = S.filter(live).sort(function (a, b) { return b.x - a.x; });
      order.forEach(function (s) {
        var tv = s.v0, fy = 0;
        order.forEach(function (o) {
          if (o === s || o.x < s.x || ov(s, o, MG)) return;
          if (!yOv(s, o, MG + 10)) return;
          var gap = o.x - (s.x + s.w);
          if (gap > LOOK || s.v0 <= o.vx) return;
          if (P.get(s) === 0 && P.get(o) === 0 && yOv(s, o, MG)) { P.set(s, 1); P.set(o, 1); return; }
          var k = smooth(1 - gap / LOOK);
          tv = Math.min(tv, s.v0 + (o.vx - s.v0) * k);
          var dir = (s.y0 + s.h / 2) < (o.y0 + o.h / 2) ? -1 : 1;
          if (s.y0 < 12) dir = 1; else if (s.y0 + s.h > H - 12) dir = -1;
          fy += dir * PUSH * k;
        });
        // keep a soft vertical cushion from slides it must not overlap
        S.forEach(function (o) {
          if (o === s || !live(o) || ov(s, o, MG)) return;
          if (!(s.x < o.x + o.w + MG && o.x < s.x + s.w + MG)) return;
          if (P.get(s) === 0 && P.get(o) === 0) return;
          var vg = s.y0 > o.y0 ? s.y0 - (o.y0 + o.h) : o.y0 - (s.y0 + s.h);
          if (vg < 14) fy += (s.y0 > o.y0 ? 1 : -1) * PUSH * smooth(1 - vg / 14);
        });
        // last-resort braking, still eased, so a blocked slide never pushes in
        var brake = false;
        order.forEach(function (o) {
          if (o === s || o.x < s.x || ov(s, o, MG) || !yOv(s, o, MG)) return;
          if (P.get(s) === 0 && P.get(o) === 0) return;
          if (o.x - (s.x + s.w) < 8 && o.vx < tv) { tv = o.vx; brake = true; }
        });
        // soft walls
        if (s.y0 < 10) fy += (10 - s.y0) * 4;
        if (s.y0 + s.h > H - 10) fy -= (s.y0 + s.h - (H - 10)) * 4;
        s.vy += (fy - s.vy * DRAG) * dt;
        s.vx += (tv - s.vx) * Math.min(1, dt * (brake ? 5 : 1.6));
        s.x += s.vx * dt;
        s.y0 += s.vy * dt;
        if (!s.done && s.z > 0.6 && s.x + s.w / 2 > W * 0.6) { s.done = true; s.cs = T; }
        if (s.x > W + 10) { s.wait = true; s.x = -999; }
      });
      S.forEach(function (s) { if (s.wait && Math.random() < dt * 1.6) tryPlace(s, -s.w - 30, -s.w - 2); });
    }

    function drawSlide(s) {
      var b = theme === 'blue', w = s.w, h = s.h;
      var y = s.y0 + Math.sin(T * 0.7 + s.ph) * 1.4 * s.z + Math.sin(T * 0.31 + s.ph * 2) * 1.1;
      var tilt = Math.max(-5, Math.min(5, s.vy * 0.35));
      var r = (Math.sin(T * 0.45 + s.ph) * 3.5 * (1.1 - s.z) - 1.5 + tilt) * Math.PI / 180;
      var op = 0.25 + 0.75 * s.z;

      var pal = C.pastels[s.pal];
      ctx.save();
      ctx.globalAlpha = b ? op * 0.9 : 0.55 + 0.45 * s.z;
      ctx.translate(s.x + w / 2, y + h / 2);
      ctx.rotate(r);
      ctx.translate(-w / 2, -h / 2);

      rr(ctx, 0, 0, w, h, w * 0.08);
      if (b) { ctx.fillStyle = '#FFFFFF'; ctx.fill(); }
      else if (theme === 'light') {
        ctx.fillStyle = '#FFFFFF'; ctx.fill();
        ctx.lineWidth = 1; ctx.strokeStyle = '#E1E5EC'; ctx.stroke();
      } else { ctx.fillStyle = pal[0]; ctx.fill(); }

      var a = ctx.globalAlpha;
      ctx.globalAlpha = a * (b ? 0.18 : theme === 'light' ? 0.9 : 0.75);
      ctx.fillStyle = b ? C.brand : theme === 'light' ? '#E3E7EF' : pal[1];
      rr(ctx, w * 0.1, h * 0.18, w * 0.42, Math.max(2, h * 0.1), h * 0.05); ctx.fill();
      rr(ctx, w * 0.1, h * 0.38, w * 0.62, Math.max(1.5, h * 0.07), h * 0.035); ctx.fill();
      rr(ctx, w * 0.1, h * 0.52, w * 0.36, Math.max(1.5, h * 0.07), h * 0.035); ctx.fill();
      ctx.globalAlpha = a;

      if (s.done) {
        var k = back(Math.min(1, (T - s.cs) / 0.4));
        ctx.translate(w * 0.82, h * 0.78);
        ctx.scale(k, k);
        ctx.beginPath(); ctx.arc(0, 0, w * 0.11, 0, Math.PI * 2);
        ctx.globalAlpha = 1; ctx.fillStyle = C.brand; ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-w * 0.05, 0); ctx.lineTo(-w * 0.015, w * 0.035); ctx.lineTo(w * 0.055, -w * 0.04);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = Math.max(1.4, w * 0.028); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.stroke();
      }
      ctx.restore();
    }

    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var bg = ctx.createLinearGradient(0, 0, W, H), c = C[theme].bg;
      bg.addColorStop(0, c[0]); bg.addColorStop(1, c[1]);
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      for (var i = 0; i < S.length; i++) if (!S[i].wait) drawSlide(S[i]);
    }

    function tick(now) {
      if (destroyed) return;
      raf = requestAnimationFrame(tick);
      if (!lastTick) lastTick = now;
      var el = now - lastTick; lastTick = now;
      acc += el;
      if (acc < frameMs) return;
      var dt = Math.min(0.1, acc / 1000); acc = 0;
      step(dt); draw();
    }
    function start() {
      if (destroyed || reduce || paused || raf || document.hidden) return;
      lastTick = 0; acc = 0; raf = requestAnimationFrame(tick);
    }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

    function resize() {
      var nw = Math.round(container.clientWidth);
      if (!nw) return;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      var rebuild = Math.abs(nw - W) > 24 || !S.length;
      W = nw;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      if (rebuild) build();
      draw();
    }

    function onVis() { if (document.hidden) stop(); else start(); }
    function onMotion(e) { reduce = e.matches; if (reduce) { stop(); draw(); } else start(); }

    var ro = window.ResizeObserver ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(container); else window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVis);
    if (mq) { if (mq.addEventListener) mq.addEventListener('change', onMotion); else if (mq.addListener) mq.addListener(onMotion); }

    resize();
    start();

    return {
      setTheme: function (t) { theme = pick(t); draw(); },
      pause: function () { paused = true; stop(); },
      resume: function () { paused = false; start(); },
      destroy: function () {
        destroyed = true; stop();
        if (ro) ro.disconnect(); else window.removeEventListener('resize', resize);
        document.removeEventListener('visibilitychange', onVis);
        if (mq) { if (mq.removeEventListener) mq.removeEventListener('change', onMotion); else if (mq.removeListener) mq.removeListener(onMotion); }
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        S = [];
      }
    };
  }

  var api = { mount: mount };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SlideshotHero = api;
})(typeof window !== 'undefined' ? window : this);
