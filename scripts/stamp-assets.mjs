#!/usr/bin/env node
// stamp-assets.mjs — make browsers load the newest CSS/JS right after a change.
//
// Browsers keep a saved copy of style/script files for a while, so a visitor can
// see an old design after you update. This adds a short fingerprint of each
// file's contents to its link, e.g.  assets/hci.css?v=3f9a1c2e
// When the file changes, the fingerprint changes, and every browser fetches
// the new one at once.
//
//   node scripts/stamp-assets.mjs          update all pages (then rebuilds the blog)
//   node scripts/stamp-assets.mjs --check  only check (used by scripts/check-site.mjs)
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const check = process.argv.includes('--check');
const pages = readdirSync('.').filter((f) => f.endsWith('.html')).concat(existsSync('blog/_page.html') ? ['blog/_page.html'] : []);
const hashes = {};
const fp = (file) => (hashes[file] ??= createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 8));
const RE = /((?:href|src)=")(assets\/[\w./-]+\.(?:css|js))(?:\?v=([0-9a-f]+))?(")/g;

const stale = [];
for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  const out = html.replace(RE, (m, pre, file, v, post) => {
    if (!existsSync(file)) return m;
    const want = fp(file);
    if (v !== want) stale.push(`${page}: ${file}`);
    return `${pre}${file}?v=${want}${post}`;
  });
  if (!check && out !== html) writeFileSync(page, out);
}

if (check) {
  if (stale.length) {
    for (const s of stale) console.log(`✗ ${s} needs a new version stamp. Run: node scripts/stamp-assets.mjs`);
    process.exit(1);
  }
  console.log('✓ CSS/JS version stamps are up to date.');
} else {
  console.log(stale.length ? `✓ Updated ${stale.length} link(s).` : '✓ All version stamps already up to date.');
  if (existsSync('scripts/build-blog.mjs')) spawnSync(process.execPath, ['scripts/build-blog.mjs'], { stdio: 'inherit' });
}
