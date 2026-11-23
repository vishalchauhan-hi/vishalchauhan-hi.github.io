/* hci.js — homepage layer (loaded with `defer`).
   1. Reading progress bar + current-section highlight in the nav
   2. The street: a hand-drawn crossing where the visitor is the pedestrian.
      Self-driving cars notice you at the curb, brake with real deceleration
      (v² = 2ad), light a cyan eHMI bar, and the smart pole (SPIU) swaps to a
      walking figure. Everything is drawn with seeded pencil jitter; moving
      things "boil" a few times a second like hand-drawn animation.
   Nothing is stored or sent anywhere. No libraries. */

(function () {
  'use strict';
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- pencil: seeded hand-drawn SVG paths, shared by both figures ---------- */
  function pencil(seed) {
    function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
    var r = rng(seed);
  function j(a) { return (r() - 0.5) * 2 * a; }
  function f(n) { return Math.round(n * 10) / 10; }
  function stroke(x1, y1, x2, y2, a) {
    var dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
    var nx = -dy / len, ny = dx / len, bow = j(a) + len * 0.004 * j(1);
    var ax = x1 + j(a * 0.6), ay = y1 + j(a * 0.6), bx = x2 + j(a * 0.6), by = y2 + j(a * 0.6);
    var mx = (ax + bx) / 2 + nx * bow, my = (ay + by) / 2 + ny * bow;
    return 'M' + f(ax) + ' ' + f(ay) + 'Q' + f(mx) + ' ' + f(my) + ' ' + f(bx) + ' ' + f(by);
  }
  function line(x1, y1, x2, y2, a) { a = a == null ? 1.2 : a; return stroke(x1, y1, x2, y2, a) + stroke(x1, y1, x2, y2, a); }
  function rect(x, y, w, h, a) {
    var o = 2; a = a == null ? 1.2 : a;
    return line(x - o, y, x + w + o, y, a) + line(x + w, y - o, x + w, y + h + o, a) +
           line(x + w + o, y + h, x - o, y + h, a) + line(x, y + h + o, x, y - o, a);
  }
  function ellipse(cx, cy, rx, ry, a) {
    a = a == null ? 0.8 : a;
    var d = '', n = 22, start = r() * Math.PI * 2, i, t, x, y;
    for (i = 0; i <= n + 2; i++) {
      t = start + (i / n) * Math.PI * 2;
      x = cx + Math.cos(t) * (rx + j(a)); y = cy + Math.sin(t) * (ry + j(a));
      d += (i ? 'L' : 'M') + f(x) + ' ' + f(y);
    }
    return d;
  }
  function path(d, cls) { return '<path class="' + (cls || 'pencil') + '" d="' + d + '"/>'; }
  function text(x, y, s, cls, anchor) {
    return '<text class="' + (cls || 'note-txt') + '" x="' + x + '" y="' + y + '"' +
           (anchor ? ' text-anchor="' + anchor + '"' : '') + '>' + s + '</text>';
  }
    return { r: r, j: j, f: f, stroke: stroke, line: line, rect: rect, ellipse: ellipse, path: path, text: text };
  }

  /* ---------- 1. progress bar + nav highlight ---------- */
  (function () {
    var bar = document.createElement('div');
    bar.className = 'hci-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);
    var ticking = false;
    function update() {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, window.scrollY / h) : 0) + ')';
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
    if (!('IntersectionObserver' in window)) return;
    var links = {};
    document.querySelectorAll('nav.primary a[href^="#"]').forEach(function (a) {
      links[a.getAttribute('href').slice(1)] = a;
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        Object.keys(links).forEach(function (k) { links[k].classList.toggle('is-current', k === e.target.id); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    document.querySelectorAll('main > section[id]').forEach(function (s) { io.observe(s); });
  })();

  /* ---------- 2. the street ---------- */
  (function () {
    var fig = document.getElementById('street');
    if (!fig) return;
    var svg = fig.querySelector('svg');
    var gStatic = svg.querySelector('.st-static'), gCar = svg.querySelector('.st-car'),
        gPole = svg.querySelector('.st-pole'), gPed = svg.querySelector('.st-ped'),
        gGaze = svg.querySelector('.st-gaze'), gNotes = svg.querySelector('.st-notes');
    var note = fig.querySelector('.street-note');
    var pauseBtn = fig.querySelector('.street-pause');
    svg.setAttribute('tabindex', '0');
    /* on a phone, frame just the crossing so the drawing stays legible */
    var narrow = window.matchMedia('(max-width: 640px)');
    function frame() { svg.setAttribute('viewBox', narrow.matches ? '410 -84 600 354' : '0 -84 1000 344'); }
    frame();
    if (narrow.addEventListener) narrow.addEventListener('change', frame);

    var P = pencil(7), r = P.r, j = P.j, f = P.f, stroke = P.stroke, line = P.line,
        rect = P.rect, ellipse = P.ellipse, path = P.path, text = P.text;

    /* --- scene geometry (viewBox 1000 × 260) --- */
    var TOP = 62, BOT = 192, MID = 127, LANE = 160;
    var CW0 = 560, CW1 = 640;               // crosswalk x-range
    var STOP_FRONT = 532;                   // where a yielding car's bumper stops
    var CAR_L = 100, V = 230, A_GO = 260, A_MAX = 520, A_EMERG = 1500;
    var IDLE = { x: 600, y: 228 };
    var touch = window.matchMedia && window.matchMedia('(hover: none)').matches;

    /* --- static scene: drawn once --- */
    (function drawStatic() {
      var h = '';
      h += '<rect class="fill-road" x="0" y="' + TOP + '" width="1000" height="' + (BOT - TOP) + '"/>';
      h += path(line(-10, TOP, 1010, TOP, 1.6)) + path(line(-10, BOT, 1010, BOT, 1.6));
      h += path(line(-10, TOP + 5, 1010, TOP + 5, 1.2), 'pencil soft') + path(line(-10, BOT - 5, 1010, BOT - 5, 1.2), 'pencil soft');
      var x, y, d = '';
      for (x = 10; x < 1000; x += 46) if (x + 24 < CW0 - 8 || x > CW1 + 8) d += stroke(x, MID, x + 24, MID, 0.8);
      h += path(d, 'pencil soft');
      d = '';                                   // light pencil shading on the road
      for (var k = 0; k < 140; k++) {
        x = r() * 1000; y = TOP + 10 + r() * (BOT - TOP - 20);
        if (x > CW0 - 6 && x < CW1 + 6) continue;
        d += stroke(x, y, x + 7 + r() * 5, y - 6 - r() * 4, 0.3);
      }
      h += path(d, 'pencil hatch');
      for (y = TOP + 9; y < BOT - 12; y += 17) {             // zebra stripes
        h += path(rect(CW0 + 4, y, CW1 - CW0 - 8, 9, 0.9));
        d = '';
        for (x = CW0 + 9; x < CW1 - 6; x += 5) d += stroke(x, y + 8, x + 4, y + 1, 0.25);
        h += path(d, 'pencil soft');
      }
      h += path(line(STOP_FRONT + 6, MID + 5, STOP_FRONT + 6, BOT - 4, 1), 'pencil');

      /* --- street life (all static): paving, trees, a bench, planters, road marks --- */
      d = '';                                              // paving joints on both pavements
      for (x = 22; x < 1000; x += 44) {
        d += stroke(x, TOP - 24, x - 1, TOP - 4, 0.3);
        d += stroke(x + 22, BOT + 4, x + 21, BOT + 26, 0.3);
      }
      d += stroke(-10, TOP - 25, 1010, TOP - 25, 0.6) + stroke(-10, BOT + 27, 1010, BOT + 27, 0.6);
      h += path(d, 'pencil hatch');
      // manhole cover and lane arrows
      h += path(ellipse(300, 94, 9, 9, 0.3) + stroke(293, 94, 307, 94, 0.2) + stroke(300, 87, 300, 101, 0.2), 'pencil soft');
      h += path(line(392, LANE, 440, LANE, 0.5) + stroke(440, LANE, 430, LANE - 6, 0.3) + stroke(440, LANE, 430, LANE + 6, 0.3), 'pencil soft');
      h += path(line(860, 94, 812, 94, 0.5) + stroke(812, 94, 822, 88, 0.3) + stroke(812, 94, 822, 100, 0.3), 'pencil soft');
      // a bench and a planter on the far pavement
      h += path(rect(470, 30, 40, 12, 0.5) + stroke(472, 36, 508, 36, 0.3), 'pencil');
      [[868, 38]].forEach(function (p) {
        h += path(rect(p[0], p[1] - 7, 22, 14, 0.4), 'pencil') +
             path(ellipse(p[0] + 6, p[1], 3, 3, 0.3) + ellipse(p[0] + 13, p[1] - 2, 2.6, 2.6, 0.3) + ellipse(p[0] + 17, p[1] + 3, 2.4, 2.4, 0.3), 'pencil soft');
      });
      /* the far side of the street, drawn the way architects fold a street open:
         the building fronts stand up along the top edge (ground line y = 0) */
      var G = 0, FL = 22, UP = 14;                      // ground-floor and upper-floor heights
      function wash(cls, x, y, w, hh) { return '<rect class="' + cls + '" x="' + f(x + 1.5) + '" y="' + f(y + 1) + '" width="' + f(w) + '" height="' + f(hh) + '"/>'; }
      function windows(x, w, floors, top) {
        var s = '', n = Math.max(2, Math.round(w / 22)), gap = w / n, k, fl;
        for (fl = 0; fl < floors; fl++) for (k = 0; k < n; k++)
          s += rect(x + k * gap + gap * 0.25, top + fl * UP + 3, gap * 0.5, UP - 7, 0.25);
        return path(s, 'pencil soft');
      }
      function building(x, w, floors, kind, label) {
        var hh = FL + floors * UP, top = G - hh, s = '';
        if (kind === 'house') {                            // two-storey house with a gable roof
          s += path(line(x, G, x, top, 0.5) + line(x + w, G, x + w, top, 0.5) +
                    stroke(x - 4, top + 1, x + w / 2, top - 14, 0.4) + stroke(x + w / 2, top - 14, x + w + 4, top + 1, 0.4) + line(x - 4, top + 1, x + w + 4, top + 1, 0.3));
          s += windows(x + 4, w - 8, floors, top);
          var dx = x + w / 2 - 8;                           // door with a noren curtain and a paper lantern
          s += path(rect(dx, G - 17, 16, 17, 0.3));
          s += wash('noren-wash', dx + 1, G - 16, 14, 7) + path(stroke(dx + 5.3, G - 16, dx + 5.3, G - 9, 0.15) + stroke(dx + 10.6, G - 16, dx + 10.6, G - 9, 0.15) + line(dx + 1, G - 9, dx + 15, G - 9, 0.15), 'pencil soft');
          s += '<ellipse class="lantern-wash" cx="' + f(dx + 22) + '" cy="' + f(G - 13) + '" rx="3" ry="4.2"/>' + path(ellipse(dx + 22, G - 13, 3, 4.2, 0.2) + stroke(dx + 22, G - 18, dx + 22, G - 20, 0.1));
          return s;
        }
        s += path(line(x, G, x, top, 0.5) + line(x + w, G, x + w, top, 0.5) + line(x - 3, top, x + w + 3, top, 0.5) + line(x - 1, top + 3, x + w + 1, top + 3, 0.25));
        s += windows(x + 3, w - 6, floors, top + 4);
        if (kind === 'cafe') {                             // striped awning, big window, a menu board
          s += path(rect(x + 6, G - 15, w - 26, 15, 0.3)) + path(rect(x + w - 16, G - 16, 10, 16, 0.3));
          var aw = '', st = '', xx;
          for (xx = x + 2; xx < x + w - 2; xx += 8) { aw += 'M' + f(xx) + ' ' + f(G - 18) + 'Q' + f(xx + 4) + ' ' + f(G - 15 + j(0.4)) + ' ' + f(xx + 8) + ' ' + f(G - 18); st += stroke(xx, G - 23, xx, G - 18, 0.15); }
          s += wash('awning-wash', x + 2, G - 23, w - 4, 6) + path(line(x + 1, G - 23, x + w - 1, G - 23, 0.3) + aw) + path(st, 'pencil soft');
          s += path(stroke(x + w + 4, G, x + w + 7, G - 9, 0.15) + stroke(x + w + 10, G, x + w + 7, G - 9, 0.15) + rect(x + w + 3.5, G - 9, 7, 6, 0.15), 'pencil soft');
        } else if (kind === 'konbini') {                   // glass front with mullions, a sign band
          s += wash('sign-wash', x + 2, G - FL + 1, w - 4, 6) + path(rect(x + 2, G - FL + 1, w - 4, 6, 0.25));
          var mull = '';
          for (xx = x + 4; xx <= x + w - 4; xx += 13) mull += stroke(xx, G - 14, xx, G, 0.15);
          s += path(rect(x + 3, G - 14, w - 6, 14, 0.3)) + path(mull, 'pencil soft');
        } else if (kind === 'books') {                     // shelves of book spines, a vertical sign
          s += path(rect(x + 4, G - 15, w - 20, 15, 0.3)) + path(rect(x + w - 13, G - 16, 9, 16, 0.3));
          var spines = '';
          for (xx = x + 6; xx < x + w - 18; xx += 2.6) spines += stroke(xx, G - 7, xx + j(0.3), G - 12 - r() * 2, 0.1);
          s += path(spines + line(x + 5, G - 6.5, x + w - 17, G - 6.5, 0.1), 'pencil soft');
          s += wash('sign-wash', x + w + 1, top + 10, 7, 22) + path(rect(x + w + 1, top + 10, 7, 22, 0.2));
        } else {                                           // a plain office front
          s += path(rect(x + w / 2 - 7, G - 16, 14, 16, 0.3) + rect(x + 4, G - 12, w / 2 - 14, 8, 0.2) + rect(x + w / 2 + 10, G - 12, w / 2 - 14, 8, 0.2), 'pencil soft');
        }
        if (label) s += text(x + w / 2, top - 4, label, 'note-txt small', 'middle');
        return s;
      }
      function vending(x) {                                // a pair of vending machines
        var s = '';
        for (var k = 0; k < 2; k++) {
          var vx = x + k * 11, dots = '';
          s += wash('vend-wash', vx, G - 22, 10, 22) + path(rect(vx, G - 22, 10, 22, 0.2));
          for (var rr = 0; rr < 3; rr++) for (var c = 0; c < 3; c++) dots += ellipse(vx + 2.2 + c * 2.8, G - 19 + rr * 4, 0.6, 0.9, 0.05);
          s += path(dots + rect(vx + 2, G - 6, 6, 3, 0.1), 'pencil soft');
        }
        return s;
      }
      // the row of buildings (a short alley gap here and there, like a real block)
      h += building(150, 70, 2, 'office');
      h += building(232, 64, 1, 'house');
      h += building(312, 92, 2, 'cafe', 'café');
      h += vending(408);
      h += building(436, 86, 3, 'office');
      h += building(668, 90, 1, 'konbini', '24h');
      h += building(764, 66, 2, 'books', 'books');
      h += building(850, 72, 2, 'house');
      h += path(line(-10, G, 1010, G, 0.6), 'pencil soft');
      // utility poles with sagging wires, as on most Tokyo streets
      var poles = [118, 540, 660], wires = '';
      poles.forEach(function (px) {
        h += path(line(px, G + 2, px, G - 66, 0.4) + stroke(px - 9, G - 60, px + 9, G - 60, 0.2) + stroke(px - 6, G - 52, px + 6, G - 52, 0.2));
      });
      for (var w2 = 0; w2 < poles.length - 1; w2++) {
        var a0 = poles[w2], a1 = poles[w2 + 1];
        wires += 'M' + a0 + ' ' + (G - 60) + 'Q' + ((a0 + a1) / 2) + ' ' + (G - 44) + ' ' + a1 + ' ' + (G - 60);
        wires += 'M' + a0 + ' ' + (G - 52) + 'Q' + ((a0 + a1) / 2) + ' ' + (G - 38) + ' ' + a1 + ' ' + (G - 52);
      }
      wires += 'M' + (-10) + ' ' + (G - 50) + 'Q50 ' + (G - 42) + ' 118 ' + (G - 60) + 'M660 ' + (G - 60) + 'Q840 ' + (G - 40) + ' 1010 ' + (G - 54);
      h += path(wires, 'pencil soft');
      // yellow tactile paving at both kerbs of the crossing (warning dots), as at real Japanese crossings
      [TOP - 9, BOT + 2].forEach(function (yy) {
        h += '<rect class="tactile-wash" x="' + (CW0 + 4) + '" y="' + yy + '" width="' + (CW1 - CW0 - 8) + '" height="7"/>';
        var dts = '';
        for (var tx = CW0 + 8; tx < CW1 - 6; tx += 5) dts += ellipse(tx, yy + 3.5, 0.8, 0.8, 0.05);
        h += path(dts, 'pencil soft');
      });
      // parked bicycles outside the convenience store (seen from above)
      [[700, 22], [712, 24], [724, 22]].forEach(function (b) {
        h += path(stroke(b[0], b[1] - 9, b[0], b[1] + 9, 0.15) + ellipse(b[0], b[1] - 7, 1.2, 4, 0.1) + ellipse(b[0], b[1] + 7, 1.2, 4, 0.1) + stroke(b[0] - 4, b[1] - 3, b[0] + 4, b[1] - 3, 0.1));
      });
      function tree(cx, cy, R) {
        // an architect's tree: a loose loopy crown drawn twice, a light watercolour
        // wash that doesn't quite line up, pencil-hatched shadow, a trunk cross
        var n = Math.round(R / 3.2) + 5, ph = r() * 6.28, i, t0, t1, tm, d1 = '', d2 = '', wash = '';
        for (var pass = 0; pass < 2; pass++) {
          var d = '';
          for (i = 0; i < n; i++) {
            t0 = ph + i / n * Math.PI * 2; t1 = ph + (i + 1) / n * Math.PI * 2; tm = (t0 + t1) / 2;
            var r0 = R * (0.86 + j(0.06)), r1 = R * (0.86 + j(0.06)), rc = R * (1.2 + j(0.08));
            var x0 = cx + Math.cos(t0) * r0, y0 = cy + Math.sin(t0) * r0, x1 = cx + Math.cos(t1) * r1, y1 = cy + Math.sin(t1) * r1;
            d += (i ? 'L' : 'M') + f(x0) + ' ' + f(y0) + 'Q' + f(cx + Math.cos(tm) * rc) + ' ' + f(cy + Math.sin(tm) * rc) + ' ' + f(x1) + ' ' + f(y1);
          }
          if (pass) d2 = d; else d1 = d;
        }
        for (i = 0; i <= 18; i++) {
          t0 = i / 18 * Math.PI * 2;
          var rw = R * (1.02 + j(0.09));
          wash += (i ? 'L' : 'M') + f(cx + 3 + Math.cos(t0) * rw) + ' ' + f(cy + 2 + Math.sin(t0) * rw);
        }
        var shade = '';
        for (t0 = -0.5; t0 < 2.1; t0 += 0.22) {
          var hx = cx + Math.cos(t0) * (R + 3), hy = cy + Math.sin(t0) * (R + 3);
          shade += stroke(hx, hy, hx + 4 + r() * 2, hy + 4 + r() * 2, 0.2);
        }
        var inner = '';
        for (i = 0; i < 3; i++) {
          var ia = r() * 6.28, ir = R * (0.3 + r() * 0.3), ix = cx + Math.cos(ia) * ir, iy = cy + Math.sin(ia) * ir;
          inner += 'M' + f(ix - 3) + ' ' + f(iy) + 'Q' + f(ix) + ' ' + f(iy - 4) + ' ' + f(ix + 3) + ' ' + f(iy);
        }
        return '<path class="tree-wash" d="' + wash + 'Z"/>' + path(shade, 'pencil hatch') +
               path(d1) + path(d2, 'pencil soft') + path(inner, 'pencil soft') +
               path(stroke(cx - 2.5, cy, cx + 2.5, cy, 0.2) + stroke(cx, cy - 2.5, cx, cy + 2.5, 0.2));
      }
      [[262, 34, 20], [792, 32, 22], [940, 30, 20],
       [150, 228, 22], [338, 226, 24], [480, 230, 18], [962, 214, 16]].forEach(function (tr) { h += tree(tr[0], tr[1], tr[2]); });
      gStatic.innerHTML = h;
      // annotations
      var n = '';
      n += text(800, 252, 'the SPIU, from above');
      n += path(stroke(800, 240, 778, 230, 1.2) + stroke(778, 230, 786, 228, 0.5) + stroke(778, 230, 784, 236, 0.5));
      n += text(14, 252, 'not to scale', 'note-txt small');
      n += text(14, 36, touch ? 'drag the figure to walk' : 'your cursor is the pedestrian', 'note-txt small');
      gNotes.innerHTML = n + '<g class="st-live"></g>';
    })();
    var gLive = gNotes.querySelector('.st-live');

    /* --- pole: two frames, swapped instantly (real LEDs don't fade) --- */
    /* top-down view of the real SPIU (configuration 4 drawing): a rounded-rectangle
       ring, 606 × 393 mm, four spokes, the camera unit in the middle */
    var PX = 688, PY = 226, RW = 23, RH = 15;
    var ringD = 'M' + (PX - RW + 9) + ' ' + (PY - RH) + 'H' + (PX + RW - 9) + 'Q' + (PX + RW) + ' ' + (PY - RH) + ' ' + (PX + RW) + ' ' + (PY - RH + 9) +
                'V' + (PY + RH - 9) + 'Q' + (PX + RW) + ' ' + (PY + RH) + ' ' + (PX + RW - 9) + ' ' + (PY + RH) + 'H' + (PX - RW + 9) +
                'Q' + (PX - RW) + ' ' + (PY + RH) + ' ' + (PX - RW) + ' ' + (PY + RH - 9) + 'V' + (PY - RH + 9) + 'Q' + (PX - RW) + ' ' + (PY - RH) + ' ' + (PX - RW + 9) + ' ' + (PY - RH) + 'Z';
    var poleBase = '<path class="fill-car" d="' + ringD + '"/>' +
                   path(line(PX - RW + 3, PY, PX - 6, PY, .4) + line(PX + 6, PY, PX + RW - 3, PY, .4) + line(PX, PY - RH + 3, PX, PY - 6, .4) + line(PX, PY + 6, PX, PY + RH - 3, .4), 'pencil soft') +
                   path(ellipse(PX, PY, 6, 6, .4) + ellipse(PX - 2, PY - 1, 2, 2, .2));
    var walkFig = '<path class="ring walk" d="' + ringD + '"/>' + text(PX + 30, PY + 6, 'WALK', 'led walk');
    var stopFig = '<path class="ring stop" d="' + ringD + '"/>' + text(PX + 30, PY + 6, 'STOP', 'led stop');
    var poleState = '';
    function setPole(walk) {
      var s = walk ? 'walk' : 'stop';
      if (s === poleState) return;
      poleState = s;
      gPole.innerHTML = poleBase + (walk ? walkFig : stopFig);
    }

    /* --- car (local coords: x 0..100, y -20..20) ---
       Built once; to "boil" like hand-drawn animation only the path shapes are
       re-jittered (setAttribute), never re-created. */
    var NS = 'http://www.w3.org/2000/svg';
    function el(tag, attrs, parent) {
      var e = document.createElementNS(NS, tag);
      for (var k in attrs) e.setAttribute(k, attrs[k]);
      if (parent) parent.appendChild(e);
      return e;
    }
    var ehmiEl, alarmEl, carPaths, carBody, lidarBeam;
    /* a small self-driving car seen from above, in pencil: rounded body, windscreen
       and rear window lightly hatched, mirrors, and the sensor dome on the roof */
    var BODY = 'M10 -20H84Q99 -20 100 -8V8Q99 20 84 20H10Q0 20 0 10V-10Q0 -20 10 -20Z';
    function carShapes() {
      return [line(10, -20, 84, -20, 0.8) + stroke(84, -20, 98, -11, 0.5) + line(100, -9, 100, 9, 0.6) + stroke(98, 11, 84, 20, 0.5) +
                line(84, 20, 10, 20, 0.8) + stroke(10, 20, 1, 12, 0.5) + line(0, 10, 0, -10, 0.6) + stroke(1, -12, 10, -20, 0.5),
              stroke(62, -15, 77, -11, 0.4) + stroke(77, -11, 77, 11, 0.4) + stroke(77, 11, 62, 15, 0.4) + stroke(62, 15, 62, -15, 0.4) +
                stroke(22, -14, 13, -11, 0.4) + stroke(13, -11, 13, 11, 0.4) + stroke(13, 11, 22, 14, 0.4) +
                stroke(26, -15, 58, -15, 0.4) + stroke(26, 15, 58, 15, 0.4) +
                stroke(65, -10, 69, -13, 0.2) + stroke(65, -2, 73, -9, 0.2) + stroke(65, 6, 75, -3, 0.2) + stroke(66, 13, 75, 5, 0.2) +
                stroke(14, -4, 19, -11, 0.2) + stroke(14, 6, 20, -3, 0.2),
              stroke(66, -20, 70, -25, 0.3) + stroke(70, -25, 75, -21, 0.3) + stroke(66, 20, 70, 25, 0.3) + stroke(70, 25, 75, 21, 0.3) +
                line(14, -23, 30, -23, 0.4) + line(72, -23, 88, -23, 0.4) + line(14, 23, 30, 23, 0.4) + line(72, 23, 88, 23, 0.4)];
    }
    function drawCar() {
      var d = carShapes();
      if (!carPaths) {
        carBody = el('path', { 'class': 'fill-car', d: BODY }, gCar);
        carPaths = [el('path', { 'class': 'pencil' }, gCar), el('path', { 'class': 'pencil soft' }, gCar), el('path', { 'class': 'pencil' }, gCar)];
        el('circle', { 'class': 'car-lidar', cx: 42, cy: 0, r: 4.5 }, gCar);
        lidarBeam = el('path', { 'class': 'car-beam', d: 'M0 0L4 0' }, gCar);
        ehmiEl = el('line', { 'class': 'ehmi', x1: 104, y1: -14, x2: 104, y2: 14 }, gCar);
        alarmEl = el('text', { 'class': 'alarm', x: 112, y: -14, visibility: 'hidden' }, gCar);
        alarmEl.textContent = '!';
      }
      for (var i = 0; i < 3; i++) carPaths[i].setAttribute('d', d[i]);
    }

    /* --- pedestrian (top-down head + shoulders), built once, re-jittered to "boil" --- */
    var pedPaths;
    function drawPed() {
      var d = [ellipse(0, 0, 10, 6, 0.7), ellipse(0, 0, 5, 5, 0.5), stroke(3, -2, 9, 0, 0.3) + stroke(9, 0, 3, 2, 0.3)];
      if (!pedPaths) {
        el('ellipse', { 'class': 'ped', cx: 0, cy: 0, rx: 10, ry: 6 }, gPed);
        var p1 = el('path', { 'class': 'pencil' }, gPed);
        el('circle', { 'class': 'ped', cx: 0, cy: 0, r: 5 }, gPed);
        pedPaths = [p1, el('path', { 'class': 'pencil' }, gPed), el('path', { 'class': 'pencil soft' }, gPed)];
      }
      for (var i = 0; i < 3; i++) pedPaths[i].setAttribute('d', d[i]);
    }

    /* --- state --- */
    var ped = { x: IDLE.x, y: IDLE.y, vx: 0, vy: 0, tx: IDLE.x, ty: IDLE.y, heading: -Math.PI / 2 };
    var aim = null;                 // pointer position (for the small cross)
    var car = null, nextSpawn = 0.6;
    var t = 0, last = 0, raf = 0, running = !reduceMotion, visible = true;
    var curbSince = null, intent = false, waitStart = null, steppedOut = null, crossed = false, lastNote = '';
    var boilCar = 0, boilPed = 0;

    function say(s) { if (s !== lastNote) { lastNote = s; note.textContent = s; } }
    function inRoad() { return ped.y > TOP + 2 && ped.y < BOT - 2; }
    function nearCurb() {
      return ped.x > CW0 - 40 && ped.x < CW1 + 40 &&
             ((ped.y >= BOT - 2 && ped.y < BOT + 30) || (ped.y <= TOP + 2 && ped.y > TOP - 30));
    }
    function inLane() { return ped.y + 6 > LANE - 22 && ped.y - 6 < LANE + 22; }

    function spawn() {
      car = { x: -130, v: V, a: 0, state: 'cruise', noticed: false, waitT: 0, leaveAt: null, quietSince: null };
      drawCar();
    }

    function step(dt) {
      t += dt;
      /* pedestrian: low-bounce spring toward the target, capped at walking speed */
      var k = 38, c = 11, max = 210;
      ped.vx += ((ped.tx - ped.x) * k - ped.vx * c) * dt;
      ped.vy += ((ped.ty - ped.y) * k - ped.vy * c) * dt;
      var sp = Math.hypot(ped.vx, ped.vy);
      if (sp > max) { ped.vx *= max / sp; ped.vy *= max / sp; sp = max; }
      ped.x += ped.vx * dt; ped.y += ped.vy * dt;
      if (sp > 12) ped.heading = Math.atan2(ped.vy, ped.vx);

      /* intent: standing at the curb for 0.4 s, or already in the road */
      if (nearCurb()) { if (curbSince == null) curbSince = t; } else curbSince = null;
      var wasIntent = intent;
      intent = inRoad() || (curbSince != null && t - curbSince >= 0.4);
      if (intent && !wasIntent && !inRoad()) { waitStart = curbSince; crossed = false; }
      if (inRoad() && steppedOut == null) steppedOut = t;
      if (!inRoad() && steppedOut != null) {
        if (ped.y <= TOP + 2 && !crossed) {
          crossed = true;
          var waited = waitStart != null ? steppedOut - waitStart : 0;
          say(waited < 0.5 ? 'you didn’t wait for a signal. lucky it was paying attention.'
                            : 'made it. you waited ' + waited.toFixed(1) + ' s at the curb.');
        }
        steppedOut = null; waitStart = null;
      }

      /* cars */
      if (!car && t >= nextSpawn) spawn();
      if (car) {
        var front = car.x + CAR_L;
        var pedAhead = inRoad() && inLane() && ped.x > car.x - 12 && ped.x < front + 150;
        if (pedAhead && car.v > 0 && car.state !== 'emerg' && car.state !== 'wait') {
          if (car.state !== 'yield' || ped.x < front + 40) {
            car.state = 'emerg'; car.a = -A_EMERG;
            say('you stepped out first. it braked hard.');
          }
        }
        if (car.state === 'cruise' && intent && front < STOP_FRONT - 4) {
          var need = car.v * car.v / (2 * (STOP_FRONT - front));
          if (need <= A_MAX) {
            car.state = 'yield'; car.a = -need; car.noticed = true;
            if (!inRoad()) say('it noticed you. cyan means: go ahead.');
          } else if (!car.warned) {
            car.warned = true;
            if (!inRoad()) say('too close to stop smoothly. the pole says wait.');
          }
        }
        if (car.state === 'yield' || car.state === 'emerg') {
          car.v += car.a * dt;
          if (car.v <= 0) { car.v = 0; car.state = 'wait'; car.waitT = 0; }
        } else if (car.state === 'wait') {
          car.waitT += dt;
          var engaged = intent || inRoad();
          if (engaged) car.quietSince = null; else if (car.quietSince == null) car.quietSince = t;
          if (crossed && car.leaveAt == null) car.leaveAt = t + 0.5;
          if ((car.leaveAt != null && t >= car.leaveAt) ||
              (car.quietSince != null && t - car.quietSince > 1.2 && !inRoad()) ||
              (car.waitT > 8 && !inRoad())) {
            if (car.waitT > 8 && !crossed) say('it waited eight seconds, then gave up.');
            car.state = 'go';
          }
        } else if (car.state === 'go') {
          car.v = Math.min(V, car.v + A_GO * dt);
        }
        car.x += car.v * dt;
        if (car.x > 1040) { car = null; nextSpawn = t + 1.2 + Math.random() * 1.6; }
      }
    }

    /* live labels: created once, then only moved or shown/hidden */
    var youTxt = el('text', { 'class': 'note-txt small' }, gLive); youTxt.textContent = 'you';
    var aimPath = el('path', { 'class': 'pencil soft' }, gLive);
    var ehmiTxt = el('text', { 'class': 'note-txt small', visibility: 'hidden' }, gLive); ehmiTxt.textContent = 'eHMI';
    var gazePath = el('path', { 'class': 'gaze', visibility: 'hidden' }, gGaze);
    var lastAim = '';
    function show(node, on) { var v = on ? 'visible' : 'hidden'; if (node.getAttribute('visibility') !== v) node.setAttribute('visibility', v); }

    function render() {
      /* pedestrian */
      boilPed += 1;
      if (Math.hypot(ped.vx, ped.vy) > 12 && boilPed % 9 === 0) drawPed();
      gPed.setAttribute('transform', 'translate(' + f(ped.x) + ' ' + f(ped.y) + ') rotate(' + f(ped.heading * 180 / Math.PI) + ')');
      youTxt.setAttribute('x', f(ped.x + 14)); youTxt.setAttribute('y', f(ped.y + 22));
      var aimKey = aim && !touch ? Math.round(aim.x) + ',' + Math.round(aim.y) : '';
      if (aimKey !== lastAim) {               // re-draw the small cross only when the pointer moved
        lastAim = aimKey;
        if (aimKey) aimPath.setAttribute('d', stroke(aim.x - 4, aim.y, aim.x + 4, aim.y, 0.3) + stroke(aim.x, aim.y - 4, aim.x, aim.y + 4, 0.3));
        show(aimPath, !!aimKey);
      }
      /* car */
      var walk = true, ehmiOn = false, gazeOn = false;
      if (car) {
        boilCar += 1;
        if (car.v > 5 && boilCar % 8 === 0) drawCar();
        gCar.setAttribute('transform', 'translate(' + f(car.x) + ' ' + LANE + ')');
        lidarBeam.setAttribute('transform', 'translate(42 0) rotate(' + Math.round(t * 400 % 360) + ')');   // the roof sensor keeps scanning
        if (gCar.style.display) gCar.style.display = '';
        if (car.state === 'yield') ehmiOn = true;
        else if (car.state === 'wait' && !crossed && car.noticed) ehmiOn = Math.floor(t * 2.4) % 2 === 0;
        else if (car.state === 'wait' && !crossed) ehmiOn = true;
        ehmiEl.classList.toggle('on', ehmiOn);
        show(alarmEl, car.state === 'emerg');
        if (ehmiOn) { ehmiTxt.setAttribute('x', f(car.x + CAR_L + 10)); ehmiTxt.setAttribute('y', LANE - 26); }
        if ((car.state === 'yield' || car.state === 'wait') && car.noticed && !crossed) {
          var sx = car.x + 70, sy = LANE, ex = ped.x, ey = ped.y;
          var mx = (sx + ex) / 2 + 30, my = (sy + ey) / 2 - 10;
          gazePath.setAttribute('d', 'M' + f(sx) + ' ' + f(sy) + 'Q' + f(mx) + ' ' + f(my) + ' ' + f(ex) + ' ' + f(ey));
          gazeOn = true;
        }
        var committed = car.state === 'yield' || car.state === 'wait';
        if (!committed && car.x < CW1 + 20 && car.x + CAR_L > 250) walk = false;
      } else if (gCar.style.display !== 'none') gCar.style.display = 'none';
      show(ehmiTxt, ehmiOn);
      show(gazePath, gazeOn);
      setPole(walk);
    }

    function loop(now) {
      var dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      step(dt);
      render();
      raf = running && visible ? requestAnimationFrame(loop) : 0;
    }
    function kick() {
      if (!raf && running && visible) { last = performance.now(); raf = requestAnimationFrame(loop); }
    }

    /* --- input --- */
    function toLocal(e) {
      var pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      var m = svg.getScreenCTM(); if (!m) return null;
      var p = pt.matrixTransform(m.inverse());
      return { x: Math.max(8, Math.min(992, p.x)), y: Math.max(8, Math.min(254, p.y)) };
    }
    var dragging = false;
    svg.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch' && !dragging) return;
      var p = toLocal(e); if (!p) return;
      aim = p; ped.tx = p.x; ped.ty = p.y; kick();
    });
    svg.addEventListener('pointerdown', function (e) {
      dragging = true; svg.setPointerCapture && svg.setPointerCapture(e.pointerId);
      var p = toLocal(e); if (p) { ped.tx = p.x; ped.ty = p.y; } kick();
    });
    ['pointerup', 'pointercancel'].forEach(function (n) { svg.addEventListener(n, function () { dragging = false; }); });
    svg.addEventListener('pointerleave', function () { aim = null; });
    svg.addEventListener('keydown', function (e) {
      var d = { ArrowUp: [0, -24], ArrowDown: [0, 24], ArrowLeft: [-24, 0], ArrowRight: [24, 0], ' ': [0, -30] }[e.key];
      if (!d) return;
      e.preventDefault();
      ped.tx = Math.max(8, Math.min(992, ped.tx + d[0])); ped.ty = Math.max(8, Math.min(254, ped.ty + d[1]));
      kick();
    });

    pauseBtn.addEventListener('click', function () {
      running = !running;
      pauseBtn.textContent = running ? 'pause' : 'play';
      pauseBtn.setAttribute('aria-pressed', running ? 'false' : 'true');
      kick();
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; kick(); }).observe(fig);
    }
    document.addEventListener('visibilitychange', function () { visible = !document.hidden; kick(); });

    /* --- first frame --- */
    drawPed(); setPole(true);
    if (touch) say('drag to the curb and wait. you are the pedestrian.');
    if (!running) { pauseBtn.textContent = 'play'; pauseBtn.setAttribute('aria-pressed', 'true'); render(); }
    kick();
  })();
  /* ---------- 3. Fig. 2 — the smart pole, taken apart by scroll ----------
     A pencil elevation of the real SPIU: camera unit on top, a ring LED
     display, bracket arms, the pole, and a wheeled base. The pinned scroll
     moves each part out, holds while hand-written leaders draw in, puts it
     back together, and the ring switches from STOP to WALK. The ring text
     scrolls with the page. Only the visitor's scroll moves anything.
     Reduced motion: a still, taken-apart drawing. */
  (function () {
    var sec = document.getElementById('spiu');
    if (!sec) return;
    var svg = sec.querySelector('svg'), phase = sec.querySelector('.td-phase');
    var P = pencil(23), line = P.line, rect = P.rect, ellipse = P.ellipse, stroke = P.stroke, path = P.path, f = P.f;

    function arc(cx, cy, rx, ry, a0, a1, jit) {          // part of an ellipse, pencil-jittered
      var d = '', n = 18, i, t;
      for (i = 0; i <= n; i++) {
        t = a0 + (a1 - a0) * i / n;
        d += (i ? 'L' : 'M') + f(cx + Math.cos(t) * (rx + P.j(jit))) + ' ' + f(cy + Math.sin(t) * (ry + P.j(jit)));
      }
      return d;
    }
    var PI = Math.PI;
    /* camera unit */
    var cam = '<path class="paper" d="M200 52 L200 150 L260 150 L260 52 Z"/>' +
      path(arc(230, 52, 30, 8, 0, 2 * PI, .5) + line(200, 52, 200, 150, .8) + line(260, 52, 260, 150, .8) + arc(230, 150, 30, 8, 0, PI, .5)) +
      path(ellipse(216, 84, 12, 12, .5) + ellipse(216, 84, 6, 6, .3)) + path(rect(211, 104, 9, 16, .4)) +
      path(line(204, 128, 256, 128, .5), 'pencil soft');
    /* ring LED display */
    var band = 'M110 168 L110 214 A120 18 0 0 0 350 214 L350 168 A120 18 0 0 1 110 168 Z';
    var ring = '<defs><clipPath id="td-band"><path d="' + band + '"/></clipPath></defs>' +
      '<path d="' + band + '" fill="#1E1D1B"/>' +
      '<g clip-path="url(#td-band)"><text class="td-led" x="110" y="208"></text></g>' +
      path(arc(230, 168, 120, 18, 0, 2 * PI, .7) + line(110, 168, 110, 214, .6) + line(350, 168, 350, 214, .6) + arc(230, 214, 120, 18, 0, PI, .7));
    /* bracket arms */
    var arms = path(stroke(140, 228, 176, 262, 1.4) + stroke(176, 262, 214, 292, 1.2) + stroke(170, 232, 192, 266, 1) + stroke(192, 266, 214, 296, 1) +
      stroke(320, 228, 284, 262, 1.4) + stroke(284, 262, 246, 292, 1.2) + stroke(290, 232, 268, 266, 1) + stroke(268, 266, 246, 296, 1) +
      stroke(200, 230, 214, 300, .8) + stroke(260, 230, 246, 300, .8));
    /* pole */
    var pole = '<rect class="paper" x="214" y="226" width="32" height="390"/>' +
      path(line(214, 226, 214, 614, 1) + line(246, 226, 246, 614, 1)) + path(line(238, 240, 238, 600, .6), 'pencil soft') +
      path(arc(230, 614, 22, 6, 0, PI, .4));
    /* wheeled base */
    var base = '<path class="paper" d="M128 640 L300 640 L340 616 L340 704 L300 728 L128 728 Z"/>' +
      path(line(128, 640, 300, 640, 1) + line(300, 640, 340, 616, .8) + line(340, 616, 168, 616, .8) + line(168, 616, 128, 640, .8) +
           line(128, 640, 128, 728, 1) + line(300, 640, 300, 728, 1) + line(340, 616, 340, 704, 1) + line(128, 728, 300, 728, 1) + line(300, 728, 340, 704, .8)) +
      path(line(140, 660, 290, 660, .5), 'pencil soft') +
      '<ellipse class="paper" cx="150" cy="736" rx="16" ry="18"/><ellipse class="paper" cx="286" cy="736" rx="16" ry="18"/>' +
      path(ellipse(150, 736, 16, 18, .6) + ellipse(150, 736, 6, 7, .3) + ellipse(286, 736, 16, 18, .6) + ellipse(286, 736, 6, 7, .3) + ellipse(330, 712, 11, 14, .5));

    var PARTS = [
      { name: 'camera unit', note: 'watches the crossing and the cars', dir: [0, -1], dist: 130, anchor: [262, 96], label: [470, -44], draw: cam },
      { name: 'ring display', note: 'printed ribs inside, flexible LEDs outside', dir: [0, -1], dist: 46, anchor: [352, 190], label: [470, 112], draw: ring },
      { name: 'bracket arms', note: 'hold the ring above the crowd', dir: [0, 0], dist: 0, anchor: [300, 250], label: [470, 268], draw: arms },
      { name: 'the pole', note: 'speaks for every car at the crossing', dir: [0, 0], dist: 0, anchor: [246, 440], label: [470, 440], draw: pole },
      { name: 'mobile base', note: 'on wheels, so it can follow you (CHI ’26)', dir: [0, 1], dist: 54, anchor: [340, 660], label: [470, 690], draw: base }
    ];
    var ORDER = [4, 3, 2, 1, 0];                 // paint back to front: base, pole, arms, ring, camera

    var h = '', i, k;
    for (k = 0; k < ORDER.length; k++) {
      i = ORDER[k];
      h += '<g class="td-part" data-i="' + i + '">' + PARTS[i].draw + '</g>';
    }
    for (i = 0; i < PARTS.length; i++) {
      h += '<g class="td-label" data-i="' + i + '" opacity="0"><path class="lead" pathLength="1" d=""/>' +
           '<text class="lbl-num" x="' + PARTS[i].label[0] + '" y="' + (PARTS[i].label[1] - 28) + '">2' + 'abcde'[i] + '</text>' +
           '<text class="lbl" x="' + PARTS[i].label[0] + '" y="' + PARTS[i].label[1] + '">' + PARTS[i].name + '</text>' +
           '<text class="lbl-sub" x="' + PARTS[i].label[0] + '" y="' + (PARTS[i].label[1] + 28) + '">' + PARTS[i].note + '</text></g>';
    }
    h += path(line(90, 760, 380, 760, 1.4), 'pencil soft');
    svg.innerHTML += h;
    var gParts = {}, gLabels = {};
    svg.querySelectorAll('.td-part').forEach(function (g) { gParts[g.getAttribute('data-i')] = g; });
    svg.querySelectorAll('.td-label').forEach(function (g) { gLabels[g.getAttribute('data-i')] = g; });
    var led = svg.querySelector('.td-led'), ledState = '';

    function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
    function ease(x) { return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }   // cubic in-out

    function draw(p) {
      var back = ease(clamp((p - .70) / .18));
      for (var i = 0; i < PARTS.length; i++) {
        var pt = PARTS[i];
        var out = ease(clamp((p - (.06 + i * .05)) / .2)) * (1 - back);
        var dx = pt.dir[0] * pt.dist * out, dy = pt.dir[1] * pt.dist * out;
        gParts[i].setAttribute('transform', 'translate(' + f(dx) + ' ' + f(dy) + ')');
        var show = pt.dist ? clamp((out - .55) / .45) : clamp((p - (.2 + i * .05)) / .12) * (1 - back);
        var lab = gLabels[i];
        lab.setAttribute('opacity', show ? 1 : 0);
        var ax = pt.anchor[0] + dx, ay = pt.anchor[1] + dy, lx = pt.label[0] - 12, ly = pt.label[1] - 9;
        var lead = lab.firstChild;
        lead.setAttribute('d', 'M' + f(ax) + ' ' + f(ay) + 'Q' + f((ax + lx) / 2) + ' ' + f(ay) + ' ' + f(lx) + ' ' + f(ly));
        lead.style.strokeDashoffset = 1 - show;
        for (var k = 1; k < lab.childNodes.length; k++) lab.childNodes[k].setAttribute('opacity', clamp(show * 1.4 - .4));
      }
      var walk = p > .9 || p < .03;
      var s = walk ? 'walk' : 'stop';
      if (s !== ledState) {
        ledState = s;
        led.textContent = walk ? 'WALK  WALK  WALK  WALK' : 'STOP  STOP  STOP  STOP';
        led.setAttribute('class', 'td-led ' + s);
      }
      led.setAttribute('x', f(110 - (p * 900) % 190));      // the ring turns with your scroll
      phase.textContent = p < .05 ? 'scroll to take it apart' : p < .45 ? 'every part has one job' :
        p < .70 ? 'five parts, one message' : p < .9 ? 'putting it back together' : 'back together, it says: go.';
    }

    if (reduceMotion) { sec.classList.add('is-static'); draw(.5); return; }
    var track = sec.querySelector('.td-track'), ticking = false;
    function onScroll() {
      ticking = false;
      var rr = track.getBoundingClientRect(), span = rr.height - window.innerHeight;
      draw(span > 0 ? clamp(-rr.top / span) : 0);
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();
  })();
  /* ---------- 4. the Fusion 360 model: plays only while you hover or after a tap ---------- */
  (function () {
    var v = document.querySelector('.make-video');
    if (!v) return;
    var hint = v.parentNode.querySelector('.make-hint');
    var hover = window.matchMedia && window.matchMedia('(hover: hover)').matches;
    if (!hover && hint) hint.textContent = 'tap to turn it.';
    function play() { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
    if (hover) {
      v.addEventListener('mouseenter', play);
      v.addEventListener('mouseleave', function () { v.pause(); });
    }
    v.addEventListener('click', function () { if (v.paused) play(); else v.pause(); });
    v.setAttribute('tabindex', '0');
    v.addEventListener('keydown', function (e) {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (v.paused) play(); else v.pause(); }
    });
  })();
})();
