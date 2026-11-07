import { getChapters, verseByKey, chapterVerses } from '../verse.js';
import { json } from '../lib.js';

// Quran content: the surah list, verses of a surah, verses by key, and the approved items the weekly agent found.
// Returns the response for a path this file handles, or null.
export async function handle(req, env, url) {
  if (url.pathname === '/api/surahs') {
    try { return json(await getChapters()); } catch { return json({ error: 'unavailable' }, 503); }
  }

  // ---- approved miracle items discovered by the weekly agent (public) ----
  if (url.pathname === '/api/miracles-extra') {
    const rows = (await env.DB.prepare("SELECT id,g,title,note,keys,status FROM miracle_candidates WHERE status IN ('approved','pending') AND topic='miracles' ORDER BY id").all()).results;
    return json(rows.map((r) => ({ id: r.id, g: r.g, t: r.title, note: r.note, keys: JSON.parse(r.keys || '[]'), pending: r.status === 'pending' })));
  }
  // ---- researched items for a topic page (jannah …): approved ones, plus pending ones shown as «قيد المراجعة» ----
  if (url.pathname === '/api/topic-extra') {
    const topic = url.searchParams.get('topic');
    if (!['jannah'].includes(topic)) return json([]);
    const rows = (await env.DB.prepare("SELECT id,title,note,keys,status FROM miracle_candidates WHERE topic=? AND status IN ('approved','pending') ORDER BY id").bind(topic).all()).results;
    return json(rows.map((r) => ({ id: r.id, t: r.title, note: r.note, keys: JSON.parse(r.keys || '[]'), pending: r.status === 'pending' })));
  }

  // Verses of a surah (Arabic text from Quran.com) for the memorisation screen.
  if (url.pathname === '/api/verses') {
    const n = +url.searchParams.get('s');
    if (!(n >= 1 && n <= 114)) return json({ error: 'bad surah' }, 400);
    try { return json(await chapterVerses(n)); } catch { return json({ error: 'unavailable' }, 503); }
  }

  // A handful of specific verses by key (lesson examples).
  if (url.pathname === '/api/ayat') {
    const keys = (url.searchParams.get('keys') || '').split(',').slice(0, 8);
    const out = (await Promise.all(keys.map((k) => verseByKey(k.trim()).catch(() => null)))).filter(Boolean);
    return json(out.map(({ key, surah_ar, ayah, text }) => ({ key, surah_ar, ayah, text })));
  }
  return null;
}
