// Level-2 word statistics (links, associations, patterns) from the Quranic Arabic Corpus morphology + public/quran_text.json -> public/deep.json
// usage: node scripts/deep-stats.mjs <quran-morphology.txt>   (github.com/mustafa0x/quran-morphology)
import { readFileSync, writeFileSync } from 'node:fs';
const file = process.argv[2] || 'scratch_morph.txt';
const strip = (s) => s.replace(/[ً-ٰٟـۖ-ۭ]/g, '').replace(/[ٱأإآ]/g, 'ا');
const TEXT = JSON.parse(readFileSync('public/quran_text.json', 'utf8')), S = JSON.parse(readFileSync('public/stats.json', 'utf8'));
const SUR = Object.fromEntries(S.surahs.map((s) => [s.id, s]));
const inc = (m, k, n = 1) => m.set(k, (m.get(k) || 0) + n);
const top = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n);

/* ---- one content word per Quran word: its lemma and root (nouns, adjectives, proper nouns, verbs; not pronouns or particles) ---- */
const SKIP = ['PRON', 'REL', 'DEM', 'INTG', 'COND', 'T', 'LOC'];
const words = new Map();             // "s:v:w" -> { s, v, lem, root }
const shown = new Map();             // stripped lemma -> voweled lemma (first seen), for display
for (const line of readFileSync(file, 'utf8').split('\n')) {
  const p = line.trim().split('\t'); if (p.length < 4) continue;
  const [s, v, w] = p[0].split(':').map(Number), key = `${s}:${v}:${w}`;
  if (words.has(key) || (p[2] !== 'N' && p[2] !== 'V')) continue;
  const f = p[3].split('|'); if (f.includes('PREF') || f.includes('SUFF') || SKIP.some((x) => f.includes(x))) continue;
  const lemV = (f.find((x) => x.startsWith('LEM:')) || '').slice(4).replace(/ٱ/g, 'ا'), lem = strip(lemV);
  if (!lem) continue;
  if (!shown.has(lem)) shown.set(lem, lemV);
  words.set(key, { s, v, lem, lemV, fem: f.some((x) => /^[123]?F[SDP]?$/.test(x)), root: (f.find((x) => x.startsWith('ROOT:')) || '').slice(5) });
}
const W = [...words.values()], show = (l) => shown.get(l) || l;
console.log('content words', W.length, 'lemmas', shown.size);

/* ---- per verse sets of lemmas; per surah and per place counts ---- */
const verseSets = new Map(), lemCount = new Map(), lemSurah = new Map(), place = { makkah: new Map(), madinah: new Map() }, placeTotal = { makkah: 0, madinah: 0 };
for (const x of W) {
  const vk = `${x.s}:${x.v}`; (verseSets.get(vk) || verseSets.set(vk, new Set()).get(vk)).add(x.lem);
  inc(lemCount, x.lem);
  const ms = lemSurah.get(x.lem) || lemSurah.set(x.lem, new Map()).get(x.lem); inc(ms, x.s);
  const pl = SUR[x.s].place; inc(place[pl], x.lem); placeTotal[pl]++;
}
const NV = verseSets.size, df = new Map(), co = new Map();
const STOP = new Set(['كان', 'قال', 'اي']);   // too common or grammatical (the «يا أيها» vocative): they would fill every pair list
for (const set of verseSets.values()) {
  const a = [...set].filter((l) => !STOP.has(l)).sort();
  for (const l of a) inc(df, l);
  for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) inc(co, a[i] + '|' + a[j]);
}
const pmi = (c, a, b) => Math.log2((c * NV) / (df.get(a) * df.get(b)));

/* 1. strongest word pairs in the same verse: co-count x PMI (frequent AND more together than chance) */
const pairs = [...co].filter(([, c]) => c >= 10).map(([k, c]) => { const [a, b] = k.split('|'); return { a, b, c, p: pmi(c, a, b) }; }).filter((x) => x.p > 1);
const strongPairs = pairs.sort((x, y) => y.c * y.p - x.c * x.p).slice(0, 40).map((x) => [show(x.a), show(x.b), x.c, +x.p.toFixed(1)]);

