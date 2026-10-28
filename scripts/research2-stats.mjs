// Second batch of research-framework criteria (#research / #stats): surah clusters (47), neighbouring surahs (75),
// structurally similar surahs (82), openings and endings (71), words at the same positions (72), shared phrases between
// surahs (81) and between far passages (98), Uthmani against plain spelling (88), consonant repetition (67), internal
// rhyme (68), topics (95) and Makki/Madani classification of verses (97) -> public/research2.json
// usage: node scripts/research2-stats.mjs <quran-morphology.txt>   (needs quran.sql from scripts/load-quran.mjs for 88)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import assert from 'node:assert';
const S = JSON.parse(readFileSync('public/stats.json', 'utf8')), TEXT = JSON.parse(readFileSync('public/quran_text.json', 'utf8'));
const SU = S.surahs, NAME = Object.fromEntries(SU.map((s) => [s.id, s.ar]));
const inc = (m, k, n = 1) => m.set(k, (m.get(k) || 0) + n);
const r2 = (x) => Math.round(x * 100) / 100;
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const strip = (s) => s.replace(/[ً-ٰٟـۖ-ۭ]/g, '').replace(/[ٱأإآ]/g, 'ا').replace(/ى/g, 'ي');
const AR = /[ء-ي]/;
const letters = (w) => [...strip(w)].filter((c) => AR.test(c));

/* ---- content words per verse (lemmas), as scripts/deep-stats.mjs ---- */
const SKIP = ['PRON', 'REL', 'DEM', 'INTG', 'COND', 'T', 'LOC'];
const vLem = new Map(), seen = new Set(), feat = new Map();   // verse -> [lemmas]; verse -> morphological feature counts (97)
for (const line of readFileSync(process.argv[2] || 'scratch_morph.txt', 'utf8').split('\n')) {
  const p = line.trim().split('\t'); if (p.length < 4) continue;
  const [s, v, w] = p[0].split(':'), vk = `${s}:${v}`, f = p[3].split('|');
  const fm = feat.get(vk) || feat.set(vk, new Map()).get(vk);
  inc(fm, p[2]); for (const t of ['PERF', 'IMPF', 'IMPV', 'PASS', 'PN', 'COND', 'NEG', 'INTG', 'VOC', 'EMPH', 'RES', 'ACC', 'GEN', 'NOM', 'DET', 'INDEF', 'P', 'CONJ', 'REM', '1P', '1S', '2MP', '3MP']) if (f.includes(t)) inc(fm, t);
  const key = `${vk}:${w}`; if (seen.has(key) || (p[2] !== 'N' && p[2] !== 'V')) continue;
  if (f.includes('PREF') || f.includes('SUFF') || SKIP.some((x) => f.includes(x))) continue;
  const lem = strip((f.find((x) => x.startsWith('LEM:')) || '').slice(4)); if (!lem) continue;
  seen.add(key); (vLem.get(vk) || vLem.set(vk, []).get(vk)).push(lem);
}
const VK = Object.keys(TEXT), bySurah = new Map();
for (const k of VK) { const s = +k.split(':')[0]; (bySurah.get(s) || bySurah.set(s, []).get(s)).push(k); }

/* ---- 47, 75: lexical similarity of surahs (tf-idf on lemmas, cosine) ---- */
const sCount = new Map(), sdf = new Map();
for (const [s, ks] of bySurah) { const m = new Map(); for (const k of ks) for (const l of vLem.get(k) || []) inc(m, l); sCount.set(s, m); for (const l of m.keys()) inc(sdf, l); }
const vec = new Map();
for (const [s, m] of sCount) { const v = new Map(); let nn = 0; for (const [l, c] of m) { const x = (1 + Math.log(c)) * Math.log(114 / sdf.get(l)); if (x > 0) { v.set(l, x); nn += x * x; } } vec.set(s, { v, nn: Math.sqrt(nn) }); }
const cos = (a, b) => { const A = vec.get(a), B = vec.get(b); let d = 0; for (const [l, x] of A.v) { const y = B.v.get(l); if (y) d += x * y; } return d / (A.nn * B.nn || 1); };
const SIM = Array.from({ length: 115 }, () => new Float64Array(115));
for (let a = 1; a <= 114; a++) for (let b = a + 1; b <= 114; b++) SIM[a][b] = SIM[b][a] = cos(a, b);
const allPairs = []; for (let a = 1; a <= 114; a++) for (let b = a + 1; b <= 114; b++) allPairs.push(SIM[a][b]);
const adj = []; for (let a = 1; a < 114; a++) adj.push([NAME[a], NAME[a + 1], r2(100 * SIM[a][a + 1])]);
const neighbours = { adjMean: r2(100 * mean(adj.map((x) => x[2] / 100))), allMean: r2(100 * mean(allPairs)),
  higher: adj.filter((x, i) => SIM[i + 1][i + 2] > mean(allPairs)).length, top: [...adj].sort((a, b) => b[2] - a[2]).slice(0, 10), low: [...adj].sort((a, b) => a[2] - b[2]).slice(0, 5) };
