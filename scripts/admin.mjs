// usage: node scripts/admin.mjs run | list [pending|approved|rejected]
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync('.env','utf8').split(/\r?\n/).filter(l=>l&&!l.startsWith('#')&&l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1)]));
const H = { authorization: 'Bearer ' + env.ADMIN_TOKEN, 'content-type': 'application/json' };
const base = 'https://quran.can-du-ai.com';
if (process.argv[2] === 'run') { const r = await fetch(base + '/api/admin/run' + (process.argv[3] === 'wait' ? '?wait=1' : ''), { method: 'POST', headers: H }); console.log(r.status, await r.text()); }
else { const r = await fetch(base + '/api/admin/candidates?status=' + (process.argv[3] || 'pending'), { headers: H }); const j = await r.json(); console.log(r.status, Array.isArray(j) ? j.length + ' candidates' : JSON.stringify(j));
  for (const c of Array.isArray(j) ? j : []) console.log(`#${c.id} [g${c.g}] score ${c.score} (${c.model}) ${c.title}  keys:${c.keys.join(',')}\n    ${c.note.slice(0,150).replace(/\s+/g,' ')}…\n    issues: ${c.issues}`); }
