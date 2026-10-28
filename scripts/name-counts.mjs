// usage: node scripts/name-counts.mjs <quran-morphology.txt>
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
// names whose bare letters also spell other words: counted by their word in the morphology instead of by spelling
// («ملك» is also مُلْك ownership and مَلَك angel; only مَلِك, king, can be the name)
const BY_LEMMA = { 'الملك': 'مَلِك' };
const lemmaVerses = {};
if (process.argv[2]) for (const line of readFileSync(process.argv[2], 'utf8').split('\n')) {
  const p = line.trim().split('\t'); if (p.length < 4) continue;
  const lem = (/LEM:([^|]+)/.exec(p[3]) || [])[1]; if (!lem) continue;
  for (const [n, l] of Object.entries(BY_LEMMA)) if (lem.normalize('NFD') === l.normalize('NFD')) { const k = p[0].split(':').slice(0, 2).join(':'); (lemmaVerses[n] ||= {})[k] = (lemmaVerses[n][k] || 0) + 1; }
} else throw new Error('usage: node scripts/name-counts.mjs <quran-morphology.txt>   (github.com/mustafa0x/quran-morphology)');
const occOf = (name) => (BY_LEMMA[name] ? Object.entries(lemmaVerses[name] || {}) : verses.map(([k, t]) => [k, countIn(t, name)]).filter(([, c]) => c));
const out = {};
for (const name of names) { const o = occOf(name); out[name] = { n: o.reduce((a, [, c]) => a + c, 0), v: o.length }; }
writeFileSync('public/names_counts.json', JSON.stringify(out));
// names that also come in the Quran for other than Allah (marked ⚠︎): every verse where each comes, for the volunteers to judge (#validate)
const amb = /const AMBIGUOUS = new Set\(\[([^\]]*)\]\)/.exec(html)[1].match(/'([^']+)'/g).map((x) => x.slice(1, -1));
const occ = {};
for (const name of amb.filter((n) => names.includes(n))) occ[name] = occOf(name);
for (const [n, list] of Object.entries(occ)) if (list.reduce((a, [, c]) => a + c, 0) !== out[n].n) throw new Error('occurrences do not add up: ' + n);
writeFileSync('public/names_occ.json', JSON.stringify(occ));
console.log('names to judge:', Object.keys(occ).length, 'verses:', Object.values(occ).reduce((a, l) => a + l.length, 0));
const top = Object.entries(out).sort((a, b) => b[1].n - a[1].n);
console.log('names:', names.length);
console.log('top 12:', top.slice(0, 12).map(([n, c]) => `${n}:${c.n}`).join('  '));
console.log('least 12:', top.slice(-12).map(([n, c]) => `${n}:${c.n}`).join('  '));
console.log('spot checks:', ['الرحمن', 'الرحيم', 'الغفور', 'العليم', 'الحكيم', 'العزيز', 'السميع', 'القدير'].map((n) => `${n}:${out[n]?.n}/${out[n]?.v}v`).join('  '));
