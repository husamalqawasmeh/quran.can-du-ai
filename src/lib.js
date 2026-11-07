// Helpers shared by the route files (src/routes/*.js).

/** The Gmail address a Google sign-in token belongs to, checked by Google; null if the token is missing, expired or for another site. */
export async function googleEmail(env, token) {
  if (!env.GOOGLE_CLIENT_ID || typeof token !== 'string' || token.length > 4096) return null;
  const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token)).catch(() => null);
  if (!r || !r.ok) return null;
  const t = await r.json().catch(() => ({}));
  const ok = t.aud === env.GOOGLE_CLIENT_ID && String(t.email_verified) === 'true' && /@gmail\.com$/i.test(t.email || '') && +t.exp * 1000 > Date.now();
  return ok ? t.email.toLowerCase() : null;
}
const listOf = (v) => (v || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
export const adminsOf = (env) => listOf(env.ADMINS || env.REVIEWERS);
export async function trustedOf(env) {   // volunteers an admin has entrusted with judging (#validate)
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS trusted(who TEXT PRIMARY KEY, added_by TEXT, created TEXT DEFAULT CURRENT_TIMESTAMP)').run();
  return new Set((await env.DB.prepare('SELECT who FROM trusted').all()).results.map((r) => r.who.toLowerCase()));
}
export const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } });
let cache, neural;
// neural model head: class weights (unit vectors), logit scale and calibration temperature, all stored in D1
export async function loadNeural(env) {
  if (neural) return neural;
  const rows = (await env.DB.prepare('SELECT k,v FROM model_meta').all()).results;
  const m = Object.fromEntries(rows.map((r) => [r.k, r.v]));
  if (!m.classes) return null;
  const classes = JSON.parse(m.classes);
  if (classes.some((c) => !m['w:' + c])) return null;               // incomplete upload: fall back to the older method
  return (neural = { classes, W: classes.map((c) => JSON.parse(m['w:' + c])), scale: +m.scale, temp: +m.temperature });
}
export async function load(env) {
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
export async function limited(env, req, kind, max, ipOverride) {
  const ip = ipOverride || req.headers.get('cf-connecting-ip') || 'unknown';
  const bucket = kind + ':' + new Date().toISOString().slice(0, 13);
  await env.DB.prepare('DELETE FROM rate WHERE bucket NOT LIKE ?').bind('%:' + new Date().toISOString().slice(0, 10) + '%').run();
  const row = await env.DB.prepare('INSERT INTO rate(ip,bucket,n) VALUES(?,?,1) ON CONFLICT(ip,bucket) DO UPDATE SET n=n+1 RETURNING n').bind(ip, bucket).first();
  return row.n > max;
}

export const SYS = 'أنت مساعد دقيق في موقع للتعرّف على قرّاء القرآن الكريم. اكتب دائماً بالعربية الفصحى المبسطة. ' +
  'اعتمد فقط على المعلومات الموثوقة والمشهورة عن القرّاء وعن التلاوة. إذا لم تكن متأكداً من معلومة فاحذفها أو قل إنك لست متأكداً، ولا تخترع معلومات سيرة. نصّ عادي بلا تنسيق.';

const safeEq = (a, b) => { if (!a || !b || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
export const isAdmin = (req, env) => safeEq((req.headers.get('authorization') || '').replace(/^Bearer /, ''), env.ADMIN_TOKEN || '');
