// Computes linguistic statistics of the Quran text (Quran.com, "imlaei simple" orthography) -> public/stats.json
import { writeFileSync } from 'node:fs';
const get = async (u) => { for (let i = 0; i < 4; i++) { try { const r = await fetch(u); if (r.ok) return r.json(); } catch {} await new Promise((r) => setTimeout(r, 800)); } throw new Error('fetch failed ' + u); };
const chapters = (await get('https://api.quran.com/api/v4/chapters?language=en')).chapters;
const clean = (t) => t.replace(/[\u064B-\u065F\u0670\u0640\u06D6-\u06ED]/g, '').replace(/\s+/g, ' ').trim();
const isLetter = (c) => /[\u0621-\u064A]/.test(c);
const wordFreq = new Map(), letterFreq = new Map(), lenDist = {}, surahs = [], verses = [];
let words = 0, letters = 0;
for (const ch of chapters) {
  const vs = (await get(`https://api.quran.com/api/v4/verses/by_chapter/${ch.id}?fields=text_imlaei_simple&per_page=300`)).verses;
  if (vs.length !== ch.verses_count) throw new Error('verse count mismatch in ' + ch.id);
  let sw = 0, sl = 0;
  for (const v of vs) {
    const ws = clean(v.text_imlaei_simple).split(' ').filter((w) => [...w].some(isLetter));
    sw += ws.length;
    verses.push({ key: v.verse_key, words: ws.length, text: ws.join(' ') });
    for (const w of ws) {
      wordFreq.set(w, (wordFreq.get(w) || 0) + 1);
      const chars = [...w].filter(isLetter); sl += chars.length;
      const L = Math.min(chars.length, 10); lenDist[L] = (lenDist[L] || 0) + 1;
      for (let c of chars) { c = c === 'ى' ? 'ي' : (c === 'ؤ' || c === 'ئ') ? 'ء' : c; letterFreq.set(c, (letterFreq.get(c) || 0) + 1); }
    }
  }
  words += sw; letters += sl;
  surahs.push({ id: ch.id, ar: ch.name_arabic, en: ch.name_simple, place: ch.revelation_place, verses: vs.length, words: sw, letters: sl });
  process.stdout.write(ch.id + ' ');
}
const byPlace = {};
for (const s of surahs) { const p = (byPlace[s.place] ||= { surahs: 0, verses: 0, words: 0, letters: 0 }); p.surahs++; p.verses += s.verses; p.words += s.words; p.letters += s.letters; }
const top = [...wordFreq].sort((a, b) => b[1] - a[1]);
const longest = verses.reduce((a, b) => (b.words > a.words ? b : a)), shortest = verses.reduce((a, b) => (b.words < a.words ? b : a));
const out = {
  source: 'Quran.com API (text_imlaei_simple)', generated: new Date().toISOString().slice(0, 10),
  totals: { surahs: surahs.length, verses: verses.length, words, letters, uniqueWords: wordFreq.size, hapax: top.filter((x) => x[1] === 1).length,
            wordsPerVerse: +(words / verses.length).toFixed(2), lettersPerWord: +(letters / words).toFixed(2) },
  topWords: top.slice(0, 30).map(([w, n]) => ({ w, n })),
  letters: [...letterFreq].sort((a, b) => b[1] - a[1]).map(([l, n]) => ({ l, n })),
  wordLength: Object.entries(lenDist).map(([k, n]) => ({ len: +k, n })).sort((a, b) => a.len - b.len),
  longestVerse: { key: longest.key, words: longest.words, text: longest.text }, shortestVerse: { key: shortest.key, words: shortest.words, text: shortest.text },
  byPlace, surahs,
};
writeFileSync('public/stats.json', JSON.stringify(out));
console.log('\n', JSON.stringify(out.totals), '\n top5', out.topWords.slice(0, 5).map((x) => x.w + ':' + x.n).join(' '), '\n place', JSON.stringify(byPlace), '\n longest', longest.key, longest.words, 'shortest', shortest.key, shortest.words);
