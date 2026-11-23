/* terrain.js — every page gets its own soft contour map across the whole page.
   The map is generated once from the page's name, so the homepage, Publications,
   CV, News… each have a different landscape from the same family, like sheets
   of an atlas. Drawn once as a background image: nothing moves, no cost while
   scrolling. Behind the text column it is veiled to about a third (style.css, "terrain"). */
(function () {
  'use strict';
  var root = document.documentElement;
  var page = (location.pathname.split('/').pop() || 'index.html').replace(/\.html$/, '') || 'index';

  // seeded random, so a page always gets the same map
  var seed = 0;
  for (var i = 0; i < page.length; i++) seed = (seed * 31 + page.charCodeAt(i)) | 0;
  function rnd() { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }

  var W = 1600, H = 1400;
  function loop(cx, cy, r, wob, ph, sx) {
    var n = 56, pts = [], d = '';
    for (var k = 0; k < n; k++) {
      var t = 2 * Math.PI * k / n;
      var rr = r * (1 + wob * (0.55 * Math.sin(3 * t + ph) + 0.3 * Math.sin(5 * t + ph * 1.7) + 0.15 * Math.sin(2 * t - ph)));
      pts.push([cx + rr * Math.cos(t) * sx, cy + rr * Math.sin(t)]);
    }
    for (k = 0; k < n; k++) {
      var a = pts[k], b = pts[(k + 1) % n], c = pts[(k + 2) % n];
      if (!k) d += 'M' + ((a[0] + b[0]) / 2).toFixed(1) + ' ' + ((a[1] + b[1]) / 2).toFixed(1);
      d += 'Q' + b[0].toFixed(1) + ' ' + b[1].toFixed(1) + ' ' + ((b[0] + c[0]) / 2).toFixed(1) + ' ' + ((b[1] + c[1]) / 2).toFixed(1);
    }
    return d + 'Z';
  }
  // hills spread across the whole width; each takes one colour from the
  // contact box's sunset palette
  var PALETTE = [[232, 128, 98], [232, 180, 60], [74, 140, 105], [96, 140, 214]];
  var hills = [], start = Math.floor(rnd() * 4);
  var SPOTS = [[80, 300, 120, 520], [500, 760, 60, 420], [880, 1140, 520, 900], [1300, 1540, 160, 560], [140, 420, 860, 1200], [1180, 1480, 900, 1260]];
  SPOTS.forEach(function (sp, idx) {
    var cx = sp[0] + rnd() * (sp[1] - sp[0]);
    var cy = sp[2] + rnd() * (sp[3] - sp[2]);
    var ph = rnd() * 6.28, sx = 0.9 + rnd() * 0.6, rings = 6 + Math.floor(rnd() * 5), base = 14 + rnd() * 22, d = '';
    for (var k = 0; k < rings; k++) d += loop(cx, cy, base + k * 26, 0.05 + k * 0.009, ph + k * 0.2, sx);
    hills.push({ cx: cx, cy: cy, r: base + rings * 26, sx: sx, d: d, c: PALETTE[(start + idx) % 4] });
  });
  function tile(lineAlpha, glowAlpha) {
    var defs = '', body = '';
    hills.forEach(function (hl, i) {
      var rgb = hl.c.join(',');
      defs += '<radialGradient id="g' + i + '"><stop offset="0" stop-color="rgb(' + rgb + ')" stop-opacity="' + glowAlpha + '"/>' +
              '<stop offset="1" stop-color="rgb(' + rgb + ')" stop-opacity="0"/></radialGradient>';
      body += '<ellipse cx="' + hl.cx.toFixed(1) + '" cy="' + hl.cy.toFixed(1) + '" rx="' + (hl.r * hl.sx * 1.15).toFixed(1) + '" ry="' + (hl.r * 1.15).toFixed(1) + '" fill="url(#g' + i + ')"/>' +
              '<path d="' + hl.d + '" fill="none" stroke="rgb(' + rgb + ')" stroke-opacity="' + lineAlpha + '" stroke-width="1.1"/>';
    });
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '"><defs>' + defs + '</defs>' + body + '</svg>';
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
  }
  root.style.setProperty('--terrain-light', tile(0.42, 0.22));
  root.style.setProperty('--terrain-dark', tile(0.26, 0.12));
  root.classList.add('has-terrain');
})();
