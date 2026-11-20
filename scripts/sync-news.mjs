#!/usr/bin/env node
// Copy the newest news items from news.html onto the homepage.
// Usage (from the repo root):  node scripts/sync-news.mjs
import { writeFileSync } from 'node:fs';
import { compare, END, HOME_COUNT } from './news.mjs';

const r = compare('.');
if (r.missing) {
  console.error('index.html is missing the <!-- news:start --> / <!-- news:end --> markers.');
  process.exit(1);
}
if (r.ok) {
  console.log(`Homepage news already matches the newest ${HOME_COUNT} items in news.html.`);
} else {
  const out = r.index.slice(0, r.a) + r.expected + r.index.slice(r.b + END.length);
  writeFileSync('index.html', out);
  console.log(`Updated the homepage with the newest ${HOME_COUNT} items from news.html.`);
}
