// 100-reciter enrolment from the mp3quran.net catalogue (full-surah Hafs recordings, partial download).
// usage: node scripts/enroll3.mjs   -> writes seed.sql and prints held-out accuracy
import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { voiceprints, DIM } from '../public/voiceprint.js';
import { classify } from '../src/match.mjs';

// mp3quran reciter ids, roughly ordered by fame (curated from recurring "top reciter" lists + recognisability).
const RANKED = [123,51,54,31,112,118,125,102,30,92,76,89,4,5,121,70,60,21,56,43,107,205,74,135,66,67,69,46,202,217,254,178,59,100,
  255,257,259,267,271,273,285,302,301,304,77,86,81,152,163,160,161,164,181,197,198,203,17,32,1,2,3,20,219,221,226,236,243,244,
  245,248,251,252,256,24,33,36,39,64,47,253,277,278,109,111,106,201,165,40,42,290,300,62,44,286,260,265,159,108,55,10];
if (new Set(RANKED).size !== RANKED.length || RANKED.length !== 100) throw new Error('list must be 100 unique ids, got ' + RANKED.length);

const en = Object.fromEntries(JSON.parse(readFileSync('mp3q.json', 'utf8')).reciters.map((r) => [r.id, r]));
const ar = Object.fromEntries(JSON.parse(readFileSync('mp3q_ar.json', 'utf8')).reciters.map((r) => [r.id, r.name]));
const RECITERS = RANKED.map((id, i) => {
  const r = en[id];
  const moshafs = r.moshaf.filter((m) => /Hafs/i.test(m.name) && m.surah_total >= 100).slice(0, 2);
  return { id: 'r' + id, rank: i + 1, name: r.name.replace(/\s+/g, ' ').trim(), name_ar: ar[id], moshafs };
});
const TRAIN = [67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78];
const TEST = [79, 80, 81, 82];
const BYTES = 700_000;

async function fetchPart(url, f) {
  if (existsSync(f)) return true;
  for (let t = 0; t < 3; t++) {
    try {
      const r = await fetch(url, { headers: { Range: `bytes=0-${BYTES}` } });
      if (!r.ok) return false;
      writeFileSync(f, Buffer.from(await r.arrayBuffer()));
      return true;
    } catch { /* retry */ }
  }
  return false;
}
async function pcm(rec, m, mi, surah) {
  if (!m.surah_list.split(',').includes(String(surah))) return null;
  const dir = `samples3/${rec.id}`; mkdirSync(dir, { recursive: true });
  const f = `${dir}/${mi}_${surah}.mp3`;
  if (!(await fetchPart(m.server + String(surah).padStart(3, '0') + '.mp3', f))) return null;
  try {
    const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', f, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
    return new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
  } catch { return null; }
}
let seed = 7;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
function augment(p, snr, lp) {
  const o = new Float32Array(p.length);
  let e = 0; for (const x of p) e += x * x; e /= p.length;
  const ns = Math.sqrt(e / 10 ** (snr / 10)); let prev = 0;
  for (let i = 0; i < p.length; i++) { const s = lp ? (prev = prev * lp + p[i] * (1 - lp)) : p[i]; o[i] = s + gauss() * ns; }
  return o;
}
async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]); }));
}

const train = {}, test = {}, testNoisy = {};
await pool(RECITERS, 6, async (rec) => {
  train[rec.id] = []; test[rec.id] = []; testNoisy[rec.id] = [];
  for (const [mi, m] of rec.moshafs.entries()) {
    for (const [si, s] of TRAIN.entries()) {
      const p = await pcm(rec, m, mi, s); if (!p) continue;
      train[rec.id].push(...voiceprints(p, 5));
      if (si % 3 === 0) train[rec.id].push(...voiceprints(augment(p, 20, 0.3), 5));
      if (si % 3 === 1) train[rec.id].push(...voiceprints(augment(p, 12, 0), 5));
    }
    for (const s of TEST) {
      const p = await pcm(rec, m, mi, s); if (!p) continue;
      test[rec.id].push(...voiceprints(p, 5));
      testNoisy[rec.id].push(...voiceprints(augment(p, 15, 0.2), 5));
    }
  }
  console.log(String(rec.rank).padStart(3), rec.name.padEnd(30), 'train', train[rec.id].length, 'test', test[rec.id].length);
});
const bad = RECITERS.filter((r) => train[r.id].length < 20);
if (bad.length) console.log('WARNING too little audio for:', bad.map((r) => r.name).join(', '));
const ACTIVE = RECITERS.filter((r) => train[r.id].length >= 20);

const all = ACTIVE.flatMap((r) => train[r.id]);
const mu = Array(DIM).fill(0), sd = Array(DIM).fill(0);
for (const v of all) v.forEach((x, i) => (mu[i] += x / all.length));
for (const v of all) v.forEach((x, i) => (sd[i] += (x - mu[i]) ** 2 / all.length));
sd.forEach((x, i) => (sd[i] = Math.sqrt(x) || 1));
const z = (v) => v.map((x, i) => (x - mu[i]) / sd[i]);

