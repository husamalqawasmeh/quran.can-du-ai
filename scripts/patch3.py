p = 'src/worker.js'
s = open(p, encoding='utf8').read()

# 1) ask: make the question explicitly about this reader (pronouns like "هو" were being refused)
old = "          { role: 'user', content: question.trim() },"
assert old in s
s = s.replace(old, "          { role: 'user', content: 'سؤال عن القارئ «' + r.name_ar + '»: ' + question.trim() },", 1)

# 2) imports
s = s.replace("normAr, skel } from './verse.js';", "normAr, skel, chapterVerses } from './verse.js';", 1)

route = r'''    // Verses of a surah (Arabic text from Quran.com) for the memorisation screen.
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

    // Memorisation check: transcribe the user's recitation and compare it word by word with the verse.
    if (url.pathname === '/api/check' && req.method === 'POST') {
      const key = url.searchParams.get('key');
      const wav = await req.arrayBuffer();
      if (wav.byteLength < 8000 || wav.byteLength > 2_500_000) return json({ error: 'bad audio' }, 400);
      if (await limited(env, req, 'check', 60)) return json({ error: 'وصلت إلى الحد الأقصى في هذه الساعة، حاول لاحقاً.' }, 429);
      let v;
      try { v = await verseByKey(key); } catch { v = null; }
      if (!v) return json({ error: 'bad verse' }, 400);
      let heard;
      try { heard = await transcribe(env, wav, 'ar'); } catch { return json({ error: 'transcription unavailable' }, 503); }
      const exp = v.text.split(/\s+/).filter((w) => normAr(w));
      const got = new Set(normAr(heard).split(' ').filter(Boolean).map(skel));
      // order-aware: walk the heard words forward so repeated words are matched in sequence
      const gotList = normAr(heard).split(' ').filter(Boolean).map(skel);
      let j = 0;
      const words = exp.map((w) => {
        const k = skel(normAr(w));
        const at = gotList.indexOf(k, j);
        if (at >= 0 && at - j <= 3) { j = at + 1; return { w, ok: true }; }
        return { w, ok: false };
      });
      const okN = words.filter((x) => x.ok).length;
      return json({ heard, words, score: Math.round((100 * okN) / words.length), extra: got.size });
    }

    // Tajweed / Quran-learning teacher.
    if (url.pathname === '/api/teach' && req.method === 'POST') {
      const { question } = await req.json().catch(() => ({}));
      if (typeof question !== 'string' || question.trim().length < 3 || question.length > 300) return json({ error: 'bad input' }, 400);
      if (await limited(env, req, 'teach', 20)) return json({ error: 'وصلت إلى الحد الأقصى للأسئلة في هذه الساعة، حاول لاحقاً.' }, 429);
      try {
        const out = await chat(env, [
          { role: 'system', content: SYS + ' أنت معلّم لأحكام التجويد وتعليم القرآن الكريم للمبتدئين. أجب باختصار ووضوح (حتى 120 كلمة) مع مثال قرآني عند الحاجة. إذا كان السؤال في مسألة فقهية أو خلافية فانصح بسؤال معلّم مجاز. وإذا لم يكن السؤال متعلقاً بتعلّم القرآن وتلاوته فاعتذر بلطف.' },
          { role: 'user', content: question.trim() },
        ], 320);
        return json({ answer: out.text });
      } catch { return json({ error: 'AI unavailable' }, 503); }
    }

    return env.ASSETS.fetch(req);'''
assert s.count("    return env.ASSETS.fetch(req);") == 1
s = s.replace("    return env.ASSETS.fetch(req);", route, 1)
open(p, 'w', encoding='utf8').write(s)

p = 'src/verse.js'
s = open(p, encoding='utf8').read()
s += r'''
const chapCache = {};
/** All verses of a surah: [{n, text}] in Uthmani script, from Quran.com. */
export async function chapterVerses(n) {
  if (chapCache[n]) return chapCache[n];
  const r = await fetch(`https://api.quran.com/api/v4/verses/by_chapter/${n}?fields=text_uthmani&per_page=300`);
  if (!r.ok) throw new Error('quran.com ' + r.status);
  return (chapCache[n] = (await r.json()).verses.map((v) => ({ n: v.verse_number, text: v.text_uthmani })));
}
'''
open(p, 'w', encoding='utf8').write(s)
print('ok')
