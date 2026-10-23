// Weekly research agent for "الإعجاز العلمي في القرآن": several LLMs propose new topics, every verse is verified on Quran.com,
// a critic model reviews each candidate, and the survivors are stored as PENDING for a human to approve. Nothing is published automatically.
import INDEX from './miracles_index.json';
import { verseByKey } from './verse.js';

const OR = 'https://openrouter.ai/api/v1/chat/completions';
const GROQ = 'https://api.groq.com/openai/v1/chat/completions';
const GROUPS = '0 الإنسان والحياة، 1 الفلك والكون، 2 الأرض والجغرافيا، 3 البحار والمياه والجو، 4 الحيوان، 5 التاريخ والآثار، 6 النبات والزراعة، 7 التحدي والإعجاز البياني';

async function oa(url, key, model, messages, o = {}) {
  const r = await fetch(url, { method: 'POST', headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' },
    body: JSON.stringify({ model, messages, max_tokens: o.max || 1800, temperature: o.temp ?? 0.6, ...(o.extra || {}) }), signal: AbortSignal.timeout(o.timeout || 90000) });
  if (!r.ok) throw new Error(model + ' ' + r.status);
  return (await r.json()).choices?.[0]?.message?.content || '';
}
async function cohere(key, model, messages, o = {}) {
  const r = await fetch('https://api.cohere.com/v2/chat', { method: 'POST', headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' },
    body: JSON.stringify({ model, messages, max_tokens: o.max || 1800, temperature: o.temp ?? 0.6 }), signal: AbortSignal.timeout(o.timeout || 90000) });
  if (!r.ok) throw new Error(model + ' ' + r.status);
  return (await r.json()).message?.content?.[0]?.text || '';
}
const parse = (t) => { const m = (t || '').replace(/```(?:json)?/g, '').match(/[\[{][\s\S]*[\]}]/); try { return m ? JSON.parse(m[0]) : null; } catch { return null; } };
const toAscii = (s) => String(s).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const keyOf = (k) => { const m = /(\d{1,3})\s*[:：]\s*(\d{1,3})/.exec(toAscii(k)); return m ? `${+m[1]}:${+m[2]}` : null; };
const norm = (s) => String(s).replace(/[ً-ٰٟـ]/g, '').replace(/[^ء-ي\s]/g, ' ').replace(/\s+/g, ' ').trim();

const DISCOVERERS = [
  { id: 'cohere', focus: 'الطب والأحياء وعلم الأجنة وجسم الإنسان', run: (env, m) => env.COHERE_API_KEY && cohere(env.COHERE_API_KEY, 'command-a-03-2025', m) },
  { id: 'kimi', focus: 'الفلك والفيزياء والكون', run: (env, m) => env.OPENROUTER_API_KEY && oa(OR, env.OPENROUTER_API_KEY, 'moonshotai/kimi-k2', m) },
  { id: 'glm', focus: 'الجيولوجيا والجغرافيا والأرصاد والبحار', run: (env, m) => env.OPENROUTER_API_KEY && oa(OR, env.OPENROUTER_API_KEY, 'z-ai/glm-4.6', m, { extra: { reasoning: { enabled: false } } }) },
  { id: 'qwen', focus: 'الحيوان والنبات واللغة والتاريخ والإعجاز البياني', run: (env, m) => env.OPENROUTER_API_KEY && oa(OR, env.OPENROUTER_API_KEY, 'qwen/qwen-2.5-72b-instruct', m) },
];

function discoverMessages(focus, known) {
  return [
    { role: 'system', content: 'أنت باحث في باب «الإعجاز العلمي في القرآن» وتلتزم بضوابطه: لا تحمّل الآية ما لا تحتمل؛ اذكر دائماً المعنى الظاهر عند المفسرين؛ اذكر ما يراه المهتمون بالباب بصيغة «يرى بعضهم»؛ اذكر الخلاف أو النقد إن وُجد؛ ولا تورد أرقاماً أو حقائق علمية لست متأكداً منها؛ ولا تخترع أقوالاً منسوبة لأحد. اكتب بالعربية الفصحى المبسطة.' },
    { role: 'user', content: `مجال بحثك هذا الأسبوع: ${focus}.\nالموضوعات الموجودة في الموقع أو المقترحة سابقاً (لا تكررها ولا تقترح ما يتداخل معها):\n${known}\n\nاقترح ٤ موضوعات جديدة جيدة التوثيق الشائع في هذا الباب. لكل موضوع: عنوان قصير، ورقم المجموعة (${GROUPS})، وآية أو آيتان أو ثلاث بصيغة "رقم السورة:رقم الآية" بالأرقام الإنجليزية، وملاحظة من ٦٠ إلى ١٢٠ كلمة تتضمن: ما يلاحظه المهتمون، والمعنى الظاهر عند المفسرين، وأي خلاف أو نقد.\nأجب بصيغة JSON فقط: {"items":[{"t":"...","g":0,"keys":["23:14"],"note":"..."}]}` },
  ];
}

export async function discover(env, { limit = 8 } = {}) {
  const t0 = Date.now();
  const old = (await env.DB.prepare("SELECT title, keys FROM miracle_candidates WHERE topic='miracles'").all()).results || [];
  const seenKeys = new Set([...INDEX.flatMap((i) => i.keys), ...old.flatMap((o) => JSON.parse(o.keys || '[]'))]);
  const seenTitles = [...INDEX.map((i) => i.t), ...old.map((o) => o.title)];
  const known = seenTitles.slice(-140).join('، ');

  // 1) discovery in parallel
  const perModel = {};
  const rawLists = await Promise.all(DISCOVERERS.map(async (d) => {
    const t = Date.now();
    try {
      const raw = await d.run(env, discoverMessages(d.focus, known));
      const j = parse(raw);
      perModel[d.id] = { ms: Date.now() - t, chars: (raw || '').length, items: (j?.items || []).length };
      return (j?.items || []).map((x) => ({ ...x, model: d.id }));
    } catch (e) { perModel[d.id] = { ms: Date.now() - t, error: String(e.message || e).slice(0, 80) }; return []; }
  }));
  let cands = rawLists.flat();

  // 2) normalise, drop duplicates (same verses or near-identical title), verify every verse on Quran.com
  const out = [];
  for (const c of cands) {
    if (!c || typeof c.t !== 'string' || typeof c.note !== 'string' || c.note.length < 40) continue;
    const keys = [...new Set((Array.isArray(c.keys) ? c.keys : []).map(keyOf).filter(Boolean))].slice(0, 3);
    const g = Number.isInteger(+c.g) && +c.g >= 0 && +c.g <= 7 ? +c.g : null;
    if (!keys.length || g === null) continue;
    if (keys.some((k) => seenKeys.has(k))) continue;               // any verse already covered => it is probably the same topic
    const nt = norm(c.t);
    if (seenTitles.some((s) => norm(s) === nt) || out.some((o) => norm(o.t) === nt || o.keys.some((k) => keys.includes(k)))) continue;
    const verses = (await Promise.all(keys.map((k) => verseByKey(k).catch(() => null)))).filter(Boolean);
    if (verses.length !== keys.length) continue;                       // a hallucinated verse number kills the candidate
    out.push({ t: c.t.trim().slice(0, 90), g, keys, note: c.note.trim().slice(0, 1200), model: c.model, verses });
  }

  // 3) critic: faithfulness to the verse text, overreach, balance
  const reviewed = [];
  for (const c of out.slice(0, 16)) {
    const msgs = [
      { role: 'system', content: 'أنت ناقد علمي صارم لمحتوى «الإعجاز العلمي في القرآن». مهمتك أن تحمي القارئ من المبالغة وسوء النسبة. قيّم المقترح وأعد صياغة ملاحظته عند الحاجة بحيث تكون محايدة وموزونة.' },
      { role: 'user', content: `الآيات (نص حقيقي من المصحف):\n${c.verses.map((v) => `[${v.key}] ${v.text}\nالمعنى: ${v.translation}`).join('\n')}\n\nالعنوان المقترح: ${c.t}\nالملاحظة المقترحة: ${c.note}\n\nقيّم: (١) هل الملاحظة مدعومة فعلاً بنص الآيات؟ (٢) هل فيها مبالغة أو حقائق علمية مشكوك فيها أو أقوال منسوبة بلا توثيق؟ (٣) هل ذكرت المعنى الظاهر عند المفسرين والخلاف؟\nأجب بصيغة JSON فقط: {"score":0-10,"issues":"ملخص المشكلات بالعربية في جملة","note":"الملاحظة بعد التحسين (٦٠–١٢٠ كلمة) أو نفس النص إن كانت جيدة"}` },
    ];
    let j = null;
    for (const run of [() => env.GROQ_API_KEY && oa(GROQ, env.GROQ_API_KEY, 'openai/gpt-oss-120b', msgs, { max: 900, temp: 0.2, timeout: 40000, extra: { reasoning_effort: 'low' } }), () => env.COHERE_API_KEY && cohere(env.COHERE_API_KEY, 'command-a-03-2025', msgs, { max: 700, temp: 0.2, timeout: 40000 })]) {
      try { j = parse(await run()); if (j) break; } catch { /* next */ }
    }
    const score = j ? Math.round(+j.score) : 0;
    if (score >= 7) reviewed.push({ ...c, score, issues: String(j.issues || '').slice(0, 300), note: (typeof j.note === 'string' && j.note.length > 40 ? j.note : c.note).slice(0, 1200) });
  }

  // 4) store as pending (best first, capped)
  reviewed.sort((a, b) => b.score - a.score);
  const week = new Date().toISOString().slice(0, 10);
  let saved = 0;
  for (const c of reviewed.slice(0, limit)) {
    await env.DB.prepare("INSERT INTO miracle_candidates(title,g,note,keys,model,score,issues,week,status) VALUES(?,?,?,?,?,?,?,?, 'pending')")
      .bind(c.t, c.g, c.note, JSON.stringify(c.keys), c.model, c.score, c.issues, week).run();
    saved++;
  }
  return { proposed: cands.length, verified: out.length, passedCritic: reviewed.length, saved, perModel, seconds: Math.round((Date.now() - t0) / 1000) };
}
