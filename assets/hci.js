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
    function frame() { svg.setAttribute('viewBox', narrow.matches ? '410 20 600 250' : '0 0 1000 260'); }
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

    /* --- car (local coords: x 0..100, y -20..20), re-drawn to "boil" --- */
    var ehmiEl, alarmEl;
    function drawCar() {
      var h = '<rect class="fill-car" x="0" y="-20" width="' + CAR_L + '" height="40" rx="9"/>';
      h += path(line(8, -20, 92, -20, 1) + line(92, 20, 8, 20, 1) +
                stroke(8, -20, 1, -12, 0.6) + line(0, -12, 0, 12, 0.8) + stroke(1, 12, 8, 20, 0.6) +
                stroke(92, -20, 99, -12, 0.6) + line(100, -12, 100, 12, 0.8) + stroke(99, 12, 92, 20, 0.6));
      h += path(stroke(66, -16, 73, 0, 0.6) + stroke(73, 0, 66, 16, 0.6) + line(20, -15, 20, 15, 0.6) +
                line(28, -13, 60, -13, 0.6) + line(28, 13, 60, 13, 0.6), 'pencil soft');
      h += path(line(14, -23, 30, -23, 0.4) + line(70, -23, 86, -23, 0.4) + line(14, 23, 30, 23, 0.4) + line(70, 23, 86, 23, 0.4));
      h += '<line class="ehmi" x1="104" y1="-14" x2="104" y2="14"/>';
      h += '<text class="alarm" x="112" y="-14" visibility="hidden">!</text>';
      gCar.innerHTML = h;
      ehmiEl = gCar.querySelector('.ehmi'); alarmEl = gCar.querySelector('.alarm');
    }

    /* --- pedestrian (top-down head + shoulders), re-drawn to "boil" --- */
    function drawPed() {
      gPed.innerHTML = '<ellipse class="ped" cx="0" cy="0" rx="10" ry="6"/>' + path(ellipse(0, 0, 10, 6, 0.7)) +
                       '<circle class="ped" cx="0" cy="0" r="5"/>' + path(ellipse(0, 0, 5, 5, 0.5)) +
                       path(stroke(3, -2, 9, 0, 0.3) + stroke(9, 0, 3, 2, 0.3), 'pencil soft');
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

    function render() {
      /* pedestrian */
      boilPed += 1;
      if (Math.hypot(ped.vx, ped.vy) > 12 && boilPed % 9 === 0) drawPed();
      gPed.setAttribute('transform', 'translate(' + f(ped.x) + ' ' + f(ped.y) + ') rotate(' + f(ped.heading * 180 / Math.PI) + ')');
      var live = text(f(ped.x + 14), f(ped.y + 22), 'you', 'note-txt small');
      if (aim && !touch) live += path(stroke(aim.x - 4, aim.y, aim.x + 4, aim.y, 0.3) + stroke(aim.x, aim.y - 4, aim.x, aim.y + 4, 0.3), 'pencil soft');
      /* car */
      var walk = true;
      if (car) {
        boilCar += 1;
        if (car.v > 5 && boilCar % 8 === 0) drawCar();
        gCar.setAttribute('transform', 'translate(' + f(car.x) + ' ' + LANE + ')');
        gCar.style.display = '';
        var on = false;
        if (car.state === 'yield') on = true;
        else if (car.state === 'wait' && !crossed && car.noticed) on = Math.floor(t * 2.4) % 2 === 0;
        else if (car.state === 'wait' && !crossed) on = true;
        ehmiEl.classList.toggle('on', on);
        alarmEl.setAttribute('visibility', car.state === 'emerg' ? 'visible' : 'hidden');
        if (on) live += text(f(car.x + CAR_L + 10), LANE - 26, 'eHMI', 'note-txt small');
        if ((car.state === 'yield' || car.state === 'wait') && car.noticed && !crossed) {
          var sx = car.x + 70, sy = LANE, ex = ped.x, ey = ped.y;
          var mx = (sx + ex) / 2 + 30, my = (sy + ey) / 2 - 10;
          gGaze.innerHTML = '<path class="gaze" d="M' + f(sx) + ' ' + f(sy) + 'Q' + f(mx) + ' ' + f(my) + ' ' + f(ex) + ' ' + f(ey) + '"/>';
        } else gGaze.innerHTML = '';
        var committed = car.state === 'yield' || car.state === 'wait';
        if (!committed && car.x < CW1 + 20 && car.x + CAR_L > 250) walk = false;
      } else { gCar.style.display = 'none'; gGaze.innerHTML = ''; }
      setPole(walk);
      gLive.innerHTML = live;
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
