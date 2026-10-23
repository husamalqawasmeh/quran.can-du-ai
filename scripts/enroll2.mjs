// Bigger enrolment: many surahs, overlapping segments, noise/quality augmentation, LDA projection.
import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { voiceprints, DIM } from '../public/voiceprint.js';
import { classify } from '../src/match.mjs';

const RECITERS = [
  ['alafasy', 'Mishary Rashid Alafasy', 'مشاري راشد العفاسي', 'Alafasy_128kbps'],
  ['abdulbasit', 'Abdul Basit Abdul Samad', 'عبد الباسط عبد الصمد', 'Abdul_Basit_Murattal_192kbps'],
  ['sudais', 'Abdul Rahman Al-Sudais', 'عبد الرحمن السديس', 'Abdurrahmaan_As-Sudais_192kbps'],
  ['shuraim', 'Saud Al-Shuraim', 'سعود الشريم', 'Saood_ash-Shuraym_128kbps'],
  ['minshawi', 'Mohamed Siddiq Al-Minshawi', 'محمد صديق المنشاوي', 'Minshawy_Murattal_128kbps'],
  ['husary', 'Mahmoud Khalil Al-Husary', 'محمود خليل الحصري', 'Husary_128kbps'],
  ['mustafaismail', 'Mustafa Ismail', 'مصطفى إسماعيل', 'Mustafa_Ismail_48kbps'],
  ['muaiqly', 'Maher Al-Muaiqly', 'ماهر المعيقلي', 'Maher_AlMuaiqly_64kbps'],
  ['ghamdi', 'Saad Al-Ghamdi', 'سعد الغامدي', 'Ghamadi_40kbps'],
  ['dosari', 'Yasser Al-Dosari', 'ياسر الدوسري', 'Yasser_Ad-Dussary_128kbps'],
  ['aljaber', 'Ali Jaber', 'علي جابر', 'Ali_Jaber_64kbps'],
];
const ids = (s, a, b) => Array.from({ length: b - a + 1 }, (_, i) => [s, a + i]);
const TRAIN = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,20,21,23,24,25,26,27,28,29,31,32,33,34,35,36,37,38,40,42,44,46,48,50,51,52,54,57,58,59,61,62,64,66,67,69,70,71,72,73,75,77,80,81,82,85,89,91,93,96,99,103,105,107,109,112].flatMap((s) =>
  s === 2 ? [...ids(2, 1, 4), ...ids(2, 255, 258), ...ids(2, 285, 286)] : s === 1 ? ids(1, 1, 7) : ids(s, 1, 5));
const TEST = [19,22,30,39,41,45,47,49,53,55,56,60,63,65,68,74,76,78,79,83,84,86,87,88,90,92,94,95,97,98,100,101,102,104,106,108,110,111,113,114].flatMap((s) => ids(s, 1, 4));
const fmt = ([s, a]) => String(s).padStart(3, '0') + String(a).padStart(3, '0');