// spherical k-means, 8 groups: 40 random starts (fixed seed), the tightest result kept; surahs under 200 words are too short to place reliably
let ks = 11; const krnd = () => { ks = (ks * 16807) % 2147483647; return ks / 2147483647; };
const big = SU.filter((s) => s.words >= 200).map((s) => s.id), KC = 8;
const unit = (s) => { const { v, nn } = vec.get(s); return new Map([...v].map(([l, x]) => [l, x / nn])); };
const dot = (u, c) => { let d = 0; for (const [l, x] of u) { const y = c.get(l); if (y) d += x * y; } return d; };
const U = new Map(big.map((s) => [s, unit(s)]));
let bestRun = null;
for (let run = 0; run < 40; run++) {
  const pick = [...big].sort(() => krnd() - 0.5).slice(0, KC); let cent = pick.map((s) => U.get(s)), asg = new Map(), score = 0;
  for (let it = 0; it < 25; it++) {
    score = 0; asg = new Map(big.map((s) => { const d = cent.map((c) => dot(U.get(s), c)), m = Math.max(...d); score += m; return [s, d.indexOf(m)]; }));
    cent = cent.map((c, k) => { const m = new Map(); let n = 0; for (const [s, g] of asg) if (g === k) { n++; for (const [l, x] of U.get(s)) inc(m, l, x); } let nn = 0; for (const x of m.values()) nn += x * x; nn = Math.sqrt(nn) || 1; return n ? new Map([...m].map(([l, x]) => [l, x / nn])) : c; });
  }
  const sizes = Array.from({ length: KC }, (_, k) => [...asg.values()].filter((g) => g === k).length);
  if (Math.min(...sizes) >= 3 && (!bestRun || score > bestRun.score)) bestRun = { score, asg };   // no group of one or two surahs
}
const cl = Array.from({ length: KC }, (_, k) => big.filter((s) => bestRun.asg.get(s) === k)).filter((g) => g.length);
const words = (g) => { const m = new Map(); for (const s of g) for (const [l, x] of vec.get(s).v) inc(m, l, x); return [...m].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([l]) => l); };
const clusters = cl.sort((a, b) => b.length - a.length).map((g) => ({ surahs: g.sort((a, b) => a - b).map((s) => NAME[s]), words: words(g), makki: g.filter((s) => SU[s - 1].place === 'makkah').length }));

/* ---- 82: surahs alike in structure (length, verse length, endings, opening letters), and how alike their words are ---- */
const endOf = (k) => letters(TEXT[k]).at(-1);
const MUQ = /^(الم|المص|الر|المر|كهيعص|طه|طسم|طس|يس|ص|حم|ق|ن)$/;
const shape = (s) => { const ks = bySurah.get(s), e = new Map(); ks.forEach((k) => inc(e, endOf(k))); const top = Math.max(...e.values()) / ks.length;
  return [Math.log(ks.length), Math.log(SU[s - 1].words / ks.length), top, MUQ.test(strip(TEXT[`${s}:1`]).trim()) ? 1 : 0]; };
const SH = new Map(SU.map((s) => [s.id, shape(s.id)])), sdv = [0, 1, 2, 3].map((i) => { const xs = [...SH.values()].map((v) => v[i]), m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))) || 1; });
const shp = []; for (let a = 1; a <= 114; a++) for (let b = a + 1; b <= 114; b++) shp.push([a, b, Math.sqrt(SH.get(a).reduce((t, x, i) => t + ((x - SH.get(b)[i]) / sdv[i]) ** 2, 0))]);
const twins = shp.sort((x, y) => x[2] - y[2]).slice(0, 12).map(([a, b]) => [NAME[a], NAME[b], r2(100 * SIM[a][b])]);
const structure = { twins, twinMean: r2(mean(twins.map((x) => x[2]))), allMean: neighbours.allMean };

