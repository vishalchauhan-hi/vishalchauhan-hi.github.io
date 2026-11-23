/* nav.js — on phones the menu is one swipeable row; this scrolls the current
   page's link into view so visitors can see where they are. */
(function () {
  var nav = document.querySelector('nav.primary');
  var cur = nav && nav.querySelector('a[aria-current="page"]');
  if (!nav || !cur || nav.scrollWidth <= nav.clientWidth) return;
  nav.scrollLeft = Math.max(0, cur.offsetLeft - nav.clientWidth / 2 + cur.offsetWidth / 2);
})();
