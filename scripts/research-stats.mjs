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
const roots = new Map(), lemmas = new Map(), pnames = new Map(), rootLems = new Map();
let segs = 0;
for (const line of readFileSync(process.argv[2] || 'scratch_morph.txt', 'utf8').split('\n')) {
  const p = line.trim().split('\t'); if (p.length < 4) continue;
  const [s, v, w] = p[0].split(':'), key = `${s}:${v}:${w}`, pl = PLACE[+s], f = p[3].split('|');
  const add = (k) => { inc(cnt.all, k); inc(cnt[pl], k); };
  words.all.add(key); words[pl].add(key);
  const root = (f.find((x) => x.startsWith('ROOT:')) || '').slice(5); if (root) inc(roots, root);
  const lem = (f.find((x) => x.startsWith('LEM:')) || '').slice(4);
  segs++; if (lem) inc(lemmas, lem.normalize('NFD')); if (lem && f.includes('PN')) inc(pnames, lem.normalize('NFD'));   // the marks can be stored in either order
  if (root && lem) (rootLems.get(root) || rootLems.set(root, new Set()).get(root)).add(lem);
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

/* ---- 4. more criteria: verse-length outliers, first/last verses, verse-ending runs, Makki/Madani verse length (7, 64, 74, 84) ---- */
const VK = Object.keys(TEXT), vWords = (k) => TEXT[k].split(/\s+/).filter(Boolean).length;
const VL = VK.map(vWords), vm = mean(VL), vsd = sd(VL);
structure.verseLen = { mean: r2(vm), sd: r2(vsd), long: VK.map((k, i) => [k, VL[i], r2((VL[i] - vm) / vsd)]).sort((a, b) => b[1] - a[1]).slice(0, 10), oneOrTwo: VL.filter((n) => n <= 2).length, over3sd: VL.filter((n) => n > vm + 3 * vsd).length };
const bySurah = new Map(); VK.forEach((k) => { const s = +k.split(':')[0]; (bySurah.get(s) || bySurah.set(s, []).get(s)).push(k); });
const firstW = [...bySurah.values()].map((a) => vWords(a[0])), lastW = [...bySurah.values()].map((a) => vWords(a.at(-1)));
structure.firstLast = { first: r2(mean(firstW)), last: r2(mean(lastW)), longerFirst: firstW.filter((n, i) => n > lastW[i]).length, longerLast: firstW.filter((n, i) => n < lastW[i]).length };
const endL = (k) => { const w = [...norm(TEXT[k].trim())].filter((c) => AR.test(c)); return w.at(-1); };
let same = 0, pairs = 0; const run = [];
for (const [s, a] of bySurah) { let m = 0; for (let i = 1; i < a.length; i++) { pairs++; if (endL(a[i]) === endL(a[i - 1])) { same++; m++; } } if (a.length >= 10) run.push([SU[s - 1].ar, a.length, r2((100 * m) / (a.length - 1))]); }
structure.fawasil = { same: r2((100 * same) / pairs), top: run.sort((a, b) => b[2] - a[2]).slice(0, 10), low: run.slice(-5).reverse() };
const placeV = (pl) => { const g = SU.filter((s) => s.place === pl); return { surahs: g.length, verses: g.reduce((a, s) => a + s.verses, 0), wpv: r2(g.reduce((a, s) => a + s.words, 0) / g.reduce((a, s) => a + s.verses, 0)), vps: r2(mean(g.map((s) => s.verses))) }; };
structure.place = { makkah: placeV('makkah'), madinah: placeV('madinah') };

/* ---- 5. letters: three-letter sequences, letters per surah, long against short surahs (10, 13, 15) ---- */
const ALPHA = [...lf.keys()].sort((a, b) => lf.get(b) - lf.get(a));
const tri = new Map(), perS = new Map();
for (const k of VK) { const s = +k.split(':')[0], row = perS.get(s) || perS.set(s, new Map()).get(s);
  for (const raw of TEXT[k].split(/\s+/)) { const w = [...norm(raw)].filter((c) => AR.test(c)); w.forEach((c, i) => { inc(row, c); if (i > 1) inc(tri, w[i - 2] + w[i - 1] + c); }); } }
letters.tri = topN(tri, 20, [...tri.values()].reduce((a, b) => a + b, 0));
letters.alpha = ALPHA;
letters.perSurah = SU.map((s) => ALPHA.map((c) => perS.get(s.id).get(c) || 0));
const bySize = [...SU].sort((a, b) => b.words - a.words), third = (g) => { const m = new Map(); g.forEach((s) => perS.get(s.id).forEach((n, c) => inc(m, c, n))); const t = [...m.values()].reduce((a, b) => a + b, 0); return (c) => (100 * (m.get(c) || 0)) / t; };
const longP = third(bySize.slice(0, 38)), shortP = third(bySize.slice(-38));
letters.longShort = ALPHA.map((c) => [c, r2(longP(c)), r2(shortP(c)), r2(shortP(c) - longP(c))]).sort((a, b) => Math.abs(b[3]) - Math.abs(a[3])).slice(0, 10);

/* ---- 6. words: every word form with its count (17, 19), frequency against length (22), vocabulary richness per surah (18) ---- */
const forms = new Map(), sw = new Map();
for (const k of VK) { const s = +k.split(':')[0]; for (const raw of TEXT[k].split(/\s+/)) { const w = [...norm(raw)].filter((c) => AR.test(c)).join(''); if (!w) continue; inc(forms, w); (sw.get(s) || sw.set(s, []).get(s)).push(w); } }
const ranked = [...forms].sort((a, b) => b[1] - a[1]);
writeFileSync('public/words.json', JSON.stringify(ranked));   // the full list, loaded only when the word search is opened
const lr = ranked.map(([, n], i) => [Math.log(i + 1), Math.log(n)]), slope = (() => { const xs = lr.map((p) => p[0]), ys = lr.map((p) => p[1]), mx = mean(xs), my = mean(ys); let a = 0, b = 0; xs.forEach((x, i) => { a += (x - mx) * (ys[i] - my); b += (x - mx) ** 2; }); return a / b; })();
const band = (a) => r2(mean(a.map(([w]) => [...w].length)));
const words2 = { forms: ranked.length, hapax: ranked.filter(([, n]) => n === 1).length, zipf: r2(slope),
  bands: [['أكثر ١٠٠ كلمة', band(ranked.slice(0, 100))], ['من ١٠١ إلى ١٠٠٠', band(ranked.slice(100, 1000))], ['ما بعد الألف', band(ranked.slice(1000).filter(([, n]) => n > 1))], ['ما ورد مرة واحدة', band(ranked.filter(([, n]) => n === 1))]] };
const mattr = (a, W = 100) => { const c = new Map(); let types = 0, sum = 0; a.forEach((w, i) => { if (!c.get(w)) types++; inc(c, w); if (i >= W) { const o = a[i - W]; c.set(o, c.get(o) - 1); if (!c.get(o)) types--; } if (i >= W - 1) sum += types / W; }); return sum / (a.length - W + 1); };   // moving-average type/token ratio: not biased by the surah's length
const rich = SU.filter((s) => sw.get(s.id).length >= 200).map((s) => [s.ar, sw.get(s.id).length, r2(100 * mattr(sw.get(s.id)))]).sort((a, b) => b[2] - a[2]);
words2.rich = { n: rich.length, top: rich.slice(0, 10), low: rich.slice(-10).reverse() };
assert.ok(Math.abs(mattr(['a', 'b', 'a', 'b'], 2) - 1) < 1e-9 && Math.abs(mattr(['a', 'a', 'a'], 2) - 0.5) < 1e-9);

/* ---- 7. roots: every root with its count and its distinct words (25, 30); concepts by root (41) ---- */
const rootRows = [...roots].map(([r, n]) => [r, n, rootLems.get(r)?.size || 0]).sort((a, b) => b[1] - a[1]);
grammar.rootTable = rootRows;
grammar.rootCorr = r2(corr(rootRows.map((x) => Math.log(x[1])), rootRows.map((x) => x[2])));
const CONCEPTS = [['الرحمة', 'رحم'], ['العلم', 'علم'], ['الإيمان والأمن', 'أمن'], ['الكفر', 'كفر'], ['الهدى', 'هدي'], ['الحق', 'حقق'], ['الذكر', 'ذكر'], ['الظلم', 'ظلم'], ['التقوى', 'وقي'], ['العذاب', 'عذب'], ['الصبر', 'صبر'], ['الشكر', 'شكر'], ['الصدق', 'صدق'], ['العدل', 'عدل'], ['القسط', 'قسط'], ['الحب', 'حبب'], ['الخوف', 'خوف'], ['التوبة', 'توب'], ['المغفرة', 'غفر'], ['الحكمة', 'حكم']];
grammar.concepts = CONCEPTS.map(([c, r]) => [c, r, roots.get(r) || 0, rootLems.get(r)?.size || 0]).sort((a, b) => b[2] - a[2]);

/* ---- 8. places (52), similes (55), oath openings (60), word counting conventions (92) ---- */
const PLACES = [['مكة', 'مَكَّة'], ['بكة', 'بَكَّة'], ['يثرب', 'يَثْرِب'], ['المدينة', 'مَدِينَة'], ['مصر', 'مِصْر'], ['بابل', 'بابِل'], ['مدين', 'مَدْيَن'], ['سيناء', 'سَيْناء'], ['سينين', 'سِينِين'], ['الجودي', 'جُودِيّ'], ['الأحقاف', 'أَحْقاف'], ['إرم', 'إِرَم'], ['سبأ', 'سَبَإ'], ['عرفات', 'عَرَفات'], ['الصفا', 'صَفا'], ['المروة', 'مَرْوَة'], ['الكعبة', 'كَعْبَة'], ['بدر', 'بَدْر'], ['حنين', 'حُنَيْن'], ['الروم', 'رُوم']];
const UNSEEN = [['جهنم', 'جَهَنَّم'], ['عدن', 'عَدْن'], ['سقر', 'سَقَر'], ['الفردوس', 'فِرْدَوْس'], ['لظى', 'لَظَى'], ['سلسبيل', 'سَلْسَبِيل']];
const lc = (l) => pnames.get(l.normalize('NFD')) || lemmas.get(l.normalize('NFD')) || 0, lm = (l) => lemmas.get(l.normalize('NFD')) || 0;
grammar.places = { earth: PLACES.map(([a, l]) => [a, lc(l)]).sort((a, b) => b[1] - a[1]), unseen: UNSEEN.map(([a, l]) => [a, lc(l)]).sort((a, b) => b[1] - a[1]) };
grammar.similes = [['كاف التشبيه (كـ)', lm('ك')], ['مِثْل', lm('مِثْل')], ['مَثَل (ضرب المثل)', lm('مَثَل')], ['كأنّ / كأنْ', lm('كَأَنّ') + lm('كَأَنْ')]];
const OATH = /^(وال|والل|لا اقسم|فلا اقسم|ص والقران|ق والقران|يس والقران|حم والكتاب|ن والقلم|والسماء|والفجر)/;
grammar.oathOpen = SU.filter((s) => { const v1 = norm(TEXT[`${s.id}:1`] || ''), v2 = norm(TEXT[`${s.id}:2`] || ''); return OATH.test(v1) || (/^(حم|طس|يس|ص|ق|ن)$/.test(v1.trim()) && OATH.test(v2)); }).map((s) => s.ar);
grammar.tokens = { space: nw, qac: words.all.size, segments: segs };

/* ---- 9. marks of the Uthmani text: vowels, shadda, tanween (14); spelling marks of the Uthmani rasm (89); pause signs ---- */
let marks = null;
try {   // quran.sql from scripts/load-quran.mjs holds the Uthmani text
  const U = readFileSync('quran.sql', 'utf8').split('\n').filter((l) => l.startsWith('INSERT INTO ayat')).map((l) => /^INSERT INTO ayat VALUES\(\d+,\d+,'((?:[^']|'')*)'/.exec(l)[1].replace(/''/g, "'"));
  const mc = new Map(); for (const v of U) for (const c of v) inc(mc, c);
  const M = (g, rows) => rows.map(([cp, name]) => [g, name, String.fromCharCode(cp), mc.get(String.fromCharCode(cp)) || 0]);
  marks = { verses: U.length, words: U.reduce((a, v) => a + v.split(/\s+/).filter((w) => /[ء-يٱ]/.test(w)).length, 0), rows: [   // pause signs stand alone between words: not counted
    ...M('الحركات', [[0x64e, 'الفتحة'], [0x650, 'الكسرة'], [0x64f, 'الضمة'], [0x652, 'السكون']]),
    ...M('الشدة والتنوين', [[0x651, 'الشدة'], [0x64b, 'تنوين الفتح'], [0x64d, 'تنوين الكسر'], [0x64c, 'تنوين الضم']]),
    ...M('علامات الرسم العثماني', [[0x671, 'همزة الوصل (ٱ)'], [0x670, 'الألف الخنجرية (الألف الصغيرة)'], [0x653, 'علامة المد'], [0x6df, 'الصفر المستدير (حرف زائد لا يُنطق)'], [0x6e5, 'الواو الصغيرة'], [0x6e6, 'الياء الصغيرة'], [0x6e2, 'الميم الصغيرة (الإقلاب)']]),
    ...M('علامات الوقف', [[0x6da, 'ج: الوقف جائز'], [0x6d6, 'صلى: الوصل أولى'], [0x6d7, 'قلى: الوقف أولى'], [0x6d8, 'م: الوقف لازم'], [0x6d9, 'لا: لا تقف'], [0x6db, 'النقاط الثلاث: تعانق الوقف']]),
  ] };
  assert.equal(U.length, 6236);
} catch (e) { console.log('marks skipped:', e.message); }
grammar.tokens.uthmani = marks?.words;

writeFileSync('public/research.json', JSON.stringify({ structure, letters, grammar, words: words2, marks }));
console.log('extra', structure.verseLen.over3sd, structure.fawasil.same, words2.forms, words2.hapax, words2.zipf, grammar.rootCorr, grammar.oathOpen.length, grammar.tokens);
console.log('research.json', structure.verses, letters.entropy, grammar.rows.slice(0, 3), grammar.roots.quad);