/* 2. companions of key words: the lemmas that come with them in the same verse more than chance */
const KEYS = ['الله', 'رب', 'جنة', 'نار', 'رحمة', 'صبر', 'علم', 'قلب', 'ارض', 'سماء', 'رسول', 'كتاب', 'شيطان', 'نور', 'حق', 'ماء', 'دنيا', 'اخرة', 'مال', 'ولد'];
const companions = KEYS.filter((k) => df.has(k)).map((k) => {
  const list = [];
  for (const [l, n] of df) { if (l === k) continue; const c = co.get(k < l ? k + '|' + l : l + '|' + k) || 0; if (c >= 4 && n >= 4) list.push([show(l), c, pmi(c, k, l)]); }
  return [show(k), df.get(k), list.sort((a, b) => b[1] * b[2] - a[1] * a[2]).slice(0, 8).map(([l, c]) => [l, c])];
});

/* 3. words that never appear without another word (every verse that has A also has B) */
const always = [...co].map(([k, c]) => { const [a, b] = k.split('|'); return [a, b, c]; })
  .flatMap(([a, b, c]) => [[a, b, c], [b, a, c]]).filter(([a, b, c]) => c >= 5 && c === df.get(a) && df.get(b) > c)
  .sort((x, y) => y[2] - x[2]).slice(0, 30).map(([a, b, c]) => [show(a), show(b), c]);

/* ---- phrases from the plain text ---- */
const verses = Object.entries(TEXT).map(([k, t]) => [k, t.split(/\s+/).filter(Boolean)]);
const surOf = (k) => SUR[+k.split(':')[0]].ar;
/* 4. whole verses repeated word for word */
const vt = new Map(); for (const [k, t] of verses) { const s = t.join(' '); (vt.get(s) || vt.set(s, []).get(s)).push(k); }
const repeatedVerses = [...vt].filter(([s, ks]) => ks.length >= 3 && s.split(' ').length >= 2).sort((a, b) => b[1].length - a[1].length).slice(0, 20)
  .map(([s, ks]) => [s, ks.length, [...new Set(ks.map(surOf))].join('، ')]);
/* 5. most repeated phrases (3+ words), keeping only the longest form of each */
const gram = new Map();
for (const [k, t] of verses) for (let n = 3; n <= 30; n++) for (let i = 0; i + n <= t.length; i++) { const g = t.slice(i, i + n).join(' '); const e = gram.get(g) || gram.set(g, { c: 0, n, at: new Set() }).get(g); e.c++; e.at.add(k); }
const rep = [...gram].filter(([, e]) => e.c >= 4);
const maximal = rep.filter(([g, e]) => !rep.some(([h, f]) => f.n > e.n && f.c >= 0.85 * e.c && h.includes(g)));   // a shorter phrase that is nearly always part of a longer one is dropped
const phrases = maximal.sort((a, b) => b[1].c * Math.sqrt(b[1].n) - a[1].c * Math.sqrt(a[1].n)).slice(0, 40).map(([g, e]) => [g, e.c, new Set([...e.at].map((k) => k.split(':')[0])).size]);
/* 6. longest phrases repeated in two or more places (not whole repeated verses) */
const long = [...gram].filter(([g, e]) => e.c >= 2 && e.n >= 8 && !vt.has(g));
const longest = long.filter(([g, e]) => !long.some(([h, f]) => f.n > e.n && f.c === e.c && h.includes(g)))
  .sort((a, b) => b[1].n - a[1].n || b[1].c - a[1].c).filter(((seen) => ([, e]) => { const k = [...e.at].sort().join(); return !seen.has(k) && seen.add(k); })(new Set()))   // one phrase per set of places (overlapping windows of the same passage)
  .slice(0, 15).map(([g, e]) => [g, e.c, [...e.at].join('، ')]);

/* 7. how verses end and begin */
const ends = new Map(), ends2 = new Map(), starts = new Map();
for (const [, t] of verses) { inc(ends, t[t.length - 1]); if (t.length >= 2) inc(ends2, t.slice(-2).join(' ')); inc(starts, t[0]); }
const verseEnds = top(ends, 20), verseEnds2 = top(ends2, 20), verseStarts = top(starts, 20);

/* 8. root families: one root, many different words */
const rootLem = new Map(), rootCount = new Map();
for (const x of W) if (x.root) { (rootLem.get(x.root) || rootLem.set(x.root, new Set()).get(x.root)).add(x.lem); inc(rootCount, x.root); }
const roots = [...rootLem].sort((a, b) => b[1].size - a[1].size || rootCount.get(b[0]) - rootCount.get(a[0])).slice(0, 20)
  .map(([r, ls]) => [r, ls.size, rootCount.get(r), [...ls].sort((a, b) => lemCount.get(b) - lemCount.get(a)).slice(0, 10).map(show)]);