/* ---- 71: opening (first 3 verses) against ending (last 3) of each surah, by shared lemmas ---- */
const setOf = (ks) => new Set(ks.flatMap((k) => vLem.get(k) || []));
const jac = (A, B) => { let i = 0; for (const x of A) if (B.has(x)) i++; return A.size + B.size - i ? i / (A.size + B.size - i) : 0; };
const oe = [], base = [];
const long = SU.filter((s) => s.verses >= 12).map((s) => s.id);
for (const s of long) { const ks = bySurah.get(s); oe.push([NAME[s], r2(100 * jac(setOf(ks.slice(0, 3)), setOf(ks.slice(-3))))]); }
for (let i = 0; i < long.length; i++) { const a = bySurah.get(long[i]), b = bySurah.get(long[(i + 7) % long.length]); base.push(100 * jac(setOf(a.slice(0, 3)), setOf(b.slice(-3)))); }   // the same measure between unrelated surahs
const openEnd = { n: long.length, mean: r2(mean(oe.map((x) => x[1]))), base: r2(mean(base)), top: [...oe].sort((a, b) => b[1] - a[1]).slice(0, 10) };

/* ---- 72: words that come in the first verse, and in the last verse, of many surahs ---- */
const atPos = (pick) => { const m = new Map(); for (const [s, ks] of bySurah) for (const l of new Set(vLem.get(pick(ks)) || [])) (m.get(l) || m.set(l, []).get(l)).push(NAME[s]); return [...m].sort((a, b) => b[1].length - a[1].length).map(([l, su]) => [l, su.length, su]); };   // every word, with the surahs
const both = new Map(); for (const [s, ks] of bySurah) { const f = new Set(vLem.get(ks[0]) || []); if (ks.length > 1) for (const l of new Set(vLem.get(ks.at(-1)) || [])) if (f.has(l)) (both.get(l) || both.set(l, []).get(l)).push(NAME[s]); }   // words in both the first and the last verse of the same surah, with those surahs
const positions = { first: atPos((ks) => ks[0]), last: atPos((ks) => ks.at(-1)), both: [...both].sort((a, b) => b[1].length - a[1].length).map(([l, su]) => [l, su.length, su]) };

/* ---- 81, 98: phrases of 5+ words repeated in two surahs; the farthest-apart verses that share one ---- */
const N5 = 5, gram = new Map();
for (const k of VK) { const w = strip(TEXT[k]).split(/\s+/).filter(Boolean); for (let i = 0; i + N5 <= w.length; i++) { const g = w.slice(i, i + N5).join(' '); (gram.get(g) || gram.set(g, new Set()).get(g)).add(k); } }
const pairPh = new Map(), far = [];
for (const [g, ks] of gram) { const a = [...ks]; if (a.length < 2 || a.length > 6) continue;   // very common phrases (refrains) say little about two passages
  for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) { const s1 = +a[i].split(':')[0], s2 = +a[j].split(':')[0]; if (s1 === s2) continue;
    const key = s1 < s2 ? `${s1}-${s2}` : `${s2}-${s1}`; inc(pairPh, key); far.push([a[i], a[j], Math.abs(VK.indexOf(a[i]) - VK.indexOf(a[j])), g]); } }
const shared = [...pairPh].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, n]) => { const [a, b] = k.split('-').map(Number); return [NAME[a], NAME[b], n, r2(100 * SIM[a][b])]; });
const farSeen = new Set(), farTop = far.sort((a, b) => b[2] - a[2]).filter(([x, y]) => !farSeen.has(x + y) && farSeen.add(x + y))   // one phrase per pair of verses.slice(0, 10).map(([a, b, d, g]) => [a, b, d, g]);

