// usage: node scripts/name-counts.mjs <quran-morphology.txt>
// How many times does each name's WORD occur in the Quran text? (counts tokens; also verses). -> public/names_counts.json
import { readFileSync, writeFileSync } from 'node:fs';
const html = readFileSync('public/index.html', 'utf8');
const start = html.indexOf('TOPICS.names = {'), seg = html.slice(start, html.indexOf('\n};', start));
const names = [...seg.matchAll(/\{ g: (\d+), t: "([^"]+)", note: "[^"]*", keys: \['([^']+)'\] \}/g)].map((m) => m[2]);
const Q = JSON.parse(readFileSync('quran_text.json', 'utf8'));
// skeleton: no diacritics, alef variants merged, hamza letters dropped. Alef-maqsura (ى) is KEPT, so «على» is not confused with «علي».
const cmp = (s) => s.replace(/[\u064B-\u065F\u0670\u0640\u06D6-\u06ED]/g, '').replace(/[إأآٱ]/g, 'ا').replace(/[ءؤئ]/g, '').replace(/\s+/g, ' ').trim();
const verses = Object.entries(Q).map(([k, t]) => [k, cmp(t).split(' ')]);
// names whose hamza must stay: without it «المؤمن» becomes «ممن» (مِمَّن, from whom), a different word
const KEEP_HAMZA = new Set(['المؤمن']);
const cmpH = (s) => s.replace(/[ً-ٰٟـۖ-ۭ]/g, '').replace(/[إأآٱ]/g, 'ا').replace(/\s+/g, ' ').trim();
const versesH = Object.entries(Q).map(([k, t]) => [k, cmpH(t).split(' ')]);
const textOf = (name) => (KEEP_HAMZA.has(name) ? versesH : verses), partOf = (name) => (KEEP_HAMZA.has(name) ? cmpH : cmp)(name);
const strip = (w) => w.replace(/^ال/, '');
function same(token, part) {
  const cands = [token]; if (/^[وفبلك]/.test(token)) cands.push(token.slice(1));
  if (/^[وف]?لل/.test(token)) cands.push('ال' + token.replace(/^[وف]?لل/, ''));        // «للرحمن» = ل + الرحمن (the article's alef drops)
  for (const c of cands) for (const base of [c, strip(c)]) if (base === part || base === part + 'ا') return true;
  return false;
}
const SPECIAL = { 'الله': new Set(['لله', 'تالله']) };       // «لله» = ل + الله, «تالله» = oath
function countIn(tokens, name) {
  if (name === 'الله') return tokens.filter((t) => /^[وفا]?[بكت]?الله$|^[وفا]?لله$/.test(t)).length;   // not «له» (for him): once the article is dropped, «الله» would collide with it
  const parts = partOf(name).split(' ').map(strip); let n = 0;
  for (let i = 0; i + parts.length <= tokens.length; i++) {
    if (parts.every((p, j) => same(tokens[i + j], p))) { n++; i += parts.length - 1; }
    else if (parts.length === 1 && SPECIAL[name]?.has(tokens[i])) n++;
  }
  return n;
}
// names whose bare letters also spell other words: counted by their word in the morphology instead of by spelling
// («ملك» is also مُلْك ownership and مَلَك angel; only مَلِك, king, can be the name)
const BY_LEMMA = { 'الملك': 'مَلِك' };
const lemmaVerses = {};
if (process.argv[2]) for (const line of readFileSync(process.argv[2], 'utf8').split('\n')) {
  const p = line.trim().split('\t'); if (p.length < 4) continue;
  const lem = (/LEM:([^|]+)/.exec(p[3]) || [])[1]; if (!lem) continue;
  for (const [n, l] of Object.entries(BY_LEMMA)) if (lem.normalize('NFD') === l.normalize('NFD')) { const k = p[0].split(':').slice(0, 2).join(':'); (lemmaVerses[n] ||= {})[k] = (lemmaVerses[n][k] || 0) + 1; }
} else throw new Error('usage: node scripts/name-counts.mjs <quran-morphology.txt>   (github.com/mustafa0x/quran-morphology)');
const occOf = (name) => (BY_LEMMA[name] ? Object.entries(lemmaVerses[name] || {}) : textOf(name).map(([k, t]) => [k, countIn(t, name)]).filter(([, c]) => c));
const out = {};
for (const name of names) { const o = occOf(name); out[name] = { n: o.reduce((a, [, c]) => a + c, 0), v: o.length }; }
writeFileSync('public/names_counts.json', JSON.stringify(out));
// names that also come in the Quran for other than Allah (marked ⚠︎): every verse where each comes, for the volunteers to judge (#validate)
const amb = /const AMBIGUOUS = new Set\(\[([^\]]*)\]\)/.exec(html)[1].match(/'([^']+)'/g).map((x) => x.slice(1, -1));
const occ = {};
for (const name of amb.filter((n) => names.includes(n))) occ[name] = occOf(name);