/* 9. Makki vs Madani: words far more frequent (per word of text) in one than the other */
const V = shown.size, odds = [];
for (const [l, n] of lemCount) {
  if (n < 15) continue;
  const a = place.makkah.get(l) || 0, b = place.madinah.get(l) || 0;
  odds.push([show(l), a, b, Math.log((a + 1) / (placeTotal.makkah + V)) - Math.log((b + 1) / (placeTotal.madinah + V))]);
}
odds.sort((x, y) => y[3] - x[3]);
const per10k = (n, t) => +((10000 * n) / t).toFixed(1);
const makki = odds.slice(0, 20).map(([l, a, b]) => [l, a, b, per10k(a, placeTotal.makkah), per10k(b, placeTotal.madinah)]);
const madani = odds.slice(-20).reverse().map(([l, a, b]) => [l, a, b, per10k(a, placeTotal.makkah), per10k(b, placeTotal.madinah)]);

/* 10. words gathered in one surah */
const concentrated = [...lemSurah].map(([l, m]) => { const [s, c] = top(m, 1)[0]; return [l, lemCount.get(l), s, c]; })
  .filter(([, n, , c]) => n >= 8 && c / n >= 0.6).sort((a, b) => b[3] - a[3]).slice(0, 25).map(([l, n, s, c]) => [show(l), n, SUR[s].ar, c]);

/* 11. surahs that share the most vocabulary (cosine of tf-idf lemma vectors) */
const vec = new Map(); for (const x of W) { const m = vec.get(x.s) || vec.set(x.s, new Map()).get(x.s); inc(m, x.lem); }
const sdf = new Map(); for (const m of vec.values()) for (const l of m.keys()) inc(sdf, l);
const tfidf = new Map([...vec].map(([s, m]) => { const v = new Map([...m].map(([l, c]) => [l, c * Math.log(114 / sdf.get(l))])); let nn = 0; for (const x of v.values()) nn += x * x; return [s, { v, nn: Math.sqrt(nn) }]; }));
const sim = [];
for (let a = 1; a <= 114; a++) for (let b = a + 1; b <= 114; b++) {
  const A = tfidf.get(a), B = tfidf.get(b); if (!A.nn || !B.nn) continue;
  let d = 0; for (const [l, x] of A.v) { const y = B.v.get(l); if (y) d += x * y; }
  sim.push([a, b, d / (A.nn * B.nn)]);
}
const similar = sim.sort((x, y) => y[2] - x[2]).slice(0, 25).map(([a, b, c]) => [SUR[a].ar, SUR[b].ar, Math.round(c * 100)]);

/* 12. words found in only one surah: which surahs have the most */
const own = new Map(); for (const [l, m] of lemSurah) if (m.size === 1) inc(own, [...m.keys()][0]);
const exclusive = [...own].map(([s, n]) => [SUR[s].ar, n, vec.get(s).size, Math.round((100 * n) / vec.get(s).size)]).sort((a, b) => b[1] - a[1]).slice(0, 15);

/* 13. opposite pairs: how often each side is mentioned, and how often both come in the same verse
   each side is a list of corpus lemmas (voweled, as the corpus writes them); "آخِرَة" is the feminine of the lemma آخِر */
