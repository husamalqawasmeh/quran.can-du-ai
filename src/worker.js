import { classify } from './match.mjs';
import { chat, transcribe } from './ai.js';
import { advise } from './advisor.js';
import { discover } from './discover.js';
import { findVerse, getChapters, verseByKey, normAr, skel, chapterVerses, ayatWithWords, ayatByEnglish } from './verse.js';

const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } });
let cache, neural;
// neural model head: class weights (unit vectors), logit scale and calibration temperature, all stored in D1
async function loadNeural(env) {
  if (neural) return neural;
  const rows = (await env.DB.prepare('SELECT k,v FROM model_meta').all()).results;
  const m = Object.fromEntries(rows.map((r) => [r.k, r.v]));
  if (!m.classes) return null;
  const classes = JSON.parse(m.classes);
  if (classes.some((c) => !m['w:' + c])) return null;               // incomplete upload: fall back to the older method
  return (neural = { classes, W: classes.map((c) => JSON.parse(m['w:' + c])), scale: +m.scale, temp: +m.temperature });
}
async function load(env) {
  if (cache) return cache;
  const [rec, vps, meta, lnk] = await Promise.all([
    env.DB.prepare('SELECT id,name,name_ar FROM reciters').all(),
    env.DB.prepare('SELECT reciter_id,vec FROM voiceprints').all(),
    env.DB.prepare("SELECT v FROM meta WHERE k='norm'").first(),
    env.DB.prepare('SELECT reciter_id,kind,label,url FROM reciter_links ORDER BY id').all(),
  ]);
  const links = {};
  for (const l of lnk.results) (links[l.reciter_id] ||= []).push({ kind: l.kind, label: l.label, url: l.url });
  cache = {
    reciters: Object.fromEntries(rec.results.map((r) => [r.id, { ...r, links: links[r.id] || [] }])),
    db: vps.results.map((r) => ({ id: r.reciter_id, v: JSON.parse(r.vec) })),
    norm: JSON.parse(meta.v),
  };
  return cache;
}

// Per-IP hourly limit for endpoints that spend AI credits.
async function limited(env, req, kind, max, ipOverride) {
  const ip = ipOverride || req.headers.get('cf-connecting-ip') || 'unknown';
  const bucket = kind + ':' + new Date().toISOString().slice(0, 13);
  await env.DB.prepare('DELETE FROM rate WHERE bucket NOT LIKE ?').bind('%:' + new Date().toISOString().slice(0, 10) + '%').run();
  const row = await env.DB.prepare('INSERT INTO rate(ip,bucket,n) VALUES(?,?,1) ON CONFLICT(ip,bucket) DO UPDATE SET n=n+1 RETURNING n').bind(ip, bucket).first();
  return row.n > max;
}

const SYS = 'أنت مساعد دقيق في موقع للتعرّف على قرّاء القرآن الكريم. اكتب دائماً بالعربية الفصحى المبسطة. ' +
  'اعتمد فقط على المعلومات الموثوقة والمشهورة عن القرّاء وعن التلاوة. إذا لم تكن متأكداً من معلومة فاحذفها أو قل إنك لست متأكداً، ولا تخترع معلومات سيرة. نصّ عادي بلا تنسيق.';

const safeEq = (a, b) => { if (!a || !b || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
const isAdmin = (req, env) => safeEq((req.headers.get('authorization') || '').replace(/^Bearer /, ''), env.ADMIN_TOKEN || '');

export default {
  // Every Friday 06:00 UTC (10:00 Dubai): the research agent looks for new miracle items and saves them as PENDING.
  async scheduled(event, env, ctx) { ctx.waitUntil(discover(env).catch(() => null)); },

  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    // The site moved from qreaders.can-du-ai.com to quran.can-du-ai.com; keep old links working.
    if (url.hostname === 'qreaders.can-du-ai.com') return Response.redirect('https://quran.can-du-ai.com' + url.pathname + url.search, 308);

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

    if (url.pathname === '/api/surahs') {
      try { return json(await getChapters()); } catch { return json({ error: 'unavailable' }, 503); }
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
    // ---- admin: review what the weekly agent found (needs the private token) ----
    if (url.pathname.startsWith('/api/admin/')) {
      if (!isAdmin(req, env)) return json({ error: 'unauthorized' }, 401);
      if (url.pathname === '/api/admin/candidates') {
        const st = ['pending', 'approved', 'rejected'].includes(url.searchParams.get('status')) ? url.searchParams.get('status') : 'pending';
        const rows = (await env.DB.prepare('SELECT id,created_at,week,title,g,note,keys,model,score,issues,status,topic FROM miracle_candidates WHERE status=? ORDER BY score DESC, id DESC LIMIT 100').bind(st).all()).results;
        return json(rows.map((r) => ({ ...r, keys: JSON.parse(r.keys || '[]') })));
      }
      if (url.pathname === '/api/admin/update' && req.method === 'POST') {
        const b = await req.json().catch(() => ({}));
        const id = +b.id; if (!id || !['approve', 'reject', 'pending'].includes(b.action)) return json({ error: 'bad input' }, 400);
        const status = b.action === 'approve' ? 'approved' : b.action === 'reject' ? 'rejected' : 'pending';
        if (typeof b.title === 'string' && b.title.trim()) await env.DB.prepare('UPDATE miracle_candidates SET title=? WHERE id=?').bind(b.title.trim().slice(0, 90), id).run();
        if (typeof b.note === 'string' && b.note.trim().length > 20) await env.DB.prepare('UPDATE miracle_candidates SET note=? WHERE id=?').bind(b.note.trim().slice(0, 1500), id).run();
        if (Number.isInteger(b.g) && b.g >= 0 && b.g <= 7) await env.DB.prepare('UPDATE miracle_candidates SET g=? WHERE id=?').bind(b.g, id).run();
        await env.DB.prepare('UPDATE miracle_candidates SET status=? WHERE id=?').bind(status, id).run();
        return json({ ok: true });
      }
      if (url.pathname === '/api/admin/run' && req.method === 'POST') {          // run the weekly agent now (takes a minute or two)
        if (url.searchParams.get('wait')) return json(await discover(env).catch((e) => ({ error: String(e && e.message || e) })));
        ctx.waitUntil(discover(env).catch(() => null));
        return json({ started: true });
      }
      return json({ error: 'not found' }, 404);
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

    const res = await env.ASSETS.fetch(req);
    if (!(res.headers.get('content-type') || '').includes('text/html')) return res;
    const out = new Response(res.body, res);
    out.headers.set('cache-control', 'no-cache');
    return out;
  },
};
