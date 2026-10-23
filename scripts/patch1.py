import re
# ---- verse.js: shared chapter list + verse lookup by key
p = 'src/verse.js'
s = open(p, encoding='utf8').read()
a = s.index("let chapters;")
b = s.index("async function search")
new_mid = r'''let chapters;
export async function getChapters() {
  if (!chapters) {
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
  const r = await fetch(`https://api.quran.com/api/v4/verses/by_key/${key}?translations=20&fields=text_uthmani`);
  if (!r.ok) return null;
  const v = (await r.json()).verse;
  return { key, surah: +m[1], ayah: +m[2], surah_en: ch.en, surah_ar: ch.ar, text: v.text_uthmani, translation: strip(v.translations?.[0]?.text) };
}

'''
s = s[:a] + new_mid + s[b:]
open(p, 'w', encoding='utf8').write(s)

# ---- ai.js: optional language
p = 'src/ai.js'
s = open(p, encoding='utf8').read()
s = s.replace("export async function transcribe(env, wav) {", "export async function transcribe(env, wav, lang = 'ar') {")
s = s.replace("      fd.append('language', 'ar');", "      if (lang) fd.append('language', lang);")
open(p, 'w', encoding='utf8').write(s)

# ---- worker.js
p = 'src/worker.js'
s = open(p, encoding='utf8').read()
s = s.replace("import { findVerse } from './verse.js';", "import { findVerse, getChapters, verseByKey } from './verse.js';")
route = r'''    if (url.pathname === '/api/surahs') {
      try { return json(await getChapters()); } catch { return json({ error: 'unavailable' }, 503); }
    }

    // Q-Companion: transcribe what is heard (Arabic or other speech), find the verse if it is recitation,
    // and suggest related ayahs. Verse text always comes from Quran.com; the AI only picks verse numbers + a reason.
    if (url.pathname === '/api/companion' && req.method === 'POST') {
      const wav = await req.arrayBuffer();
      if (wav.byteLength < 20000 || wav.byteLength > 2_500_000) return json({ error: 'bad audio' }, 400);
      if (await limited(env, req, 'companion', 40)) return json({ error: 'You have reached the hourly limit. Please try again later.' }, 429);
      let transcript;
      try { transcript = await transcribe(env, wav, null); } catch { return json({ error: 'transcription unavailable' }, 503); }
      if (transcript.split(/\s+/).filter(Boolean).length < 3) return json({ transcript, heard: null, related: [] });
      let heard = null;
      try { const f = await findVerse(transcript); if (f) heard = await verseByKey(f.key); } catch { /* optional */ }
      let topic = '', picks = [];
      try {
        const out = await chat(env, [
          { role: 'system', content: SYS + ' Reply with JSON only.' },
          { role: 'user', content: 'Someone is listening to this (speech-to-text, may contain errors):\n"' + transcript.slice(0, 900) + '"\n' +
            (heard ? 'It appears to be Quran ' + heard.key + ': ' + heard.translation + '\n' : '') +
            'Identify the main theme in at most 8 words, then choose up to 5 OTHER Quran verses that are closely related in meaning or theme. ' +
            'Only choose verses you are certain exist (format "surah:ayah"). Reply as JSON: {"topic":"...","related":[{"key":"2:153","why":"one short sentence"}]}. If the content has no religious theme, return an empty related list.' },
        ], 450);
        const j = JSON.parse(out.text.replace(/^```(?:json)?|```$/g, '').trim());
        topic = String(j.topic || '').slice(0, 120);
        picks = (Array.isArray(j.related) ? j.related : []).slice(0, 6);
      } catch { /* AI unavailable: still return what was heard */ }
      const seen = new Set(heard ? [heard.key] : []);
      const related = (await Promise.all(picks.map(async (p) => {
        if (!p || typeof p.key !== 'string' || seen.has(p.key)) return null;
        seen.add(p.key);
        try { const v = await verseByKey(p.key); return v && { ...v, why: String(p.why || '').slice(0, 200) }; } catch { return null; }
      }))).filter(Boolean).slice(0, 5);
      return json({ transcript, heard, topic, related, ai: true });
    }

    return env.ASSETS.fetch(req);'''
assert s.count("    return env.ASSETS.fetch(req);") == 1
s = s.replace("    return env.ASSETS.fetch(req);", route, 1)
open(p, 'w', encoding='utf8').write(s)
print('patched')