const OPP = [
  ['الحياة', ['حَياة', 'حَيّ', 'أَحْيا', 'مَحْيا'], 'الموت', ['مَوْت', 'مَيِّت', 'مَيْت', 'ماتَ', 'أَماتَ', 'مَمات']],
  ['الليل', ['لَيْل', 'لَيْلَة'], 'النهار', ['نَهار']],
  ['السماء', ['سَماء'], 'الأرض', ['أَرْض']],
  ['الأب', ['أَب'], 'الأم', ['أُمّ']],
  ['الابن', ['ابْن'], 'البنت', ['بِنْت']],
  ['الأخ', ['أَخ'], 'الأخت', ['أُخْت']],
  ['الرجل', ['رَجُل', 'رِجال'], 'المرأة', ['امْرَأَت', 'نِساء']],
  ['الذكر', ['ذَكَر'], 'الأنثى', ['أُنثَى']],
  ['الصغير', ['صَغِير', 'صَغِيرَة'], 'الكبير', ['كَبِير', 'كَبِيرَة']],
  ['الطفل والغلام', ['طِفْل', 'غُلام', 'صَبِيّ'], 'الشيخ', ['شَيْخ']],
  ['الدنيا', ['دُنْيا'], 'الآخرة', ['آخِرَة']],
  ['الجنة', ['جَنَّة'], 'النار', ['نار']],
  ['النور', ['نُور'], 'الظلمات', ['ظُلُمَة']],
  ['الخير', ['خَيْر'], 'الشر', ['شَرّ', 'شَرَ']],
  ['الحق', ['حَقّ'], 'الباطل', ['باطِل']],
  ['الهدى', ['هُدًى'], 'الضلال', ['ضَلال', 'ضَلالَة']],
  ['الإيمان', ['إِيمان'], 'الكفر', ['كُفْر']],
  ['المؤمن', ['مُؤْمِن'], 'الكافر', ['كافِر']],
  ['الحسنة', ['حَسَنَة'], 'السيئة', ['سَيِّئَة']],
  ['الرحمة', ['رَحْمَة'], 'العذاب', ['عَذاب']],
  ['الثواب', ['ثَواب'], 'العقاب', ['عِقاب']],
  ['البشير', ['بَشِير'], 'النذير', ['نَذِير']],
  ['الشمس', ['شَمْس'], 'القمر', ['قَمَر']],
  ['البر', ['بَرّ'], 'البحر', ['بَحْر']],
  ['المشرق', ['مَشْرِق'], 'المغرب', ['مَغْرِب']],
  ['الغيب', ['غَيْب'], 'الشهادة', ['شَهادَة']],
  ['الغني', ['غَنِيّ'], 'الفقير', ['فَقِير']],
  ['اليسر', ['يُسْر'], 'العسر', ['عُسْر']],
  ['الأمن', ['أَمْن', 'أَمَنَة'], 'الخوف', ['خَوْف']],
  ['البصير', ['بَصِير'], 'الأعمى', ['أَعْمَى']],
  ['النفع', ['نَفْع'], 'الضر', ['ضَرّ']],
  ['الفرح', ['فَرِح', 'فَرِحَ'], 'الحزن', ['حَزَن', 'حُزْن', 'يَحْزُن']],
  ['الصدق', ['صِدْق'], 'الكذب', ['كَذِب']],
  ['الحلال', ['حَلال'], 'الحرام', ['حَرام']],
  ['القليل', ['قَلِيل'], 'الكثير', ['كَثِير']],
  ['القريب', ['قَرِيب'], 'البعيد', ['بَعِيد']],
  ['الظاهر', ['ظاهِر'], 'الباطن', ['باطِن']],
  ['الإنس', ['إِنس'], 'الجن', ['جِنّ']],
  ['فوق', ['فَوْق'], 'تحت', ['تَحْت']],
];
const nf = (l) => l.normalize('NFD');   // the marks (shadda, kasra…) can be stored in either order
for (const o of OPP) { o[1] = o[1].map(nf); o[3] = o[3].map(nf); }
const lemmaOf = (x) => (x.lemV === 'آخِر' && x.fem ? nf('آخِرَة') : nf(x.lemV));
const sideCount = new Map(), sideVerses = new Map();
for (const x of W) { const l = lemmaOf(x); inc(sideCount, l); (sideVerses.get(l) || sideVerses.set(l, new Set()).get(l)).add(`${x.s}:${x.v}`); }
const verseUnion = (ls) => new Set(ls.flatMap((l) => [...(sideVerses.get(l) || [])]));
const opposites = OPP.map(([an, al, bn, bl]) => {
  const a = al.reduce((t, l) => t + (sideCount.get(l) || 0), 0), b = bl.reduce((t, l) => t + (sideCount.get(l) || 0), 0);
  const va = verseUnion(al), vb = verseUnion(bl), both = [...va].filter((k) => vb.has(k)).length;
  const missing = [...al, ...bl].filter((l) => !sideCount.has(l)); if (missing.length) console.log('no such lemma:', missing.join(' '));
  return [an, a, bn, b, both, Math.min(va.size, vb.size), +((both * NV) / (va.size * vb.size || 1)).toFixed(1)];   // last: times more than chance
});

const out = { opposites, totals: { words: W.length, lemmas: V, verses: NV, makkah: placeTotal.makkah, madinah: placeTotal.madinah }, strongPairs, companions, always, repeatedVerses, phrases, longest, verseEnds, verseEnds2, verseStarts, roots, makki, madani, concentrated, similar, exclusive };
writeFileSync('public/deep.json', JSON.stringify(out));
console.log(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, Array.isArray(v) ? v.length : v])));
