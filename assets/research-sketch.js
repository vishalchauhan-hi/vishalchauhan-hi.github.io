/* research-sketch.js — the three pencil scenes in the Research circles.
   01 a self-driving car signals to a pedestrian, 02 a delivery robot makes room,
   03 the smart pole coordinates a crossing. Each line is drawn three slightly
   different ways and they swap every 150 ms, like a hand-drawn flip book.
   Runs only while a circle is on screen; visitors who turn off motion see one
   still frame. Without JavaScript the original drawings in index.html stay. */

(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var f = function (n) { return (Math.round(n * 10) / 10).toString(); };
  function R(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // ---- pencil primitives (each call draws slightly differently) ----
  function pencil(r) {
    var j = function (a) { return (r() - 0.5) * 2 * a; };
    function seg(x1, y1, x2, y2, a) {
      a = a == null ? 0.7 : a;
      var dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
      var o1 = r() * Math.min(1.4, L * 0.08), o2 = r() * Math.min(1.8, L * 0.1);
      var sx = x1 - ux * o1 + j(a * 0.4), sy = y1 - uy * o1 + j(a * 0.4);
      var ex = x2 + ux * o2 + j(a * 0.4), ey = y2 + uy * o2 + j(a * 0.4);
      var bow = j(a) * Math.min(1, L / 30);
      var mx = (sx + ex) / 2 - uy * bow, my = (sy + ey) / 2 + ux * bow;
      return 'M' + f(sx) + ' ' + f(sy) + 'Q' + f(mx) + ' ' + f(my) + ' ' + f(ex) + ' ' + f(ey);
    }
    function line(x1, y1, x2, y2, a) { return seg(x1, y1, x2, y2, a) + seg(x1, y1, x2, y2, (a == null ? 0.7 : a) * 0.7); }
    function poly(pts, closed, a) {
      var d = '', n = pts.length;
      for (var i = 0; i < n - 1; i++) d += seg(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], a);
      if (closed) d += seg(pts[n - 1][0], pts[n - 1][1], pts[0][0], pts[0][1], a);
      return d;
    }
    function ell(cx, cy, rx, ry, a, turns) {
      a = a == null ? 0.5 : a;
      var n = 20, st = r() * 6.28, sweep = 6.283 * (turns || 1.08), pts = [], d = '';
      for (var k = 0; k <= n; k++) {
        var t = st + sweep * k / n, rr = 1 + j(Math.min(0.05, 1.4 / Math.max(rx, ry)));
        pts.push([cx + rx * rr * Math.cos(t) + j(a * 0.3), cy + ry * rr * Math.sin(t) + j(a * 0.3)]);
      }
      d = 'M' + f(pts[0][0]) + ' ' + f(pts[0][1]);
      for (k = 1; k < pts.length - 1; k++) {
        var p = pts[k], q = pts[k + 1];
        d += 'Q' + f(p[0]) + ' ' + f(p[1]) + ' ' + f((p[0] + q[0]) / 2) + ' ' + f((p[1] + q[1]) / 2);
      }
      return d;
    }
    function arc(cx, cy, rad, a0, a1, a) {
      var n = 8, pts = [];
      for (var k = 0; k <= n; k++) { var t = a0 + (a1 - a0) * k / n; pts.push([cx + rad * Math.cos(t) + j(0.3), cy + rad * Math.sin(t) + j(0.3)]); }
      var d = 'M' + f(pts[0][0]) + ' ' + f(pts[0][1]);
      for (k = 1; k < n; k++) d += 'Q' + f(pts[k][0]) + ' ' + f(pts[k][1]) + ' ' + f((pts[k][0] + pts[k + 1][0]) / 2) + ' ' + f((pts[k][1] + pts[k + 1][1]) / 2);
      return d + 'L' + f(pts[n][0]) + ' ' + f(pts[n][1]);
    }
    // diagonal pencil hatching inside a box
    function hatch(x, y, w, h, step) {
      var d = '';
      for (var s = step * r(); s < w + h; s += step) {
        var c = x + s;
        var ax = Math.min(c, x + w), ay = y + Math.max(0, c - (x + w));
        var bx = Math.max(c - h, x), by = y + Math.min(h, c - x);
        if (Math.hypot(bx - ax, by - ay) > 1.5) d += seg(ax, ay, bx, by, 0.4);
      }
      return d;
    }
    return { seg: seg, line: line, poly: poly, ell: ell, arc: arc, hatch: hatch, j: j };
  }

  // ---- a scene: builds pencil parts once (3 versions each) and swaps them ("boil") ----
  function Scene(svg, seed, zoom, cy) {
    zoom = zoom || 1; cy = cy || 100;
    this.svg = svg; this.parts = []; this.v = 0;
    this.P = [0, 1, 2].map(function (k) { return pencil(R(seed * 977 + k * 7919)); });
    var id = 'clip-' + seed;
    var defs = el('defs', svg);
    var cp = el('clipPath', defs, { id: id });
    el('circle', cp, { cx: 100, cy: 100, r: 91 });
    // zoom into the street so people and vehicles read clearly in the circle
    this.world = el('g', el('g', svg, { 'clip-path': 'url(#' + id + ')' }), { transform: 'translate(100 100) scale(' + zoom + ') translate(-100 -' + cy + ')' });
    this.top = el('g', svg);
    var me = this;
    this.ink(this.top, function (P) { return P.ell(100, 100, 92, 92, 0.8, 1.06); });
  }
  function el(name, parent, attrs) {
    var n = document.createElementNS(NS, name);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  Scene.prototype.g = function (parent, cls) { return el('g', parent || this.world, cls ? { 'class': cls } : null); };
  Scene.prototype.ink = function (parent, build, cls) {
    var vars = this.P.map(build);
    var p = el('path', parent || this.world, { d: vars[0], pathLength: 1, 'class': 'sk-ink' + (cls ? ' ' + cls : '') });
    this.parts.push({ p: p, vars: vars });
    return p;
  };
  Scene.prototype.text = function (parent, x, y, s, cls, size) {
    var t = el('text', parent, { x: x, y: y, 'class': 'sk-hand' + (cls ? ' ' + cls : ''), 'text-anchor': 'middle' });
    if (size) t.style.fontSize = size + 'px';
    t.textContent = s; return t;
  };
  Scene.prototype.boil = function () {
    this.v = (this.v + 1) % 3; var v = this.v;
    for (var i = 0; i < this.parts.length; i++) this.parts[i].p.setAttribute('d', this.parts[i].vars[v]);
  };

  // ---- helpers for motion ----
  var clamp = function (x) { return x < 0 ? 0 : x > 1 ? 1 : x; };
  var span = function (t, a, b) { return clamp((t - a) / (b - a)); };
  var ease = function (x) { return x * x * (3 - 2 * x); };
  var outQ = function (x) { return 1 - (1 - x) * (1 - x); };
  var inQ = function (x) { return x * x; };
  var bump = function (t, a, b, e) { e = e || 0.4; return Math.min(ease(span(t, a, a + e)), 1 - ease(span(t, b - e, b))); };
  function put(g, x, y, s, rot) { g.setAttribute('transform', 'translate(' + f(x) + ' ' + f(y) + ')' + (s != null && s !== 1 ? ' scale(' + s.toFixed(3) + ')' : '') + (rot ? ' rotate(' + f(rot) + ')' : '')); }
  function rotAt(g, deg) { g.setAttribute('transform', 'rotate(' + f(deg) + ')'); }
  function show(n, o) { n.style.opacity = o.toFixed(2); }

  // ---- shared figures ----
  function person(S, parent, opts) {
    opts = opts || {};
    var g = S.g(parent, 'sk-dark');
    S.ink(g, function (P) { return P.ell(0, -32, 5.6, 6, 0.4); });
    S.ink(g, function (P) { return P.line(0, -26, 0.4, -13, 0.4); });
    if (opts.hair) S.ink(g, function (P) { return P.seg(-5.6, -34, -1, -38.8, 0.3) + P.seg(-1, -38.8, 5.4, -35, 0.3); }, 'sk-soft');
    var face = face6(g);
    var legA = S.g(el('g', g, { transform: 'translate(0.4 -13)' }));
    var legB = S.g(el('g', g, { transform: 'translate(0.4 -13)' }));
    S.ink(legA, function (P) { return P.seg(0, 0, -0.8, 13, 0.3); });
    S.ink(legB, function (P) { return P.seg(0, 0, 0.8, 13, 0.3); });
    var armA = S.g(el('g', g, { transform: 'translate(0 -23)' }));
    var armB = S.g(el('g', g, { transform: 'translate(0 -23)' }));
    S.ink(armA, function (P) { return P.seg(0, 0, -4, 9, 0.3); });
    S.ink(armB, function (P) { return P.seg(0, 0, 4, 9, 0.3); });
    if (opts.cup) S.ink(armB, function (P) { return P.poly([[2.6, 9], [6.6, 9], [6, 14], [3.2, 14]], true, 0.2); }, 'sk-gold');
    if (opts.bag) S.ink(armA, function (P) { return P.poly([[-6.5, 8], [-1.5, 8], [-1.5, 14], [-6.5, 14]], true, 0.2); }, 'sk-soft');
    return { g: g, legA: legA, legB: legB, armA: armA, armB: armB, mood: face.mood, blink: face.blink };
  }

  // a small face: eyes that blink, and a mood (flat, worried, oh, happy)
  function face6(parent) {
    var f6 = el('g', parent, { transform: 'translate(0.6 -32)', 'class': 'sk-face' });
    var eyes = el('g', f6);
    el('circle', eyes, { cx: -2, cy: -0.6, r: 0.8, 'class': 'sk-fill' });
    el('circle', eyes, { cx: 2, cy: -0.6, r: 0.8, 'class': 'sk-fill' });
    var parts = {
      worried: [el('path', f6, { d: 'M-3.4 -2.4L-1 -3.5M3.4 -2.4L1 -3.5' }), el('path', f6, { d: 'M-1.9 3Q0 1.5 1.9 3' }),
                el('path', f6, { d: 'M5.2 -4.6q-1.1 1.7 0 2.3q1.1-.6 0-2.3', 'class': 'sk-drop' })],
      oh: [el('path', f6, { d: 'M-3.2 -3.3L-1 -3.6M3.2 -3.3L1 -3.6' }), el('circle', f6, { cx: 0, cy: 2.3, r: 1 })],
      happy: [el('path', f6, { d: 'M-2.4 1.4Q0 4 2.4 1.4' }),
              el('ellipse', f6, { cx: -3.4, cy: 1, rx: 1, ry: 0.55, 'class': 'sk-blush' }), el('ellipse', f6, { cx: 3.4, cy: 1, rx: 1, ry: 0.55, 'class': 'sk-blush' })],
      flat: [el('path', f6, { d: 'M-1.5 2.2L1.5 2.2' })]
    };
    var cur = '';
    function mood(m) {
      if (m === cur) return; cur = m;
      for (var k in parts) parts[k].forEach(function (n) { n.style.display = k === m ? '' : 'none'; });
    }
    function blink(t) {
      var b = (t % 3.1) < 0.12;
      eyes.setAttribute('transform', b ? 'scale(1 0.15)' : '');
    }
    mood('flat');
    return { mood: mood, blink: blink };
  }
  function walkPose(p, phase, amt) {
    var s = Math.sin(phase) * 24 * amt;
    rotAt(p.legA, s); rotAt(p.legB, -s);
    rotAt(p.armA, -s * 0.7);
  }

  function car(S, parent) {
    var g = S.g(parent);
    var body = S.g(g, 'sk-dark');
    S.ink(body, function (P) { return P.poly([[-58, -7], [-58, -16], [-50, -19], [-41, -30], [-17, -30], [-7, -19], [0, -16], [0, -7]], true, 0.6); });
    S.ink(body, function (P) { return P.poly([[-38.5, -27], [-30, -27], [-30, -20.5], [-44, -20.5]], true, 0.35); }, 'sk-soft');
    S.ink(body, function (P) { return P.poly([[-27, -27], [-19, -27], [-11.5, -20.5], [-27, -20.5]], true, 0.35); }, 'sk-soft');
    S.ink(body, function (P) { return P.seg(-29, -19, -29, -8, 0.3); }, 'sk-faint');
    S.ink(body, function (P) { return P.ell(-2.6, -12.5, 1.6, 2.2, 0.2); });
    // roof sensor
    S.ink(body, function (P) { return P.poly([[-32, -30], [-32, -33], [-25, -33], [-25, -30]], false, 0.2); }, 'sk-soft');
    // eyes in the windscreen
    var eyes = S.g(body);
    el('circle', eyes, { cx: -22, cy: -23.6, r: 1.15, 'class': 'sk-fill' });
    el('circle', eyes, { cx: -17.2, cy: -23.6, r: 1.15, 'class': 'sk-fill' });
    // eHMI light bar along the roof
    var bar = S.ink(g, function (P) { return P.seg(-40, -31.6, -17, -31.6, 0.25); }, 'sk-sig sk-late');
    var wheels = [-46, -12].map(function (x) {
      var w = el('g', g, { transform: 'translate(' + x + ' -6)' });
      var spin = S.g(w, 'sk-dark');
      el('circle', w, { cx: 0, cy: 0, r: 5.6, fill: 'var(--paper)' }).parentNode.insertBefore(w.lastChild, spin);
      S.ink(spin, function (P) { return P.ell(0, 0, 5.8, 5.8, 0.3); });
      S.ink(spin, function (P) { return P.seg(-2.6, 0, 2.6, 0, 0.1) + P.seg(0, -2.6, 0, 2.6, 0.1); }, 'sk-soft');
      return spin;
    });
    return { g: g, body: body, eyes: eyes, bar: bar, wheels: wheels };
  }

  // ================= 01 · Autonomous mobility =================
  function mobility(svg) {
    var S = new Scene(svg, 11, 1.32, 112), W = S.world, L = 7.8;
    var bg = S.g(W);
    // tree + far pavement
    S.ink(bg, function (P) { return P.line(42, 110, 43, 82, 0.5); }, 'sk-soft');
    S.ink(bg, function (P) { return P.ell(43, 70, 15, 13, 1.4, 1.5); }, 'sk-soft');
    S.ink(bg, function (P) { return P.ell(170, 52, 8, 8, 0.6, 1.1); }, 'sk-gold sk-faint');
    S.ink(bg, function (P) { return P.line(0, 110, 200, 110, 0.6); });
    S.ink(bg, function (P) { return P.line(0, 153, 200, 153, 0.6); });
    for (var i = 0; i < 5; i++) (function (i) {
      var y = 114 + i * 7.6, x0 = 124 + i * 1.4, x1 = 150 + i * 2.6;
      S.ink(bg, function (P) { return P.poly([[x0, y], [x1, y], [x1 + 1.4, y + 4], [x0 + 1.4, y + 4]], true, 0.3) + P.hatch(x0 + 1, y + 0.6, x1 - x0 - 1, 3, 3.2); }, 'sk-faint');
    })(i);
    S.ink(bg, function (P) { return P.seg(10, 132, 30, 132, 0.2) + P.seg(60, 132, 80, 132, 0.2); }, 'sk-faint');

    // pedestrian on far kerb
    var pedG = S.g(W);
    var ped = person(S, pedG, { hair: true, bag: true });
    var ask = S.g(pedG, 'sk-dark'), yes = S.g(pedG, 'sk-go');
    S.ink(ask, function (P) { return P.ell(12, -47, 10, 7.5, 0.5, 1.04) + P.seg(5, -41, 2, -37, 0.2); }, 'sk-soft');
    S.text(ask, 12, -43, '?', '', 13);
    S.ink(yes, function (P) { return P.ell(12, -47, 10, 7.5, 0.5, 1.04) + P.seg(5, -41, 2, -37, 0.2); }, 'sk-soft');
    S.ink(yes, function (P) { return P.seg(7.5, -47, 11, -43.5, 0.2) + P.seg(11, -43.5, 17, -51, 0.2); });

    // car
    var cG = S.g(W);
    var C = car(S, cG);
    // "after you" waves + note
    var waves = S.g(W, 'sk-go');
    var wv = [0, 1, 2].map(function (k) { return S.ink(waves, function (P) { return P.arc(0, 0, 7 + k * 6, -1.15, -0.25, 0.3); }); });
    var note = S.g(W, 'sk-go');
    S.text(note, 82, 80, 'after you', '', 14);
    S.ink(note, function (P) { return P.seg(98, 82, 120, 96, 0.4) + P.seg(120, 96, 115, 95, 0.1) + P.seg(120, 96, 119, 91, 0.1); }, 'sk-soft');

    function frame(t) {
      // car
      var cx, nod = 0;
      if (t < 2.4) { cx = -40 + 156 * outQ(span(t, 0, 2.4)); nod = Math.sin(span(t, 2.0, 2.7) * Math.PI) * 2.2; }
      else if (t < 5.7) { cx = 116; nod = Math.sin(span(t, 2.0, 2.7) * Math.PI) * 2.2; }
      else cx = 116 + 170 * inQ(span(t, 5.7, 7.3));
      put(cG, cx, 147); rotAt(C.body, nod);
      C.wheels.forEach(function (w) { rotAt(w, cx * 9); });
      // light bar: scanning (coral, dashed) → calm (green, solid)
      var yielding = t > 2.3 && t < 5.7;
      C.bar.style.color = yielding ? 'var(--go)' : 'var(--coral)';
      C.bar.style.strokeDasharray = yielding ? '1 1' : '0.12 0.08';
      C.bar.style.strokeDashoffset = yielding ? 0 : (-t * 0.6).toFixed(3);
      C.eyes.setAttribute('transform', t > 2.4 && t < 4.4 ? 'translate(1.1 -0.9)' : '');
      // waves + note
      put(waves, 118, 132);
      wv.forEach(function (w, k) { show(w, bump(t, 2.5 + k * 0.18, 3.9 + k * 0.18, 0.25)); });
      show(note, bump(t, 2.6, 4.2, 0.3));
      // pedestrian
      var w = ease(span(t, 3.5, 5.4)), px = 138 + w * 2, py = 110 + w * 54, ps = 0.8 + w * 0.22;
      put(pedG, px, py, ps);
      walkPose(ped, t * 9, t > 3.5 && t < 5.4 ? 1 : 0);
      rotAt(ped.armB, t > 5.6 && t < 7 ? -150 + Math.sin(t * 12) * 18 : 0);
      ped.mood(t < 2.5 ? 'worried' : t < 3.2 ? 'oh' : 'happy'); ped.blink(t);
      show(ask, bump(t, 0.6, 3.2, 0.3));
      show(yes, bump(t, 3.0, 4.3, 0.2));
      show(pedG, Math.min(ease(span(t, 0, 0.4)), 1 - ease(span(t, 7.2, 7.7))));
    }
    return { S: S, frame: frame, L: L, still: 3.3 };
  }

  // ================= 02 · Human–robot interaction =================
  function robot(svg) {
    var S = new Scene(svg, 22, 1.22, 112), W = S.world, L = 8;
    var bg = S.g(W);
    // shop front
    S.ink(bg, function (P) { return P.line(0, 122, 200, 122, 0.6); });
    S.ink(bg, function (P) { return P.poly([[30, 120], [30, 74], [84, 74], [84, 120]], false, 0.6); }, 'sk-soft');
    S.ink(bg, function (P) { return P.hatch(34, 78, 46, 38, 7); }, 'sk-faint');
    S.ink(bg, function (P) { return P.poly([[26, 74], [34, 62], [80, 62], [88, 74]], false, 0.5) + P.seg(42, 62, 38, 74, 0.3) + P.seg(57, 62, 57, 74, 0.3) + P.seg(72, 62, 76, 74, 0.3); }, 'sk-soft');
    S.ink(bg, function (P) { return P.poly([[122, 120], [122, 66], [146, 66], [146, 120]], false, 0.5) + P.ell(141, 94, 1.2, 1.2, 0.1); }, 'sk-soft');
    S.ink(bg, function (P) { return P.poly([[164, 120], [166, 108], [178, 108], [180, 120]], false, 0.3) + P.ell(172, 98, 8, 9, 1.2, 1.4); }, 'sk-soft');
    for (var i = 0; i < 6; i++) (function (i) { var x = 8 + i * 36; S.ink(bg, function (P) { return P.seg(x, 124, x - 10, 172, 0.4); }, 'sk-faint'); })(i);
    S.ink(bg, function (P) { return P.seg(0, 150, 200, 150, 0.3); }, 'sk-faint');

    var plan = el('path', W, { 'class': 'sk-plan' });

    // robot
    var rG = S.g(W);
    var rb = S.g(rG, 'sk-dark');
    var flag = S.g(el('g', rb, { transform: 'translate(12 -31)' }));
    S.ink(flag, function (P) { return P.seg(0, 0, 2, -15, 0.2); }, 'sk-soft');
    S.ink(flag, function (P) { return P.poly([[2, -15], [11, -12.5], [2, -10]], true, 0.2); }, 'sk-sig');
    S.ink(rb, function (P) { return P.poly([[-17, -8], [-17, -26], [-14, -31], [14, -31], [17, -26], [17, -8]], true, 0.5); });
    S.ink(rb, function (P) { return P.seg(-17, -25.5, 17, -25.5, 0.3); }, 'sk-soft');
    S.ink(rb, function (P) { return P.poly([[-2, -22], [13, -22], [13, -12], [-2, -12]], true, 0.3); });
    S.ink(rb, function (P) { return P.poly([[-13, -21], [-6, -21], [-6, -12], [-13, -12]], true, 0.2) + P.hatch(-13, -21, 7, 9, 2.6); }, 'sk-faint');
    var calm = S.g(rb), happy = S.g(rb);
    el('circle', calm, { cx: 3, cy: -17, r: 1.3, 'class': 'sk-fill' });
    el('circle', calm, { cx: 9, cy: -17, r: 1.3, 'class': 'sk-fill' });
    S.ink(happy, function (P) { return P.arc(3, -16, 1.9, Math.PI * 1.1, Math.PI * 1.9) + P.arc(9, -16, 1.9, Math.PI * 1.1, Math.PI * 1.9); });
    var rw = [-11, 0, 11].map(function (x) {
      var w = el('g', rb, { transform: 'translate(' + x + ' -4)' });
      el('circle', w, { cx: 0, cy: 0, r: 4, fill: 'var(--paper)' });
      var s = S.g(w);
      S.ink(s, function (P) { return P.ell(0, 0, 4, 4, 0.2) + P.seg(-1.6, 0, 1.6, 0, 0.1); });
      return s;
    });
    var beep = S.g(rG, 'sk-gold');
    S.text(beep, 24, -40, '♪', '', 14);
    S.ink(beep, function (P) { return P.seg(18, -34, 21, -37, 0.1) + P.seg(20, -30, 24, -31, 0.1); });

    // person with coffee, walking left
    var hG = S.g(W);
    var hum = person(S, el('g', hG, { transform: 'scale(-1 1)' }), { cup: true });
    var heart = S.g(hG, 'sk-sig');
    S.ink(heart, function (P) { return P.seg(0, -42, -3.4, -46, 0.1) + P.arc(-1.8, -46.6, 1.8, Math.PI * 0.8, Math.PI * 2) + P.arc(1.8, -46.6, 1.8, Math.PI, Math.PI * 2.2) + P.seg(3.4, -46, 0, -42, 0.1); });

    var label = S.g(W, 'sk-dark');
    S.text(label, 100, 48, 'makes room', '', 14);

    function rx(t) { var a = span(t, 0, L); return -34 + 268 * (a + 0.09 * Math.sin(a * 2 * Math.PI) * -1); }
    function ry(t) { return 152 - 15 * bump(t, 2.3, 5.6, 1.1); }
    function rs(t) { return 1 - 0.12 * bump(t, 2.3, 5.6, 1.1); }
    function frame(t) {
      var x = rx(t), y = ry(t), s = rs(t);
      put(rG, x, y, s);
      rw.forEach(function (w) { rotAt(w, x * 14); });
      rotAt(flag, Math.sin(t * 7) * 6);
      var meet = bump(t, 3.0, 5.0, 0.3);
      show(happy, meet); show(calm, 1 - meet);
      show(beep, bump(t, 3.3, 4.6, 0.2));
      // planned path: where the robot will be in the next ~1.6 s
      var d = '';
      for (var k = 1; k <= 8; k++) { var tt = t + k * 0.2; d += (k === 1 ? 'M' : 'L') + f(rx(tt) + 18 * rs(tt)) + ' ' + f(ry(tt) - 3); }
      plan.setAttribute('d', d);
      // person, walking the other way
      var hx = 232 - 268 * span(t, 0, L) + 6 * Math.sin(span(t, 0, L) * 2 * Math.PI);
      put(hG, hx, 162, 1.08);
      walkPose(hum, t * 8, 1);
      rotAt(hum.armA, t > 3.6 && t < 4.9 ? 150 + Math.sin(t * 12) * 18 : -Math.sin(t * 8) * 16);
      hum.mood(t < 2.7 ? 'flat' : t < 3.4 ? 'oh' : t < 6 ? 'happy' : 'flat'); hum.blink(t + 1.3);
      show(heart, bump(t, 3.9, 5.0, 0.2));
      show(label, bump(t, 2.6, 5.0, 0.4));
    }
    return { S: S, frame: frame, L: L, still: 3.9 };
  }

  // ================= 03 · Intelligent urban environments =================
  function city(svg) {
    var S = new Scene(svg, 33, 1.06, 104), W = S.world, L = 7.8;
    var bg = S.g(W);
    // skyline
    S.ink(bg, function (P) { return P.poly([[8, 110], [8, 46], [36, 46], [36, 110]], false, 0.6); }, 'sk-soft');
    S.ink(bg, function (P) { return P.hatch(13, 52, 7, 8, 2.4) + P.hatch(24, 52, 7, 8, 2.4) + P.hatch(13, 70, 7, 8, 2.4) + P.hatch(24, 88, 7, 8, 2.4); }, 'sk-faint');
    S.ink(bg, function (P) { return P.poly([[150, 110], [150, 34], [176, 34], [176, 22], [186, 22], [186, 110]], false, 0.6); }, 'sk-soft');
    S.ink(bg, function (P) { return P.hatch(155, 42, 8, 8, 2.4) + P.hatch(167, 60, 8, 8, 2.4) + P.hatch(155, 78, 8, 8, 2.4); }, 'sk-faint');
    S.ink(bg, function (P) { return P.poly([[112, 110], [112, 72], [132, 72], [132, 110]], false, 0.5); }, 'sk-faint');
    S.ink(bg, function (P) { return P.line(0, 110, 200, 110, 0.6); });
    S.ink(bg, function (P) { return P.line(0, 156, 200, 156, 0.6); });
    for (var i = 0; i < 5; i++) (function (i) {
      var y = 114 + i * 8.4, x0 = 88 - i * 1.4, x1 = 112 + i * 1.4;
      S.ink(bg, function (P) { return P.poly([[x0, y], [x1, y], [x1, y + 4.2], [x0, y + 4.2]], true, 0.3); }, 'sk-faint');
    })(i);

    // light cone + pool on the crossing
    var cone = S.g(W, 'sk-gold');
    S.ink(cone, function (P) { return P.seg(60, 32, 84, 132, 0.4) + P.seg(76, 32, 118, 132, 0.4); }, 'sk-soft');
    S.ink(cone, function (P) { return P.ell(100, 134, 21, 5.6, 0.4) + P.hatch(84, 131, 32, 6, 3); }, 'sk-soft');

    // the pole
    var pole = S.g(W, 'sk-dark');
    S.ink(pole, function (P) { return P.line(68, 110, 68, 36, 0.5); });
    S.ink(pole, function (P) { return P.seg(62, 110, 74, 110, 0.2); });
    S.ink(pole, function (P) { return P.poly([[63, 64], [73, 64], [73, 76], [63, 76]], true, 0.2); }, 'sk-soft');
    S.ink(pole, function (P) { return P.ell(68, 30, 15, 5, 0.3); });
    var leds = [];
    for (var k = 0; k < 12; k++) (function (k) {
      var a = k / 12 * 2 * Math.PI, x = 68 + 15 * Math.cos(a), y = 30 + 5 * Math.sin(a);
      leds.push(el('circle', W, { cx: f(x), cy: f(y), r: 1.5, 'class': 'sk-fill' }));
    })(k);
    // V2X waves toward the car
    var v2x = S.g(W, 'sk-sig');
    var vw = [0, 1, 2].map(function (k) { return S.ink(v2x, function (P) { return P.arc(84, 30, 8 + k * 9, -0.55, 0.55, 0.3); }); });
    S.text(v2x, 118, 22, 'V2X · wait', '', 12);

    // pedestrian
    var pedG = S.g(W);
    var ped = person(S, pedG, { hair: true });
    // car facing left
    var cG = S.g(W);
    var C = car(S, el('g', cG, { transform: 'scale(-1 1)' }));
    var dots = S.g(cG, 'sk-dark');
    [0, 1, 2].forEach(function (k) { el('circle', dots, { cx: 20 + k * 6, cy: -40, r: 1.4, 'class': 'sk-fill' }); });
    var ok = S.g(W, 'sk-go');
    S.text(ok, 112, 176, 'everyone knows who goes', '', 12);

    function frame(t) {
      // ring: scanning → green
      var green = t > 2.6 && t < 5.6, scan = (t * 5) % 12;
      leds.forEach(function (l, k) {
        if (green) { l.style.color = 'var(--go)'; l.style.opacity = 1; }
        else { var dd = Math.min(Math.abs(k - scan), 12 - Math.abs(k - scan)); l.style.color = 'var(--coral)'; l.style.opacity = Math.max(0.18, 1 - dd * 0.32).toFixed(2); }
      });
      vw.forEach(function (w, k) { show(w, bump(t, 1.4 + k * 0.2, 3.0 + k * 0.2, 0.25)); });
      show(v2x.lastChild, bump(t, 1.5, 3.4, 0.3));
      show(cone, bump(t, 2.7, 5.6, 0.4));
      show(ok, bump(t, 4.2, 5.8, 0.4));
      // car from the right, waits, leaves
      var cx = t < 2.6 ? 250 - 112 * outQ(span(t, 0.2, 2.6)) : t < 6.3 ? 138 : 138 - 240 * inQ(span(t, 6.3, 7.7));
      put(cG, cx, 150);
      C.wheels.forEach(function (w) { rotAt(w, -cx * 9); });
      var waiting = t > 2.4 && t < 6.3;
      C.bar.style.color = waiting ? 'var(--go)' : 'var(--coral)';
      C.bar.style.strokeDasharray = waiting ? '1 1' : '0.12 0.08';
      C.bar.style.strokeDashoffset = waiting ? 0 : (-t * 0.6).toFixed(3);
      show(dots, waiting ? 0.35 + 0.65 * Math.abs(Math.sin(t * 3)) : 0);
      // pedestrian crosses on the lit crossing
      var w = ease(span(t, 3.0, 5.2));
      var away = ease(span(t, 5.3, 7.0));
      put(pedG, 100 - away * 95, 110 + w * 58, 0.8 + w * 0.22);
      ped.mood(t < 1.4 ? 'flat' : t < 2.7 ? 'worried' : 'happy'); ped.blink(t + 0.7);
      walkPose(ped, t * 9, (t > 3.0 && t < 5.2) || (t > 5.3 && t < 7.0) ? 1 : 0);
      show(pedG, Math.min(ease(span(t, 0, 0.4)), 1 - ease(span(t, 7.1, 7.7))));
    }
    return { S: S, frame: frame, L: L, still: 3.6 };
  }

  // ---- run: one clock, only for circles on screen ----

  // ================= 04 · Design =================
  // the double diamond: discover → define → develop → deliver
  function design(svg) {
    var S = new Scene(svg, 44, 1.0, 104), W = S.world, L = 8.6;
    var dVars = S.P.map(function (P) {
      return P.poly([[18, 100], [59, 64], [100, 100]], false, 0.4) + P.poly([[100, 100], [141, 64], [182, 100]], false, 0.4) +
             P.poly([[182, 100], [141, 136], [100, 100]], false, 0.4) + P.poly([[100, 100], [59, 136], [18, 100]], false, 0.4);
    });
    var dia = el('path', W, { d: dVars[0], pathLength: 1, 'class': 'sk-reveal sk-proto' });
    S.parts.push({ p: dia, vars: dVars });
    var pencil = el('g', W);
    var pin = S.g(pencil, 'sk-dark');
    S.ink(pin, function (P) { return P.poly([[0, 0], [3, -7], [24, -28], [29, -23], [8, -2]], true, 0.2); });
    S.ink(pin, function (P) { return P.poly([[24, -28], [27, -31], [32, -26], [29, -23]], false, 0.1); }, 'sk-sig');

    // discover: scattered sticky notes (they later gather = define)
    var notes = [[32, 88, 'sk-gold'], [44, 108, 'sk-sig'], [52, 82, 'sk-go'], [36, 112, 'sk-gold'], [58, 100, 'sk-sig']].map(function (n, i) {
      var g = el('g', W);
      var inner = S.g(g, n[2]);
      S.ink(inner, function (P) { return P.poly([[-4, -4], [4, -4], [4, 4], [-4, 4]], true, 0.2) + P.seg(-2.4, -1, 2.4, -1, 0.1) + P.seg(-2.4, 1.4, 1, 1.4, 0.1); });
      return { g: g, x: n[0], y: n[1], cx: 76 + (i % 3) * 5 - 5, cy: 92 + Math.floor(i / 3) * 6, r: (i * 37 % 13) - 6 };
    });
    // define: an insight
    var bulb = S.g(W, 'sk-gold');
    S.ink(bulb, function (P) { return P.ell(82, 112, 5, 5.6, 0.3) + P.seg(80, 118, 84, 118, 0.1) + P.seg(80.5, 120.5, 83.5, 120.5, 0.1); });
    S.ink(bulb, function (P) { return P.seg(74, 106, 71, 104, 0.1) + P.seg(90, 106, 93, 104, 0.1) + P.seg(82, 104, 82, 101, 0.1); }, 'sk-soft');
    // develop: quick UI sketches, one gets refined
    var ui = S.g(W, 'sk-dark');
    S.ink(ui, function (P) { return P.poly([[110, 82], [124, 82], [124, 106], [110, 106]], true, 0.3) + P.seg(113, 87, 121, 87, 0.1) + P.seg(113, 92, 119, 92, 0.1) + P.ell(117, 100, 2.6, 2.6, 0.1); });
    var ui2 = S.g(W, 'sk-dark');
    S.ink(ui2, function (P) { return P.poly([[128, 96], [142, 96], [142, 120], [128, 120]], true, 0.3) + P.seg(131, 101, 139, 101, 0.1) + P.hatch(131, 105, 8, 6, 2.2) + P.seg(131, 115, 136, 115, 0.1); });
    // deliver: someone uses it and is happy
    var tG = S.g(W);
    var tester = person(S, tG, { hair: true });
    var yes = S.g(tG, 'sk-go');
    S.ink(yes, function (P) { return P.ell(12, -46, 8.5, 7, 0.4, 1.04) + P.seg(6, -40.5, 3, -37, 0.2); }, 'sk-soft');
    S.ink(yes, function (P) { return P.seg(8, -46, 11, -43, 0.2) + P.seg(11, -43, 16, -50, 0.2); });
    var words = S.g(W, 'sk-dark');
    S.text(words, 38, 154, 'discover', '', 11); S.text(words, 80, 154, 'define', '', 11);
    S.text(words, 120, 154, 'develop', '', 11); S.text(words, 162, 154, 'deliver', '', 11);

    function frame(t) {
      var d = ease(span(t, 0.2, 4.4));
      dia.style.strokeDashoffset = (1 - d).toFixed(3);
      var pt = dia.getPointAtLength(dia.getTotalLength() * d);
      put(pencil, pt.x, pt.y);
      show(pencil, Math.min(ease(span(t, 0, 0.3)), 1 - ease(span(t, 4.4, 4.9))));
      var gather = ease(span(t, 2.0, 2.9));
      notes.forEach(function (n, i) {
        var x = n.x + (n.cx - n.x) * gather, y = n.y + (n.cy - n.y) * gather;
        put(n.g, x, y, 1, n.r * (1 - gather));
        show(n.g, bump(t, 0.6 + i * 0.15, 7.9, 0.25));
      });
      show(bulb, bump(t, 2.9, 7.9, 0.3));
      show(ui, bump(t, 3.6, 7.9, 0.3));
      show(ui2, bump(t, 4.2, 7.9, 0.3));
      var w = ease(span(t, 4.8, 5.8));
      put(tG, 196 - w * 30, 128, 0.78);
      walkPose(tester, t * 9, t > 4.8 && t < 5.8 ? 1 : 0);
      tester.mood(t < 5.9 ? 'flat' : t < 6.3 ? 'oh' : 'happy'); tester.blink(t + 2);
      show(yes, bump(t, 6.3, 7.9, 0.25));
      show(tG, Math.min(ease(span(t, 4.7, 5.0)), 1 - ease(span(t, 7.8, 8.3))));
      show(words, 1);
      dia.style.opacity = (1 - ease(span(t, 7.9, 8.4))).toFixed(2);
    }
    return { S: S, frame: frame, L: L, still: 6.8 };
  }

  var makers = [mobility, robot, city, design];
  var holders = document.querySelectorAll('#research .rs-scene');
  if (holders.length < 3 || holders.length > 4 || !window.IntersectionObserver) return; // keep the original drawings
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var scenes = [].map.call(holders, function (holder, i) {
    var svg = el('svg', null, { viewBox: '0 0 200 200', 'class': 'rs-sketch', 'aria-hidden': 'true', focusable: 'false' });
    holder.textContent = '';
    holder.appendChild(svg);
    holder.classList.add('is-sketched');
    var s = makers[i](svg); s.svg = svg; s.on = false; s.frame(s.still); return s;
  });

  var running = false, last = 0, clock = 0, lastBoil = 0;
  function tick(now) {
    var dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
    clock += dt;
    var boil = now - lastBoil > 150, any = false;
    if (boil) lastBoil = now;
    scenes.forEach(function (s) {
      if (!s.on) return;
      any = true;
      s.frame(clock % s.L);
      if (boil) s.S.boil();
    });
    running = any;
    if (any) requestAnimationFrame(tick);
  }
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      var s = scenes.find(function (x) { return x.svg === e.target; });
      s.on = e.isIntersecting && !reduce;
      if (e.isIntersecting) requestAnimationFrame(function () { s.svg.classList.add('sk-drawn'); });
    });
    if (!running && scenes.some(function (s) { return s.on; })) { running = true; last = performance.now(); requestAnimationFrame(tick); }
  }, { threshold: 0.2 });
  scenes.forEach(function (s) { io.observe(s.svg); });
})();
