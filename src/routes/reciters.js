import { classify } from '../match.mjs';
import { chat } from '../ai.js';
import { json, load, loadNeural, limited, SYS } from '../lib.js';

// Reciters: the list, identification by voice (two models), feedback on a result, and the AI note and questions about a reader.
// Returns the response for a path this file handles, or null.
export async function handle(req, env, url) {
  if (url.pathname === '/api/reciters') {
    const { reciters } = await load(env);
    return json(Object.values(reciters).sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })));
  }

  if (url.pathname === '/api/identify' && req.method === 'POST') {
    const { vectors } = await req.json().catch(() => ({}));
    if (!Array.isArray(vectors) || !vectors.length || vectors.length > 60) return json({ error: 'bad input' }, 400);
    const { reciters, db, norm } = await load(env);
    const tot = {};
    for (const raw of vectors) {
      if (!Array.isArray(raw) || raw.length !== norm.mu.length) return json({ error: 'bad vector' }, 400);
      let z = raw.map((x, i) => (x - norm.mu[i]) / norm.sd[i]);
      if (norm.W) z = norm.W[0].map((_, c) => z.reduce((a, x, i) => a + x * norm.W[i][c], 0));
      for (const { id, p } of classify(z, db, 15)) tot[id] = (tot[id] || 0) + p / vectors.length;
    }
    const results = Object.entries(tot).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([id, p]) => ({ id, name: reciters[id].name, name_ar: reciters[id].name_ar, links: reciters[id].links, confidence: p }));
    return json({ results, segments: vectors.length });
  }

  // Neural identification: the browser sends one 192-d embedding per 3 s window; we score them against the stored class weights.
  if (url.pathname === '/api/identify2' && req.method === 'POST') {
    const { emb } = await req.json().catch(() => ({}));
    if (!Array.isArray(emb) || !emb.length || emb.length > 30) return json({ error: 'bad input' }, 400);
    const [{ reciters }, nm] = await Promise.all([load(env), loadNeural(env)]);
    if (!nm) return json({ error: 'model unavailable' }, 503);
    const C = nm.classes.length, D = nm.W[0].length, avg = new Array(C).fill(0);
    for (const e of emb) {
      if (!Array.isArray(e) || e.length !== D) return json({ error: 'bad embedding' }, 400);
      let n = 0; for (const x of e) n += x * x; n = Math.sqrt(n) || 1;
      const lg = nm.W.map((w) => { let a = 0; for (let i = 0; i < D; i++) a += w[i] * e[i]; return (nm.scale * a) / n / nm.temp; });
      const mx = Math.max(...lg); let z = 0; for (const x of lg) z += Math.exp(x - mx); const lz = mx + Math.log(z);
      for (let c = 0; c < C; c++) avg[c] += (lg[c] - lz) / emb.length;      // mean log-probability over windows
    }
    const mx = Math.max(...avg); const ex = avg.map((x) => Math.exp(x - mx)); const sum = ex.reduce((a, b) => a + b, 0);
    const results = ex.map((x, c) => ({ id: nm.classes[c], p: x / sum })).sort((a, b) => b.p - a.p).slice(0, 5)
      .filter((x) => reciters[x.id]).map((x) => ({ id: x.id, name: reciters[x.id].name, name_ar: reciters[x.id].name_ar, links: reciters[x.id].links, confidence: x.p }));
    return json({ results, segments: emb.length, model: 'neural' });
  }

  if (url.pathname === '/api/feedback' && req.method === 'POST') {
    const b = await req.json().catch(() => ({}));
    const { reciters } = await load(env);
    if (!reciters[b.predicted_id] || typeof b.is_correct !== 'boolean') return json({ error: 'bad input' }, 400);
    const actual = b.is_correct ? b.predicted_id : (reciters[b.actual_id] ? b.actual_id : null);
    const vecs = Array.isArray(b.vectors) ? b.vectors.slice(0, 20) : [];
    // free-text name of the real reader (may be someone outside the 100 known readers)
    const name = !b.is_correct && typeof b.actual_name === 'string' ? b.actual_name.replace(/[\x00-\x1f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || null : null;
    await env.DB.prepare('INSERT INTO feedback(predicted_id,confidence,is_correct,actual_id,actual_name,vectors) VALUES(?,?,?,?,?,?)')
      .bind(b.predicted_id, Number(b.confidence) || null, b.is_correct ? 1 : 0, actual, name, JSON.stringify(vecs)).run();
    return json({ ok: true });
  }

  // AI-written short note about a reader; generated once per reader and cached in D1.
  if (url.pathname === '/api/bio') {
    const { reciters } = await load(env);
    const r = reciters[url.searchParams.get('id')];
    if (!r) return json({ error: 'unknown reader' }, 404);
    const hit = await env.DB.prepare('SELECT bio FROM reciter_bios WHERE reciter_id=?').bind(r.id).first();
    if (hit) return json({ bio: hit.bio, ai: true });
    if (await limited(env, req, 'bio', 30)) return json({ error: 'rate limited' }, 429);
    try {
      const out = await chat(env, [
        { role: 'system', content: SYS },
        { role: 'user', content: `اكتب من جملتين إلى ثلاث جمل (بحد أقصى 60 كلمة) عن قارئ القرآن «${r.name_ar}» (${r.name}): بلده، وأسلوبه في التلاوة، وبماذا اشتهر. وإذا لم تكن لديك معلومات موثوقة عن هذا القارئ فقل ذلك في جملة واحدة.` },
      ], 160);
      await env.DB.prepare('INSERT OR REPLACE INTO reciter_bios(reciter_id,bio,model) VALUES(?,?,?)').bind(r.id, out.text, out.model).run();
      return json({ bio: out.text, ai: true });
    } catch { return json({ error: 'AI unavailable' }, 503); }
  }

  if (url.pathname === '/api/ask' && req.method === 'POST') {
    const { id, question } = await req.json().catch(() => ({}));
    const { reciters } = await load(env);
    const r = reciters[id];
    if (!r || typeof question !== 'string' || question.trim().length < 3 || question.length > 300) return json({ error: 'bad input' }, 400);
    if (await limited(env, req, 'ask', 15)) return json({ error: 'وصلت إلى الحد الأقصى للأسئلة في هذه الساعة، حاول لاحقاً.' }, 429);
    try {
      const out = await chat(env, [
        { role: 'system', content: SYS + ` يسأل المستخدم عن القارئ «${r.name_ar}» (${r.name}). الضمائر في سؤاله مثل «هو» و«له» تعود إلى هذا القارئ. أجب بالعربية في حدود 100 كلمة. وإذا كان السؤال لا علاقة له بهذا القارئ أو بتلاوة القرآن فاعتذر بلطف.` },
        { role: 'user', content: 'سؤال عن القارئ «' + r.name_ar + '»: ' + question.trim() },
      ], 260);
      return json({ answer: out.text, ai: true });
    } catch { return json({ error: 'AI unavailable' }, 503); }
  }
  return null;
}
