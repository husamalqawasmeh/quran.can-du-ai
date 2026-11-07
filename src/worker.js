import { discover } from './discover.js';
import { useDb } from './verse.js';
import * as reciters from './routes/reciters.js';
import * as volunteers from './routes/volunteers.js';
import * as speech from './routes/speech.js';
import * as content from './routes/content.js';
import * as admin from './routes/admin.js';

const ROUTES = [reciters, volunteers, content, speech, admin];   // each answers its own /api/ paths, or returns null

export default {
  // Every Friday 06:00 UTC (10:00 Dubai): the research agent looks for new miracle items and saves them as PENDING.
  async scheduled(event, env, ctx) { useDb(env.DB); ctx.waitUntil(discover(env).catch(() => null)); },

  async fetch(req, env, ctx) {
    useDb(env.DB);
    const url = new URL(req.url);
    // The site moved from qreaders.can-du-ai.com to quran.can-du-ai.com; keep old links working.
    if (url.hostname === 'qreaders.can-du-ai.com') return Response.redirect('https://quran.can-du-ai.com' + url.pathname + url.search, 308);

    for (const r of ROUTES) { const res = await r.handle(req, env, url, ctx); if (res) return res; }

    const res = await env.ASSETS.fetch(req);
    if (!(res.headers.get('content-type') || '').includes('text/html')) return res;
    const out = new Response(res.body, res);
    out.headers.set('cache-control', 'no-cache');
    return out;
  },
};
