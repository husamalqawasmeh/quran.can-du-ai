// Live "secret advisor": several LLM agents propose verses for what the speaker just said, a judge picks one using the REAL verse text.
import { transcribe } from './ai.js';
import { verseByKey, getChapters, normAr, ayatWithWords } from './verse.js';

const OR = 'https://openrouter.ai/api/v1/chat/completions';
const GROQ = 'https://api.groq.com/openai/v1/chat/completions';

async function openaiCompat(url, key, model, messages, o) {
  const r = await fetch(url, {
    method: 'POST', headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' },
    body: JSON.stringify({ model, messages, max_tokens: o.max || 160, temperature: o.temp ?? 0.3, ...(o.extra || {}) }), signal: AbortSignal.timeout(o.timeout),
  });
  if (!r.ok) throw new Error(model + ' ' + r.status);
  return (await r.json()).choices?.[0]?.message?.content || '';
}
async function cohere(key, model, messages, o) {
  const r = await fetch('https://api.cohere.com/v2/chat', {
    method: 'POST', headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' },
    body: JSON.stringify({ model, messages, max_tokens: o.max || 160, temperature: o.temp ?? 0.3 }), signal: AbortSignal.timeout(o.timeout),
  });
  if (!r.ok) throw new Error(model + ' ' + r.status);
  return (await r.json()).message?.content?.[0]?.text || '';
}

// Each agent has a different job and a different model, so their picks are genuinely independent.
const AGENTS = [
  { id: 'cohere', label: 'Cohere Command A', role: 'answer', run: (env, m, o) => env.COHERE_API_KEY && cohere(env.COHERE_API_KEY, 'command-a-03-2025', m, o) },
  { id: 'qwen', label: 'Qwen3 (Groq)', role: 'match', run: (env, m, o) => env.GROQ_API_KEY && openaiCompat(GROQ, env.GROQ_API_KEY, 'qwen/qwen3.8-27b', m, o) },
  { id: 'kimi', label: 'Kimi K2 (OpenRouter)', role: 'next', run: (env, m, o) => env.OPENROUTER_API_KEY && openaiCompat(OR, env.OPENROUTER_API_KEY, 'moonshotai/kimi-k2', m, o) },
  { id: 'glm', label: 'GLM (OpenRouter)', role: 'reflect', run: (env, m, o) => env.OPENROUTER_API_KEY && openaiCompat(OR, env.OPENROUTER_API_KEY, 'z-ai/glm-4.5-air', m, { ...o, extra: { reasoning: { enabled: false } } }) },
];
const ROLES = {
  answer: 'إن كان في كلام المتحدث سؤال أو إشكال أو حيرة فاقترح الآية التي تجيب عنه أو تعالجه مباشرة؛ وإن لم يكن فاقترح الآية الأقرب لمعنى آخر ما قيل.',
  match: 'اقترح الآية التي تتضمن الكلمات أو المعاني المحددة التي ذكرها المتحدث للتو.',
  next: 'استنتج الموضوع الذي سينتقل إليه المتحدث على الأرجح بعد هذا الكلام، واقترح آية تثري ذلك الموضوع القادم قبل أن يصل إليه.',
  reflect: 'اقترح آية تضيف عمقاً أو حكمة أو تذكيراً يناسب مقام الحديث وروحه (موعظة، تثبيت، شكر، تسلية…).',
};