function jacobi(A) {
  const n = A.length, V = A.map((_, i) => A.map((_, j) => +(i === j)));
  A = A.map((r) => r.slice());
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] ** 2;
    if (off < 1e-18) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      if (Math.abs(A[p][q]) < 1e-14) continue;
      const th = (A[q][q] - A[p][p]) / (2 * A[p][q]);
      const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) { const a = A[k][p], b = A[k][q]; A[k][p] = c * a - s * b; A[k][q] = s * a + c * b; }
      for (let k = 0; k < n; k++) { const a = A[p][k], b = A[q][k]; A[p][k] = c * a - s * b; A[q][k] = s * a + c * b; }
      for (let k = 0; k < n; k++) { const a = V[k][p], b = V[k][q]; V[k][p] = c * a - s * b; V[k][q] = s * a + c * b; }
    }
  }
  return { vals: A.map((r, i) => r[i]), vecs: V };
}
const Z = Object.fromEntries(ACTIVE.map((r) => [r.id, train[r.id].map(z)]));
const gm = Array(DIM).fill(0); let N = 0;
for (const vs of Object.values(Z)) for (const v of vs) { v.forEach((x, i) => (gm[i] += x)); N++; }
gm.forEach((_, i) => (gm[i] /= N));
const Sw = Array.from({ length: DIM }, () => Array(DIM).fill(0)), Sb = Array.from({ length: DIM }, () => Array(DIM).fill(0));
for (const vs of Object.values(Z)) {
  const m = Array(DIM).fill(0);
  vs.forEach((v) => v.forEach((x, i) => (m[i] += x / vs.length)));
  for (const v of vs) for (let i = 0; i < DIM; i++) for (let j = 0; j < DIM; j++) Sw[i][j] += ((v[i] - m[i]) * (v[j] - m[j])) / N;
  for (let i = 0; i < DIM; i++) for (let j = 0; j < DIM; j++) Sb[i][j] += (vs.length / N) * (m[i] - gm[i]) * (m[j] - gm[j]);
}
for (let i = 0; i < DIM; i++) Sw[i][i] += 0.05;
const ew = jacobi(Sw);
const Wh = Array.from({ length: DIM }, (_, i) => Array.from({ length: DIM }, (_, j) => {
  let s = 0; for (let k = 0; k < DIM; k++) s += (ew.vecs[i][k] * ew.vecs[j][k]) / Math.sqrt(ew.vals[k]); return s;
}));
const mul = (A, B) => A.map((r) => B[0].map((_, j) => r.reduce((s, x, k) => s + x * B[k][j], 0)));
const M = mul(mul(Wh, Sb), Wh);
for (let i = 0; i < DIM; i++) for (let j = i + 1; j < DIM; j++) M[i][j] = M[j][i] = (M[i][j] + M[j][i]) / 2;
const eb = jacobi(M);
const K = 40;
const order = eb.vals.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, K).map((x) => x[1]);
const U = Array.from({ length: DIM }, (_, i) => order.map((c) => eb.vecs[i][c]));
const W = mul(Wh, U);
const proj = (zv) => W[0].map((_, c) => +zv.reduce((s, x, i) => s + x * W[i][c], 0).toFixed(3));

const db = Object.entries(Z).flatMap(([id, vs]) => vs.map((v) => ({ id, v: proj(v) })));
const name = Object.fromEntries(RECITERS.map((r) => [r.id, r.name]));
const evalSet = (set, label) => {
  let ok = 0, ok5 = 0, n = 0; const per = {};
  for (const [id, vs] of Object.entries(set)) for (const v of vs) {
    if (!Z[id]) continue;
    const r = classify(proj(z(v)), db, 15); n++;
    per[id] = per[id] || [0, 0]; per[id][1]++;
    if (r[0].id === id) { ok++; per[id][0]++; }
    if (r.slice(0, 5).some((x) => x.id === id)) ok5++;
  }
  console.log(label, 'segment top-1', ((100 * ok) / n).toFixed(1) + '%', 'top-5', ((100 * ok5) / n).toFixed(1) + '%', `(n=${n})`);
  return per;
};
const per = evalSet(test, 'clean held-out');
evalSet(testNoisy, 'noisy held-out');
{ // 20 s listen = 4 segments averaged, on noisy audio; and how reliable is "confidence >= 80%"
  let ok = 0, n = 0, hi = 0, hiOk = 0;
  for (const [id, vs] of Object.entries(testNoisy)) {
    if (!Z[id]) continue;
    for (let i = 0; i + 4 <= vs.length; i += 4) {
      const t = {};
      for (const v of vs.slice(i, i + 4)) for (const r of classify(proj(z(v)), db, 15)) t[r.id] = (t[r.id] || 0) + r.p / 4;
      const [best, p] = Object.entries(t).sort((a, b) => b[1] - a[1])[0];
      n++; if (best === id) ok++;
      if (p >= 0.8) { hi++; if (best === id) hiOk++; }
    }
  }
  console.log(`noisy 20s-clip top-1 ${((100 * ok) / n).toFixed(1)}% (n=${n}); answers with conf>=80%: ${hi}, of which correct ${hiOk}`);
}
const worst = Object.entries(per).map(([k, [a, b]]) => [name[k], a / b]).sort((a, b) => a[1] - b[1]).slice(0, 10);
console.log('weakest:', worst.map(([n, a]) => `${n} ${(a * 100).toFixed(0)}%`).join('; '));

const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
let sql = 'DELETE FROM voiceprints; DELETE FROM reciters; DELETE FROM meta;\n';
for (const r of ACTIVE) sql += `INSERT INTO reciters(id,name,name_ar) VALUES(${q(r.id)},${q(r.name)},${q(r.name_ar)});\n`;
for (const r of db) sql += `INSERT INTO voiceprints(reciter_id,vec) VALUES(${q(r.id)},${q(JSON.stringify(r.v))});\n`;
sql += `INSERT INTO meta(k,v) VALUES('norm',${q(JSON.stringify({ mu, sd, W: W.map((r) => r.map((x) => +x.toFixed(4))) }))});\n`;
writeFileSync('seed.sql', sql);
console.log('wrote seed.sql:', ACTIVE.length, 'reciters,', db.length, 'vectors,', (sql.length / 1e6).toFixed(2) + 'MB');
