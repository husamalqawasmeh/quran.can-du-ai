import { chat } from '../ai.js';
import { verseByKey, getChapters, normAr, ayatWithWords } from '../verse.js';
import { json, limited } from '../lib.js';

// The Quran chatbot: answers in the language of the question (Arabic or English) and cites ayahs as evidence.
// The model never supplies ayah text: it names keys plus a few exact words from each ayah; the server fetches the
// real text, keeps a citation only if those words are really in it (else looks the words up), and drops the rest.
const isArabic = (s) => (s.match(/[؀-ۿ]/g) || []).length >= (s.match(/[A-Za-z]/g) || []).length;

const SYSTEM = {
  ar: 'أنت مساعد للأسئلة عن القرآن الكريم في موقع قرآني. أجب بالعربية الفصحى المبسطة دائماً. ' +
    'اعتمد على القرآن الكريم، واذكر الآيات التي تستدل بها. لا تكتب نص الآيات في الإجابة (الموقع يعرض نصها الصحيح)، بل اذكر مراجعها فقط. ' +
    'إذا كان السؤال عن حكم فقهي تفصيلي أو فتوى فاذكر ما في القرآن ثم انصح بالرجوع إلى أهل العلم. إذا لم يكن السؤال عن القرآن أو الإسلام فاعتذر بلطف. ' +
    'لا تخترع شيئاً؛ إذا لم تكن متأكداً فقل ذلك.',
  en: 'You are an assistant for questions about the Holy Quran on a Quran website. Always answer in clear, simple English. ' +
    'Base the answer on the Quran and cite the ayahs you rely on. Do not write out ayah text in the answer (the site shows the exact text); give the references only. ' +
    'For detailed rulings or fatwas, state what the Quran says and advise consulting qualified scholars. If the question is not about the Quran or Islam, politely decline. ' +
    'Never invent anything; if unsure, say so.',
};
const FORMAT = 'Reply with JSON only, no markdown: {"answer": "<the answer, 2-6 short paragraphs, plain text>", "ayahs": [{"key": "<surah:ayah, e.g. 2:255>", "words": "<2-4 consecutive words copied exactly, in Arabic, from that ayah>", "why": "<one short line, in the answer language, on why it is evidence>"}]}. ' +
  'Give 1-5 ayahs, the most relevant first. Only cite ayahs you are sure of.';

const skel = (s) => normAr(s).replace(/[اءؤئو\s]/g, '');   // spelling-insensitive: Uthmani «ءَاتُوا۟», «يَـٰٓأَيُّهَا» match plain «آتوا», «يا أيها»
const parseJSON = (s) => { const m = String(s || '').match(/\{[\s\S]*\}/); try { return m ? JSON.parse(m[0]) : null; } catch { return null; } };

async function verify(cites, chapters) {
  const out = [], seen = new Set();
  for (const c of cites.slice(0, 6)) {
    const words = String(c?.words || '').trim(), why = String(c?.why || '').slice(0, 200);
    const m = /^(\d{1,3}):(\d{1,3})$/.exec(String(c?.key || '').trim());
    let v = null;
    if (m && chapters[+m[1] - 1] && +m[2] >= 1 && +m[2] <= chapters[+m[1] - 1].verses) {
      v = await verseByKey(m[1] + ':' + m[2]).catch(() => null);
      if (v && words && !skel(v.text).includes(skel(words))) v = null;   // the words are not in that ayah: a wrong reference
    }
    if (!v && words.split(/\s+/).length >= 2) v = (await ayatWithWords(words, 1).catch(() => []))[0] || null;   // find the ayah those words come from
    if (!v || seen.has(v.key)) continue;
    seen.add(v.key);
    out.push({ key: v.key, surah_ar: v.surah_ar, surah_en: v.surah_en, ayah: v.ayah, text: v.text, translation: v.translation, why });
    if (out.length === 5) break;
  }
  return out;
}

export async function handle(req, env, url) {
  if (url.pathname !== '/api/chat' || req.method !== 'POST') return null;
  const { question, history } = await req.json().catch(() => ({}));
  if (typeof question !== 'string' || question.trim().length < 3 || question.length > 600) return json({ error: 'bad input' }, 400);
  const lang = isArabic(question) ? 'ar' : 'en';
  if (await limited(env, req, 'chat', 30)) return json({ error: lang === 'ar' ? 'وصلت إلى الحد الأقصى للأسئلة في هذه الساعة، حاول لاحقاً.' : 'You have reached the hourly question limit; please try again later.' }, 429);
  if (await limited(env, req, 'chat-day:' + new Date().toISOString().slice(0, 10), 3000, '*')) return json({ error: lang === 'ar' ? 'بلغ الموقع حدّه اليومي لهذه الميزة، حاول غداً.' : 'The site has reached its daily limit for this feature; please try tomorrow.' }, 429);
  const past = (Array.isArray(history) ? history : []).slice(-4).flatMap((h) => [
    { role: 'user', content: String(h?.q || '').slice(0, 600) }, { role: 'assistant', content: String(h?.a || '').slice(0, 1200) }]).filter((m) => m.content);
  try {
    const out = await chat(env, [{ role: 'system', content: SYSTEM[lang] + '\n' + FORMAT }, ...past, { role: 'user', content: question.trim() }], 900);
    const j = parseJSON(out.text);
    const answer = String(j?.answer || (j ? '' : out.text)).trim();
    if (!answer) throw new Error('empty');
    const ayahs = await verify(Array.isArray(j?.ayahs) ? j.ayahs : [], await getChapters());
    return json({ lang, answer, ayahs, model: out.model });
  } catch { return json({ error: lang === 'ar' ? 'المساعد غير متاح الآن، حاول بعد قليل.' : 'The assistant is unavailable right now; please try again shortly.' }, 503); }
}
