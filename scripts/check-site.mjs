#!/usr/bin/env node
// check-site.mjs — safety net for the site. Plain Node, no dependencies.
// Runs on every pull request (GitHub Actions) and locally:
//     node scripts/check-site.mjs
// It fails (exit 1) on anything that would break or slow the live site:
//   • a link, image, video, script or stylesheet pointing to a file that doesn't exist
//   • an in-site link to an #anchor that doesn't exist on that page
//   • an image without alt text
//   • a page missing its title, description, header name, the standard menu,
//     the light/dark toggle, the footer or the tab icon (keeps every page consistent)
//   • an image over 600 KB or a video over 6 MB (keeps the site fast)
//   • broken JSON-LD (what Google reads about you)
//   • (on GitHub, or with --external) photos linked from other websites that no longer exist
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, extname, relative } from 'node:path';

const ROOT = process.cwd();
const IMG_MAX = 600 * 1024, VIDEO_MAX = 6 * 1024 * 1024;
const MENU = ['Research', 'Publications', 'CV', 'News', 'Moments', 'About', 'Contact'];
const SKIP_DIRS = new Set(['.git', '.github', 'node_modules', 'scripts', 'tools']);
const ci = !!process.env.GITHUB_ACTIONS;

const problems = [];
function fail(file, line, msg) {
  problems.push({ file, line, msg });
  if (ci) console.log(`::error file=${file},line=${line || 1}::${msg}`);
}
function lineOf(text, index) { return text.slice(0, index).split('\n').length; }

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
const files = walk(ROOT);
const pages = files.filter((f) => extname(f) === '.html' && dirname(f) === ROOT);

