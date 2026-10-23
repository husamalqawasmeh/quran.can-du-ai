// Downloads sample recitations (everyayah.com), builds voiceprints, writes seed.sql and an accuracy report.
// usage: node scripts/enroll.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { voiceprints, DIM } from '../public/voiceprint.js';

export const RECITERS = [
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
const ids = (s, from, to) => Array.from({ length: to - from + 1 }, (_, i) => [s, from + i]);
// training ayahs vs. held-out ayahs (different surahs) used only for the accuracy report
const TRAIN = [...ids(1, 1, 7), ...ids(2, 255, 256), ...ids(18, 1, 6), ...ids(36, 1, 8), ...ids(67, 1, 4), ...ids(112, 1, 4)];
const TEST = [...ids(55, 1, 6), ...ids(56, 1, 4), ...ids(78, 1, 6), ...ids(19, 1, 4)];

const fmt = ([s, a]) => String(s).padStart(3, '0') + String(a).padStart(3, '0');
async function pcm(folder, ref) {
  const f = `samples/${folder}/${fmt(ref)}.mp3`;
  if (!existsSync(f)) {
    mkdirSync(`samples/${folder}`, { recursive: true });
    const r = await fetch(`https://everyayah.com/data/${folder}/${fmt(ref)}.mp3`);
    if (!r.ok) return null;
    writeFileSync(f, Buffer.from(await r.arrayBuffer()));
  }
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', f, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
  return new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
}
async function collect(folder, refs) {
  const out = [];
  for (const r of refs) { const p = await pcm(folder, r); if (p) out.push(...voiceprints(p, 5)); }
  return out;
}

const train = {}, test = {};
for (const [id, , , folder] of RECITERS) {
  train[id] = await collect(folder, TRAIN);
  test[id] = await collect(folder, TEST);
  console.log(id, 'train', train[id].length, 'test', test[id].length);
}
// global standardisation
const all = Object.values(train).flat();
const mu = Array(DIM).fill(0), sd = Array(DIM).fill(0);
for (const v of all) v.forEach((x, i) => (mu[i] += x / all.length));
for (const v of all) v.forEach((x, i) => (sd[i] += (x - mu[i]) ** 2 / all.length));
sd.forEach((x, i) => (sd[i] = Math.sqrt(x) || 1));
const z = (v) => v.map((x, i) => (x - mu[i]) / sd[i]);

// quick held-out accuracy using the same kNN as the worker
const { classify } = await import('../src/match.mjs');
const db = Object.entries(train).flatMap(([id, vs]) => vs.map((v) => ({ id, v: z(v) })));
let ok = 0, n = 0; const per = {};
for (const [id, vs] of Object.entries(test)) for (const v of vs) {
  const r = classify(z(v), db)[0].id; n++; per[id] = per[id] || [0, 0]; per[id][1]++; if (r === id) { ok++; per[id][0]++; }
}
console.log('held-out segment accuracy', ok, '/', n, (100 * ok / n).toFixed(1) + '%');
for (const [k, [a, b]] of Object.entries(per)) console.log(' ', k.padEnd(14), a + '/' + b);

const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
let sql = 'DELETE FROM voiceprints; DELETE FROM reciters; DELETE FROM meta;\n';
for (const [id, en, ar] of RECITERS) sql += `INSERT INTO reciters(id,name,name_ar) VALUES(${q(id)},${q(en)},${q(ar)});\n`;
for (const [id, vs] of Object.entries(train)) for (const v of vs) sql += `INSERT INTO voiceprints(reciter_id,vec) VALUES(${q(id)},${q(JSON.stringify(z(v).map((x) => +x.toFixed(4))))});\n`;
sql += `INSERT INTO meta(k,v) VALUES('norm',${q(JSON.stringify({ mu, sd }))});\n`;
writeFileSync('seed.sql', sql);
console.log('wrote seed.sql', (sql.length / 1e6).toFixed(2) + 'MB');
