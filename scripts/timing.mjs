// builds public/timing.json: reciter id -> mp3quran "ayat_timing" read id (only readers whose audio folder has verse timings)
import { readFileSync, writeFileSync } from 'node:fs';
const reads = JSON.parse(readFileSync('reads.json', 'utf8'));
const en = JSON.parse(readFileSync('mp3q.json', 'utf8')).reciters;
const IDS = JSON.parse(readFileSync('ranked.json', 'utf8'));
const norm = (u) => u.replace(/\/+$/, '').toLowerCase();
const byFolder = new Map(reads.map((r) => [norm(r.folder_url), r]));
const map = {};
for (const id of IDS) for (const m of en.find((x) => x.id === id).moshaf.filter((m) => /Hafs/i.test(m.name) && m.surah_total >= 100)) {
  const x = byFolder.get(norm(m.server)); if (x) { map['r' + id] = { read: x.id, soar: x.soar_count }; break; }
}
writeFileSync('public/timing.json', JSON.stringify(map)); console.log(Object.keys(map).length, 'readers with timing');