// strip comments, scripts and styles but keep line numbers
function visible(html) {
  return html.replace(/<!--[\s\S]*?-->|<script\b(?![^>]*application\/ld\+json)[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi,
    (m) => m.replace(/[^\n]/g, ' '));
}
function ids(html) {
  const s = new Set();
  for (const m of visible(html).matchAll(/\sid="([^"]+)"/g)) s.add(m[1]);
  return s;
}
const idCache = {};
function idsOf(page) {
  if (!idCache[page]) idCache[page] = ids(readFileSync(page, 'utf8'));
  return idCache[page];
}

/* ---------- every page ---------- */
for (const page of pages) {
  const rel = relative(ROOT, page);
  const raw = readFileSync(page, 'utf8');
  const html = visible(raw);
  const has = (re) => re.test(html);

  if (!has(/<html[^>]*\slang="/)) fail(rel, 1, 'missing <html lang="…">');
  if (!has(/<title>[^<]{3,}<\/title>/)) fail(rel, 1, 'missing <title>');
  if (!has(/<meta name="viewport"/)) fail(rel, 1, 'missing viewport meta tag (phones will zoom out)');
  if (!has(/<meta name="description" content="[^"]{20,}"/)) fail(rel, 1, 'missing or very short meta description');
  if (!has(/<header class="site"/)) fail(rel, 1, 'missing the shared <header class="site">');
  if (!has(/<a class="brand"/)) fail(rel, 1, 'header is missing the name link (<a class="brand">)');
  if (!has(/id="themeToggle"/)) fail(rel, 1, 'missing the light/dark toggle (#themeToggle)');
  if (!has(/<footer class="site"/)) fail(rel, 1, 'missing the shared <footer class="site">');
  if (!has(/<link rel="icon"/)) fail(rel, 1, 'missing the tab icon (<link rel="icon" href="favicon.ico">)');
  const nav = html.match(/<nav class="primary"[\s\S]*?<\/nav>/);
  if (!nav) fail(rel, 1, 'missing the main menu (<nav class="primary">)');
  else {
    const labels = [...nav[0].matchAll(/<a\b[^>]*>([^<]+)<\/a>/g)].map((m) => m[1].trim());
    if (labels.join('|') !== MENU.join('|')) {
      fail(rel, lineOf(html, nav.index), `menu should be "${MENU.join(' · ')}" but is "${labels.join(' · ')}"`);
    }
  }

  // images need alt text
  for (const m of html.matchAll(/<img\b[^>]*>/g)) {
    if (!/\salt="/.test(m[0])) fail(rel, lineOf(html, m.index), 'image without alt text: ' + m[0].slice(0, 80));
  }

  // every local reference must exist
  for (const m of html.matchAll(/\s(src|href|poster|data-src)="([^"]*)"/g)) {
    const url = m[2];
    if (!url || /^(https?:|mailto:|tel:|data:|javascript:|\/\/)/i.test(url)) continue;
    const line = lineOf(html, m.index);
    if (url.startsWith('#')) {
      if (url.length > 1 && !idsOf(page).has(url.slice(1))) fail(rel, line, `link to #${url.slice(1)}, but no element has that id`);
      continue;
    }
    const [pathPart, hash] = url.split('#');
    const clean = decodeURIComponent(pathPart.split('?')[0]);
    if (!clean) continue;
    const target = clean.startsWith('/') ? join(ROOT, clean) : join(dirname(page), clean);
    const resolved = existsSync(target) && statSync(target).isDirectory() ? join(target, 'index.html') : target;
    if (!existsSync(resolved)) { fail(rel, line, `points to a file that doesn't exist: ${url}`); continue; }
    if (hash && extname(resolved) === '.html' && !idsOf(resolved).has(hash)) {
      fail(rel, line, `link to ${url}, but ${relative(ROOT, resolved)} has no id="${hash}"`);
    }
  }

  // JSON-LD must parse
  for (const m of raw.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(m[1]); } catch (e) { fail(rel, lineOf(raw, m.index), 'JSON-LD is not valid JSON: ' + e.message); }
  }
}

/* ---------- photos loaded from other websites (CI only: needs the network) ---------- */
// Catches images that another site (e.g. the lab website) has moved or deleted.
if (ci || process.argv.includes('--external')) {
  const ext = new Map();
  for (const page of pages) {
    const html = visible(readFileSync(page, 'utf8'));
    for (const m of html.matchAll(/\s(src|data-src|poster)="(https?:[^"]+)"/g)) {
      if (!/\.(jpe?g|png|gif|webp|avif|mp4)(\?|$)/i.test(m[2])) continue;
      if (!ext.has(m[2])) ext.set(m[2], [relative(ROOT, page), lineOf(html, m.index)]);
    }
  }
  await Promise.all([...ext].map(async ([url, [file, line]]) => {
    try {
      const r = await fetch(url, { method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0 (site check)', Range: 'bytes=0-0' } });
      if (r.status === 404 || r.status === 410) fail(file, line, `photo from another website is gone (HTTP ${r.status}): ${url}`);
    } catch (e) { /* network hiccup: don't fail the build */ }
  }));
}

/* ---------- file sizes ---------- */
for (const f of files) {
  const ext = extname(f).toLowerCase(), size = statSync(f).size, rel = relative(ROOT, f);
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif'].includes(ext) && size > IMG_MAX) {
    fail(rel, 1, `image is ${(size / 1024).toFixed(0)} KB (limit 600 KB). Run: python3 tools/optimize-images.py "${rel}"`);
  }
  if (['.mp4', '.webm', '.mov'].includes(ext) && size > VIDEO_MAX) {
    fail(rel, 1, `video is ${(size / 1048576).toFixed(1)} MB (limit 6 MB). Re-export it smaller (e.g. avconvert -p Preset960x540).`);
  }
}

/* ---------- report ---------- */
if (problems.length) {
  if (!ci) for (const p of problems) console.log(`✗ ${p.file}:${p.line}  ${p.msg}`);
  console.log(`\n${problems.length} problem${problems.length === 1 ? '' : 's'} found. Fix them before merging.`);
  process.exit(1);
}
console.log(`✓ All checks passed (${pages.length} pages, ${files.length} files).`);