/* ---- 88: Uthmani spelling against the plain spelling, word by word where both verses have the same number of words ---- */
let rasm = null;
if (existsSync('quran.sql')) {
  const U = new Map(readFileSync('quran.sql', 'utf8').split('\n').filter((l) => l.startsWith('INSERT INTO ayat')).map((l) => { const m = /^INSERT INTO ayat VALUES\((\d+),(\d+),'((?:[^']|'')*)'/.exec(l); return [`${m[1]}:${m[2]}`, m[3].replace(/''/g, "'")]; }));
  const diff = new Map(); let comp = 0, same = 0, aligned = 0;
  for (const k of VK) { const a = strip(TEXT[k]).split(/\s+/).filter(Boolean), b = (U.get(k) || '').split(/\s+/).filter((w) => /[ء-يٱ]/.test(w)); if (a.length !== b.length) continue; aligned++;
    a.forEach((w, i) => { comp++; const raw = strip(b[i]).replace(/[^ء-ي]/g, ''); if (raw === w) same++; else inc(diff, `${w} ← ${raw}`); }); }
  rasm = { verses: aligned, words: comp, same, differ: comp - same, top: [...diff].sort((a, b) => b[1] - a[1]).slice(0, 15) };
}

/* ---- 67, 68: one consonant repeated through a verse; words in a verse rhyming with its ending ---- */
const LF = new Map(); let LT = 0; for (const k of VK) for (const c of letters(TEXT[k])) { inc(LF, c); LT++; }
const COMMON = new Set('اليونمهوةءؤئ'.split(''));   // the commonest letters and the hamza seats say little about sound
const allit = [], rhyme = [];
for (const k of VK) { const ws = strip(TEXT[k]).split(/\s+/).filter(Boolean); if (ws.length < 6) continue;
  const m = new Map(); let t = 0; for (const c of letters(TEXT[k])) { inc(m, c); t++; }
  let best = null; for (const [c, n] of m) if (!COMMON.has(c) && n >= 5) { const x = n / t / (LF.get(c) / LT); if (!best || x > best[1]) best = [c, x, n]; }
  if (best) allit.push([k, best[0], best[2], r2(best[1])]);
  const end = ws.at(-1).slice(-2), inner = ws.slice(0, -1).filter((w) => w.length > 2 && w.endsWith(end)).length;
  rhyme.push([k, end, inner, ws.length, r2(inner / (ws.length - 1))]); }
const alliteration = allit.sort((a, b) => b[3] - a[3]).slice(0, 10);
const internalRhyme = { mean: r2(100 * mean(rhyme.map((x) => x[4]))), top: rhyme.sort((a, b) => b[4] - a[4] || b[2] - a[2]).slice(0, 10) };

/* ---- 95: topics (LDA, Gibbs sampling, fixed seed) over verses ---- */
let seed = 7; const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const vdf = new Map(); for (const k of VK) for (const l of new Set(vLem.get(k) || [])) inc(vdf, l);
const keep = (l) => vdf.get(l) >= 5 && vdf.get(l) <= VK.length * 0.04;   // drop the rarest and the most common words
const docs = VK.map((k) => (vLem.get(k) || []).filter(keep)).filter((d) => d.length >= 3);
const vocab = [...new Set(docs.flat())], vid = new Map(vocab.map((l, i) => [l, i])), K = 12, A = 0.1, B = 0.01, V = vocab.length;
const nkw = Array.from({ length: K }, () => new Int32Array(V)), nk = new Int32Array(K), ndk = docs.map(() => new Int32Array(K));
const zs = docs.map((d, di) => d.map((l) => { const z = Math.floor(rnd() * K); nkw[z][vid.get(l)]++; nk[z]++; ndk[di][z]++; return z; }));
const p = new Float64Array(K);
for (let it = 0; it < 300; it++) docs.forEach((d, di) => d.forEach((l, i) => { const w = vid.get(l); let z = zs[di][i]; nkw[z][w]--; nk[z]--; ndk[di][z]--;
  let t = 0; for (let k = 0; k < K; k++) { t += (ndk[di][k] + A) * (nkw[k][w] + B) / (nk[k] + V * B); p[k] = t; }
  const u = rnd() * t; z = 0; while (p[z] < u) z++; zs[di][i] = z; nkw[z][w]++; nk[z]++; ndk[di][z]++; }));
const docKeys = VK.filter((k) => (vLem.get(k) || []).filter(keep).length >= 3);
const topics = Array.from({ length: K }, (_, k) => { const top = [...nkw[k].keys()].sort((a, b) => nkw[k][b] - nkw[k][a]).slice(0, 8).map((i) => vocab[i]);
  const sm = new Map(); docs.forEach((d, di) => { if (ndk[di][k] / d.length >= 0.5) inc(sm, +docKeys[di].split(':')[0]); });
  return { words: top, size: nk[k], surahs: [...sm].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([s, n]) => [NAME[s], n]) }; }).sort((a, b) => b.size - a.size);

