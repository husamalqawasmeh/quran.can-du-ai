// Looks transcribed Arabic up in the Quran via the Quran.com search API and only accepts a match whose words really overlap.
export const normAr = (s) => s
  .replace(/[ً-ٰٟۖ-ۭـ]/g, '')
  .replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
  .replace(/[^ء-ي\s]/g, ' ').replace(/\s+/g, ' ').trim();

let DB = null;
export const useDb = (db) => { DB = db; };   // the worker's D1: the fixed Quran text lives there (scripts/load-quran.mjs); Quran.com is the fallback
const dbRows = async (sql, ...args) => { if (!DB) return []; try { return (await DB.prepare(sql).bind(...args).all()).results; } catch { return []; } };

let chapters;
export async function getChapters() {
  if (!chapters) {
    const rows = await dbRows('SELECT id, en, ar, verses, place, meaning FROM chapters ORDER BY id');
    if (rows.length === 114) return (chapters = rows);
    const r = await fetch('https://api.quran.com/api/v4/chapters?language=en');
    chapters = (await r.json()).chapters.map((c) => ({ id: c.id, en: c.name_simple, ar: c.name_arabic, verses: c.verses_count, place: c.revelation_place, meaning: c.translated_name?.name }));
  }
  return chapters;
}
async function chapterName(n) {
  const c = (await getChapters())[n - 1];
  return c ? { en: c.en, ar: c.ar } : { en: 'Surah ' + n, ar: '' };
}
const strip = (t) => (t || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
/** Arabic text + Saheeh International translation of one verse, straight from Quran.com (never AI-generated). */
export async function verseByKey(key) {
  const m = /^(\d{1,3}):(\d{1,3})$/.exec(key || '');
  const ch = m && (await getChapters())[+m[1] - 1];
  if (!ch || +m[2] < 1 || +m[2] > ch.verses) return null;
  const [row] = await dbRows('SELECT text, translation FROM ayat WHERE surah = ? AND ayah = ?', +m[1], +m[2]);
  if (row) return { key, surah: +m[1], ayah: +m[2], surah_en: ch.en, surah_ar: ch.ar, text: row.text, translation: row.translation };
  const r = await fetch(`https://api.quran.com/api/v4/verses/by_key/${key}?translations=20&fields=text_uthmani`);
  if (!r.ok) return null;
  const v = (await r.json()).verse;
  return { key, surah: +m[1], ayah: +m[2], surah_en: ch.en, surah_ar: ch.ar, text: v.text_uthmani, translation: strip(v.translations?.[0]?.text) };
}

/** Spelling-insensitive skeleton: ignores alef/hamza variants so Whisper text matches Uthmani script. */
export const skel = (w) => w.replace(/[اءؤئ]/g, '');

async function search(words) {
  const r = await fetch('https://api.quran.com/api/v4/search?size=8&language=en&q=' + encodeURIComponent(words.join(' ')));
  const raw = await r.text();
  if (r.status === 204) return [];
  if (!r.ok || !raw) throw new Error('quran.com search ' + r.status);
  let best = null;
  for (const v of JSON.parse(raw).search?.results || []) {
    const vw = new Set(normAr(v.text).split(' ').map(skel));
    const hit = words.filter((w) => vw.has(skel(w))).length / words.length;
    if (!best || hit > best.hit) best = { v, hit };
  }
  return best ? [best] : [];
}

// A clip usually spans several verses, so look up how it begins (first words) and report that verse.
export async function findVerse(transcript) {
  const all = normAr(transcript).split(' ').filter((w) => w.length > 1);
  if (new Set(all).size < 3) return null; // too few distinct words to pin down a verse
  for (const n of [7, 5, 4]) {
    const words = all.slice(0, n);
    if (new Set(words).size < 3) continue;
    const [best] = await search(words);
    if (best && best.hit >= 0.75) {
      const [s, a] = best.v.verse_key.split(':').map(Number);
      const c = await chapterName(s);
      return { key: best.v.verse_key, surah: s, ayah: a, surah_en: c.en, surah_ar: c.ar, text: best.v.text.replace(/<[^>]+>/g, ''), match: Math.round(best.hit * 100) };
    }
  }
  return null;
}

const chapCache = {};
/** All verses of a surah: [{n, text}] in Uthmani script, from Quran.com. */
export async function chapterVerses(n) {
  if (chapCache[n]) return chapCache[n];
  const rows = await dbRows('SELECT ayah AS n, text FROM ayat WHERE surah = ? ORDER BY ayah', n);
  if (rows.length) return (chapCache[n] = rows);
  const r = await fetch(`https://api.quran.com/api/v4/verses/by_chapter/${n}?fields=text_uthmani&per_page=300`);
  if (!r.ok) throw new Error('quran.com ' + r.status);
  return (chapCache[n] = (await r.json()).verses.map((v) => ({ n: v.verse_number, text: v.text_uthmani })));
}

/** Word stem for matching: drops attached prefixes (و ف ب ل ك ال) and spelling variants of alef/hamza/waw. */
export const stem = (w) => normAr(w).replace(/^(وال|فال|بال|كال|لل|ال|و|ف|ب|ل|ك|س)(?=.{3,})/, '').replace(/[اءؤئو]/g, '');
const STOP = new Set('في من على الى عن ان انه انها هو هي هم ما لا لم لن قد ثم او و يا هذا هذه ذلك الذي التي الذين كان كانوا كل بل اذا اذ ان إن'.split(' ').map(stem));
async function searchAll(q, size = 12) {
  const r = await fetch('https://api.quran.com/api/v4/search?size=' + size + '&language=en&q=' + encodeURIComponent(q));
  if (r.status === 204 || !r.ok) return [];
  const raw = await r.text();
  return raw ? JSON.parse(raw).search?.results || [] : [];
}

/** Up to `max` verses that contain the heard words. Arabic input: ranked by how many of the words each verse contains. */
export async function ayatWithWords(transcript, max = 3) {
  const ws = [...new Set(normAr(transcript).split(' ').filter((w) => w.length > 1))];
  if (!ws.length) return [];
  const key = ws.filter((w) => !STOP.has(stem(w)));
  const core = (key.length ? key : ws).slice().sort((a, b) => b.length - a.length);
  const queries = [ws.slice(0, 5).join(' ')];
  if (core.length > 1) queries.push(core.slice(0, 2).join(' '));
  for (const w of core.slice(0, 3)) queries.push(w);
  const want = new Set((key.length ? key : ws).map(stem));
  const found = new Map();
  for (const q of [...new Set(queries)]) {
    for (const v of await searchAll(q)) {
      if (found.has(v.verse_key)) continue;
      const vw = new Set(normAr(v.text).split(' ').map(stem));
      const hits = [...want].filter((w) => vw.has(w));
      if (hits.length) found.set(v.verse_key, { v, score: hits.length / want.size, len: vw.size });
    }
    if ([...found.values()].filter((x) => x.score >= 0.99).length >= max) break;
  }
  const top = [...found.values()].sort((a, b) => b.score - a.score || a.len - b.len).slice(0, max);
  return (await Promise.all(top.map((t) => verseByKey(t.v.verse_key).catch(() => null)))).map((v, i) => v && { ...v, score: Math.round(top[i].score * 100) }).filter(Boolean);
}

/** English input: let Quran.com search the translations; return the best `max` verses. */
export async function ayatByEnglish(text, max = 3) {
  const res = (await searchAll(text.slice(0, 120), 6)).slice(0, max);
  return (await Promise.all(res.map((v) => verseByKey(v.verse_key).catch(() => null)))).filter(Boolean);
}
