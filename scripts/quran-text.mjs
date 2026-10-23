// downloads the whole Quran (standard spelling, no diacritics) once, for auditing -> quran_text.json
import { writeFileSync } from 'node:fs';
const get = async (u) => { for (let i = 0; i < 4; i++) { try { const r = await fetch(u); if (r.ok) return r.json(); } catch {} await new Promise((r) => setTimeout(r, 700)); } throw new Error(u); };
const out = {};
const ids = Array.from({ length: 114 }, (_, i) => i + 1);
let next = 0;
await Promise.all(Array.from({ length: 6 }, async () => { while (next < ids.length) { const id = ids[next++]; const j = await get(`https://api.quran.com/api/v4/verses/by_chapter/${id}?fields=text_imlaei_simple&per_page=300`); for (const v of j.verses) out[v.verse_key] = v.text_imlaei_simple; } }));
writeFileSync('quran_text.json', JSON.stringify(out));
console.log('verses:', Object.keys(out).length);
