import re, sys
sys.stdout.reconfigure(encoding='utf-8')
# ---------------- worker
p='src/worker.js'; s=open(p,encoding='utf8').read()
s=s.replace("let cache;\n","""let cache, neural;
// neural model head: class weights (unit vectors), logit scale and calibration temperature, all stored in D1
async function loadNeural(env) {
  if (neural) return neural;
  const rows = (await env.DB.prepare('SELECT k,v FROM model_meta').all()).results;
  const m = Object.fromEntries(rows.map((r) => [r.k, r.v]));
  if (!m.weights) return null;
  return (neural = { classes: JSON.parse(m.classes), W: JSON.parse(m.weights), scale: +m.scale, temp: +m.temperature });
}
""",1)
route = r'''    // Neural identification: the browser sends one 192-d embedding per 3 s window; we score them against the stored class weights.
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

'''
marker="    if (url.pathname === '/api/feedback' && req.method === 'POST') {"
assert marker in s
s=s.replace(marker, route+marker,1)
open(p,'w',encoding='utf8').write(s)

# ---------------- page
p='public/index.html'; h=open(p,encoding='utf8').read()
h=h.replace("import { voiceprints, SR } from './voiceprint.js';","import { voiceprints, SR } from './voiceprint.js';\nimport { embed } from './embed.js';",1)
a=h.index("async function identify(pcm) {"); b=h.index("  st.textContent = '';\n  askFeedback(d.results, vectors);")
new="""async function identify(pcm) {
  st.textContent = 'جارٍ تحليل الصوت…';
  let d, r, vectors;
  try {                                                  // neural model (runs in the browser), scored on the server
    const embs = await embed(pcm);
    if (embs.length) { r = await fetch('/api/identify2', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ emb: embs }) }); if (r.ok) { d = await r.json(); vectors = embs; } }
  } catch (e) { console.warn('neural model unavailable, using fallback', e); }
  if (!d) {                                              // fallback: the earlier statistical method
    vectors = voiceprints(pcm, 5);
    if (!vectors.length) { st.textContent = 'لم يُسمع كلام كافٍ. حاول مرة أخرى وأنت أقرب إلى مصدر الصوت.'; return; }
    try { r = await fetch('/api/identify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ vectors }) }); d = await r.json(); }
    catch { st.textContent = 'تعذّر الاتصال بالخادم.'; return; }
    if (!r.ok) { st.textContent = 'حدث خطأ أثناء التحليل.'; return; }
  }
"""
h=h[:a]+new+h[b:]
open(p,'w',encoding='utf8').write(h)
m=re.search(r'<script type="module">([\s\S]*?)</script>',h).group(1)
open('tmp_check.mjs','w',encoding='utf8').write(re.sub(r'^import .*$','',m,flags=re.M))
print('ok')
