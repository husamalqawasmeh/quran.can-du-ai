// One-time copy of the fixed Quran data (114 surahs, 6,236 verses: Uthmani text + Saheeh International) from Quran.com
// into the D1 database, so the worker reads it from there instead of calling Quran.com each time.
// usage: node scripts/load-quran.mjs  ->  quran.sql, then: npx wrangler d1 execute qreaders --remote --file quran.sql
import { writeFileSync } from 'node:fs';
import assert from 'node:assert';
const q = (s) => (s == null ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);
const strip = (t) => (t || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();   // as verse.js: footnote marks out
const get = async (u) => { for (let i = 0; ; i++) { const r = await fetch(u); if (r.ok) return r.json(); if (i > 3) throw new Error(u + ' ' + r.status); await new Promise((ok) => setTimeout(ok, 1000 * (i + 1))); } };

const ch = (await get('https://api.quran.com/api/v4/chapters?language=en')).chapters;
assert.equal(ch.length, 114);
const sql = [
  'DROP TABLE IF EXISTS ayat;', 'DROP TABLE IF EXISTS chapters;',
  'CREATE TABLE chapters(id INTEGER PRIMARY KEY, en TEXT, ar TEXT, verses INTEGER, place TEXT, meaning TEXT);',
  'CREATE TABLE ayat(surah INTEGER, ayah INTEGER, text TEXT, translation TEXT, PRIMARY KEY(surah, ayah));',
  ...ch.map((c) => `INSERT INTO chapters VALUES(${c.id},${q(c.name_simple)},${q(c.name_arabic)},${c.verses_count},${q(c.revelation_place)},${q(c.translated_name?.name)});`),
];
let total = 0;
for (const c of ch) {
  const vs = (await get(`https://api.quran.com/api/v4/verses/by_chapter/${c.id}?fields=text_uthmani&translations=20&per_page=300`)).verses;
  assert.equal(vs.length, c.verses_count, 'surah ' + c.id);
  for (const v of vs) sql.push(`INSERT INTO ayat VALUES(${c.id},${v.verse_number},${q(v.text_uthmani)},${q(strip(v.translations?.[0]?.text))});`);
  total += vs.length;
}
assert.equal(total, 6236);
writeFileSync('quran.sql', sql.join('\n'));
console.log('quran.sql:', ch.length, 'surahs,', total, 'verses');
