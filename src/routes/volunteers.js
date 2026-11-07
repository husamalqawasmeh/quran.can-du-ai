import { EmailMessage } from 'cloudflare:email';
import { json, googleEmail, adminsOf, trustedOf, isAdmin } from '../lib.js';

// a new validation volunteer (#drv page), mailed to the site owner through the EMAIL (send_email) binding
const b64 = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
function volunteerMail(name, phone, email, note) {
  const from = 'noreply@can-du-ai.com', to = 'husamalqawasmeh@gmail.com';
  const body = `متطوع جديد للتحقق من محتوى quran.can-du-ai.com\n\nالاسم: ${name}\nالجوال: ${phone}\nالبريد: ${email}\n${note ? `ملاحظة: ${note}\n` : ''}`;
  const raw = [`From: Quran.can-du-ai <${from}>`, `To: ${to}`, `Reply-To: ${email}`, `Subject: =?UTF-8?B?${b64('متطوع جديد للتحقق: ' + name)}?=`,
    `Message-ID: <${crypto.randomUUID()}@can-du-ai.com>`, `Date: ${new Date().toUTCString()}`, 'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', b64(body).replace(/.{76}/g, '$&\r\n')].join('\r\n');
  return new EmailMessage(from, to, raw);
}

// Volunteers: the page settings, trusted volunteers, verdicts on the names of Allah (#validate) and volunteer sign-up (#drv).
// Returns the response for a path this file handles, or null.
export async function handle(req, env, url) {
  // the page's public settings: the Google client id for «Sign in with Google» (empty until it is set up)
  if (url.pathname === '/api/config') return json({ googleClientId: env.GOOGLE_CLIENT_ID || '' });

  // trusted volunteers: only an admin may list, add or remove them
  if (url.pathname === '/api/trusted') {
    const b = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const email = b.idToken ? await googleEmail(env, b.idToken) : null;
    if (!isAdmin(req, env) && !(email && adminsOf(env).includes(email))) return json({ error: 'admin only' }, 401);
    const T = await trustedOf(env);
    if (req.method === 'POST') {
      const who = typeof b.who === 'string' ? b.who.replace(/[\x00-\x1f<>]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 60) : '';
      if (who.length < 2) return json({ error: 'bad input' }, 400);
      if (b.remove) await env.DB.prepare('DELETE FROM trusted WHERE who = ?').bind(who).run();
      else await env.DB.prepare('INSERT OR IGNORE INTO trusted(who, added_by) VALUES(?, ?)').bind(who, email || 'admin').run();
    }
    const rows = (await env.DB.prepare('SELECT who, added_by, created FROM trusted ORDER BY created').all()).results;
    return json({ trusted: rows, admins: adminsOf(env).length });
  }

  // volunteers' judgements on things a person must check (#validate): one row per item, reference and volunteer; a new answer replaces the old
  if (url.pathname === '/api/validate') {
    const item = url.searchParams.get('item') || '';
    if (item !== 'names') return json({ error: 'bad item' }, 400);
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS validations(item TEXT, ref TEXT, who TEXT, verdict TEXT, created TEXT DEFAULT CURRENT_TIMESTAMP, verified INTEGER DEFAULT 0, PRIMARY KEY(item, ref, who))').run();
    if (req.method === 'POST') {
      const b = await req.json().catch(() => ({}));
      let who = typeof b.who === 'string' ? b.who.replace(/[\x00-\x1f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) : '', verified = 0;
      if (typeof b.ref !== 'string' || !/^[ء-ي ]{2,30}\|\d{1,3}:\d{1,3}$/.test(b.ref) || !['allah', 'other', 'unsure', ''].includes(b.verdict)) return json({ error: 'bad input' }, 400);
      if (env.GOOGLE_CLIENT_ID && /@gmail\.com$/i.test(who)) {   // a Gmail name must be proven by signing in with Google
        const email = await googleEmail(env, b.idToken);
        if (!email || email !== who.toLowerCase()) return json({ error: 'login' }, 401);
        who = email; verified = 1;
      }
      if (who.length < 2) return json({ error: 'bad input' }, 400);
      const me = who.toLowerCase(); if (!adminsOf(env).includes(me) && !(await trustedOf(env)).has(me)) return json({ error: 'not trusted' }, 403);
      if (b.verdict) await env.DB.prepare('INSERT INTO validations(item, ref, who, verdict, verified) VALUES(?,?,?,?,?) ON CONFLICT(item, ref, who) DO UPDATE SET verdict = excluded.verdict, verified = excluded.verified, created = CURRENT_TIMESTAMP').bind(item, b.ref, who, b.verdict, verified).run();
      else await env.DB.prepare('DELETE FROM validations WHERE item = ? AND ref = ? AND who = ?').bind(item, b.ref, who).run();   // the volunteer took the answer back
      return json({ ok: true });
    }
    const rows = (await env.DB.prepare('SELECT ref, verdict, COUNT(*) AS n FROM validations WHERE item = ? GROUP BY ref, verdict').bind(item).all()).results;
    const tally = {}; for (const r of rows) (tally[r.ref] ||= {})[r.verdict] = r.n;
    const who = url.searchParams.get('who'), mine = {};
    if (who) for (const r of (await env.DB.prepare('SELECT ref, verdict FROM validations WHERE item = ? AND who = ?').bind(item, who.slice(0, 60)).all()).results) mine[r.ref] = r.verdict;
    // trusted reviewers (secret REVIEWERS: comma-separated volunteer names): their «allah» / «other» settles a verse alone
    const REV = (env.REVIEWERS || '').split(',').map((x) => x.trim()).filter(Boolean), rev = {};
    if (REV.length) for (const r of (await env.DB.prepare(`SELECT ref, verdict FROM validations WHERE item = ? AND verdict IN ('allah', 'other') AND who IN (${REV.map(() => '?').join(',')})${env.GOOGLE_CLIENT_ID ? ' AND verified = 1' : ''}`).bind(item, ...REV).all()).results) rev[r.ref] = r.verdict;   // once Google sign-in is on, only signed-in answers are trusted
    const wl = (who || '').trim().toLowerCase(), trusted = !!wl && (adminsOf(env).includes(wl) || (await trustedOf(env)).has(wl));
    return json({ tally, mine, rev, trusted });
  }

  // validation volunteers: kept in D1 (so nothing is lost if mail fails) and emailed to the owner
  if (url.pathname === '/api/volunteer' && req.method === 'POST') {
    const b = await req.json().catch(() => ({}));
    if (b.website) return json({ ok: true });                       // honeypot: only bots fill the hidden field
    const clean = (s, n) => (typeof s === 'string' ? s.replace(/[\x00-\x1f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n) : '');
    const name = clean(b.name, 80), phone = clean(b.phone, 30), email = clean(b.email, 120), note = clean(b.note, 500);
    if (name.length < 2 || !/^\+?[\d\s()-]{7,}$/.test(phone) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'bad input' }, 400);
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS volunteers(id INTEGER PRIMARY KEY, name TEXT, phone TEXT, email TEXT, note TEXT, created TEXT DEFAULT CURRENT_TIMESTAMP)').run();
    await env.DB.prepare('INSERT INTO volunteers(name,phone,email,note) VALUES(?,?,?,?)').bind(name, phone, email, note).run();
    let mailed = false;
    if (env.EMAIL) try { await env.EMAIL.send(volunteerMail(name, phone, email, note)); mailed = true; } catch (e) { console.log('volunteer mail failed:', e.message); }
    return json({ ok: true, mailed });
  }
  return null;
}