/* ---- 97: telling Makki from Madani verses by morphological features only (naive Bayes, 5-fold check) ---- */
const FK = [...new Set([...feat.values()].flatMap((m) => [...m.keys()]))];
const rows = VK.map((k) => { const m = feat.get(k) || new Map(), n = [...m.values()].reduce((a, b) => a + b, 0) || 1; return { y: SU[+k.split(':')[0] - 1].place === 'madinah' ? 1 : 0, x: FK.map((f) => (m.get(f) || 0) / n).concat([Math.log(n)]) }; });
const D = FK.length + 1, fold = (i) => i % 5;
const z = (tr) => { const mu = Array.from({ length: D }, (_, j) => mean(tr.map((r) => r.x[j]))), sd = mu.map((m, j) => Math.sqrt(mean(tr.map((r) => (r.x[j] - m) ** 2))) || 1); return (x) => x.map((v, j) => (v - mu[j]) / sd[j]); };
const fit = (tr) => {   // logistic regression; each class weighted by its share so the larger (Makki) class does not dominate
  const sc = z(tr), X = tr.map((r) => sc(r.x)), w = new Float64Array(D + 1), n1 = tr.filter((r) => r.y).length, cw = [tr.length / (2 * (tr.length - n1)), tr.length / (2 * n1)];
  for (let ep = 0; ep < 150; ep++) { const g = new Float64Array(D + 1); X.forEach((x, i) => { const t = w[D] + x.reduce((a, v, j) => a + v * w[j], 0), e = (1 / (1 + Math.exp(-t)) - tr[i].y) * cw[tr[i].y]; x.forEach((v, j) => (g[j] += e * v)); g[D] += e; }); for (let j = 0; j <= D; j++) w[j] -= (0.5 * g[j]) / X.length + 0.001 * (j < D ? w[j] : 0); }
  return { w, sc };
};
const pred = (M, x) => { const v = M.sc(x); return M.w[D] + v.reduce((a, u, j) => a + u * M.w[j], 0) > 0 ? 1 : 0; };
let ok = 0; const cm = [[0, 0], [0, 0]];
for (let f = 0; f < 5; f++) { const M = fit(rows.filter((r, i) => fold(i) !== f)); rows.forEach((r, i) => { if (fold(i) === f) { const y = pred(M, r.x); cm[r.y][y]++; if (y === r.y) ok++; } }); }
const Mall = fit(rows), FN = FK.concat(['LEN']);
const sep = FN.map((f, j) => [f, r2(Math.abs(Mall.w[j])), Mall.w[j] > 0 ? 'madinah' : 'makkah']).sort((a, b) => b[1] - a[1]).slice(0, 8);
const madShare = rows.filter((r) => r.y).length / rows.length;
const classify = { accuracy: r2((100 * ok) / rows.length), balanced: r2(50 * (cm[0][0] / (cm[0][0] + cm[0][1]) + cm[1][1] / (cm[1][0] + cm[1][1]))), baseline: r2(100 * Math.max(madShare, 1 - madShare)), cm, features: sep };
assert.ok(classify.accuracy > 50 && clusters.length >= 6 && topics.length === K);

writeFileSync('public/research2.json', JSON.stringify({ clusters, neighbours, structure, openEnd, positions, shared, far: farTop, rasm, alliteration, internalRhyme, topics, classify }));
console.log({ clusters: clusters.map((c) => c.surahs.length), neighbours: [neighbours.adjMean, neighbours.allMean, neighbours.higher], twin: structure.twinMean, openEnd: [openEnd.mean, openEnd.base], rasm: rasm && [rasm.words, rasm.differ], rhyme: internalRhyme.mean, classify: [classify.accuracy, classify.balanced, classify.baseline], top: classify.features.slice(0, 4) });
