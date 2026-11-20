// news.mjs — news.html is the single source of truth for news.
// The homepage "News." list shows the newest HOME_COUNT items, copied
// between the <!-- news:start --> and <!-- news:end --> markers in index.html.
// Run `node scripts/sync-news.mjs` after editing news.html.
import { readFileSync } from 'node:fs';

export const HOME_COUNT = 5;
export const START = '<!-- news:start · copied from news.html by scripts/sync-news.mjs. Edit news.html, not this list. -->';
export const END = '<!-- news:end -->';

// Newest-first <li> items from news.html (years are listed newest first).
export function latestNews(newsHtml, count = HOME_COUNT) {
  const html = newsHtml.replace(/<!--[\s\S]*?-->/g, '');
  const items = [];
  const lists = html.match(/<ul class="news-list">[\s\S]*?<\/ul>/g) || [];
  for (const ul of lists) {
    for (const li of ul.match(/<li>[\s\S]*?<\/li>/g) || []) {
      items.push(li.replace(/\s+/g, ' ').trim());
      if (items.length === count) return items;
    }
  }
  return items;
}

export function homeBlock(newsHtml) {
  const lis = latestNews(newsHtml).map((li) => '      ' + li).join('\n');
  return `${START}\n${lis}\n      ${END}`;
}

// Returns { ok, current, expected } for the block in index.html.
export function compare(root = '.') {
  const index = readFileSync(`${root}/index.html`, 'utf8');
  const news = readFileSync(`${root}/news.html`, 'utf8');
  const a = index.indexOf(START), b = index.indexOf(END);
  if (a < 0 || b < 0) return { ok: false, missing: true };
  const current = index.slice(a, b + END.length);
  const expected = homeBlock(news);
  return { ok: current === expected, current, expected, index, a, b };
}
