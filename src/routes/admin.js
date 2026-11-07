import { discover } from '../discover.js';
import { json, isAdmin } from '../lib.js';

// Admin: review what the weekly agent found (needs the private token).
// Returns the response for a path this file handles, or null.
export async function handle(req, env, url, ctx) {
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
  return null;
}