/* Rule (the site owner's): a name that comes right after «الله», or right after another name already counted for Allah
   (as in «وكان الله عزيزا حكيما»), is a name of Allah. «هو» between them is allowed («إن الله هو الغفور الرحيم»).
   Not after «عند الله» («كان عند الله عظيما»: the deed is great, not a name). A verse is settled by the rule only when
   every coming of the name in it follows the rule; volunteers and reviewers can still overrule it. */
const isAllah = (t) => /^[وفا]?[بكت]?الله$|^[وفا]?لله$/.test(t);
const single = names.filter((n) => !n.includes(' ') && n !== 'الله').map((n) => [n, strip(cmp(n))]);
// «الله» starts a sentence (so the next word can describe Him) when it has a joined letter (والله، فالله، بالله، لله) or comes
// after one of these words; not when it closes a phrase like «وعد الله حقا», «نصر الله قريب», «من دون الله وليا»
const OPENERS = new Set(['ان', 'وان', 'فان', 'لان', 'ولكن', 'لكن', 'كان', 'وكان', 'فكان', 'قل', 'قال', 'ثم', 'اذ', 'هو', 'وهو', 'انه', 'ذلك', 'ذلكم', 'الا', 'اما', 'اليس', 'ليس', 'لعل', 'اذا', 'لو', 'ولو', 'ما', 'لا', 'ولا']);
const trigger = (tokens, i) => isAllah(tokens[i]) && (tokens[i] !== 'الله' || i === 0 || OPENERS.has(tokens[i - 1]));
function confirmedIn(tokens) {   // indices of tokens that are names counted for Allah in this verse, by the rule
  const ok = new Set(tokens.map((t, i) => (trigger(tokens, i) ? i : -1)).filter((i) => i >= 0));
  for (let i = 1; i < tokens.length; i++) {
    if (ok.has(i)) continue;
    const isName = single.find(([n, p]) => same(tokens[i], p)); if (!isName) continue;
    let j = i - 1; if (tokens[j] === 'هو' && j > 0) j--;
    if (!ok.has(j)) continue;
    if (isAllah(tokens[j]) && tokens[j - 1] === 'عند') continue;
    ok.add(i);
  }
  return ok;
}
const AMB = new Set(amb);
let ruled = 0;
for (const name of Object.keys(occ)) {
  if (BY_LEMMA[name]) continue;   // counted from the morphology: no word positions to test
  const p = strip(partOf(name));
  occ[name] = occ[name].map(([k, c]) => {
    const t = textOf(name).find(([vk]) => vk === k)[1], ok = confirmedIn(t);
    const at = t.map((w, i) => (same(w, p) ? i : -1)).filter((i) => i >= 0);
    if (at.length === c && at.every((i) => ok.has(i))) { ruled++; return [k, c, 1]; }   // 1: settled «a name of Allah» by the rule
    return [k, c];
  });
}
console.log('verses settled by the rule:', ruled);
for (const [n, list] of Object.entries(occ)) if (list.reduce((a, [, c]) => a + c, 0) !== out[n].n) throw new Error('occurrences do not add up: ' + n);
writeFileSync('public/names_occ.json', JSON.stringify(occ));
console.log('names to judge:', Object.keys(occ).length, 'verses:', Object.values(occ).reduce((a, l) => a + l.length, 0));
const top = Object.entries(out).sort((a, b) => b[1].n - a[1].n);
console.log('names:', names.length);
console.log('top 12:', top.slice(0, 12).map(([n, c]) => `${n}:${c.n}`).join('  '));
console.log('least 12:', top.slice(-12).map(([n, c]) => `${n}:${c.n}`).join('  '));
console.log('spot checks:', ['الرحمن', 'الرحيم', 'الغفور', 'العليم', 'الحكيم', 'العزيز', 'السميع', 'القدير'].map((n) => `${n}:${out[n]?.n}/${out[n]?.v}v`).join('  '));

