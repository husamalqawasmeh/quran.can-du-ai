import sys, re
sys.stdout.reconfigure(encoding='utf-8')
p='src/worker.js'; b=open(p,'rb').read().decode('utf8')
nl='\r\n' if '\r\n' in b else '\n'
def sub(old,new):
    global b
    old=old.replace('\n',nl); new=new.replace('\n',nl)
    assert old in b, old[:60]; b=b.replace(old,new,1)
sub("import { advise } from './advisor.js';","import { advise } from './advisor.js';\nimport { discover } from './discover.js';")
sub("export default {\n  async fetch(req, env) {","""const safeEq = (a, b) => { if (!a || !b || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
const isAdmin = (req, env) => safeEq((req.headers.get('authorization') || '').replace(/^Bearer /, ''), env.ADMIN_TOKEN || '');

export default {
  // Every Friday 06:00 UTC (10:00 Dubai): the research agent looks for new miracle items and saves them as PENDING.
  async scheduled(event, env, ctx) { ctx.waitUntil(discover(env).catch(() => null)); },

  async fetch(req, env, ctx) {""")
route = """    // ---- approved miracle items discovered by the weekly agent (public) ----
    if (url.pathname === '/api/miracles-extra') {
      const rows = (await env.DB.prepare("SELECT id,g,title,note,keys FROM miracle_candidates WHERE status='approved' ORDER BY id").all()).results;
      return json(rows.map((r) => ({ id: r.id, g: r.g, t: r.title, note: r.note, keys: JSON.parse(r.keys || '[]') })));
    }
    // ---- admin: review what the weekly agent found (needs the private token) ----
    if (url.pathname.startsWith('/api/admin/')) {
      if (!isAdmin(req, env)) return json({ error: 'unauthorized' }, 401);
      if (url.pathname === '/api/admin/candidates') {
        const st = ['pending', 'approved', 'rejected'].includes(url.searchParams.get('status')) ? url.searchParams.get('status') : 'pending';
        const rows = (await env.DB.prepare('SELECT id,created_at,week,title,g,note,keys,model,score,issues,status FROM miracle_candidates WHERE status=? ORDER BY score DESC, id DESC LIMIT 100').bind(st).all()).results;
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
        ctx.waitUntil(discover(env).catch(() => null));
        return json({ started: true });
      }
      return json({ error: 'not found' }, 404);
    }

"""
marker="    // Live advisor: every ~3 s the page sends"
sub(marker, route+marker)
open(p,'wb').write(b.encode('utf8'))
# cron trigger
p='wrangler.jsonc'; s=open(p,encoding='utf8').read()
if '"triggers"' not in s:
    s=s.replace('"routes": [','"triggers": { "crons": ["0 6 * * 5"] },\n  "routes": [',1)
open(p,'w',encoding='utf8').write(s)
print('ok')
