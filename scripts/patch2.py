p = 'src/worker.js'
s = open(p, encoding='utf8').read()

def rep(old, new, count=1):
    global s
    assert old in s, old[:60]
    s = s.replace(old, new, count)

# Arabic system prompt + Arabic answers
a = s.index("const SYS = ")
b = s.index("export default")
s = s[:a] + r'''const SYS = 'أنت مساعد دقيق في موقع للتعرّف على قرّاء القرآن الكريم. اكتب دائماً بالعربية الفصحى المبسطة. ' +
  'اعتمد فقط على المعلومات الموثوقة والمشهورة عن القرّاء وعن التلاوة. إذا لم تكن متأكداً من معلومة فاحذفها أو قل إنك لست متأكداً، ولا تخترع معلومات سيرة. نصّ عادي بلا تنسيق.';

''' + s[b:]

rep("Write 2-3 sentences (max 60 words) about the Quran reciter \"${r.name}\" (${r.name_ar}): country, recitation style, and what he is known for. If you do not have reliable information about this reciter, say so in one sentence instead.",
    "اكتب من جملتين إلى ثلاث جمل (بحد أقصى 60 كلمة) عن قارئ القرآن «${r.name_ar}» (${r.name}): بلده، وأسلوبه في التلاوة، وبماذا اشتهر. وإذا لم تكن لديك معلومات موثوقة عن هذا القارئ فقل ذلك في جملة واحدة.")
rep("The user is asking about the reciter \"${r.name}\" (${r.name_ar}). Answer in at most 100 words. If the question is unrelated to this reciter or Quran recitation, politely decline.",
    "يسأل المستخدم عن القارئ «${r.name_ar}» (${r.name}). أجب بالعربية في حدود 100 كلمة. وإذا كان السؤال لا علاقة له بهذا القارئ أو بتلاوة القرآن فاعتذر بلطف.")
rep("'You have reached the hourly question limit. Please try again later.'", "'وصلت إلى الحد الأقصى للأسئلة في هذه الساعة، حاول لاحقاً.'")
rep("'You have reached the hourly limit. Please try again later.'", "'وصلت إلى الحد الأقصى في هذه الساعة، حاول لاحقاً.'")
rep("'Identify the main theme in at most 8 words, then choose up to 5 OTHER Quran verses that are closely related in meaning or theme. ' +\n            'Only choose verses you are certain exist (format \"surah:ayah\"). Reply as JSON: {\"topic\":\"...\",\"related\":[{\"key\":\"2:153\",\"why\":\"one short sentence\"}]}. If the content has no religious theme, return an empty related list.'",
    "'حدّد الموضوع الرئيسي بالعربية في ثماني كلمات على الأكثر، ثم اختر حتى 5 آيات أخرى من القرآن الكريم قريبة في المعنى أو الموضوع. ' +\n            'اختر فقط آيات أنت متأكد من وجودها (بصيغة \"رقم السورة:رقم الآية\"). أجب بصيغة JSON فقط: {\"topic\":\"...\",\"related\":[{\"key\":\"2:153\",\"why\":\"جملة عربية قصيرة تبيّن الصلة\"}]}. وإذا لم يكن في الكلام موضوع ديني فأعد قائمة related فارغة.'")
rep("'Someone is listening to this (speech-to-text, may contain errors):\\n\"'", "'شخص يستمع إلى هذا الكلام (نص ناتج عن التعرّف على الكلام وقد يحوي أخطاء):\\n\"'")
rep("'It appears to be Quran ' + heard.key + ': ' + heard.translation + '\\n'", "'يبدو أنه الآية ' + heard.key + ' من القرآن: ' + heard.translation + '\\n'")

# if a "related" verse is really what was heard, report it as heard instead
rep("import { findVerse, getChapters, verseByKey } from './verse.js';", "import { findVerse, getChapters, verseByKey, normAr } from './verse.js';")
rep("      const seen = new Set(heard ? [heard.key] : []);", "      const seen = new Set(heard ? [heard.key] : []);\n      const tw = new Set(normAr(transcript).split(' '));")
rep("        try { const v = await verseByKey(p.key); return v && { ...v, why: String(p.why || '').slice(0, 200) }; } catch { return null; }\n      }))).filter(Boolean).slice(0, 5);",
    "        try { const v = await verseByKey(p.key); return v && { ...v, why: String(p.why || '').slice(0, 200) }; } catch { return null; }\n      }))).filter(Boolean);\n      if (!heard) {\n        const i = related.findIndex((v) => { const w = normAr(v.text).split(' '); return w.filter((x) => tw.has(x)).length / w.length >= 0.8; });\n        if (i >= 0) { heard = related[i]; related.splice(i, 1); }\n      }\n      related.splice(5);")
rep("return json({ transcript, heard, topic, related, ai: true });", "return json({ transcript, heard, topic, related, ai: true });")
open(p, 'w', encoding='utf8').write(s)

p = 'src/verse.js'
s = open(p, encoding='utf8').read()
s = s.replace("const norm = (s) =>", "export const normAr = (s) =>", 1)
s = s.replace("norm(", "normAr(")
open(p, 'w', encoding='utf8').write(s)

# link labels in the generator, for future runs
p = 'scripts/links.mjs'
s = open(p, encoding='utf8').read()
s = s.replace("'Full Quran audio (mp3quran.net) — Al-Fatiha'", "'تلاوة المصحف كاملاً (mp3quran.net) — الفاتحة'")
s = s.replace("'Verse by verse (everyayah.com)'", "'آية بآية (everyayah.com)'")
s = s.replace("label: 'Search on YouTube'", "label: 'بحث في يوتيوب (بالإنجليزية)'")
s = s.replace("label: 'بحث في يوتيوب'", "label: 'بحث في يوتيوب (بالعربية)'")
s = s.replace("label: 'Search on Spotify'", "label: 'بحث في سبوتيفاي'")
open(p, 'w', encoding='utf8').write(s)
print('ok')
