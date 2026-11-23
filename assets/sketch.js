/* sketch.js — hand-drawn pencil sketches for blog posts.
   A post places <figure class="sketch" data-sketch="NAME"><figcaption>…</figcaption></figure>
   and this file draws the matching sketch as inline SVG (so it follows light/dark mode
   and uses the handwriting font). Seeded jitter: the same sketch looks the same every visit. */
(function () {
  'use strict';
  var figs = document.querySelectorAll('figure.sketch[data-sketch]');
  if (!figs.length) return;

  /* ---------- pencil primitives ---------- */
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var r = rng(11);
  function j(a) { return (r() - .5) * 2 * a; }
  function f(n) { return Math.round(n * 10) / 10; }
  function st(x1, y1, x2, y2, a) {
    var dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len, bow = j(a) + len * .004 * j(1);
    var ax = x1 + j(a * .6), ay = y1 + j(a * .6), bx = x2 + j(a * .6), by = y2 + j(a * .6);
    return 'M' + f(ax) + ' ' + f(ay) + 'Q' + f((ax + bx) / 2 + nx * bow) + ' ' + f((ay + by) / 2 + ny * bow) + ' ' + f(bx) + ' ' + f(by);
  }
  function L(x1, y1, x2, y2, a) { a = a == null ? 1.1 : a; return st(x1, y1, x2, y2, a) + st(x1, y1, x2, y2, a); }
  function R(x, y, w, h, a) { var o = 2; return L(x - o, y, x + w + o, y, a) + L(x + w, y - o, x + w, y + h + o, a) + L(x + w + o, y + h, x - o, y + h, a) + L(x, y + h + o, x, y - o, a); }
  function E(cx, cy, rx, ry, a, from, to) {
    a = a == null ? .7 : a; from = from || 0; to = to || Math.PI * 2.08;
    var d = '', n = 24, s = r() * .4;
    for (var i = 0; i <= n; i++) { var t = from + s + (to - from) * i / n; d += (i ? 'L' : 'M') + f(cx + Math.cos(t) * (rx + j(a))) + ' ' + f(cy + Math.sin(t) * (ry + j(a))); }
    return d;
  }
  function P(d, cls) { return '<path class="' + (cls || 'sk-ink') + '" d="' + d + '"/>'; }
  function T(x, y, s, cls, anchor) { return '<text class="' + (cls || 'sk-note') + '" x="' + x + '" y="' + y + '"' + (anchor ? ' text-anchor="' + anchor + '"' : '') + '>' + s + '</text>'; }
  function arrow(x1, y1, x2, y2, cls) {                 // curved hand-drawn arrow with a head
    var mx = (x1 + x2) / 2 + (y2 - y1) * .18, my = (y1 + y2) / 2 - (x2 - x1) * .18;
    var ang = Math.atan2(y2 - my, x2 - mx), h = 8;
    var d = 'M' + f(x1) + ' ' + f(y1) + 'Q' + f(mx) + ' ' + f(my) + ' ' + f(x2) + ' ' + f(y2) +
      st(x2, y2, x2 - h * Math.cos(ang - .45), y2 - h * Math.sin(ang - .45), .3) + st(x2, y2, x2 - h * Math.cos(ang + .45), y2 - h * Math.sin(ang + .45), .3);
    return P(d, cls || 'sk-ink soft');
  }

  /* ---------- little things that appear in several sketches ---------- */
  function person(x, y, s, o) {                         // standing stick figure, feet at (x,y)
    o = o || {}; s = s || 1;
    var hy = y - 62 * s, d = E(x, hy, 8 * s, 8.5 * s, .5) + L(x, hy + 9 * s, x, y - 26 * s, .7) +
      L(x, y - 26 * s, x - 9 * s, y, .6) + L(x, y - 26 * s, x + 9 * s, y, .6);
    if (o.arms === 'phone') d += L(x, hy + 18 * s, x + 12 * s, hy + 30 * s, .5) + L(x + 12 * s, hy + 30 * s, x + 6 * s, hy + 16 * s, .5) + R(x + 3 * s, hy + 10 * s, 6 * s, 9 * s, .3);
    else if (o.arms === 'up') d += L(x, hy + 18 * s, x + 16 * s, hy - 2 * s, .5) + L(x, hy + 18 * s, x - 13 * s, hy + 30 * s, .5);
    else if (o.arms === 'clip') d += L(x, hy + 18 * s, x + 14 * s, hy + 26 * s, .5) + L(x, hy + 18 * s, x - 12 * s, hy + 30 * s, .5) + R(x + 12 * s, hy + 16 * s, 14 * s, 18 * s, .4);
    else d += L(x, hy + 18 * s, x - 12 * s, hy + 32 * s, .5) + L(x, hy + 18 * s, x + 12 * s, hy + 32 * s, .5);
    return P(d);
  }
  function umbrella(x, y) { return P(E(x, y, 34, 18, .7, Math.PI, Math.PI * 2) + L(x - 34, y, x + 34, y, .6) + L(x, y - 18, x, y + 34, .5)); }
  function car(x, y, w) {
    w = w || 120;
    return P(R(x, y, w, 30, 1) + L(x + w * .2, y, x + w * .32, y - 22, .8) + L(x + w * .32, y - 22, x + w * .72, y - 22, .8) + L(x + w * .72, y - 22, x + w * .84, y, .8)) +
      P(E(x + w * .22, y + 32, 11, 11, .5) + E(x + w * .78, y + 32, 11, 11, .5));
  }
  function pole(x, base, top, walk) {                  // the smart pole: ring display + camera
    var d = L(x - 6, top + 28, x - 6, base, .8) + L(x + 6, top + 28, x + 6, base, .8) + E(x, base + 2, 18, 4, .4) +
      R(x - 9, top - 22, 18, 22, .5) + E(x - 2, top - 13, 4, 4, .3);
    var ring = '<rect class="sk-ring" x="' + (x - 34) + '" y="' + top + '" width="68" height="22" rx="4"/>' + P(R(x - 34, top, 68, 22, .7));
    return P(d) + ring + T(x, top + 16, walk === false ? 'STOP' : 'WALK', 'sk-led' + (walk === false ? ' stop' : ''), 'middle');
  }

  /* ---------- the sketches ---------- */
  var S = {};

  S.who = function () {      // 1. who and where
    var h = P(L(20, 230, 620, 230, 1.2) + L(20, 236, 620, 236, .5), 'sk-ink soft');
    h += P(E(560, 50, 18, 18, .6, -1.2, 2.1) + E(553, 46, 14, 15, .5, -1.1, 2.0), 'sk-ink soft');   // moon
    for (var i = 0; i < 14; i++) { var x = 40 + r() * 560, y = 20 + r() * 150; h += P(st(x, y, x - 6, y + 14, .2), 'sk-ink faint'); } // rain
    h += umbrella(175, 140) + person(175, 230, 1.05, { arms: 'phone' });
    h += car(380, 190, 140) + P(st(522, 196, 610, 180, .6) + st(522, 206, 610, 214, .6), 'sk-accent');   // headlights
    h += T(60, 120, 'night, rain') + arrow(110, 128, 150, 150);
    h += T(235, 102, 'phone in hand,') + T(235, 124, 'in a hurry') + arrow(232, 118, 196, 158);
    h += T(395, 120, 'a car that may') + T(395, 142, 'or may not stop') + arrow(400, 148, 440, 165);
    h += T(320, 272, 'design for this moment, not for a desk', 'sk-note big', 'middle');
    return h;
  };

  S.question = function () { // 2. one question per prototype
    var h = '';
    h += P(R(70, 120, 120, 90, 1.1) + L(70, 120, 100, 96, .8) + L(190, 120, 220, 96, .8) + L(100, 96, 220, 96, .8) + L(220, 96, 220, 186, .8) + L(190, 210, 220, 186, .8)); // cardboard box
    h += P(R(92, 142, 74, 26, .6), 'sk-accent') + T(129, 160, 'WALK', 'sk-led', 'middle');
    h += T(130, 238, 'a cardboard prototype', 'sk-note', 'middle');
    h += P(L(200, 150, 470, 150, .8) + L(200, 142, 200, 158, .4) + L(470, 142, 470, 158, .4), 'sk-ink soft') + T(335, 140, '10 m', 'sk-note', 'middle');
    h += P(E(500, 150, 26, 14, .5) + E(500, 150, 7, 7, .3));   // eye
    h += P(R(330, 40, 266, 56, .8), 'sk-accent') + T(463, 63, 'Q: can people read it', 'sk-note', 'middle') + T(463, 86, 'from 10 m, in daylight?', 'sk-note', 'middle');
    h += arrow(330, 70, 200, 110);
    h += T(470, 214, 'one question →', 'sk-note', 'middle') + T(470, 238, 'one clear answer', 'sk-note', 'middle');
    return h;
  };

  S.fidelity = function () { // 3. the fidelity ladder
    var h = '', steps = [['napkin', 'minutes'], ['paper / card', 'an hour'], ['3D print / foam', 'days'], ['working', 'weeks']];
    for (var i = 0; i < 4; i++) {
      var x = 40 + i * 145, y = 236 - i * 40;
      h += P(L(x, y, x + 140, y, 1) + L(x + 140, y, x + 140, y - 40, .8));
      h += T(x + 70, y - 12, steps[i][0], 'sk-note', 'middle') + T(x + 70, y + 20, steps[i][1], 'sk-note small', 'middle');
    }
    h += arrow(60, 120, 300, 60, 'sk-accent') + T(40, 148, 'cost and time to change ↑', 'sk-note');
    h += T(612, 286, 'freedom to throw it away ↓', 'sk-note', 'end');
    return h;
  };

  S.signal = function () {   // 4. what it signals, and to whom
    var h = pole(320, 250, 70, true);
    h += P(st(286, 82, 120, 170, .5) + st(354, 82, 520, 170, .5) + st(320, 94, 320, 120, .3), 'sk-accent');   // sightlines
    h += person(110, 250, .9) + person(530, 250, .9, { arms: 'up' });
    h += P(L(20, 250, 620, 250, 1), 'sk-ink soft');
    h += T(110, 138, 'from the side?', 'sk-note', 'middle') + T(530, 138, 'from behind?', 'sk-note', 'middle');
    h += T(420, 40, 'what does green mean here?', 'sk-note') + arrow(418, 46, 362, 70);
    h += T(40, 40, 'one clear message,', 'sk-note') + T(40, 62, 'readable at a glance', 'sk-note');
    return h;
  };

  S.constraints = function () { // 5. constraints around the idea
    var h = P(E(320, 150, 70, 48, .9)) + T(320, 156, 'the idea', 'sk-note big', 'middle');
    var c = [['size', 150, 50], ['power', 490, 50], ['rain, sun, heat', 110, 160], ['cost', 530, 160], ['safety', 170, 262], ['accessibility', 470, 262]];
    c.forEach(function (k) {
      h += P(R(k[1] - 62, k[2] - 20, 124, 32, .6), 'sk-ink soft') + T(k[1], k[2] + 2, k[0], 'sk-note', 'middle');
      var dx = 320 - k[1], dy = 150 - k[2], len = Math.hypot(dx, dy);
      h += arrow(k[1] + dx * 64 / len, k[2] + dy * 26 / Math.abs(dy || 1) * .9, 320 - dx * 74 / len, 150 - dy * 50 / len);
    });
    return h;
  };

  S.test = function () {     // 6. how you will know it works
    var h = P(L(20, 240, 620, 240, 1), 'sk-ink soft');
    for (var y = 182; y < 238; y += 12) h += P(R(250, y, 140, 6, .4), 'sk-ink faint');      // crosswalk
    h += person(230, 240, 1) + pole(430, 240, 92, true);
    h += person(560, 240, .95, { arms: 'clip' }) + P(E(600, 150, 14, 14, .5) + L(600, 150, 606, 142, .3) + L(600, 132, 600, 136, .3));   // observer + stopwatch
    h += T(60, 62, 'participant:', 'sk-note') + T(60, 84, '“when do I go?”', 'sk-note');
    h += T(470, 40, 'measure: time to decide,', 'sk-note') + T(470, 62, 'errors, confidence', 'sk-note');
    h += arrow(540, 70, 580, 118);
    h += T(320, 285, 'decide what you will measure before you build', 'sk-note big', 'middle');
    return h;
  };

  S.triangle = function () { // Houde & Hill: what do prototypes prototype?
    var a = [320, 34], b = [110, 250], c = [530, 250];
    var h = P(L(a[0], a[1], b[0], b[1], 1) + L(b[0], b[1], c[0], c[1], 1) + L(c[0], c[1], a[0], a[1], 1));
    h += T(320, 24, 'role', 'sk-note big', 'middle') + T(110, 282, 'look and feel', 'sk-note big', 'middle') + T(530, 282, 'implementation', 'sk-note big', 'middle');
    h += T(352, 30, '(what it does for someone)', 'sk-note small');
    var dots = [[300, 110, 'storyboard'], [190, 214, 'foam model'], [420, 214, 'circuit test'], [330, 180, 'working pole']];
    dots.forEach(function (d) { h += P(E(d[0], d[1], 6, 6, .4), 'sk-accent') + T(d[0] + 12, d[1] + 6, d[2], 'sk-note small'); });
    return h;
  };

  figs.forEach(function (fig) {
    var fn = S[fig.getAttribute('data-sketch')];
    if (!fn) return;
    r = rng(fig.getAttribute('data-sketch').length * 97 + 7);
    var label = (fig.querySelector('figcaption') || {}).textContent || 'Sketch';
    fig.insertAdjacentHTML('afterbegin', '<svg viewBox="0 0 640 300" role="img" aria-label="' + label.replace(/"/g, '&quot;') + '">' + fn() + '</svg>');
  });
})();
