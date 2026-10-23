// How many times does each name's WORD occur in the Quran text? (counts tokens; also verses). -> public/names_counts.json
import { readFileSync, writeFileSync } from 'node:fs';
const html = readFileSync('public/index.html', 'utf8');
const start = html.indexOf('TOPICS.names = {'), seg = html.slice(start, html.indexOf('\n};', start));
const names = [...seg.matchAll(/\{ g: (\d+), t: "([^"]+)", note: "[^"]*", keys: \['([^']+)'\] \}/g)].map((m) => m[2]);
const Q = JSON.parse(readFileSync('quran_text.json', 'utf8'));
// skeleton: no diacritics, alef variants merged, hamza letters dropped. Alef-maqsura (ى) is KEPT, so «على» is not confused with «علي».
const cmp = (s) => s.replace(/[\u064B-\u065F\u0670\u0640\u06D6-\u06ED]/g, '').replace(/[إأآٱ]/g, 'ا').replace(/[ءؤئ]/g, '').replace(/\s+/g, ' ').trim();
const verses = Object.entries(Q).map(([k, t]) => [k, cmp(t).split(' ')]);
const strip = (w) => w.replace(/^ال/, '');
function same(token, part) {
  const cands = [token]; if (/^[وفبلك]/.test(token)) cands.push(token.slice(1));
  if (/^[وف]?لل/.test(token)) cands.push('ال' + token.replace(/^[وف]?لل/, ''));        // «للرحمن» = ل + الرحمن (the article's alef drops)
  for (const c of cands) for (const base of [c, strip(c)]) if (base === part || base === part + 'ا') return true;
  return false;
}
const SPECIAL = { 'الله': new Set(['لله', 'تالله']) };       // «لله» = ل + الله, «تالله» = oath
function countIn(tokens, name) {
  if (name === 'الله') return tokens.filter((t) => /^[وفا]?[بكت]?الله$|^[وفا]?لله$/.test(t)).length;   // not «له» (for him): once the article is dropped, «الله» would collide with it
  const parts = cmp(name).split(' ').map(strip); let n = 0;
  for (let i = 0; i + parts.length <= tokens.length; i++) {
    if (parts.every((p, j) => same(tokens[i + j], p))) { n++; i += parts.length - 1; }
    else if (parts.length === 1 && SPECIAL[name]?.has(tokens[i])) n++;
  }
  return n;
}
const out = {};
for (const name of names) {
  let tokens = 0, vs = 0;
  for (const [, t] of verses) { const c = countIn(t, name); if (c) { tokens += c; vs++; } }
  out[name] = { n: tokens, v: vs };
}
writeFileSync('public/names_counts.json', JSON.stringify(out));
const top = Object.entries(out).sort((a, b) => b[1].n - a[1].n);
console.log('names:', names.length);
console.log('top 12:', top.slice(0, 12).map(([n, c]) => `${n}:${c.n}`).join('  '));
console.log('least 12:', top.slice(-12).map(([n, c]) => `${n}:${c.n}`).join('  '));
console.log('spot checks:', ['الرحمن', 'الرحيم', 'الغفور', 'العليم', 'الحكيم', 'العزيز', 'السميع', 'القدير'].map((n) => `${n}:${out[n]?.n}/${out[n]?.v}v`).join('  '));
