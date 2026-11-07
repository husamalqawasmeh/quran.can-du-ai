import { chat, transcribe } from '../ai.js';
import { advise } from '../advisor.js';
import { findVerse, verseByKey, normAr, skel, ayatWithWords, ayatByEnglish } from '../verse.js';
import { json, limited } from '../lib.js';

// Speech and AI: verse from a recording, the Whisper prompter, the live advisor, the memorisation check and the tajweed teacher.
// Returns the response for a path this file handles, or null.
export async function handle(req, env, url) {
  // Speech-to-text of the heard recitation, then look the text up in the Quran (Quran.com search).
  if (url.pathname === '/api/verse' && req.method === 'POST') {
    const wav = await req.arrayBuffer();
    if (wav.byteLength < 20000 || wav.byteLength > 2_500_000) return json({ error: 'bad audio' }, 400);
    if (await limited(env, req, 'verse', 20)) return json({ error: 'rate limited' }, 429);
    try {
      const text = await transcribe(env, wav);
      let verse = null;
      try { verse = await findVerse(text); } catch { /* lookup unavailable: still return the transcript */ }
      return json({ transcript: text, verse });
    } catch { return json({ error: 'transcription unavailable' }, 503); }
  }

  // Whisper: transcribe a few seconds of speech, then return 2-3 verses that contain the heard words (text search, no AI guessing).
  if (url.pathname === '/api/whisper' && req.method === 'POST') {
    const wav = await req.arrayBuffer();
    if (wav.byteLength < 20000 || wav.byteLength > 2_500_000) return json({ error: 'bad audio' }, 400);
    if (await limited(env, req, 'whisper', 40)) return json({ error: 'وصلت إلى الحد الأقصى في هذه الساعة، حاول لاحقاً.' }, 429);
    let transcript;
    try { transcript = await transcribe(env, wav, null); } catch { return json({ error: 'transcription unavailable' }, 503); }
    if (transcript.split(/\s+/).filter(Boolean).length < 1 || transcript.length < 2) return json({ transcript: '', verses: [] });
    let verses = [];
    try { verses = /[؀-ۿ]/.test(transcript) ? await ayatWithWords(transcript, 3) : await ayatByEnglish(transcript, 3); } catch { /* search unavailable: still return the transcript */ }
    return json({ transcript, verses, arabic: /[؀-ۿ]/.test(transcript) });
  }

  // Live advisor: every ~3 s the page sends the latest seconds of audio; several LLM agents + a judge answer with one verse (or a few words of it).
  if (url.pathname === '/api/advisor' && req.method === 'POST') {
    let fd; try { fd = await req.formData(); } catch { return json({ error: 'bad input' }, 400); }
    let ctx = {}; try { ctx = JSON.parse(fd.get('ctx') || '{}'); } catch { /* ignore */ }
    const file = fd.get('audio');
    const audio = file && typeof file !== 'string' ? await file.arrayBuffer() : null;
    const text = typeof ctx.text === 'string' ? ctx.text.slice(0, 600) : '';
    if ((!audio || audio.byteLength < 20000 || audio.byteLength > 600000) && !text) return json({ error: 'bad audio' }, 400);
    if (await limited(env, req, 'advisor', 900)) return json({ error: 'وصلت إلى الحد الأقصى لهذه الساعة، حاول لاحقاً.' }, 429);
    if (await limited(env, req, 'advisor-day:' + new Date().toISOString().slice(0, 10), 6000, '*')) return json({ error: 'بلغ الموقع حدّه اليومي لهذه الميزة، حاول غداً.' }, 429);
    try {
      const out = await advise(env, { audio, text, history: Array.isArray(ctx.history) ? ctx.history.slice(-3) : [], recent: Array.isArray(ctx.recent) ? ctx.recent.slice(-8).map(String) : [], prev: String(ctx.prev || '').slice(0, 200) });
      return json(out);
    } catch { return json({ error: 'advisor unavailable' }, 503); }
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
        { role: 'system', content: 'أنت معلّم متخصص في تعليم القرآن الكريم وأحكام التجويد للمبتدئين، تكتب بالعربية الفصحى المبسطة. أجب باختصار ووضوح (حتى 120 كلمة) مع مثال قرآني عند الحاجة، بنصّ عادي بلا تنسيق. لا تخترع معلومات؛ وإذا لم تكن متأكداً فقل ذلك. ولا تذكر أرقام السور والآيات أبداً (قد تخطئ فيها)، اذكر الكلمة أو الجزء من الآية فقط. وفي المسائل الفقهية الخلافية انصح بالرجوع إلى معلّم مجاز.' },
        { role: 'user', content: 'سؤال في تعلّم القرآن وأحكام التجويد: ' + question.trim() },
      ], 320);
      return json({ answer: out.text });
    } catch { return json({ error: 'AI unavailable' }, 503); }
  }
  return null;
}