const toAscii = (s) => s.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
function parseJSON(t) {
  if (!t) return null;
  const m = t.replace(/```(?:json)?/g, '').match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}
function parseKey(k) {
  const m = /(\d{1,3})\s*[:：]\s*(\d{1,3})/.exec(toAscii(String(k ?? '')));
  return m ? `${+m[1]}:${+m[2]}` : null;
}

function proposerMessages(role, ctx) {
  const recent = ctx.recent.length ? ctx.recent.join('، ') : 'لا يوجد';
  return [
    { role: 'system', content: 'أنت مستشار قرآني يهمس للمتحدث أثناء جلسة حيّة (محاضرة أو نقاش أو خطبة). تصلك لقطات متتابعة متداخلة من كلام المتحدث (الأحدث أخيراً). ' +
      'دورك: ' + ROLES[role] + ' اقترح آية واحدة فقط من القرآن الكريم تتأكد من وجودها ومن معناها، واكتب رقمها بالصيغة "رقم السورة:رقم الآية" بالأرقام الإنجليزية (مثل 2:153). ' +
      'تجنّب الآيات المقترحة سابقاً: ' + recent + '. أجب بصيغة JSON فقط: {"key":"2:153","why":"سبب قصير بالعربية (حتى ١٢ كلمة)"}. وإذا لم يكن في الكلام ما يستدعي آية فأجب {"key":null}.' },
    { role: 'user', content: 'الكلام المسموع:\n' + ctx.snapshots.map((s, i) => `(${i + 1}) ${s}`).join('\n') + '\nالاقتراح السابق: ' + (ctx.prev || 'لا يوجد') },
  ];
}

const HALLUCINATIONS = /ترجمة|اشترك|اشتركوا|شكرا لمشاهدتكم|شكراً لمشاهدتكم|للمشاهدة|subscribe|thanks for watching/i;

export async function advise(env, { audio, text, history = [], recent = [], prev = '' }) {
  const t0 = Date.now(), timing = {};
  let transcript = (text || '').trim();
  if (!transcript) {
    transcript = await transcribe(env, audio, 'ar');
    timing.stt = Date.now() - t0;
  }
  const words = transcript.split(/\s+/).filter(Boolean);
  if (words.length < 2 || (HALLUCINATIONS.test(transcript) && words.length < 8)) return { transcript: '', suggestion: null, timing };
  const snapshots = [...history.slice(-2), transcript].map((s) => String(s).slice(0, 400));
  const ctx = { snapshots, recent, prev };

  // stage 1: independent proposers + literal word-match search, all in parallel, slow ones dropped at the deadline
  const t1 = Date.now();
  const proposed = [];
  const settle = (p) => p.catch(() => null);
  const jobs = AGENTS.map(async (a) => {
    const raw = await a.run(env, proposerMessages(a.role, ctx), { timeout: 2600, max: 120 });
    const j = parseJSON(raw); const key = parseKey(j?.key);
    return key ? { agent: a.id, label: a.label, role: a.role, key, why: String(j.why || '').slice(0, 120), ms: Date.now() - t1 } : null;
  }).map(settle);
  const searchJob = settle(ayatWithWords(transcript, 2));
  const [found, ...picks] = await Promise.all([searchJob, ...jobs]);
  for (const p of picks) if (p) proposed.push(p);
  timing.proposers = Date.now() - t1;

  // candidates: unique keys, real text fetched from Quran.com
  const byKey = new Map();
  const add = (key, src) => { if (!byKey.has(key)) byKey.set(key, { key, by: [] }); byKey.get(key).by.push(src); };
  for (const p of proposed) add(p.key, p.agent);
  for (const v of found || []) add(v.key, 'search');
  const cands = (await Promise.all([...byKey.values()].slice(0, 7).map(async (c) => {
    const v = await verseByKey(c.key).catch(() => null);
    return v && { ...c, v };
  }))).filter(Boolean);
  timing.verses = Date.now() - t1 - timing.proposers;
  const agents = proposed.map(({ agent, label, role, key, ms }) => ({ agent, label, role, key, ms }));
  if (!cands.length) return { transcript, suggestion: null, agents, timing };

  // stage 2: the judge sees the real texts
  const t2 = Date.now();
  const list = cands.map((c, i) => {
    const ws = c.v.text.split(/\s+/).filter((w) => normAr(w));
    c.words = ws;
    return `${i + 1}. [${c.key}] اقترحها: ${c.by.join('، ')}\n   ${ws.map((w, k) => `[${k + 1}]${w}`).join(' ')}\n   المعنى: ${c.v.translation}`;
  }).join('\n');
  const judgeMsgs = [
    { role: 'system', content: 'أنت رئيس لجنة مستشارين قرآنيين تهمس للمتحدث أثناء جلسة حيّة. اختر أنسب آية واحدة لما قاله المتحدث الآن، أو لا شيء. المعايير: (١) صلة حقيقية بمعنى الكلام الأخير، (٢) إن كان سؤالاً فالآية التي تجيب عنه، (٣) أو آية تثري الموضوع القادم، (٤) لا تكرر الاقتراح السابق إلا لتصحيحه (kind=revise). ' +
      'اعرض أقصر مقطع من الآية يؤدي الغرض: كلمة أو كلمتين أو ثلاث كلمات، بتحديد رقم أول كلمة وآخر كلمة كما هي مرقّمة؛ ولا تعرض الآية كاملة إلا إن كانت قصيرة جداً (أقل من ٦ كلمات). وإن كان الكلام ما زال يدور حول الآية نفسها التي اقترحتَها سابقاً فاعرض مقطعاً أطول منها (kind=extend) ليتدرج المعنى مع الحديث. لا تختر آية لا تناسب فعلاً؛ وفي هذه الحال أجب {"pick":0}. ' +
      'أجب بصيغة JSON فقط: {"pick":n,"from":i,"to":j,"kind":"answer|match|next|reflect|revise|extend","why":"سبب في ١٢ كلمة أو أقل","confidence":0-100}' },
    { role: 'user', content: 'الكلام المسموع:\n' + snapshots.map((s, i) => `(${i + 1}) ${s}`).join('\n') + '\nالاقتراح السابق: ' + (prev || 'لا يوجد') + '\n\nالآيات المرشّحة:\n' + list },
  ];
  let jr = null;
  const judges = [
    () => env.GROQ_API_KEY && openaiCompat(GROQ, env.GROQ_API_KEY, 'openai/gpt-oss-120b', judgeMsgs, { timeout: 3500, max: 400, temp: 0.1, extra: { reasoning_effort: 'low' } }),
    () => env.COHERE_API_KEY && cohere(env.COHERE_API_KEY, 'command-a-03-2025', judgeMsgs, { timeout: 4000, max: 200, temp: 0.1 }),
    () => env.GROQ_API_KEY && openaiCompat(GROQ, env.GROQ_API_KEY, 'qwen/qwen3.8-27b', judgeMsgs, { timeout: 3000, max: 200, temp: 0.1 }),
  ];
  for (const j of judges) { try { jr = parseJSON(await j()); if (jr) break; } catch { /* next judge */ } }
  timing.judge = Date.now() - t2;
  const pick = jr ? Math.round(+jr.pick) : 0;
  if (!pick || pick < 1 || pick > cands.length) return { transcript, suggestion: null, agents, timing };
  const c = cands[pick - 1];
  const growing = jr.kind === 'revise' || jr.kind === 'extend';
  if (recent.includes(c.key) && !growing) return { transcript, suggestion: null, agents, timing };

  const n = c.words.length;
  let from = Math.round(+jr.from), to = Math.round(+jr.to);
  const partial = from >= 1 && to >= from && to <= n && !(from === 1 && to === n);
  if (!partial) { from = 1; to = n; }
  const excerptText = c.words.slice(from - 1, to).join(' ');
  if (prev && prev.endsWith(`[${c.key}]`) && prev.startsWith(excerptText)) return { transcript, suggestion: null, agents, timing };   // same fragment again: nothing new to say
  const chap = (await getChapters())[c.v.surah - 1];
  const KINDS = ['answer', 'match', 'next', 'reflect', 'revise', 'extend'];
  return {
    transcript,
    suggestion: {
      key: c.key, surah: c.v.surah, ayah: c.v.ayah, surah_ar: chap?.ar || c.v.surah_ar,
      excerpt: excerptText, from, to, total: n, partial,
      kind: KINDS.includes(jr.kind) ? jr.kind : 'match', why: String(jr.why || '').slice(0, 120),
      confidence: Math.max(0, Math.min(100, Math.round(+jr.confidence) || 0)), votes: c.by.length, by: c.by,
    },
    agents, timing: { ...timing, total: Date.now() - t0 },
  };
}
