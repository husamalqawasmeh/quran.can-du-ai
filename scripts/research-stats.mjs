// Statistics for the research-framework page (#research): structure, letters and grammar, from public/stats.json,
// public/quran_text.json and the Quranic Arabic Corpus morphology -> public/research.json
// usage: node scripts/research-stats.mjs <quran-morphology.txt>   (github.com/mustafa0x/quran-morphology)
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert';
const S = JSON.parse(readFileSync('public/stats.json', 'utf8')), TEXT = JSON.parse(readFileSync('public/quran_text.json', 'utf8'));
const inc = (m, k, n = 1) => m.set(k, (m.get(k) || 0) + n);
const r2 = (x) => Math.round(x * 100) / 100;
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const median = (a) => { const b = [...a].sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
const corr = (a, b) => { const ma = mean(a), mb = mean(b); let n = 0, da = 0, db = 0; a.forEach((x, i) => { n += (x - ma) * (b[i] - mb); da += (x - ma) ** 2; db += (b[i] - mb) ** 2; }); return n / Math.sqrt(da * db); };
assert.equal(median([3, 1, 2]), 2); assert.equal(median([4, 1, 2, 3]), 2.5); assert.ok(Math.abs(corr([1, 2, 3], [2, 4, 6]) - 1) < 1e-9);

/* ---- 1. surah and verse structure (criteria 1–8) ---- */
const SU = S.surahs, V = SU.map((s) => s.verses), all = mean(V);
const loo = SU.map((s) => [s.ar, r2((V.reduce((a, b) => a + b, 0) - s.verses) / (SU.length - 1) - all)]).sort((a, b) => a[1] - b[1]);   // the average without this surah, minus the full average
const wpv = SU.map((s) => s.words / s.verses);
const thirds = [0, 1, 2].map((t) => { const g = SU.slice(Math.round((t * 114) / 3), Math.round(((t + 1) * 114) / 3)), w = g.reduce((a, s) => a + s.words, 0), v = g.reduce((a, s) => a + s.verses, 0), l = g.reduce((a, s) => a + s.letters, 0);
  return { from: g[0].ar, to: g.at(-1).ar, surahs: g.length, verses: v, words: w, wpv: r2(w / v), lpw: r2(l / w) }; });
const structure = {
  verses: { mean: r2(all), median: median(V), sd: r2(sd(V)), min: Math.min(...V), max: Math.max(...V) },
  words: { mean: r2(mean(SU.map((s) => s.words))), median: median(SU.map((s) => s.words)), sd: r2(sd(SU.map((s) => s.words))) },
  wpv: { mean: r2(mean(wpv)), median: r2(median(wpv)), sd: r2(sd(wpv)) },
  looLow: loo.slice(0, 5), looHigh: loo.slice(-5).reverse(),
  corrLenWpv: r2(corr(V, wpv)),            // surah length (verses) against average verse length (words)
  thirds,
};

/* ---- 2. letters: entropy, word-initial / word-final letters, letter pairs (criteria 9–13, 99) ---- */
const AR = /[ء-ي]/;
const norm = (w) => w.replace(/[ً-ٰٟـۖ-ۭ]/g, '').replace(/[ٱأإآ]/g, 'ا').replace(/ى/g, 'ي');   // as on the stats page: the plain spelling
const lf = new Map(), first = new Map(), last = new Map(), pair = new Map();
let nl = 0, nw = 0;
for (const t of Object.values(TEXT)) for (const raw of t.split(/\s+/)) {
  const w = [...norm(raw)].filter((c) => AR.test(c)); if (!w.length) continue;
  nw++; inc(first, w[0]); inc(last, w.at(-1));
  w.forEach((c, i) => { inc(lf, c); nl++; if (i) inc(pair, w[i - 1] + c); });
}
const H = -[...lf.values()].reduce((a, n) => a + (n / nl) * Math.log2(n / nl), 0);
const topN = (m, n, tot) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, c]) => [k, c, r2((100 * c) / tot)]);
const letters = { entropy: r2(H), maxEntropy: r2(Math.log2(lf.size)), alphabet: lf.size, letters: nl, words: nw, first: topN(first, 8, nw), last: topN(last, 8, nw), pairs: topN(pair, 20, [...pair.values()].reduce((a, b) => a + b, 0)) };
assert.ok(H > 3 && H < Math.log2(lf.size));

/* ---- 3. grammar from the morphology, overall and per 1,000 words in Makki / Madani surahs (criteria 26, 29, 31–39, 54, 84) ---- */
const PLACE = Object.fromEntries(SU.map((s) => [s.id, s.place]));
const cnt = { all: new Map(), makkah: new Map(), madinah: new Map() }, words = { all: new Set(), makkah: new Set(), madinah: new Set() };
const roots = new Map();
for (const line of readFileSync(process.argv[2] || 'scratch_morph.txt', 'utf8').split('\n')) {
  const p = line.trim().split('\t'); if (p.length < 4) continue;
  const [s, v, w] = p[0].split(':'), key = `${s}:${v}:${w}`, pl = PLACE[+s], f = p[3].split('|');
  const add = (k) => { inc(cnt.all, k); inc(cnt[pl], k); };
  words.all.add(key); words[pl].add(key);
  const root = (f.find((x) => x.startsWith('ROOT:')) || '').slice(5); if (root) inc(roots, root);
  if (p[2] === 'V') {
    add('verb'); if (f.includes('PASS')) add('pass'); else add('act');
    const per = f.find((x) => /^[123][MF]?[SDP]$/.test(x)); if (per) add('p' + per[0]);
  } else if (p[2] === 'N' && !f.includes('PRON') && !f.includes('PN') && !f.includes('DEM') && !f.includes('REL')) {
    const g = f.find((x) => /^[MF][SDP]?$/.test(x));        // QAC: M / F alone is singular
    if (g) { add('n' + (g[1] || 'S')); add('g' + g[0]); }
    for (const t of ['ACT_PCPL', 'PASS_PCPL', 'VN', 'ADJ']) if (f.includes(t)) add(t);
  }
  for (const t of ['COND', 'NEG', 'INTG', 'RES', 'EXP', 'VOC', 'EMPH', 'CERT', 'FUT', 'PN']) if (f.includes(t)) add(t);
}
const per1k = (k, pl) => r2((1000 * (cnt[pl].get(k) || 0)) / words[pl].size);
const KEYS = ['verb', 'act', 'pass', 'p1', 'p2', 'p3', 'nS', 'nD', 'nP', 'gM', 'gF', 'ACT_PCPL', 'PASS_PCPL', 'VN', 'ADJ', 'COND', 'NEG', 'INTG', 'RES', 'EXP', 'VOC', 'EMPH', 'CERT', 'FUT', 'PN'];
const grammar = { words: words.all.size, makkahWords: words.makkah.size, madinahWords: words.madinah.size,
  rows: KEYS.map((k) => [k, cnt.all.get(k) || 0, per1k(k, 'makkah'), per1k(k, 'madinah')]) };
const quad = [...roots].filter(([r]) => [...r].length === 4).sort((a, b) => b[1] - a[1]);
grammar.roots = { all: roots.size, tri: [...roots].filter(([r]) => [...r].length === 3).length, quad: quad.length, quadTop: quad.slice(0, 12) };
assert.ok(cnt.all.get('verb') > 19000 && cnt.all.get('pass') > 0);

writeFileSync('public/research.json', JSON.stringify({ structure, letters, grammar }));
console.log('research.json', structure.verses, letters.entropy, grammar.rows.slice(0, 3), grammar.roots.quad);
