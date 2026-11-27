// build-home-moments.mjs — the "From the field" photos on the homepage come from
// moments.html, so the homepage always shows the newest moments first.
//
//   node scripts/build-home-moments.mjs           rebuild the homepage strip
//   node scripts/build-home-moments.mjs --check   only check (used by Site checks)
//
// moments.html is the one place to edit. Each <figure class="moment-tile"> can carry:
//   data-note="CHI ’26, Barcelona"            the handwritten caption on the homepage
//   data-note-img="assets/images/notes/…jpg"  the photo for the homepage (default: the tile photo)
//   data-note-alt="…"                         its description, when that photo is not the tile photo
// Tiles must be newest first (by the "· Month YYYY" line); tiles without a date go last.
// The homepage shows the first SHOW tiles.
import { readFileSync, writeFileSync } from 'node:fs';

const SHOW = 5;
const TILTS = ['-1.6deg', '1.2deg', '-0.8deg', '1.8deg', '-1.2deg'];
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const check = process.argv.includes('--check');
const errors = [];

const moments = readFileSync('moments.html', 'utf8');
const attr = (tag, name) => { const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`)); return m ? m[1] : null; };
const tiles = [...moments.matchAll(/<figure class="moment-tile"[^>]*>[\s\S]*?<\/figure>/g)].map((m) => {
  const block = m[0], open = block.match(/^<figure[^>]*>/)[0];
  const img = (block.match(/<img\b[^>]*>/) || [''])[0];
  const name = ((block.match(/<strong>([\s\S]*?)<\/strong>/) || [])[1] || '').trim();
  const when = ((block.match(/<figcaption>[\s\S]*?<span>([\s\S]*?)<\/span>/) || [])[1] || '').trim();
  const d = when.match(/([A-Za-z]+)\s+(\d{4})\s*$/);
  const mi = d ? MONTHS.indexOf(d[1].toLowerCase()) : -1;
  return {
    name, when, date: d && mi >= 0 ? Number(d[2]) * 12 + mi : null,
    note: attr(open, 'data-note'), noteImg: attr(open, 'data-note-img'),
    src: attr(img, 'src'), alt: attr(open, 'data-note-alt') || attr(img, 'alt') || name,
  };
});

// newest first: every dated tile no newer than the one before it; undated tiles only at the end
let seenUndated = false, prev = Infinity;
for (const t of tiles) {
  if (t.date == null) { seenUndated = true; continue; }
  if (seenUndated) errors.push(`moments.html: "${t.name}" has a date but comes after a tile without one; move it up`);
  if (t.date > prev) errors.push(`moments.html: "${t.name}" (${t.when}) is newer than the tile above it; newest must go first`);
  prev = Math.min(prev, t.date);
}

const esc = (s) => s.replace(/&(?![a-z#0-9]+;)/gi, '&amp;').replace(/"/g, '&quot;');
const notes = tiles.slice(0, SHOW).map((t, i) => {
  const src = t.noteImg || t.src;
  if (!src) errors.push(`moments.html: "${t.name}" has no photo for the homepage`);
  const cap = t.note || t.name;
  return `          <figure class="note" style="--tilt:${TILTS[i % TILTS.length]}">
            <img loading="lazy" decoding="async" src="${src}" alt="${esc(t.alt)}" />
            <figcaption>${cap}</figcaption>
          </figure>`;
}).join('\n');

const START = '<!-- moments:start (built from moments.html by scripts/build-home-moments.mjs; edit moments.html, not here) -->';
const END = '<!-- moments:end -->';
const home = readFileSync('index.html', 'utf8');
const a = home.indexOf(START), b = home.indexOf(END);
if (a < 0 || b < a) errors.push('index.html: the moments:start / moments:end markers are missing');
const out = a < 0 || b < a ? home : home.slice(0, a + START.length) + '\n' + notes + '\n          ' + home.slice(b);

if (errors.length) { for (const e of errors) console.log('✗ ' + e); process.exit(1); }
if (check) {
  if (out !== home) { console.log('✗ index.html: the homepage moments are out of date (run: node scripts/build-home-moments.mjs)'); process.exit(1); }
} else if (out !== home) {
  writeFileSync('index.html', out);
  console.log('homepage moments rebuilt: ' + tiles.slice(0, SHOW).map((t) => t.name).join(' · '));
}
