/* hci.js — engagement layer for the homepage (loaded with `defer`).
   1. Reading progress bar + current-section highlight in the nav
   2. Reveal-on-scroll
   3. Selected-work method filters
   4. Fig. 1 — "Who goes first?" crossing study
   Every feature guards its own elements, so this file is safe on any page.
   Nothing is stored or sent anywhere: the crossing-study results live only
   in memory for the current tab. */

(function () {
  'use strict';
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
        Object.keys(links).forEach(function (k) {
          links[k].classList.toggle('is-current', k === e.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    document.querySelectorAll('main > section[id]').forEach(function (s) { io.observe(s); });
  })();

  /* ---------- 2. reveal on scroll ---------- */
  (function () {
    if (reduceMotion || !('IntersectionObserver' in window)) return;
    var items = document.querySelectorAll('.reveal');
    if (!items.length) return;
    document.documentElement.classList.add('js-reveal');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    items.forEach(function (el) { io.observe(el); });
  })();

  /* ---------- 3. selected-work filters ---------- */
  (function () {
    var bar = document.querySelector('.sw-filters');
    if (!bar) return;
    var cards = document.querySelectorAll('.sw-card');
    var live = document.getElementById('sw-live');
    bar.addEventListener('click', function (ev) {
      var btn = ev.target.closest('button[data-filter]');
      if (!btn) return;
      var f = btn.getAttribute('data-filter');
      bar.querySelectorAll('button').forEach(function (b) {
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });
      var shown = 0;
      cards.forEach(function (c) {
        var on = f === 'all' || (' ' + c.getAttribute('data-methods') + ' ').indexOf(' ' + f + ' ') > -1;
        c.hidden = !on;
        if (on) shown++;
      });
      if (live) live.textContent = shown + (shown === 1 ? ' paper' : ' papers') + ' shown';
    });
  })();

  /* ---------- 4. Fig. 1 — crossing study ---------- */
  (function () {
    var root = document.getElementById('xs');
    if (!root) return;
    var $ = function (sel) { return root.querySelector(sel); };
    var stage = $('.xs-stage');
    var car = $('#xs-car'), ehmi = $('#xs-ehmi'), carLabel = $('#xs-car-label');
    var ped = $('#xs-ped'), spiu = $('#xs-spiu'), panelTxt = $('#xs-panel-txt');
    var flash = $('#xs-flash');
    var btnStart = $('#xs-start'), btnCross = $('#xs-cross'), btnReset = $('#xs-reset');
    var rotate = $('#xs-rotate');
    var status = $('#xs-status'), tbody = $('#xs-tbody'), insight = $('#xs-insight');

    var CONDS = {
      none: 'No signal',
      ehmi: 'Car eHMI',
      spiu: 'SPIU',
      both: 'SPIU + car eHMI'
    };
    var ORDER = ['none', 'ehmi', 'spiu', 'both'];

    // Scene geometry (SVG viewBox 720 × 300)
    var CAR_W = 76, LANE_TOP = 146, LANE_BOT = 224;
    var PED_X = 365, PED_R = 9, PED_Y0 = 252, PED_Y1 = 50, CROSS_DUR = 1.6;
    var V = 200;             // car cruise speed, px/s
    var ONSET = 0.6;         // when an explicit signal appears, s
    var BRAKE_AT = 0.9;      // yielding car starts braking, s
    var STOP_X = 245;        // yielding car's resting x (front at 321, before the stop line)
    var ACC = V * V / (2 * (STOP_X - (-90 + V * BRAKE_AT)));
    var STOP_T = BRAKE_AT + V / ACC;
    var WAIT_LIMIT = 6.0;    // a yielding car gives up waiting after this, s

    var results = [];
    var trial = null, raf = 0;

    function cond() {
      var r = root.querySelector('input[name="xs-cond"]:checked');
      return r ? r.value : 'none';
    }
    function has(c, what) { return c === what || c === 'both'; }

    function carX(t, tr) {
      if (!trial.yields) return -90 + V * t;
      if (t < BRAKE_AT) return -90 + V * t;
      if (tr == null || t < tr) {
        if (t >= STOP_T) return STOP_X;
        var d = t - BRAKE_AT;
        return -90 + V * BRAKE_AT + V * d - 0.5 * ACC * d * d;
      }
      var g = t - tr;
      return STOP_X + 0.5 * 220 * g * g;
    }
    // when could a careful pedestrian *know* the car's intent?
    function readableAt(c, yields) {
      if (yields && (has(c, 'ehmi') || has(c, 'spiu'))) return ONSET;
      if (!yields && has(c, 'spiu')) return ONSET;
      if (yields) return 1.35;            // deceleration becomes visible
      return 1.75;                         // car reaches the crosswalk without slowing
    }

    function say(msg, tone) {
      status.textContent = msg;
      if (tone) status.setAttribute('data-tone', tone); else status.removeAttribute('data-tone');
    }

    function render(t) {
      var x = carX(t, trial.release);
      car.setAttribute('transform', 'translate(' + x.toFixed(1) + ' 167)');
      carLabel.setAttribute('x', (x + CAR_W / 2).toFixed(1));
      var c = trial.cond;
      ehmi.classList.toggle('on', has(c, 'ehmi') && trial.yields && t >= ONSET && (trial.release == null || t < trial.release));
      spiu.style.opacity = has(c, 'spiu') ? 1 : 0.28;
      var txt = '· · ·', cls = '';
      if (has(c, 'spiu')) {
        if (t >= ONSET) {
          var clear = !trial.yields && x > 410;
          var go = (trial.yields && (trial.release == null || t < trial.release)) || clear;
          txt = go ? 'WALK' : 'STOP'; cls = go ? 'walk' : 'stop';
        }
      } else { txt = 'OFF'; }
      panelTxt.textContent = txt;
      panelTxt.setAttribute('class', 'xs-panel-txt ' + cls);
      var py = PED_Y0;
      if (trial.crossAt != null) {
        var p = Math.min(1, (t - trial.crossAt) / CROSS_DUR);
        py = PED_Y0 + (PED_Y1 - PED_Y0) * p;
      }
      if (trial.hitY != null) py = trial.hitY;
      ped.setAttribute('transform', 'translate(' + PED_X + ' ' + py.toFixed(1) + ')');
      return { x: x, py: py };
    }

    function frame(now) {
      var t = (now - trial.start) / 1000;
      var s = render(t);
      // collision: pedestrian inside the car lane while the car body spans the crosswalk
      if (trial.crossAt != null && trial.outcome == null) {
        var inLane = s.py + PED_R > LANE_TOP && s.py - PED_R < LANE_BOT;
        var overlap = s.x < PED_X + PED_R + 6 && s.x + CAR_W > PED_X - PED_R - 6;
        if (inLane && overlap) {
          trial.outcome = 'conflict'; trial.hitY = s.py;
          flash.classList.remove('on'); void flash.getBoundingClientRect(); flash.classList.add('on');
          return finish(t, 1100);
        }
        if (t - trial.crossAt >= CROSS_DUR) {
          trial.outcome = trial.crossAt < trial.readable ? 'guess' : 'safe';
          if (trial.yields && trial.release == null) trial.release = t + 0.25;
        }
      }
      // a yielding car eventually gives up waiting
      if (trial.yields && trial.release == null && t > WAIT_LIMIT) {
        trial.release = t;
        if (trial.crossAt == null) trial.hesitated = true;
      }
      var carGone = s.x > 740;
      if (trial.outcome && carGone) return finish(t, 0);
      if (t > 11) { if (!trial.outcome) trial.outcome = 'none'; return finish(t, 0); }
      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (trial && trial.running) return;
      cancelAnimationFrame(raf);
      var c = cond();
      trial = {
        cond: c, yields: Math.random() < 0.5, start: performance.now(),
        crossAt: null, outcome: null, release: null, hitY: null, running: true, hesitated: false
      };
      trial.readable = readableAt(c, trial.yields);
      flash.classList.remove('on');
      btnCross.disabled = false;
      btnStart.disabled = true;
      say('Condition: ' + CONDS[c] + '. A vehicle is approaching — press Cross when you feel safe.');
      stage.focus({ preventScroll: true });
      raf = requestAnimationFrame(frame);
    }

    function cross() {
      if (!trial || !trial.running) { start(); return; }
      if (trial.crossAt != null) return;
      trial.crossAt = (performance.now() - trial.start) / 1000;
      btnCross.disabled = true;
    }

    function finish(t, delay) {
      cancelAnimationFrame(raf);
      trial.running = false;
      var r = {
        cond: trial.cond, yields: trial.yields, outcome: trial.outcome,
        rt: trial.crossAt, hesitated: trial.hesitated
      };
      results.push(r);
      var rt = r.rt != null ? r.rt.toFixed(2) + ' s' : '—';
      var msg, tone;
      if (r.outcome === 'conflict') { msg = 'Near miss. The car was not yielding — you stepped out at ' + rt + '.'; tone = 'bad'; }
      else if (r.outcome === 'guess') { msg = 'Safe, but you went at ' + rt + ', before the car’s intent was readable. A lucky guess.'; tone = 'warn'; }
      else if (r.outcome === 'safe') { msg = 'Safe crossing. Decision at ' + rt + (r.hesitated ? ', after the car had given up waiting.' : '.'); tone = 'good'; }
      else { msg = 'You didn’t cross this time.'; tone = 'warn'; }
      if (r.outcome !== 'conflict') msg += ' (The car ' + (r.yields ? 'was' : 'was not') + ' going to yield.)';
      setTimeout(function () {
        say(msg, tone);
        btnCross.disabled = true;
        btnStart.disabled = false;
        btnStart.textContent = 'Next trial';
        if (rotate && rotate.checked) {
          var next = ORDER[(ORDER.indexOf(r.cond) + 1) % ORDER.length];
          var radio = root.querySelector('input[value="' + next + '"]');
          if (radio) radio.checked = true;
        }
        table();
      }, delay);
    }

    function mean(a) { return a.reduce(function (s, v) { return s + v; }, 0) / a.length; }

    function table() {
      var rows = '', means = {}, maxM = 0;
      ORDER.forEach(function (c) {
        var rs = results.filter(function (r) { return r.cond === c; });
        var rts = rs.filter(function (r) { return r.rt != null && r.outcome !== 'conflict'; }).map(function (r) { return r.rt; });
        means[c] = rts.length ? mean(rts) : null;
        if (means[c] > maxM) maxM = means[c];
        means[c + '_n'] = rs.length;
        means[c + '_bad'] = rs.filter(function (r) { return r.outcome === 'conflict' || r.outcome === 'guess'; }).length;
      });
      ORDER.forEach(function (c) {
        var m = means[c];
        var w = m != null && maxM ? Math.round(60 * m / maxM) : 0;
        rows += '<tr><td>' + CONDS[c] + '</td><td class="num">' + means[c + '_n'] + '</td>' +
          '<td class="num">' + (m != null ? '<span class="xs-bar" style="width:' + w + 'px"></span>' + m.toFixed(2) + ' s' : '—') + '</td>' +
          '<td class="num">' + means[c + '_bad'] + '</td></tr>';
      });
      tbody.innerHTML = rows;
      var best = null;
      ['ehmi', 'spiu', 'both'].forEach(function (c) {
        if (means[c] != null && (best == null || means[c] < means[best])) best = c;
      });
      if (means.none != null && best && means[best] < means.none) {
        insight.textContent = 'In your trials, you decided ' + (means.none - means[best]).toFixed(2) +
          ' s faster with ' + CONDS[best] + ' than with no signal at all.';
      } else if (results.length) {
        insight.textContent = 'Try every condition at least once to compare your own decision times.';
      } else insight.textContent = '';
      btnReset.disabled = !results.length;
    }

    btnStart.addEventListener('click', start);
    btnCross.addEventListener('click', cross);
    btnReset.addEventListener('click', function () {
      results = []; table(); say('Results cleared. Pick a condition and start a trial.');
      btnStart.textContent = 'Start trial';
    });
    stage.addEventListener('keydown', function (e) {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); cross(); }
      else if (e.key === 'n' || e.key === 'N') { if (!trial || !trial.running) start(); }
    });
    stage.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button')) return;
      if (trial && trial.running) cross();
    });

    // initial still frame
    trial = { cond: cond(), yields: true, start: 0, crossAt: null, release: null, hitY: null };
    render(0);
    root.addEventListener('change', function (e) {
      if (e.target.name === 'xs-cond' && (!trial || !trial.running)) { trial.cond = cond(); render(0); }
    });
    table();
  })();
})();
