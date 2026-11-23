/* blog.js — small helpers for blog posts.
   Drag-to-compare: <div class="ba"> with an <input type="range"> moves the divider. */
(function () {
  document.querySelectorAll('.ba').forEach(function (ba) {
    var r = ba.querySelector('input[type=range]');
    if (!r) return;
    var set = function () { ba.style.setProperty('--pos', r.value + '%'); };
    r.addEventListener('input', set); set();
  });
})();
