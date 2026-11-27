/* hci.js — homepage layer (loaded with `defer`).
   1. Reading progress bar + current-section highlight in the nav
   2. The street: a hand-drawn crossing where the visitor is the pedestrian.
      Self-driving cars notice you at the curb, brake with real deceleration
      (v² = 2ad), light a cyan eHMI bar, and the smart pole (SPIU) rolls out and crosses with you,
      showing WALK. Everything is drawn with seeded pencil jitter; moving
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
    function frame() { svg.setAttribute('viewBox', narrow.matches ? '410 -100 600 378' : '0 -100 1000 376'); }   // a strip of sky on top for the flyer
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

    var frontHTML = '';
    /* --- static scene: drawn once --- */
    (function drawStatic() {
      var h = '';
      /* parts of the scene are grouped by research area (ar-mobility, ar-urban,
         ar-hri, ar-design) so one area can be picked out and the rest faded */
      h += '<g class="ar-mobility">';
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
      h += '</g><g class="ar-urban">';
      /* the shared space: around the crossing the road and both pavements are one
         paved surface (block paving, a warm wash), with low bollards at its corners */
      var SS0 = CW0 - 38, SS1 = CW1 + 38, row = 0;
      h += '<rect class="share-wash" x="' + SS0 + '" y="' + (TOP - 25) + '" width="' + (SS1 - SS0) + '" height="' + (BOT - TOP + 52) + '"/>';
      d = '';
      for (y = TOP - 21; y < BOT + 25; y += 7, row++) {
        var inRoadRow = y > TOP - 3 && y < BOT + 1;
        for (x = SS0 + (row % 2 ? 2 : 8); x < SS1 - 4; x += 13) {
          if (inRoadRow && x + 9 > CW0 && x < CW1) continue;           // the zebra keeps its own stripes
          if (r() < 0.2) continue;                                      // a few gaps, as if drawn quickly
          d += stroke(x, y, Math.min(x + 9, SS1 - 2), y, 0.25) + stroke(x, y, x, y + 2.6, 0.12);
        }
      }
      h += path(d, 'pencil hatch');
      h += path(stroke(SS0, TOP - 25, SS0, BOT + 27, 0.5) + stroke(SS1, TOP - 25, SS1, BOT + 27, 0.5), 'pencil soft');
      for (y = TOP + 9; y < BOT - 12; y += 17) {             // zebra stripes
        h += path(rect(CW0 + 4, y, CW1 - CW0 - 8, 9, 0.9));
        d = '';
        for (x = CW0 + 9; x < CW1 - 6; x += 5) d += stroke(x, y + 8, x + 4, y + 1, 0.25);
        h += path(d, 'pencil soft');
      }
      h += path(line(STOP_FRONT + 6, MID + 5, STOP_FRONT + 6, BOT - 4, 1), 'pencil');
      h += '</g>';

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
        var glow = '';                                     // at night some windows are lit (see .win-glow)
        for (fl = 0; fl < floors; fl++) for (k = 0; k < n; k++) {
          s += rect(x + k * gap + gap * 0.25, top + fl * UP + 3, gap * 0.5, UP - 7, 0.25);
          if ((Math.round(x) * 3 + k * 7 + fl * 5) % 5 < 3)
            glow += '<rect class="win-glow" x="' + f(x + k * gap + gap * 0.25) + '" y="' + f(top + fl * UP + 3) + '" width="' + f(gap * 0.5) + '" height="' + (UP - 7) + '"/>';
        }
        return glow + path(s, 'pencil soft');
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
        } else if (kind === 'studio') {                    // the design studio: through the window, the work in progress
          var wx = x + 5, wy = G - 18;
          s += path(box(wx, wy, 57, 18, 0.3)) + path(box(x + w - 18, G - 17, 11, 17, 0.25) + stroke(x + w - 9.6, G - 9, x + w - 9.6, G - 7.6, 0.05));
          var notes = '', washes = ['tactile-wash', 'awning-wash', 'sign-wash', 'tree-wash'], nx, ny, q = 0;
          for (ny = 0; ny < 2; ny++) for (nx = 0; nx < 5; nx++, q++) {      // sticky notes on the wall
            if (q === 3 || q === 8) continue;
            var sx = wx + 3 + nx * 3.7 + j(0.25), sy = wy + 2.4 + ny * 3.9 + j(0.25);
            s += '<rect class="' + washes[q % 4] + '" x="' + f(sx) + '" y="' + f(sy) + '" width="2.8" height="2.8"/>';
            notes += box(sx, sy, 2.8, 2.8, 0.06);
          }
          s += path(notes, 'pencil soft');
          s += figure(wx + 30, G - 0.6, { s: 0.74, pose: 'stand', dir: 1, wash: 'tree-wash' }) +               // someone testing in a headset
               '<rect class="car-tyre" x="' + f(wx + 28.2) + '" y="' + f(G - 15.7) + '" width="4.4" height="2" rx="0.6"/>' +
               path(stroke(wx + 32.6, G - 14.8, wx + 30.4, G - 14.2, 0.05), 'pencil soft');
          s += path(line(wx + 39, G - 5, wx + 55, G - 5, 0.15) + stroke(wx + 41, G - 5, wx + 41, G, 0.1) + stroke(wx + 53, G - 5, wx + 53, G, 0.1), 'pencil soft') +   // workbench
               path(box(wx + 43.6, G - 8.6, 5.4, 3.6, 0.08) + stroke(wx + 46.3, G - 8.6, wx + 46.3, G - 14.6, 0.08) + ellipse(wx + 46.3, G - 15, 3.4, 0.9, 0.06) +     // a half-built pole
                    stroke(wx + 51, G - 5.2, wx + 54, G - 6.4, 0.06) + stroke(wx + 52.4, G - 5.2, wx + 51.4, G - 7.4, 0.06));
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
      h += '<g class="ar-design">' + building(436, 86, 3, 'studio', 'studio') + '</g>';
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
      h += '<g class="ar-urban">';
      [TOP - 9, BOT + 2].forEach(function (yy) {
        h += '<rect class="tactile-wash" x="' + (CW0 + 4) + '" y="' + yy + '" width="' + (CW1 - CW0 - 8) + '" height="7"/>';
        var dts = '';
        for (var tx = CW0 + 8; tx < CW1 - 6; tx += 5) dts += ellipse(tx, yy + 3.5, 0.8, 0.8, 0.05);
        h += path(dts, 'pencil soft');
      });
      h += '</g>';
      // parked bicycles outside the convenience store (seen from above)
      [[700, 22], [712, 24], [724, 22]].forEach(function (b) {
        h += path(stroke(b[0], b[1] - 9, b[0], b[1] + 9, 0.15) + ellipse(b[0], b[1] - 7, 1.2, 4, 0.1) + ellipse(b[0], b[1] + 7, 1.2, 4, 0.1) + stroke(b[0] - 4, b[1] - 3, b[0] + 4, b[1] - 3, 0.1));
      });
      /* --- people, drawn standing up like everything else on the pavements --- */
      function box(x0, y0, w0, h0, a) {                   // a small box without the overshooting corners of rect()
        return stroke(x0, y0, x0 + w0, y0, a) + stroke(x0 + w0, y0, x0 + w0, y0 + h0, a) + stroke(x0 + w0, y0 + h0, x0, y0 + h0, a) + stroke(x0, y0 + h0, x0, y0, a);
      }
      function figure(x, base, o) {
        // o.pose: 'stand' | 'walk' | 'sit'   o.dir: 1 faces right, -1 left   o.s: size   o.wash: colour of the clothes
        o = o || {};
        var sc = o.s || 1, dir = o.dir || 1, pose = o.pose || 'stand', out = '', soft = '';
        function X(v) { return x + v * sc * dir; }
        function Y(v) { return base - v * sc; }
        function seg(x1, y1, x2, y2, a) { return stroke(X(x1), Y(y1), X(x2), Y(y2), a == null ? 0.2 : a); }
        var hip = pose === 'sit' ? 6.6 : 9.2, sh = hip + 7.2, headY = hip + 10.4, lean = pose === 'sit' ? 0.5 : pose === 'walk' ? 0.8 : 0;
        if (o.wash) out += '<ellipse class="' + o.wash + '" cx="' + f(X(lean / 2 + 0.6)) + '" cy="' + f(Y(hip + 3.6) + 0.6) + '" rx="' + f(2.5 * sc) + '" ry="' + f(4.4 * sc) + '"/>';
        var body = ellipse(X(lean + 0.2), Y(headY), 2.3 * sc, 2.5 * sc, 0.15) + seg(lean, sh + 0.9, 0, hip, 0.25);
        if (pose === 'sit') {
          body += seg(0, hip, 4.8, hip + 0.1) + seg(4.8, hip + 0.1, 5.3, 0) + seg(5.3, 0, 6.6, 0, 0.1);            // thigh, shin, foot
          body += seg(lean, sh, 2.6, sh - 3.4) + seg(2.6, sh - 3.4, 5.4, sh - 3.2);                              // arm resting on the table
          soft += seg(-2.4, hip - 0.5, 2.6, hip - 0.5, 0.15) + seg(-2.4, hip - 0.5, -3.3, hip + 8, 0.2) +          // chair seat and back
                  seg(-2.4, hip - 0.5, -2.8, 0, 0.15) + seg(2.4, hip - 0.5, 2.7, 0, 0.15);
        } else if (pose === 'walk') {
          body += seg(0, hip, 2.9, hip / 2 + 0.3) + seg(2.9, hip / 2 + 0.3, 2.4, 0) + seg(2.4, 0, 3.8, 0, 0.1);    // leading leg
          body += seg(0, hip, -1.6, hip / 2) + seg(-1.6, hip / 2, -3.6, 0.5) + seg(-3.6, 0.5, -2.6, 0, 0.1);       // trailing leg
          body += seg(lean, sh, 2.4, sh - 3.6) + seg(2.4, sh - 3.6, 3.4, sh - 6.6) + seg(lean, sh, -2.2, sh - 3.4) + seg(-2.2, sh - 3.4, -2.6, sh - 6.4);
        } else {
          body += seg(0, hip, -1.5, 0) + seg(-1.5, 0, -0.4, 0, 0.1) + seg(0, hip, 1.5, 0) + seg(1.5, 0, 2.7, 0, 0.1);
          body += seg(0, sh, -2.2, sh - 3.6) + seg(-2.2, sh - 3.6, -2.2, sh - 6.8) + seg(0, sh, 2.2, sh - 3.4) + seg(2.2, sh - 3.4, 3.2, sh - 6);
        }
        if (o.bag) soft += box(X(-3.8) - (dir < 0 ? 3.2 * sc : 0), Y(hip + 1.6), 3.2 * sc, 3.8 * sc, 0.15) + seg(-2.2, hip + 1.6, 0, sh, 0.15);
        if (o.hair) body += seg(-2.3, headY + 0.6, -2.9, headY - 3.4, 0.25) + seg(-1.9, headY + 1.6, -2.6, headY - 2.6, 0.2);
        return out + path(soft, 'pencil soft') + path(body);
      }
      function table(x, base, cups) {
        var s2 = path(line(x - 5.4, base - 9.6, x + 5.4, base - 9.6, 0.25) + stroke(x, base - 9.6, x, base, 0.2) + stroke(x - 3.2, base, x + 3.2, base, 0.2));
        var c = '', st = '';
        (cups || []).forEach(function (cx2) {
          c += box(x + cx2 - 0.9, base - 11.8, 1.8, 2.1, 0.08) + stroke(x + cx2 + 0.9, base - 11.2, x + cx2 + 1.8, base - 10.6, 0.06);
          st += 'M' + f(x + cx2) + ' ' + f(base - 12.6) + 'q1.1 -1.3 0 -2.6q-1.1 -1.3 0 -2.6';                   // a little steam
        });
        return s2 + path(c) + path(st, 'pencil hatch');
      }
      function parasol(x, base) {
        var top = base - 31, rim = base - 23, d2 = 'M' + f(x - 16) + ' ' + f(rim), k2;
        for (k2 = 0; k2 < 4; k2++) d2 += 'q4 2.4 8 0';                                                           // scalloped edge
        return '<path class="awning-wash" d="M' + f(x - 15) + ' ' + f(rim + 1) + 'Q' + f(x + 1) + ' ' + f(top - 4) + ' ' + f(x + 17) + ' ' + f(rim + 1) + 'Z"/>' +
               path(stroke(x, base - 9.6, x, top + 1, 0.2), 'pencil soft') +
               path('M' + f(x - 16) + ' ' + f(rim) + 'Q' + f(x) + ' ' + f(top - 6) + ' ' + f(x + 16) + ' ' + f(rim) + d2 +
                    'M' + f(x - 8) + ' ' + f(rim + 0.6) + 'Q' + f(x - 5) + ' ' + f(top - 0.5) + ' ' + f(x) + ' ' + f(top - 2.6) + 'M' + f(x + 8) + ' ' + f(rim + 0.6) + 'Q' + f(x + 5) + ' ' + f(top - 0.5) + ' ' + f(x) + ' ' + f(top - 2.6));
      }
      // the café terrace: two tables under parasols, friends talking, someone with a laptop, a waiter
      var TY = 38;
      h += parasol(336, TY) + parasol(386, TY - 1);
      h += figure(326, TY, { pose: 'sit', dir: 1, wash: 'sign-wash', hair: true }) + figure(346, TY, { pose: 'sit', dir: -1, wash: 'awning-wash' });
      h += table(336, TY, [-2.6, 2.4]);
      h += figure(376, TY - 1, { pose: 'sit', dir: 1, wash: 'tree-wash' }) + table(386, TY - 1, [3]);
      h += path(box(382.6, TY - 14.4, 4.6, 3.6, 0.1) + stroke(381.6, TY - 10.8, 388.4, TY - 10.8, 0.1), 'pencil');       // laptop
      h += path(stroke(394.6, TY - 7.5, 399.6, TY - 7.5, 0.15) + stroke(399.6, TY - 7.5, 400.6, TY - 15.6, 0.2) + stroke(394.8, TY - 7.5, 394.6, TY - 1, 0.15) + stroke(399.6, TY - 7.5, 399.9, TY - 1, 0.15), 'pencil soft');   // an empty chair
      h += figure(361, TY + 9, { pose: 'walk', dir: -1, wash: 'noren-wash' }) +                                           // the waiter, with a tray
           path(stroke(352.6, TY - 4.6, 358.4, TY - 4.9, 0.12) + box(354.4, TY - 6.9, 1.7, 2, 0.06) + box(356.6, TY - 6.6, 1.3, 1.7, 0.06));
      // a bench by the crossing: one person reading, one looking at the street
      var BY = 38;
      h += path(line(468, BY - 6.4, 512, BY - 6.4, 0.3) + line(468, BY - 12, 512, BY - 12, 0.25) + line(468, BY - 14.6, 512, BY - 14.6, 0.25) +
                stroke(470, BY - 15, 470, BY, 0.2) + stroke(510, BY - 15, 510, BY, 0.2) + stroke(476, BY - 6.4, 476, BY, 0.15) + stroke(504, BY - 6.4, 504, BY, 0.15), 'pencil soft');
      h += figure(482, BY + 0.2, { pose: 'sit', dir: 1, wash: 'tactile-wash', hair: true }) + path(box(486, BY - 12.4, 3.4, 2.6, 0.08), 'pencil');
      h += figure(499, BY + 0.2, { pose: 'sit', dir: 1, wash: 'sign-wash' });
      // people on foot, sharing the space: a parent and child, a shopper, a dog walker, two friends
      h += figure(632, 46, { pose: 'walk', dir: -1, wash: 'awning-wash', hair: true }) + figure(641, 46.5, { pose: 'walk', dir: -1, s: 0.62, wash: 'tactile-wash' }) +
           path(stroke(635.4, 33.2, 639.2, 37.4, 0.1), 'pencil');                                                        // holding hands
      h += figure(742, 30, { pose: 'stand', dir: -1, wash: 'tree-wash', bag: true });
      var front = '';                                      // things on the near pavement that stand in front of the cyclist
      front += figure(246, 236, { pose: 'walk', dir: 1, wash: 'sign-wash' }) +
           path(stroke(249.4, 226.6, 262, 232.4, 0.15), 'pencil soft') +                                                 // the lead
           path(ellipse(266.5, 232, 4.2, 2.1, 0.15) + ellipse(271.6, 229.6, 1.7, 1.5, 0.1) + stroke(272.4, 228.4, 273.2, 226.8, 0.08) +
                stroke(263.4, 233.4, 263, 236, 0.08) + stroke(265.4, 233.8, 265.6, 236, 0.08) + stroke(268.4, 233.8, 268.6, 236, 0.08) + stroke(269.8, 233.4, 270.4, 236, 0.08) +
                stroke(262.4, 231.4, 260.2, 229, 0.1));                                                                   // the dog
      front += figure(826, 238, { pose: 'stand', dir: 1, wash: 'awning-wash', hair: true }) + figure(838, 238.4, { pose: 'stand', dir: -1, wash: 'noren-wash', bag: true });
      function delivery(x, base, dir) {                    // a small six-wheeled delivery robot with its flag
        var s3 = '<rect class="sign-wash" x="' + f(x - 6.4) + '" y="' + f(base - 10.4) + '" width="13.6" height="7.6"/>';
        s3 += path('M' + f(x - 7) + ' ' + f(base - 3.2) + 'V' + f(base - 9) + 'Q' + f(x - 7) + ' ' + f(base - 11.4) + ' ' + f(x - 4.6) + ' ' + f(base - 11.4) + 'H' + f(x + 4.6) +
                   'Q' + f(x + 7) + ' ' + f(base - 11.4) + ' ' + f(x + 7) + ' ' + f(base - 9) + 'V' + f(base - 3.2) + 'Z' +
                   ellipse(x - 4.6, base - 1.8, 1.8, 1.8, 0.08) + ellipse(x, base - 1.8, 1.8, 1.8, 0.08) + ellipse(x + 4.6, base - 1.8, 1.8, 1.8, 0.08));
        s3 += path(stroke(x - 7, base - 8.6, x + 7, base - 8.6, 0.1) + stroke(x - 4 * dir, base - 11.4, x - 4.6 * dir, base - 20, 0.1) +
                   stroke(x - 4.6 * dir, base - 20, x - 1 * dir, base - 18.8, 0.06) + stroke(x - 1 * dir, base - 18.8, x - 4.5 * dir, base - 17.4, 0.06) +
                   ellipse(x + 4.8 * dir, base - 6.4, 0.7, 0.9, 0.04) + ellipse(x + 2.4 * dir, base - 6.4, 0.7, 0.9, 0.04), 'pencil soft');
        // it is waiting: two small arcs of light towards the people it lets pass
        s3 += '<path class="pencil signal" d="M' + f(x + 9.4 * dir) + ' ' + f(base - 9.6) + 'q' + f(2.2 * dir) + ' 3 0 6M' + f(x + 12.4 * dir) + ' ' + f(base - 11) + 'q' + f(3.2 * dir) + ' 4.4 0 8.8"/>';
        return s3;
      }
      function companion(x, base, dir) {                   // a co-walker: wheeled base, short mast, a round head with a face
        var s4 = '<rect class="awning-wash" x="' + f(x - 3.6) + '" y="' + f(base - 9.6) + '" width="8.6" height="6.6"/>';
        s4 += path(box(x - 4.4, base - 10, 8.8, 7, 0.12) + ellipse(x - 2.6, base - 1.7, 1.7, 1.7, 0.08) + ellipse(x + 2.6, base - 1.7, 1.7, 1.7, 0.08) +
                   stroke(x - 0.8, base - 10, x - 0.8, base - 13.4, 0.08) + stroke(x + 0.8, base - 10, x + 0.8, base - 13.4, 0.08));
        s4 += '<ellipse class="fill-car" cx="' + f(x) + '" cy="' + f(base - 16) + '" rx="3.7" ry="3"/>' +
              path(ellipse(x, base - 16, 3.7, 3, 0.12) + ellipse(x - 1.3 + dir * 0.5, base - 16.5, 0.45, 0.6, 0.03) + ellipse(x + 1.3 + dir * 0.5, base - 16.5, 0.45, 0.6, 0.03) +
                   'M' + f(x - 1.2 + dir * 0.5) + ' ' + f(base - 14.9) + 'q1.2 0.9 2.4 0' + stroke(x, base - 19, x, base - 20.6, 0.05));
        // it shows where it is about to go: a short arrow of light on the ground ahead
        s4 += '<path class="pencil signal" d="M' + f(x + 7 * dir) + ' ' + f(base - 0.6) + 'h' + f(8 * dir) + 'm' + f(-2.6 * dir) + ' -1.8l' + f(2.6 * dir) + ' 1.8l' + f(-2.6 * dir) + ' 1.8"/>';
        return s4;
      }
      h += '<g class="ar-hri">' + delivery(661, 47.5, -1) + '</g>';                                    // waits for the parent and child
      front += '<g class="ar-hri">' + figure(770, 241, { pose: 'walk', dir: 1, wash: 'tactile-wash', hair: true }) + companion(783, 241.4, 1) + '</g>';
      // low bollards at the corners of the shared space
      h += '<g class="ar-urban">';
      [[SS0, TOP - 2], [SS1, TOP - 2], [SS0, BOT + 12], [SS1, BOT + 12]].forEach(function (b) {
        h += '<rect class="fill-car" x="' + (b[0] - 1.4) + '" y="' + (b[1] - 8) + '" width="2.8" height="8"/>' +
             path(box(b[0] - 1.4, b[1] - 8, 2.8, 8, 0.12) + ellipse(b[0], b[1] - 8.6, 1.7, 1, 0.08) + stroke(b[0] - 1.4, b[1] - 5.6, b[0] + 1.4, b[1] - 5.6, 0.06));
      });
      h += text(SS1 + 10, TOP + 22, 'shared space', 'note-txt small') +
           path(stroke(SS1 + 8, TOP + 16, SS1 - 6, TOP + 12, 0.8) + stroke(SS1 - 6, TOP + 12, SS1 + 0.5, TOP + 9.5, 0.3) + stroke(SS1 - 6, TOP + 12, SS1 - 1, TOP + 16.5, 0.3), 'pencil soft');
      h += '</g>';
      function tree(cx, base, s, kind) {
        /* a street tree drawn standing up, like the shop fronts: a tapering trunk in
           its tree pit, forking branches, and a crown built from overlapping leaf
           masses: scalloped outline, leaf scribble on the shaded side, and a light
           watercolour wash that doesn't quite line up.
           kind 0: broad, vase-shaped (zelkova)   kind 1: tall and narrow (ginkgo) */
        function X(x) { return cx + x * s; }
        function Y(y) { return base + y * s; }
        var blobs = kind ? [[0, -29, 7.5], [-4.5, -36, 7], [4.5, -38, 7], [-1, -45, 6.5], [1.5, -52, 4.6]]
                         : [[-10.5, -31, 8.5], [9.5, -32, 9], [-1, -41, 10], [-3.5, -30, 6.5], [5, -27.5, 5.8], [8, -41, 6]];
        blobs = blobs.map(function (q) { return [q[0] + j(1), q[1] + j(1), q[2] * (1 + j(0.07))]; });
        var i, k, t0, out = '', leaf = '', back = '', wash = '';
        // trunk, root flare, tree pit and a little cast shadow
        var topY = kind ? -24 : -20;
        var trunk = stroke(X(-2.6), Y(0), X(-1.5), Y(-9), 0.25) + stroke(X(-1.5), Y(-9), X(-1.1), Y(topY), 0.25) +
                    stroke(X(2.6), Y(0), X(1.6), Y(-9), 0.25) + stroke(X(1.6), Y(-9), X(1.1), Y(topY), 0.25);
        var bark = stroke(X(-0.4), Y(-3), X(-0.2), Y(-8), 0.2) + stroke(X(0.6), Y(-10), X(0.4), Y(-16), 0.2) + stroke(X(1), Y(-2), X(0.9), Y(-5), 0.15);
        var limbs = kind
          ? stroke(X(0), Y(topY), X(-0.5), Y(-40), 0.4) + stroke(X(0), Y(-27), X(-5), Y(-34), 0.3) + stroke(X(0), Y(-30), X(4.5), Y(-37), 0.3) + stroke(X(-0.3), Y(-36), X(-4), Y(-42), 0.3)
          : stroke(X(-1), Y(topY), X(-8.5), Y(-30), 0.4) + stroke(X(1), Y(topY), X(8), Y(-31), 0.4) + stroke(X(0), Y(topY), X(-0.5), Y(-36), 0.4) +
            stroke(X(-5), Y(-25.5), X(-3), Y(-33), 0.3) + stroke(X(4.6), Y(-25.6), X(4), Y(-34), 0.3) + stroke(X(-0.3), Y(-30), X(4), Y(-38), 0.3);
        var pit = stroke(X(-8), Y(0), X(8), Y(0), 0.3) + stroke(X(-8), Y(0), X(-6.5), Y(1.8), 0.15) + stroke(X(8), Y(0), X(9.5), Y(1.8), 0.15) + stroke(X(-6.5), Y(1.8), X(9.5), Y(1.8), 0.25);
        var shade = '';
        for (i = 0; i < 6; i++) shade += stroke(X(3 + i * 2.2), Y(0.4), X(6 + i * 2.2), Y(2.4), 0.15);
        for (k = 0; k < blobs.length; k++) {
          var bx = blobs[k][0], by = blobs[k][1], br = blobs[k][2];
          // paper behind the leaves so the shop fronts don't show through, and the wash
          back += '<circle class="fill-car" cx="' + f(X(bx)) + '" cy="' + f(Y(by)) + '" r="' + f(br * s * 0.98) + '"/>';
          for (i = 0; i <= 14; i++) {
            t0 = i / 14 * Math.PI * 2;
            var rw = br * (1 + j(0.1));
            wash += (i ? 'L' : 'M') + f(X(bx + 1.6 + Math.cos(t0) * rw)) + ' ' + f(Y(by + 1.1 + Math.sin(t0) * rw));
          }
          wash += 'Z';
          // scalloped outline, only where this leaf mass is the outside of the crown
          var n = Math.max(7, Math.round(br * 1.25)), ph = r() * 6.28;
          for (i = 0; i < n; i++) {
            var a0 = ph + i / n * 6.283, a1 = ph + (i + 1) / n * 6.283, am = (a0 + a1) / 2;
            var mx = bx + Math.cos(am) * br, my = by + Math.sin(am) * br, hidden = false;
            for (var o = 0; o < blobs.length; o++) {
              if (o !== k && Math.hypot(mx - blobs[o][0], my - blobs[o][1]) < blobs[o][2] * 0.9) { hidden = true; break; }
            }
            var r0 = br * (0.97 + j(0.05)), r1 = br * (0.97 + j(0.05)), rc = br * (hidden ? 1.08 : 1.26 + j(0.08));
            var seg = 'M' + f(X(bx + Math.cos(a0) * r0)) + ' ' + f(Y(by + Math.sin(a0) * r0)) +
                      'Q' + f(X(bx + Math.cos(am) * rc)) + ' ' + f(Y(by + Math.sin(am) * rc)) + ' ' +
                      f(X(bx + Math.cos(a1) * r1)) + ' ' + f(Y(by + Math.sin(a1) * r1));
            if (!hidden) out += seg;
            else if (r() < 0.45) leaf += seg;                 // a few soft edges inside, where masses overlap
          }
          // leaf scribble: small hooked strokes, thicker on the lower right (the shaded side)
          var marks = Math.round(br * 1.5);
          for (i = 0; i < marks; i++) {
            var la = r() * 6.283, lr = br * 0.82 * Math.sqrt(r());
            var lx = bx + Math.cos(la) * lr, ly = by + Math.sin(la) * lr;
            var lit = (lx - bx) + (ly - by) < -br * 0.25;     // upper left catches the light: leave it open
            if (lit && r() < 0.75) continue;
            var w = 1.3 + r() * 1.3, dip = 0.9 + r() * 0.9;
            leaf += 'M' + f(X(lx - w)) + ' ' + f(Y(ly)) + 'Q' + f(X(lx - w / 2)) + ' ' + f(Y(ly - dip)) + ' ' + f(X(lx)) + ' ' + f(Y(ly + 0.2)) +
                    'Q' + f(X(lx + w / 2)) + ' ' + f(Y(ly - dip)) + ' ' + f(X(lx + w)) + ' ' + f(Y(ly));
          }
        }
        return path(shade, 'pencil hatch') + path(pit, 'pencil soft') +
               '<path class="fill-car" d="M' + f(X(-2.6)) + ' ' + f(Y(0)) + 'L' + f(X(-1.1)) + ' ' + f(Y(topY)) + 'L' + f(X(1.1)) + ' ' + f(Y(topY)) + 'L' + f(X(2.6)) + ' ' + f(Y(0)) + 'Z"/>' +
               path(trunk) + path(bark, 'pencil soft') + back + '<path class="tree-wash" d="' + wash + '"/>' +
               path(limbs, 'pencil soft') + path(leaf, 'pencil soft') + path(out);
      }
      [[262, 59, 1.4, 0], [792, 59, 1.45, 1], [940, 58, 1.3, 0],
       [150, 270, 1.45, 1], [338, 271, 1.5, 0], [436, 270, 1.3, 0], [962, 269, 1.35, 1]].forEach(function (tr) {
        if (tr[1] > BOT) front += tree(tr[0], tr[1], tr[2], tr[3]); else h += tree(tr[0], tr[1], tr[2], tr[3]);
      });
      /* night (dark mode only): lamps on the utility poles with pools of light on
         the pavement, and a few stars above the rooftops. Drawn last, so the
         pencil wobble of everything above is the same as in daylight. */
      var night = '<g class="night-only">';
      [118, 540, 660].forEach(function (px) {
        night += '<ellipse class="lamp-pool" cx="' + (px + 10) + '" cy="' + (G + 34) + '" rx="34" ry="12"/>' +
                 '<circle class="lamp-halo" cx="' + (px + 12) + '" cy="' + (G - 61) + '" r="9"/>' +
                 path(stroke(px, G - 64, px + 9, G - 66, 0.15) + stroke(px + 9, G - 66, px + 13, G - 62, 0.12) + stroke(px + 9.6, G - 61.4, px + 14.6, G - 61.4, 0.1)) +
                 '<circle class="lamp-bulb" cx="' + (px + 12) + '" cy="' + (G - 61) + '" r="1.6"/>';
      });
      [[34, -94], [96, -78], [205, -96], [290, -86], [402, -97], [520, -90], [606, -80], [720, -95], [812, -84], [905, -97], [968, -82]].forEach(function (sx, i) {
        var rr = i % 3 === 0 ? 1.1 : 0.7;
        night += '<path class="star" d="M' + sx[0] + ' ' + (sx[1] - rr * 2) + 'L' + sx[0] + ' ' + (sx[1] + rr * 2) + 'M' + (sx[0] - rr * 2) + ' ' + sx[1] + 'L' + (sx[0] + rr * 2) + ' ' + sx[1] + '"/>';
      });
      night += '</g>';
      h += night;
      gStatic.innerHTML = h;
      frontHTML = front;
      // annotations
      var n = '';
      n += text(14, 252, 'not to scale', 'note-txt small');
      n += text(14, 36, touch ? 'drag the figure to walk' : 'your cursor is the pedestrian', 'note-txt small');
      gNotes.innerHTML = n + '<g class="st-live"></g>';
    })();
    var gLive = gNotes.querySelector('.st-live');

    /* --- pole: the mobile SPIU, drawn standing up (like the fold-out shops) ---
       Camera unit on top, the dark ring display with its LED word, bracket arms,
       the pole and the wheeled base. It waits at the kerb; when someone wants to
       cross it rolls up to the crossing, and rolls back home afterwards.
       The LED swaps instantly (real LEDs don't fade). */
    var POLE_HOME = 704, GY = 251, PS = 1.2;   // PS: drawing scale
    var pole = { x: POLE_HOME, v: 0, spin: 0, idleSince: null, sig: '', drawn: '', boil: 0, at: false,
                 lean: 0, leanV: 0, bob: 0, pv: 0, pvy: 0, els: null };
    /* a wheel: tyre and hub are drawn once; the crossed spokes sit in their own group
       so they can turn every frame without redrawing the pencil lines */
    function wheel(cx, cy, rad) {
      var r = rad * .8;
      return '<circle class="fill-car" cx="' + cx + '" cy="' + cy + '" r="' + rad + '"/>' +
             path(ellipse(cx, cy, rad, rad, .25) + ellipse(cx, cy, rad * .35, rad * .35, .1)) +
             '<g class="pole-spokes" data-c="' + cx + ' ' + cy + '">' +
             path(stroke(cx - r, cy, cx + r, cy, .1) + stroke(cx, cy - r, cx, cy + r, .1), 'pencil soft') + '</g>';
    }
    function drawPole() {
      var walk = pole.sig === 'walk', h = '';
      // the base: back wheel, box (front face + side), front wheels. It bumps a little as it rolls.
      h += '<g class="pole-base">';
      h += wheel(13, -5, 3);
      h += '<path class="fill-car" d="M-13 -17H9L14 -21V-8L9 -4H-13Z"/>' +
           path(line(-13, -17, 9, -17, .4) + line(-13, -17, -13, -4, .4) + line(9, -17, 9, -4, .4) + line(-13, -4, 9, -4, .4) +
                stroke(9, -17, 14, -21, .2) + stroke(14, -21, 14, -8, .2) + stroke(14, -8, 9, -4, .2) + stroke(-13, -17, -8, -21, .2) + stroke(-8, -21, 14, -21, .2)) +
           path(stroke(-9, -14, 5, -14, .15), 'pencil soft');
      h += wheel(-9, -2.5, 3.6) + wheel(6, -2.5, 3.6);
      h += text(-17, 1, 'SPIU', 'note-txt small', 'end') + '</g>';
      // the tall part (pole, arms, ring, camera) sways on the base like a mast on a cart
      h += '<g class="pole-top">';
      // pole
      h += '<rect class="fill-car" x="-2" y="-40" width="4" height="22"/>' +
           path(line(-2, -40, -2, -18, .2) + line(2, -40, 2, -18, .2) + ellipse(0, -19, 4, 1.2, .1));
      // bracket arms, curling up to the ring
      h += path(stroke(-2, -35, -7, -38, .25) + stroke(-7, -38, -10, -42, .25) + stroke(2, -35, 7, -38, .25) + stroke(7, -38, 10, -42, .25) +
                stroke(-1, -37, -4, -42, .2) + stroke(1, -37, 4, -42, .2), 'pencil soft');
      // ring display: a dark band with the LED word
      h += '<path d="M-15 -49V-43A15 2.2 0 0 0 15 -43V-49A15 2.2 0 0 1 -15 -49Z" fill="#26241f"/>' +
           path(ellipse(0, -49, 15, 2.2, .2) + line(-15, -49, -15, -43, .2) + line(15, -49, 15, -43, .2) + stroke(-15, -43, 0, -40.8, .2) + stroke(0, -40.8, 15, -43, .2)) +
           text(0, -43.6, walk ? 'WALK' : 'STOP', 'led mini ' + (walk ? 'walk' : 'stop'), 'middle');
      // camera unit with its lens
      h += '<rect class="fill-car" x="-4.5" y="-60" width="9" height="10"/>' +
           path(ellipse(0, -60, 4.5, 1.3, .15) + line(-4.5, -60, -4.5, -51, .2) + line(4.5, -60, 4.5, -51, .2)) +
           path(ellipse(-1.5, -56, 1.8, 1.8, .1) + ellipse(-1.5, -56, .6, .6, .05));
      // the readable word beside it, and its name underneath
      h += text(-19, -40, walk ? 'WALK' : 'STOP', 'led ' + (walk ? 'walk' : 'stop'), 'end');   // on the left, clear of the person beside it
      h += '</g>';
      gPole.innerHTML = h;
      pole.els = { base: gPole.querySelector('.pole-base'), top: gPole.querySelector('.pole-top'),
                   spokes: Array.prototype.slice.call(gPole.querySelectorAll('.pole-spokes')) };
      poseParts();
    }
    /* every frame: turn the spokes, bump the base, sway the mast (cheap: transforms only) */
    function poseParts() {
      var e = pole.els;
      if (!e) return;
      var deg = f(pole.spin * 57.2958);
      e.spokes.forEach(function (g) { g.setAttribute('transform', 'rotate(' + deg + ' ' + g.getAttribute('data-c') + ')'); });
      e.base.setAttribute('transform', 'translate(0 ' + f(pole.bob) + ')');
      e.top.setAttribute('transform', 'translate(0 ' + f(pole.bob) + ') rotate(' + f(pole.lean) + ' 0 -18)');
    }
    function setPole(walk) { pole.sig = walk ? 'walk' : 'stop'; }
    /* the four conditions of the field study: no pole at all, a pole that stays
       at the kerb, a pole that crosses with you, and that pole plus a sign on the car */
    var cond = 'ehmi', POLE_FIX = CW0 - 14;
    /* like SPIU "Mobility" in the field study: it waits at the kerb, then crosses
       with you on the side the cars come from, waits on the far side until the
       car has gone, and rolls back home */
    pole.y = GY; pole.vy = 0; pole.mode = 'home';
    function poleInLane() { return (cond === 'mobile' || cond === 'ehmi') && pole.y > MID - 10 && pole.y < BOT + 6; }
    function movePole(dt, engaged) {
      if (cond === 'none' || cond === 'fixed') {
        pole.mode = cond; pole.v = pole.vy = 0; pole.at = true; pole.idleSince = null;
        if (cond === 'fixed') { pole.x = POLE_FIX; pole.y = GY; }
        return;
      }
      var road = inRoad();
      if (road) pole.mode = 'escort';
      else if (pole.mode === 'escort') { pole.mode = ped.y <= TOP + 2 ? 'wait' : 'back'; pole.since = t; }   // you turned back: so does the pole
      else if (pole.mode === 'wait') {
        if (t - pole.since > 1 && (!car || car.x > CW1 + 10)) pole.mode = 'back';
      } else if (pole.mode === 'back') {
        if (Math.abs(pole.y - GY) < 2) pole.mode = engaged ? 'kerb' : 'home';
      } else pole.mode = engaged ? 'kerb' : 'home';

      var tx = POLE_HOME, ty = GY, side = Math.max(CW0 + 4, Math.min(CW1 - 4, ped.x - 30));
      if (pole.mode === 'kerb') tx = side;
      else if (pole.mode === 'escort') {
        tx = side; ty = Math.max(TOP + 8, Math.min(GY, ped.y + 16));
        // a car that has not committed to stopping and is still before the crossing: the pole holds at the kerb
        var unsafe = car && car.state !== 'yield' && car.state !== 'wait' && car.x + CAR_L < tx + 30 && car.x + CAR_L > tx - 260;
        if (unsafe && pole.y > BOT - 2) ty = Math.max(ty, GY);
      }
      else if (pole.mode === 'wait') { tx = pole.x; ty = ped.y <= TOP + 2 ? TOP + 6 : pole.y; }
      else if (pole.mode === 'back') { tx = pole.x; ty = GY; }
      else if (Math.abs(pole.x - POLE_HOME) > .5) {          // linger a moment before rolling home
        if (pole.idleSince == null) pole.idleSince = t;
        if (t - pole.idleSince < 1.6) tx = pole.x;
      }
      if (pole.mode !== 'home') pole.idleSince = null;

      var dx = tx - pole.x, dy = ty - pole.y, dist = Math.hypot(dx, dy);
      var sp = Math.min(140, dist * 3), k = Math.min(1, dt * 5);
      pole.v += ((dist ? dx / dist * sp : 0) - pole.v) * k;
      pole.vy += ((dist ? dy / dist * sp : 0) - pole.vy) * k;
      pole.x += pole.v * dt; pole.y += pole.vy * dt;
      var speed = Math.hypot(pole.v, pole.vy);
      pole.spin += speed * (pole.v < 0 ? -1 : 1) * dt / 5;
      /* the mast is tall and the base is short: when the base speeds up the top lags
         behind, when it brakes the top tips forward, then it settles with a small wobble.
         A damped spring driven by the base's acceleration. */
      if (dt > 0 && !reduceMotion) {
        var ax = (pole.v - pole.pv) / dt, ay = (pole.vy - pole.pvy) / dt;
        var push = -(ax + ay * .5) * .45;
        pole.leanV += (-60 * pole.lean - 7 * pole.leanV + push) * dt;
        pole.lean = Math.max(-5, Math.min(5, pole.lean + pole.leanV * dt));
        pole.bob = speed > 2 ? -Math.abs(Math.sin(pole.spin * 2)) * Math.min(.5, speed / 160) : pole.bob * .8;
      }
      pole.pv = pole.v; pole.pvy = pole.vy;
      pole.at = (pole.mode === 'kerb' || pole.mode === 'escort') && dist < 6;
    }
    function renderPole() {
      var hide = cond === 'none' ? 'none' : '';
      if (gPole.style.display !== hide) gPole.style.display = hide;
      var moving = Math.hypot(pole.v, pole.vy) > 1;
      pole.boil += 1;
      if (pole.sig !== pole.drawn || (moving && pole.boil % 6 === 0)) { pole.drawn = pole.sig; drawPole(); }
      else poseParts();
      gPole.setAttribute('transform', 'translate(' + f(pole.x) + ' ' + f(pole.y) + ') scale(' + PS + ')');
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
    var ehmiEl, alarmEl, carPaths, carBody, lidarBeam, treadEl, treadKey = -1;
    /* a self-driving robotaxi seen from above, in pencil: rounded body, windscreen
       and rear window lightly hatched, mirrors, sensor pods on the corners, and the
       roof unit with its spinning dome */
    /* the car, seen from above: a premium electric SUV (no badge or copied grille).
       Local coords: rear at x 0, nose at x 100, sides at y ±19.5. A long bonnet
       with two creases, a raked windscreen, a panoramic glass roof between roof
       rails, a rear window, door mirrors, slim wrap-around headlights and a
       full-width light bar at the back. Being self-driving, it keeps a small
       sensor dome on the roof. */
    var BODY = 'M9 -19.5Q3 -19.4 1.4 -15.6Q1 0 1.4 15.6Q3 19.4 9 19.5H83Q95.4 19.4 98.8 15Q100.4 0 98.8 -15Q95.4 -19.4 83 -19.5Z';
    var GLASS = 'M62 -15.6L71.5 -16.8Q73.2 0 71.5 16.8L62 15.6Z' +                 // windscreen
                'M24 -11.8H58Q60.2 -11.8 60.2 -9.6V9.6Q60.2 11.8 58 11.8H24Q21.8 11.8 21.8 9.6V-9.6Q21.8 -11.8 24 -11.8Z' +   // glass roof
                'M8.6 -14.2L17.4 -14.8V14.8L8.6 14.2Q7.4 0 8.6 -14.2Z';            // rear window
    function carShapes() {
      return [// the body outline, mirrors and wheel arches
              line(9, -19.5, 83, -19.5, 0.7) + stroke(83, -19.5, 95.6, -18.4, 0.3) + stroke(95.6, -18.4, 99.2, -14, 0.25) + line(99.6, -14.4, 99.6, 14.4, 0.5) +
                stroke(99.2, 14, 95.6, 18.4, 0.25) + stroke(95.6, 18.4, 83, 19.5, 0.3) + line(83, 19.5, 9, 19.5, 0.7) +
                stroke(9, 19.5, 3.2, 18.6, 0.25) + stroke(3.2, 18.6, 1.4, 14.6, 0.2) + line(1.1, 15, 1.1, -15, 0.5) + stroke(1.4, -14.6, 3.2, -18.6, 0.2) + stroke(3.2, -18.6, 9, -19.5, 0.25) +
                stroke(62.5, -19.4, 64.6, -23.6, 0.12) + stroke(64.6, -23.6, 68.4, -23, 0.12) + stroke(68.4, -23, 67.2, -19.4, 0.12) +     // door mirrors
                stroke(62.5, 19.4, 64.6, 23.6, 0.12) + stroke(64.6, 23.6, 68.4, 23, 0.12) + stroke(68.4, 23, 67.2, 19.4, 0.12) +
                'M12 -19.5Q22 -22.8 32 -19.5M70 -19.5Q80 -22.8 90 -19.5M12 19.5Q22 22.8 32 19.5M70 19.5Q80 22.8 90 19.5',
              // soft details: bonnet creases, glass edges and reflections, door cuts, roof rails
              stroke(74, -10.5, 95.5, -7, 0.2) + stroke(74, 10.5, 95.5, 7, 0.2) +
                stroke(62, -15.6, 71.5, -16.8, 0.15) + stroke(71.5, -16.8, 72.6, 0, 0.15) + stroke(72.6, 0, 71.5, 16.8, 0.15) + stroke(71.5, 16.8, 62, 15.6, 0.15) + stroke(62, 15.6, 62, -15.6, 0.15) +
                stroke(64.5, -9, 68.6, -13.4, 0.1) + stroke(64.6, -1, 69.8, -7.6, 0.1) +                                     // windscreen glare
                stroke(26, -7.5, 33, -11, 0.1) + stroke(27.5, 1.5, 41, -9.5, 0.1) + stroke(40, 4, 52, -6, 0.1) +            // roof glare
                stroke(8.6, -14.2, 17.4, -14.8, 0.12) + stroke(17.4, -14.8, 17.4, 14.8, 0.12) + stroke(17.4, 14.8, 8.6, 14.2, 0.12) +
                stroke(40.4, -19.5, 40.4, -16.6, 0.08) + stroke(40.4, 19.5, 40.4, 16.6, 0.08) + stroke(59, -19.5, 59.4, -16.6, 0.08) + stroke(59, 19.5, 59.4, 16.6, 0.08),
              // firm details: roof rails and their feet
              line(21, -14.6, 61, -14.6, 0.15) + line(21, 14.6, 61, 14.6, 0.15) +
                stroke(21, -15.8, 21, -13.4, 0.06) + stroke(61, -15.8, 61, -13.4, 0.06) + stroke(21, 15.8, 21, 13.4, 0.06) + stroke(61, 15.8, 61, 13.4, 0.06)];
    }
    function drawCar() {
      var d = carShapes();
      if (!carPaths) {
        // tyres first, so the body covers their inner half: dark rubber showing past the sills
        [[13, -25.5], [71, -25.5], [13, 18.5], [71, 18.5]].forEach(function (w) {
          el('rect', { 'class': 'car-tyre', x: w[0], y: w[1], width: 18, height: 7, rx: 2.4 }, gCar);
        });
        treadEl = el('path', { 'class': 'car-tread' }, gCar);
        el('path', { 'class': 'headlight night-only', d: 'M101 -11L176 -27L180 -3L101 -5ZM101 5L180 3L176 27L101 11Z' }, gCar);
        carBody = el('path', { 'class': 'fill-car', d: BODY }, gCar);
        el('path', { 'class': 'car-glass', d: GLASS }, gCar);
        carPaths = [el('path', { 'class': 'pencil' }, gCar), el('path', { 'class': 'pencil soft' }, gCar), el('path', { 'class': 'pencil' }, gCar)];
        el('path', { 'class': 'car-light front', d: 'M92.4 -17.6Q98 -16.2 99.4 -9.6M92.4 17.6Q98 16.2 99.4 9.6' }, gCar);   // slim headlights
        el('path', { 'class': 'car-light rear', d: 'M1.6 -14.2V14.2' }, gCar);                                                // full-width light bar
        el('circle', { 'class': 'car-lidar', cx: 42, cy: 0, r: 3.6 }, gCar);
        lidarBeam = el('path', { 'class': 'car-beam', d: 'M0 0L4 0' }, gCar);
        ehmiEl = el('line', { 'class': 'ehmi', x1: 104, y1: -14, x2: 104, y2: 14 }, gCar);
        alarmEl = el('text', { 'class': 'alarm', x: 112, y: -14, visibility: 'hidden' }, gCar);
        alarmEl.textContent = '!';
      }
      for (var i = 0; i < 3; i++) carPaths[i].setAttribute('d', d[i]);
    }

    /* --- cyclist, riding along the near pavement ---
       Drawn from the side, standing up like the people and trees there (local
       coords: ground at y 0, x 0..34 forward). Built once; the pencil lines boil,
       and the spokes and legs are small paths moved every frame so they turn. */
    var gBike = el('g', { 'class': 'st-bike' }), bikePaths, bikeSpin, bikeNear, bikeFar, BIKE_V = 92;
    svg.insertBefore(gBike, gCar);
    gBike.style.display = 'none';
    /* --- someday: a person flying over the rooftops with a backpack jet ---
       A nod to where mobility may go next. Drawn lying flat, arm reaching
       ahead, the jet on the back; local coords: nose of the flyer to the right.
       It crosses the strip of sky above the shop signs, then the air taxi takes its turn,
       bobbing gently, with small puffs trailing from the jet. Reduced motion:
       it hangs still above the books shop. */
    var gFly = el('g', { 'class': 'st-fly ar-mobility' }), flyPaths = null, flyPuffs, FLY_Y = -84, FLY_V = 40, FLY_GAP = 1120 / 48 + 3.5;   // the gap is the air taxi's turn
    svg.insertBefore(gFly, gCar);
    /* the flyer, side-on and flying to the right (nose at +x): a flight suit with
       some volume, a round helmet with a tinted visor, one fist reaching ahead,
       legs stretched out behind with small boots, a jet pack with a flickering
       flame, and a scarf that ripples in the wind. Pencil lines boil a few
       times a second; flame, scarf and trail move every frame. */
    var flyFlame, flyFlameIn, flyScarf, flyTrail;
    var SUIT = 'M13 -5.2Q15.6 -3.4 13.6 -1.2L4.2 0.4Q2.4 0.2 2.6 -1.6L3.4 -3.6Q3.8 -4.8 5.2 -4.9Z';   // torso, filled
    function drawFly() {
      var body = ellipse(16, -3.6, 2.7, 2.6, 0.1) +                                           // helmet
                 stroke(13, -5.2, 5.2, -4.9, 0.15) + stroke(13.6, -1.2, 4.2, 0.4, 0.15) +       // back and chest
                 stroke(12.4, -4.4, 18.4, -7.2, 0.15) + stroke(13.2, -2.6, 19.4, -5.8, 0.15) +  // reaching arm (two edges)
                 ellipse(20.2, -7, 1.3, 1.2, 0.08) +                                            // fist
                 stroke(11, -1.8, 6.8, -0.2, 0.12) +                                            // other arm, along the side
                 stroke(3.6, -3.4, -5.2, -3.8, 0.15) + stroke(3, -1.2, -5, -1.8, 0.15) +         // upper leg
                 stroke(-5.2, -3.8, -8.6, -3.2, 0.12) + stroke(-5, -1.8, -8.4, -1.6, 0.12) +      // boot
                 stroke(3.4, -0.4, -2.6, 1.8, 0.14) + stroke(-2.6, 1.8, -6.2, 0.8, 0.14) +        // lower leg, bent at the knee
                 stroke(-6.2, 0.8, -8, 1.6, 0.1);
      var pack = stroke(4.6, -5.2, 10.4, -5.8, 0.1) + stroke(10.4, -5.8, 10.8, -8.8, 0.1) + stroke(10.8, -8.8, 5, -8.6, 0.1) +
                 stroke(5, -8.6, 4.6, -5.2, 0.1) + stroke(5.4, -7, 10, -7.3, 0.06) +                        // the pack, with a seam
                 stroke(4.6, -6.2, 2.8, -6.6, 0.08) + stroke(4.6, -7.8, 2.8, -7.9, 0.08) + stroke(2.8, -6.4, 2.8, -8.1, 0.06) +   // nozzle
                 stroke(15.4, -2.4, 18.4, -3.6, 0.06);                                                      // visor edge
      if (!flyPaths) {
        flyTrail = el('path', { 'class': 'fly-trail' }, gFly);
        flyPuffs = el('path', { 'class': 'pencil soft' }, gFly);
        flyFlame = el('path', { 'class': 'fly-flame' }, gFly);
        flyFlameIn = el('path', { 'class': 'fly-flame-in' }, gFly);
        el('path', { 'class': 'fly-suit', d: SUIT }, gFly);
        el('path', { 'class': 'fly-pack', d: 'M4.6 -5.2L10.4 -5.8L10.8 -8.8L5 -8.6Z' }, gFly);
        flyScarf = el('path', { 'class': 'fly-scarf' }, gFly);          // over the pack, so it streams back in view
        el('ellipse', { 'class': 'fly-helmet', cx: 16, cy: -3.6, rx: 2.7, ry: 2.6 }, gFly);
        el('path', { 'class': 'fly-visor', d: 'M16.6 -5.6Q19.4 -4.8 18.6 -2.4Q17 -2 16.2 -3Z' }, gFly);
        flyPaths = [el('path', { 'class': 'pencil' }, gFly), el('path', { 'class': 'pencil soft' }, gFly)];
        var lab = el('text', { 'class': 'note-txt', x: -13, y: 3, 'text-anchor': 'end', style: 'font-size:7.5px' }, gFly);
        lab.textContent = 'someday, Lalu';
      }
      flyPaths[0].setAttribute('d', body);
      flyPaths[1].setAttribute('d', pack);
    }
    function renderFly() {
      var period = (1120 / FLY_V) + FLY_GAP, u = reduceMotion ? null : (t + 3) % period;
      var x = u == null ? 880 : -60 + u * FLY_V;
      if (x > 1060) { if (gFly.style.display !== 'none') gFly.style.display = 'none'; return; }
      if (gFly.style.display) gFly.style.display = '';
      if (!flyPaths || (!reduceMotion && Math.floor(t * 6) !== renderFly.k)) { renderFly.k = Math.floor(t * 6); drawFly(); }
      var tt = u == null ? 0 : t, y = FLY_Y + Math.sin(tt * 1.7) * 2.2, tilt = Math.sin(tt * 1.7 + 0.8) * 3;
      // the flame flickers: a long outer tongue and a short bright core
      var fl = 5.2 + Math.sin(tt * 31) * 1.1 + Math.sin(tt * 17) * 0.7;
      flyFlame.setAttribute('d', 'M2.8 -8.2Q' + f(1 - fl * 0.35) + ' -7.9 ' + f(2.8 - fl) + ' ' + f(-6.6 + Math.sin(tt * 23) * 0.5) + 'Q' + f(1 - fl * 0.35) + ' -5.6 2.8 -6.3Z');
      flyFlameIn.setAttribute('d', 'M2.8 -7.7Q2 -7.4 ' + f(2.8 - fl * 0.45) + ' -7.1Q2 -6.8 2.8 -6.7Z');
      // the scarf ripples back from the neck in a travelling wave
      var top = '', bot = '', n = 6;
      for (var i = 0; i <= n; i++) {
        var sx = 13.8 - i * 2.4, w = Math.sin(tt * 9 - i * 1.1) * (0.3 + i * 0.3), th = 1.4 - i * 0.13;
        top += (i ? 'L' : 'M') + f(sx) + ' ' + f(-6.2 + w - i * 0.62);
        bot = 'L' + f(sx) + ' ' + f(-6.2 + w - i * 0.62 + th) + bot;
      }
      flyScarf.setAttribute('d', top + bot + 'Z');
      // a dotted trail behind the jet, drifting back
      var off = (tt * 24) % 4, td = '';
      for (var dx = 2 + off; dx < 34; dx += 4) td += 'M' + f(-dx) + ' ' + f(-7.2 + dx * 0.05) + 'L' + f(-dx - 1.4) + ' ' + f(-7.2 + dx * 0.05);
      flyTrail.setAttribute('d', td);
      var pd = '';                                    // three puffs drifting back from the nozzle, growing and thinning
      for (var q = 0; q < 3; q++) {
        var k = ((tt * 1.6 + q / 3) % 1), px = -2 - k * 16, py = -7.2 + k * 3, pr = 0.8 + k * 2.2;
        if (k < .9) pd += ellipse(px, py, pr, pr * 0.8, 0.12);
      }
      flyPuffs.setAttribute('d', pd);
      gFly.setAttribute('transform', 'translate(' + f(x) + ' ' + f(y) + ') rotate(' + f(tilt) + ') scale(2.2)');
    }
    /* --- more of the future, all things being trialled today ---
       1. an electric air taxi crosses the same strip of sky, right to left, in
          the gap while the jet-pack flyer is away (so the sky never crowds);
       2. a delivery drone hovers over the 24h shop and lowers a parcel on a
          line, then winds it back up (Japanese konbini have trialled this);
       3. a charging lane: coils under one stretch of the road charge a car as it
          drives over them; a small bolt shows it, and at night the coils glow.
       Reduced motion: the taxi waits over the café, the drone holds the parcel
       half-way, and the coils stay as drawn. */
    var gTaxi = el('g', { 'class': 'st-taxi ar-mobility' }), taxiPaths = null, taxiRotors, TAXI_V = 48;
    svg.insertBefore(gTaxi, gCar);
    gTaxi.style.display = 'none';
    function drawTaxi() {                                // local coords: nose to the left, body around (0, 0)
      var body = ellipse(0, 0, 13, 4.6, 0.15) +                                            // the cabin pod
                 stroke(-9.6, -2.4, -4, -4.2, 0.12) + stroke(-4, -4.2, 1.6, -4.2, 0.1) +      // canopy
                 stroke(-12.4, 1.2, 12.4, 1.2, 0.08) +                                     // belly seam
                 stroke(-8, -4.4, -8, -8.6, 0.1) + stroke(8, -4.4, 8, -8.6, 0.1) +           // rotor masts
                 stroke(-8, 4.4, -10, 7.4, 0.1) + stroke(8, 4.4, 10, 7.4, 0.1) + stroke(-11.6, 7.4, -7.4, 7.4, 0.08) + stroke(7.4, 7.4, 11.6, 7.4, 0.08);   // skids
      var win = ellipse(-5, -1, 2.4, 1.6, 0.08) + ellipse(1.2, -1, 2.4, 1.6, 0.08);
      if (!taxiPaths) {
        el('ellipse', { 'class': 'fill-car', cx: 0, cy: 0, rx: 13, ry: 4.6 }, gTaxi);
        taxiPaths = [el('path', { 'class': 'pencil' }, gTaxi), el('path', { 'class': 'pencil soft' }, gTaxi)];
        taxiRotors = el('path', { 'class': 'pencil soft' }, gTaxi);
        el('circle', { 'class': 'nav-light red night-only', cx: 12.6, cy: 0, r: 1.1 }, gTaxi);
        el('circle', { 'class': 'nav-light green night-only', cx: -12.6, cy: 0, r: 1.1 }, gTaxi);
        var lab = el('text', { 'class': 'note-txt', x: 17, y: 3, style: 'font-size:7.5px' }, gTaxi);
        lab.textContent = 'air taxi';
      }
      taxiPaths[0].setAttribute('d', body);
      taxiPaths[1].setAttribute('d', win);
    }
    function renderTaxi() {
      var period = (1120 / FLY_V) + FLY_GAP, u = reduceMotion ? null : (t + 3) % period, start = 1120 / FLY_V + 1.5;
      var x = u == null ? 380 : 1060 - (u - start) * TAXI_V;
      if (u != null && (u < start || x < -60)) { if (gTaxi.style.display !== 'none') gTaxi.style.display = 'none'; return; }
      if (gTaxi.style.display) gTaxi.style.display = '';
      if (!taxiPaths || (u != null && Math.floor(t * 5) !== renderTaxi.k)) { renderTaxi.k = Math.floor(t * 5); drawTaxi(); }
      var tt = u == null ? 0 : t, rd = '';
      [-8, 8].forEach(function (rx, i) {                 // two rotors, blades blurring as they spin
        var w = 7 * Math.abs(Math.cos(tt * 23 + i * 1.3)) + 1.5;
        rd += 'M' + f(rx - w) + ' -8.9L' + f(rx + w) + ' -8.9';
        rd += ellipse(rx, -8.9, 7.6, 1.1, 0.1);
      });
      taxiRotors.setAttribute('d', rd);
      var y = -86 + Math.sin(tt * 1.3) * 1.6;
      gTaxi.setAttribute('transform', 'translate(' + f(x) + ' ' + f(y) + ') rotate(' + f(-2 + Math.sin(tt * 1.3 + 1) * 1.2) + ') scale(1.9)');
    }

    var DRONE_X = 742, DRONE_Y = -68;
    var gDrone = el('g', { 'class': 'st-drone ar-mobility' }), droneBody, droneRotors, droneLine, droneBox;
    svg.insertBefore(gDrone, gCar);
    (function () {
      droneLine = el('path', { 'class': 'drone-line' }, gDrone);
      droneBox = el('g', {}, gDrone);
      el('rect', { 'class': 'fill-car', x: -3.4, y: 0, width: 6.8, height: 5.2 }, droneBox);
      el('path', { 'class': 'pencil', d: stroke(-3.4, 0, 3.4, 0, 0.08) + stroke(3.4, 0, 3.4, 5.2, 0.08) + stroke(3.4, 5.2, -3.4, 5.2, 0.08) + stroke(-3.4, 5.2, -3.4, 0, 0.08) + stroke(0, 0, 0, 5.2, 0.05) }, droneBox);
      droneBody = el('path', { 'class': 'pencil', d: ellipse(0, 0, 4.2, 1.8, 0.1) + stroke(-4, -0.6, -11, -2.6, 0.08) + stroke(4, -0.6, 11, -2.6, 0.08) +
                                                     stroke(-2, 1.8, -3.4, 3.8, 0.06) + stroke(2, 1.8, 3.4, 3.8, 0.06) }, gDrone);
      droneRotors = el('path', { 'class': 'pencil soft' }, gDrone);
      el('circle', { 'class': 'nav-light green night-only', cx: 0, cy: 0.4, r: 0.9 }, gDrone);
      var lab = el('text', { 'class': 'note-txt', x: 15, y: 1, style: 'font-size:7.5px' }, gDrone);
      lab.textContent = 'drone drop';
    })();
    function renderDrone() {
      var tt = reduceMotion ? 0 : t;
      var cyc = reduceMotion ? 0.5 : (tt % 14) / 14;          // 14 s: lower, hold, wind back up, rest
      var drop = cyc < 0.35 ? cyc / 0.35 : cyc < 0.5 ? 1 : cyc < 0.85 ? 1 - (cyc - 0.5) / 0.35 : 0;
      drop = drop * drop * (3 - 2 * drop);
      var len = 6 + drop * 30, hy = Math.sin(tt * 2.1) * 0.9;
      var rd = '';
      [-11, 11].forEach(function (rx, i) {
        var w = 4.4 * Math.abs(Math.cos(tt * 29 + i)) + 1;
        rd += 'M' + f(rx - w) + ' -3.6L' + f(rx + w) + ' -3.6' + ellipse(rx, -3.6, 4.8, 0.8, 0.08);
      });
      droneRotors.setAttribute('d', rd);
      droneLine.setAttribute('d', 'M0 1.8L' + f(Math.sin(tt * 1.4) * 0.6) + ' ' + f(len));
      droneBox.setAttribute('transform', 'translate(' + f(Math.sin(tt * 1.4) * 0.6) + ' ' + f(len) + ')');
      gDrone.setAttribute('transform', 'translate(' + DRONE_X + ' ' + f(DRONE_Y + hy) + ') scale(1.5)');
    }

    var CH0 = 130, CH1 = 410;                                // the stretch of charging lane
    var gCharge = el('g', { 'class': 'st-charge ar-urban' });
    svg.insertBefore(gCharge, gStatic.nextSibling);
    (function () {
      var d = '';
      for (var cx = CH0 + 16; cx < CH1; cx += 34) d += ellipse(cx, LANE, 12, 4.2, 0.12) + ellipse(cx, LANE, 7, 2.2, 0.08);
      el('path', { 'class': 'charge-coil', d: d }, gCharge);
      el('path', { 'class': 'pencil soft', d: stroke(CH0, LANE + 21, CH1, LANE + 21, 0.2) + stroke(CH0, LANE + 17, CH0, LANE + 25, 0.1) + stroke(CH1, LANE + 17, CH1, LANE + 25, 0.1) }, gCharge);
      var lab = el('text', { 'class': 'note-txt', x: CH0 + 4, y: LANE + 31, style: 'font-size:13px' }, gCharge);
      lab.textContent = 'charging lane';
    })();
    var carBolt = null;
    function renderCharge() {
      var mid = car ? car.x + 50 : -999, on = mid > CH0 && mid < CH1;
      gCharge.classList.toggle('on', on);
      if (!carBolt && car) {
        carBolt = el('path', { 'class': 'bolt', d: 'M48 -34L43 -26L47.5 -26L44 -18L52 -28L47.5 -28L50.5 -34Z' }, gCar);
      }
      if (carBolt) carBolt.style.display = on && car ? '' : 'none';
    }

    var gFront = el('g', { 'class': 'st-front' });        // near-side trees and people: drawn over the cyclist
    gFront.innerHTML = frontHTML;
    svg.insertBefore(gFront, gCar);
    /* the cyclist's line along the pavement: it swings behind each tree and the
       people standing there, and drifts back out in between */
    var BIKE_PATH = [[-60, 228], [96, 233], [150, 217], [204, 226], [258, 215], [304, 230], [338, 216], [388, 233], [436, 217],
                     [492, 231], [560, 225], [640, 227], [704, 219], [766, 232], [832, 215], [898, 231], [962, 217], [1040, 227]];
    function bikeY(x) {
      for (var i = 1; i < BIKE_PATH.length; i++) {
        if (x <= BIKE_PATH[i][0]) {
          var a = BIKE_PATH[i - 1], b = BIKE_PATH[i], u = Math.max(0, (x - a[0]) / (b[0] - a[0]));
          return a[1] + (b[1] - a[1]) * (u * u * (3 - 2 * u));           // ease in and out of every bend
        }
      }
      return BIKE_PATH[BIKE_PATH.length - 1][1];
    }
    function drawBike() {
      var d = [ // wheels and the frame: chain stay, seat tube, top tube, down tube, fork, bar, saddle
                ellipse(7, -6.2, 6.2, 6.2, 0.2) + ellipse(27.4, -6.2, 6.2, 6.2, 0.2) +
                stroke(7, -6.2, 15.8, -5.8, 0.15) + stroke(15.8, -5.8, 13.2, -15.4, 0.15) + stroke(13.2, -15.4, 23.8, -15.8, 0.15) +
                stroke(23.8, -15.8, 15.8, -5.8, 0.15) + stroke(7, -6.2, 13.2, -15.4, 0.15) + stroke(23.4, -17.6, 27.4, -6.2, 0.15) +
                stroke(23.4, -17.6, 25.4, -19.4, 0.1) + stroke(25.4, -19.4, 27.6, -18.6, 0.1) + stroke(11, -16.4, 15.4, -16.2, 0.12),
                // rider: back, head, arm to the bar
                stroke(13.6, -17.2, 19.4, -25.6, 0.25) + ellipse(21.6, -28.6, 2.5, 2.6, 0.15) +
                stroke(19.2, -25, 23, -21.2, 0.2) + stroke(23, -21.2, 26.6, -19.2, 0.2),
                // helmet rim, a small backpack, the ground shadow
                stroke(19, -29.6, 24.2, -30.2, 0.12) + stroke(19.4, -30.6, 21.6, -31.6, 0.1) + stroke(21.6, -31.6, 24, -30.6, 0.1) +
                stroke(12.6, -19.4, 15, -24.6, 0.15) + stroke(15, -24.6, 17.6, -23.4, 0.12) + stroke(12.6, -19.4, 15.2, -18.4, 0.12) +
                stroke(2, 0.6, 33, 0.6, 0.3)];
      if (!bikePaths) {
        bikeSpin = el('path', { 'class': 'pencil soft' }, gBike);
        bikeFar = el('path', { 'class': 'pencil soft' }, gBike);
        el('ellipse', { 'class': 'bike-wash', cx: 17, cy: -20.8, rx: 2.9, ry: 5.2, transform: 'rotate(36 17 -20.8)' }, gBike);
        bikePaths = [el('path', { 'class': 'pencil' }, gBike), el('path', { 'class': 'pencil' }, gBike), el('path', { 'class': 'pencil soft' }, gBike)];
        bikeNear = el('path', { 'class': 'pencil' }, gBike);
      }
      for (var i = 0; i < 3; i++) bikePaths[i].setAttribute('d', d[i]);
    }
    function leg(ph) {                                    // hip -> knee -> foot on the pedal (two-bone leg)
      var hx = 13.8, hy = -16.8, fx = 15.8 + Math.cos(ph) * 3.1, fy = -5.8 + Math.sin(ph) * 3.1, L1 = 7.4, L2 = 7.4;
      var dx = fx - hx, dy = fy - hy, dd = Math.min(L1 + L2 - 0.05, Math.hypot(dx, dy));
      var along = (L1 * L1 - L2 * L2 + dd * dd) / (2 * dd), off = Math.sqrt(Math.max(0, L1 * L1 - along * along));
      var kx = hx + dx / dd * along + dy / dd * off, ky = hy + dy / dd * along - dx / dd * off;   // knee bends forward
      return 'M' + f(hx) + ' ' + f(hy) + 'L' + f(kx) + ' ' + f(ky) + 'L' + f(fx) + ' ' + f(fy) + 'M' + f(fx - 1.4) + ' ' + f(fy + 0.5) + 'h3.2';
    }
    function drawBikeMotion(ph, roll) {
      var sp = '';
      [7, 27.4].forEach(function (wx) {
        for (var k = 0; k < 3; k++) {
          var a = roll + k * Math.PI / 3, cx2 = Math.cos(a) * 5.6, sy2 = Math.sin(a) * 5.6;
          sp += 'M' + f(wx - cx2) + ' ' + f(-6.2 - sy2) + 'L' + f(wx + cx2) + ' ' + f(-6.2 + sy2);
        }
      });
      bikeSpin.setAttribute('d', sp);
      bikeFar.setAttribute('d', leg(ph + Math.PI));
      bikeNear.setAttribute('d', leg(ph));
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
    var car = null, bike = null, nextSpawn = 0.6, nextBike = 2.5;
    var t = 0, last = 0, raf = 0, running = !reduceMotion, visible = true;
    var curbSince = null, intent = false, waitStart = null, steppedOut = null, crossed = false, lastNote = '';
    var boilCar = 0, boilPed = 0, boilBike = 0;

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

      /* the pole rolls up to the crossing while someone is crossing or about to */
      movePole(dt, nearCurb() || intent || inRoad() || (car && car.noticed && (car.state === 'yield' || car.state === 'wait') && !crossed));

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
        if (car.state === 'cruise' && (intent || poleInLane()) && front < STOP_FRONT - 4) {
          var need = car.v * car.v / (2 * (STOP_FRONT - front));
          if (need <= A_MAX) {
            car.state = 'yield'; car.a = -need; car.noticed = true;
            if (!inRoad()) say(cond === 'ehmi' ? 'it noticed you. cyan means: go ahead.' : cond === 'none' ? 'it slowed down. is it waiting for you?' : 'it noticed you. the pole says walk.');
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
          var engaged = intent || inRoad(), patience = cond === 'none' ? 3.5 : 8;
          if (engaged) car.quietSince = null; else if (car.quietSince == null) car.quietSince = t;
          if (crossed && car.leaveAt == null) car.leaveAt = t + 0.5;
          if (!poleInLane() && ((car.leaveAt != null && t >= car.leaveAt) ||
              (car.quietSince != null && t - car.quietSince > 1.2 && !inRoad()) ||
              (car.waitT > patience && !inRoad()))) {
            if (car.waitT > patience && !crossed) say(cond === 'none' ? 'nobody knew who goes first.' : 'it waited eight seconds, then gave up.');
            car.state = 'go';
          }
        } else if (car.state === 'go') {
          car.v = Math.min(V, car.v + A_GO * dt);
        }
        if (poleInLane() && pole.x > car.x && car.v > 0) {                  // the pole is in the lane ahead
          var room = pole.x - 26 - (car.x + CAR_L);
          if (room < car.v * car.v / (2 * A_MAX) + 8 && car.state !== 'emerg' && car.state !== 'wait') { car.state = 'emerg'; car.a = -A_EMERG; }
        }
        car.x += car.v * dt;
        if (poleInLane() && pole.x > car.x && car.x + CAR_L > pole.x - 26) { car.x = pole.x - 26 - CAR_L; car.v = 0; if (car.state !== 'wait') { car.state = 'wait'; car.waitT = 0; } }
        if (car.x > 1040) { car = null; nextSpawn = t + 1.2 + Math.random() * 1.6; }
      }
      /* the cyclist rides along the near pavement, and waits for anyone (or the
         pole) crossing its path, the way people do in a shared space */
      if (!bike && t >= nextBike) { bike = { x: -50, v: BIKE_V, ph: 0, waitT: 0 }; drawBike(); }
      if (bike) {
        var bf = bike.x + 34, lineY = bikeY(bike.x + 17) - 12;
        var pedAheadOfBike = ped.y > BOT && Math.abs(ped.y - lineY) < 26 && ped.x > bf - 8 && ped.x < bf + 54;
        var poleAhead = (cond === 'mobile' || cond === 'ehmi') && pole.y < lineY + 18 && pole.y > BOT - 4 && pole.x > bf - 4 && pole.x < bf + 46;
        var blocked = pedAheadOfBike || poleAhead;          // it waits as long as someone is in its way
        bike.v += ((blocked ? 0 : BIKE_V) - bike.v) * Math.min(1, dt * (blocked ? 7 : 2.2));
        if (blocked && bike.v < 4) bike.waitT += dt; else if (!pedAheadOfBike && !poleAhead) bike.waitT = 0;
        bike.x += bike.v * dt;
        bike.ph += bike.v * dt / 11;
        if (bike.x > 1030) { bike = null; nextBike = t + 5 + Math.random() * 6; }
      }
    }

    /* live labels: created once, then only moved or shown/hidden */
    var youTxt = el('text', { 'class': 'note-txt small' }, gLive); youTxt.textContent = 'you';
    var aimPath = el('path', { 'class': 'pencil soft' }, gLive);
    var ehmiTxt = el('text', { 'class': 'note-txt small', visibility: 'hidden' }, gLive); ehmiTxt.textContent = 'eHMI';
    var carWord = el('text', { 'class': 'led walk', visibility: 'hidden' }, gLive), carWordState = '';
    var gazePath = el('path', { 'class': 'gaze', visibility: 'hidden' }, gGaze);
    gCar.classList.add('ar-mobility'); gGaze.classList.add('ar-mobility'); gPole.classList.add('ar-urban');
    /* V2X: the pole and the car talk to each other, drawn as faint dotted pencil arcs */
    var v2x = el('path', { 'class': 'v2x', visibility: 'hidden' }, gGaze);
    v2x.parentNode.insertBefore(el('g', { 'class': 'ar-urban' }), v2x).appendChild(v2x);
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
      var walk = true, ehmiOn = false, gazeOn = false, wordOn = false;
      if (car) {
        boilCar += 1;
        if (car.v > 5 && boilCar % 8 === 0) drawCar();
        gCar.setAttribute('transform', 'translate(' + f(car.x) + ' ' + LANE + ')');
        var roll = Math.round(((car.x % 3.6) + 3.6) % 3.6 * 5);          // tread blocks run backwards as the wheels turn
        if (roll !== treadKey) {
          treadKey = roll;
          var td = '', off = 3.6 - roll / 5;
          [13, 71].forEach(function (wx) {
            for (var q = off; q < 17.4; q += 3.6) {
              if (q < 0.8) continue;
              td += 'M' + f(wx + q) + ' -25.2L' + f(wx + q - 0.9) + ' -21M' + f(wx + q) + ' 25.2L' + f(wx + q - 0.9) + ' 21';
            }
          });
          treadEl.setAttribute('d', td);
        }
        lidarBeam.setAttribute('transform', 'translate(42 0) rotate(' + Math.round(t * 400 % 360) + ')');   // the roof sensor keeps scanning
        if (gCar.style.display) gCar.style.display = '';
        if (car.state === 'yield') ehmiOn = true;
        else if (car.state === 'wait' && !crossed && car.noticed) ehmiOn = Math.floor(t * 2.4) % 2 === 0;
        else if (car.state === 'wait' && !crossed) ehmiOn = true;
        ehmiEl.classList.toggle('on', ehmiOn);
        show(alarmEl, car.state === 'emerg');
        if (cond !== 'ehmi') ehmiOn = false;
        ehmiEl.classList.toggle('on', ehmiOn);
        /* SPIU + eHMI: the car also says it in words, like the screen on the test vehicle */
        wordOn = cond === 'ehmi' && car.x + CAR_L > 150 && car.x < CW1 + 20;
        if (wordOn) {
          var cw = car.state === 'yield' || car.state === 'wait' ? 'WALK' : 'STOP';
          if (cw !== carWordState) { carWordState = cw; carWord.textContent = cw; carWord.setAttribute('class', 'led ' + cw.toLowerCase()); }
          ehmiTxt.setAttribute('x', f(car.x + 2)); ehmiTxt.setAttribute('y', LANE - 27);
          carWord.setAttribute('x', f(car.x + 56)); carWord.setAttribute('y', LANE - 28);
        }
        if ((car.state === 'yield' || car.state === 'wait') && car.noticed && !crossed) {
          var sx = car.x + 70, sy = LANE, ex = ped.x, ey = ped.y;
          var mx = (sx + ex) / 2 + 30, my = (sy + ey) / 2 - 10;
          gazePath.setAttribute('d', 'M' + f(sx) + ' ' + f(sy) + 'Q' + f(mx) + ' ' + f(my) + ' ' + f(ex) + ' ' + f(ey));
          gazeOn = true;
        }
        var committed = car.state === 'yield' || car.state === 'wait';
        if (!committed && car.x < CW1 + 20 && car.x + CAR_L > 250) walk = false;
      } else if (gCar.style.display !== 'none') gCar.style.display = 'none';
      show(ehmiTxt, wordOn); show(carWord, wordOn);
      var talk = car && cond !== 'none' && car.x + CAR_L > 150 && car.x < pole.x + 20;
      if (talk) {
        var ax = car.x + 42, ay = LANE - 4, bx = pole.x, by = pole.y - 56;
        v2x.setAttribute('d', 'M' + f(ax) + ' ' + f(ay) + 'Q' + f((ax + bx) / 2) + ' ' + f(Math.min(ay, by) - 34) + ' ' + f(bx) + ' ' + f(by));
      }
      show(v2x, !!talk);
      /* cyclist */
      if (bike) {
        boilBike += 1;
        if (bike.v > 5 && boilBike % 8 === 0) drawBike();
        drawBikeMotion(bike.ph, bike.x / 6.2);
        var by = bikeY(bike.x + 17), turn = Math.atan2(bikeY(bike.x + 23) - bikeY(bike.x + 11), 12) * 180 / Math.PI;
        // it steers into each bend and leans a little with it
        gBike.setAttribute('transform', 'translate(' + f(bike.x) + ' ' + f(by) + ') rotate(' + f(turn * 0.45) + ' 17 0) skewX(' + f(-turn * 0.35) + ')');
        if (gBike.style.display) gBike.style.display = '';
      } else if (gBike.style.display !== 'none') gBike.style.display = 'none';
      show(gazePath, gazeOn);
      renderFly(); renderTaxi(); renderDrone(); renderCharge();
      if (pole.mode === 'kerb' && !pole.at) walk = false;   // still on its way: not yet
      setPole(walk);
      renderPole();
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

    /* --- the research areas: four headings that pick their part of the street out ---
       The names and lines are the four Research areas on this page. */
    (function () {
      var AREAS = [
        ['mobility', 'Autonomous mobility', 'How pedestrians and passengers understand and respond to vehicle intent.'],
        ['hri', 'Human–robot interaction', 'How robots communicate, navigate, and cooperate with people in everyday environments.'],
        ['urban', 'Intelligent urban environments', 'How interactive infrastructure coordinates people and machines across future cities.'],
        ['design', 'Design & prototyping', 'How user research, sketching, prototyping, and evaluation turn ideas into experiences people can use and trust.']
      ];
      var wrap = document.createElement('div');
      wrap.className = 'street-areas';
      var row = document.createElement('div');
      row.className = 'street-areas__row'; row.setAttribute('role', 'group'); row.setAttribute('aria-label', 'Research areas');
      var line = document.createElement('p');
      line.className = 'street-areas__line'; line.setAttribute('aria-live', 'polite');
      var lead = document.createElement('span');
      lead.className = 'street-areas__lead'; lead.textContent = 'my research, on this street:';
      row.appendChild(lead);
      var current = null;
      function pick(key) {
        current = current === key ? null : key;
        if (current) svg.setAttribute('data-focus', current); else svg.removeAttribute('data-focus');
        row.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-area') === current ? 'true' : 'false'); });
        var a = AREAS.filter(function (x) { return x[0] === current; })[0];
        line.textContent = a ? a[2] : '';
      }
      AREAS.forEach(function (a) {
        var b = document.createElement('button');
        b.type = 'button'; b.textContent = a[1]; b.setAttribute('data-area', a[0]); b.setAttribute('aria-pressed', 'false');
        b.addEventListener('click', function () { pick(a[0]); });
        row.appendChild(b);
      });
      wrap.appendChild(row); wrap.appendChild(line);
      fig.insertBefore(wrap, fig.querySelector('figcaption'));
    })();

    /* --- first frame --- */
    drawPed(); setPole(true); renderPole();
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