/* Names of Allah that come together, one right after the other («عليم حكيم»، «غفور رحيم»، «الرحمن الرحيم»): each ordered pair
   with how many times it comes, in total and in each surah, with the verses -> public/names_pairs.json (#stats). Single-word names only; a pair can
   describe someone else now and then (9:128 «رءوف رحيم» describes the Prophet ﷺ). */
const oneWord = names.filter((n) => !n.includes(' ')).map((n) => [n, strip(partOf(n)), KEEP_HAMZA.has(n)]);
const nameAt = (tok, tokH) => (isAllah(tok) ? 'الله' : (oneWord.find(([n, p, h]) => n !== 'الله' && same(h ? tokH : tok, p)) || [])[0]);
const pairs = new Map();
verses.forEach(([k, t], vi) => {
  const tH = versesH[vi][1]; if (tH.length !== t.length) return;   // hamza kept or not, the words line up
  for (let i = 1; i < t.length; i++) {
    const a = nameAt(t[i - 1], tH[i - 1]), b = nameAt(t[i], tH[i]); if (!a || !b || a === 'الله' || b === 'الله' || a === b) continue;
    const key = a + ' ' + b, e = pairs.get(key) || pairs.set(key, { n: 0, s: {} }).get(key), [su, ay] = k.split(':').map(Number), x = (e.s[su] ||= [0, []]); e.n++; x[0]++; if (!x[1].includes(ay)) x[1].push(ay);
  }
});
const pairList = [...pairs].sort((x, y) => y[1].n - x[1].n).map(([p, e]) => [p, e.n, Object.entries(e.s).map(([su, [c, ay]]) => [+su, c, ay.sort((a, b) => a - b)]).sort((x, y) => x[0] - y[0])]);   // [surah, times in it, its verses], in mushaf order
for (const [p, n, ss] of pairList) if (ss.reduce((a, [, c]) => a + c, 0) !== n) throw new Error('pair counts do not add up: ' + p);
writeFileSync('public/names_pairs.json', JSON.stringify(pairList));
console.log('name pairs:', pairList.length, pairList.slice(0, 10).map(([p, n]) => p + ':' + n).join('  '));

/* «الله» in all its written forms (والله، بالله، لله، تالله، اللهم…), for the notes next to its count -> public/allah_forms.json */
const plain = (w) => w.replace(/[\u064B-\u065F\u0670\u0640\u06D6-\u06ED]/g, '');
const aForms = new Map();
for (const t of Object.values(Q)) for (const raw of plain(t).split(/\s+/)) { const w = raw.replace(/[إأآٱ]/g, 'ا'); if (/^[وفا]?[بكت]?الله$|^[وفا]?لله$|^[وفا]?اللهم$/.test(w)) aForms.set(raw, (aForms.get(raw) || 0) + 1); }
const aList = [...aForms].sort((a, b) => b[1] - a[1]);
writeFileSync('public/allah_forms.json', JSON.stringify({ forms: aList, total: aList.reduce((a, [, n]) => a + n, 0), withoutAllahumma: aList.filter(([w]) => !w.replace(/[إأآٱ]/g, 'ا').endsWith('اللهم')).reduce((a, [, n]) => a + n, 0) }));
console.log('allah forms:', aList.map(([w, n]) => w + ':' + n).join(' '));