async function pcm(folder, ref) {
  const f = `samples/${folder}/${fmt(ref)}.mp3`;
  if (!existsSync(f)) {
    mkdirSync(`samples/${folder}`, { recursive: true });
    for (let t = 0; t < 3; t++) {
      try {
        const r = await fetch(`https://everyayah.com/data/${folder}/${fmt(ref)}.mp3`);
        if (!r.ok) return null;
        writeFileSync(f, Buffer.from(await r.arrayBuffer()));
        break;
      } catch { if (t === 2) return null; }
    }
  }
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', f, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
  return new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
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
const segs = (p, hop) => {
  const vs = [];
  for (let s = 0; s + 5 * 16000 <= p.length; s += hop * 16000) vs.push(...voiceprints(p.subarray(s, s + 5 * 16000), 5));
  return vs.length ? vs : voiceprints(p, 5);
};

const train = {}, test = {}, testNoisy = {};
for (const [id, , , folder] of RECITERS) {
  train[id] = []; test[id] = []; testNoisy[id] = [];
  await pool(TRAIN, 8, async (r) => {
    const p = await pcm(folder, r); if (!p) return;
    train[id].push(...segs(p, 2.5), ...segs(augment(p, 20, 0.3), 5), ...segs(augment(p, 12, 0), 5));
  });
  await pool(TEST, 8, async (r) => {
    const p = await pcm(folder, r); if (!p) return;
    test[id].push(...voiceprints(p, 5));
    testNoisy[id].push(...voiceprints(augment(p, 15, 0.2), 5));
  });
  console.log(id, 'train', train[id].length, 'test', test[id].length);
}
const all = Object.values(train).flat();
const mu = Array(DIM).fill(0), sd = Array(DIM).fill(0);
for (const v of all) v.forEach((x, i) => (mu[i] += x / all.length));
for (const v of all) v.forEach((x, i) => (sd[i] += (x - mu[i]) ** 2 / all.length));
sd.forEach((x, i) => (sd[i] = Math.sqrt(x) || 1));
const z = (v) => v.map((x, i) => (x - mu[i]) / sd[i]);

// ---- LDA ----
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
const Z = Object.fromEntries(Object.entries(train).map(([k, vs]) => [k, vs.map(z)]));
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
const order = eb.vals.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, 10).map((x) => x[1]);
const U = Array.from({ length: DIM }, (_, i) => order.map((c) => eb.vecs[i][c]));
const W = mul(Wh, U); // DIM x 10
const proj = (zv) => W[0].map((_, c) => +zv.reduce((s, x, i) => s + x * W[i][c], 0).toFixed(4));

const db = Object.entries(Z).flatMap(([id, vs]) => vs.map((v) => ({ id, v: proj(v) })));
const evalSet = (set, name) => {
  let ok = 0, n = 0; const per = {};
  for (const [id, vs] of Object.entries(set)) for (const v of vs) {
    const r = classify(proj(z(v)), db, 15)[0].id; n++;
    per[id] = per[id] || [0, 0]; per[id][1]++;
    if (r === id) { ok++; per[id][0]++; }
  }
  console.log(name, 'segment accuracy', ((100 * ok) / n).toFixed(1) + '%', `(${ok}/${n})`);
  return per;
};
const per = evalSet(test, 'clean held-out');
evalSet(testNoisy, 'noisy held-out');
for (const [k, [a, b]] of Object.entries(per)) console.log(' ', k.padEnd(14), a + '/' + b);
{ // a 20 s listen = 4 segments, averaged, on noisy audio
  let ok = 0, n = 0, conf80 = 0, okConf80 = 0;
  for (const [id, vs] of Object.entries(testNoisy)) for (let i = 0; i + 4 <= vs.length; i += 4) {
    const t = {};
    for (const v of vs.slice(i, i + 4)) for (const r of classify(proj(z(v)), db, 15)) t[r.id] = (t[r.id] || 0) + r.p / 4;
    const [best, p] = Object.entries(t).sort((a, b) => b[1] - a[1])[0];
    n++; if (best === id) ok++;
    if (p >= 0.8) { conf80++; if (best === id) okConf80++; }
  }
  console.log('noisy 20s-clip accuracy', ((100 * ok) / n).toFixed(1) + '%', `(${ok}/${n}); with conf>=80%: ${conf80} clips, ${okConf80} correct`);
}

const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
let sql = 'DELETE FROM voiceprints; DELETE FROM reciters; DELETE FROM meta;\n';
for (const [id, en, ar] of RECITERS) sql += `INSERT INTO reciters(id,name,name_ar) VALUES(${q(id)},${q(en)},${q(ar)});\n`;
for (const r of db) sql += `INSERT INTO voiceprints(reciter_id,vec) VALUES(${q(r.id)},${q(JSON.stringify(r.v))});\n`;
sql += `INSERT INTO meta(k,v) VALUES('norm',${q(JSON.stringify({ mu, sd, W: W.map((r) => r.map((x) => +x.toFixed(5))) }))});\n`;
writeFileSync('seed.sql', sql);
console.log('wrote seed.sql', db.length, 'vectors', (sql.length / 1e6).toFixed(2) + 'MB');
