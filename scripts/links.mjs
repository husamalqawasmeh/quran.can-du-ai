// Builds links.sql: verified reading/listening links per reciter. Every audio URL is checked with a live request.
import { readFileSync, writeFileSync } from 'node:fs';

const RANKED = [123,51,54,31,112,118,125,102,30,92,76,89,4,5,121,70,60,21,56,43,107,205,74,135,66,67,69,46,202,217,254,178,59,100,
  255,257,259,267,271,273,285,302,301,304,77,86,81,152,163,160,161,164,181,197,198,203,17,32,1,2,3,20,219,221,226,236,243,244,
  245,248,251,252,256,24,33,36,39,64,47,253,277,278,109,111,106,201,165,40,42,290,300,62,44,286,260,265,159,108,55,10];
// ids used by the first 11-reciter model, so links work for both generations of the database
const OLD = { alafasy: 123, abdulbasit: 51, sudais: 54, shuraim: 31, minshawi: 112, husary: 118, mustafaismail: 125, muaiqly: 102, ghamdi: 30, dosari: 92, aljaber: 76 };
// everyayah.com folders (verse-by-verse), by mp3quran id; verified below
const EVERYAYAH = { 123:'Alafasy_128kbps',51:'Abdul_Basit_Murattal_192kbps',54:'Abdurrahmaan_As-Sudais_192kbps',31:'Saood_ash-Shuraym_128kbps',
  112:'Minshawy_Murattal_128kbps',118:'Husary_128kbps',125:'Mustafa_Ismail_48kbps',102:'Maher_AlMuaiqly_64kbps',30:'Ghamadi_40kbps',
  92:'Yasser_Ad-Dussary_128kbps',76:'Ali_Jaber_64kbps',89:'Hani_Rifai_192kbps',4:'Abu_Bakr_Ash-Shaatree_128kbps',5:'ahmed_ibn_ali_al_ajamy_128kbps',
  60:'Abdullah_Basfar_192kbps',74:'Hudhaify_128kbps',106:'Mohammad_al_Tablaway_128kbps',109:'Muhammad_Ayyoub_128kbps',111:'Muhammad_Jibreel_128kbps',
  1:'Ibrahim_Akhdar_64kbps',43:'Salah_Al_Budair_128kbps',46:'Salaah_AbdulRahman_Bukhatir_128kbps',59:'Abdullah_Matroud_128kbps',
  86:'Nasser_Alqatami_128kbps',77:'Ali_Hajjaj_AlSuesy_128kbps',152:'Yaser_Salamah_128kbps',32:'Sahl_Yassin_128kbps',81:'Fares_Abbad_64kbps',
  24:'khalefa_al_tunaiji_64kbps',121:'mahmoud_ali_al_banna_32kbps',21:'Khaalid_Abdullaah_al-Qahtaanee_192kbps',
  62:'Abdullaah_3awwaad_Al-Juhaynee_128kbps',10:'Akram_AlAlaqimy_128kbps' };

const en = Object.fromEntries(JSON.parse(readFileSync('mp3q.json', 'utf8')).reciters.map((r) => [r.id, r]));
const ar = Object.fromEntries(JSON.parse(readFileSync('mp3q_ar.json', 'utf8')).reciters.map((r) => [r.id, r.name]));
const ok = async (u) => { try { return (await fetch(u, { method: 'HEAD', redirect: 'follow' })).ok; } catch { return false; } };
async function pool(items, n, fn) { let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]); })); }

const links = {}; // mp3quran id -> [{kind,label,url}]
await pool(RANKED, 8, async (id) => {
  const r = en[id], L = (links[id] = []);
  const m = r.moshaf.find((x) => /Hafs/i.test(x.name) && x.surah_total >= 100);
  const file = m.server + '001.mp3';
  if (await ok(file)) L.push({ kind: 'audio', label: 'تلاوة المصحف كاملاً (mp3quran.net) — الفاتحة', url: file });
  if (EVERYAYAH[id]) {
    const u = `https://everyayah.com/data/${EVERYAYAH[id]}/001001.mp3`;
    if (await ok(u)) L.push({ kind: 'audio', label: 'آية بآية (everyayah.com)', url: `https://everyayah.com/data/${EVERYAYAH[id]}/` });
  }
  const name = r.name.replace(/\s+/g, ' ').trim();
  L.push({ kind: 'video', label: 'بحث في يوتيوب (بالإنجليزية)', url: 'https://www.youtube.com/results?search_query=' + encodeURIComponent(name + ' Quran recitation') });
  L.push({ kind: 'video', label: 'بحث في يوتيوب (بالعربية)', url: 'https://www.youtube.com/results?search_query=' + encodeURIComponent(ar[id] + ' تلاوة') });
  L.push({ kind: 'music', label: 'بحث في سبوتيفاي', url: 'https://open.spotify.com/search/' + encodeURIComponent(name + ' Quran') });
});

const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
let sql = 'DELETE FROM reciter_links;\n', n = 0, dead = 0;
const emit = (rid, id) => { for (const l of links[id]) { sql += `INSERT INTO reciter_links(reciter_id,kind,label,url) VALUES(${q(rid)},${q(l.kind)},${q(l.label)},${q(l.url)});\n`; n++; } };
for (const id of RANKED) { emit('r' + id, id); if (!links[id].some((l) => l.kind === 'audio')) dead++; }
for (const [old, id] of Object.entries(OLD)) emit(old, id);
writeFileSync('links.sql', sql);
console.log('links:', n, '| reciters with no verified audio link:', dead);
