import { readFileSync } from 'node:fs';
const html = readFileSync('public/index.html', 'utf8');
const start = html.indexOf('TOPICS.names = {'), seg = html.slice(start, html.indexOf('\n};', start));
const items = [...seg.matchAll(/\{ g: (\d+), t: "([^"]+)", note: "[^"]*", keys: \['([^']+)'\] \}/g)].map((m) => ({ g: +m[1], n: m[2], k: m[3] }));
const Q = JSON.parse(readFileSync('quran_text.json', 'utf8'));
// compare on a skeleton: no diacritics, alef/ya/waw variants merged, hamza letters dropped
const cmp = (s) => s.replace(/[\u064B-\u065F\u0670\u0640\u06D6-\u06ED]/g, '').replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/[ءؤئ]/g, '').replace(/\s+/g, ' ').trim();
const verses = Object.entries(Q).map(([k, t]) => [k, cmp(t).split(' ')]);
// one token matches a name-word if, after dropping ONE attached prefix (و ف ب ل ك) and/or the article, and an optional nunation alef, they are equal
const strip = (w) => w.replace(/^ال/, '');
function same(token, part) {
  const cands = new Set([token]);
  if (/^[وفبلك]/.test(token)) cands.add(token.slice(1));
  for (const c of [...cands]) {
    for (const base of [c, strip(c)]) {
      if (base === part || base === part + 'ا' || base + 'ا' === part) return true;
    }
  }
  return false;
}
function has(tokens, name) {
  const parts = cmp(name).split(' ').map(strip);
  for (let i = 0; i + parts.length <= tokens.length; i++) if (parts.every((p, j) => same(tokens[i + j], p))) return true;
  return false;
}
const rows = items.map(({ g, n, k }) => ({ g, n, k, total: verses.filter(([, t]) => has(t, n)).length, here: has(verses.find(([kk]) => kk === k)[1], n) }));
const bad = rows.filter((r) => !r.here);
console.log('names in the list:', rows.length, '| exact word found in the cited verse:', rows.filter((r) => r.here).length, '| NOT found in cited verse:', bad.length);
for (const r of bad) {
  const where = verses.filter(([, t]) => has(t, r.n)).slice(0, 4).map(([k]) => k).join(', ');
  console.log(`  ${r.n}  cited ${r.k}  verses-with-exact-word: ${r.total}  e.g. ${where || '-'}`);
}
