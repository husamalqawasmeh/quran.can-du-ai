// Counts word classes in the Quran from the Quranic Arabic Corpus morphology (via github.com/mustafa0x/quran-morphology) -> public/pos.json
import { readFileSync, writeFileSync } from 'node:fs';
const file = process.argv[2] || 'scratch_morph.txt';
const strip = (s) => s.replace(/[\u064B-\u065F\u0670\u0640\u06D6-\u06ED]/g, '').replace(/[ٱ]/g, 'ا');
const cats = {}, top = { noun: new Map(), pn: new Map(), adj: new Map(), verb: new Map(), pron: new Map() };
const add = (c, k, sub) => { cats[c] = (cats[c] || 0) + 1; if (sub) { const m = (top[sub] ||= new Map()); m.set(k, (m.get(k) || 0) + 1); } };
let total = 0;
const forms = new Map();   // verb form (VF) -> Map(voweled lemma -> count), for public/verbs.json
const tense = { perf: 0, impf: 0, impv: 0, fut: 0 };   // fut: present verbs right after سـ / سوف (also counted in impf)
let afterFut = false;
for (const line of readFileSync(file, 'utf8').split('\n')) {
  const p = line.trim().split('\t'); if (p.length < 4) continue;
  const f = p[3].split('|'), has = (x) => f.includes(x), lem = ((f.find((x) => x.startsWith('LEM:')) || '').slice(4)), L = strip(lem);
  total++;
  const fut = afterFut; afterFut = has('FUT');
  if (p[2] === 'V') {
    add('verb'); add(has('PERF') ? 'verbPerf' : has('IMPF') ? 'verbImpf' : has('IMPV') ? 'verbImpv' : 'verbOther');
    if (has('PASS')) add('verbPass'); add('v', L, 'verb'); cats.v--;
    const vf = +((f.find((x) => x.startsWith('VF:')) || 'VF:0').slice(3)), m = forms.get(vf) || forms.set(vf, new Map()).get(vf), w = lem.replace(/ٱ/g, 'ا');
    m.set(w, (m.get(w) || 0) + 1);
    if (has('PERF')) tense.perf++; else if (has('IMPF')) { tense.impf++; if (fut) tense.fut++; } else if (has('IMPV')) tense.impv++;
  } else if (p[2] === 'N') {
    if (has('PRON')) { add(has('SUFF') ? 'pronAttached' : 'pronSeparate'); }
    else if (has('REL')) add('rel'); else if (has('DEM')) add('dem'); else if (has('INTG')) add('intg');
    else if (has('T') || has('LOC')) add(has('T') ? 'timeAdv' : 'placeAdv');
    else if (has('PN')) { add('pn', L, 'pn'); }
    else if (has('ADJ') || L === 'رحمن') { add('adj', L, 'adj'); }   // الرحمن is an attribute like الرحيم (the corpus tags it ADJ in the basmala but N elsewhere)
    else if (has('PREF')) add('otherN');
    else { add('noun', L, 'noun'); if (has('ACT_PCPL')) add('actPcpl'); else if (has('PASS_PCPL')) add('passPcpl'); else if (has('VN')) add('vn'); }
  } else {
    add('particle');
    if (has('DET')) add('pDet'); else if (has('CONJ')) add('pConj'); else if (has('REM')) add('pRem'); else if (has('NEG')) add('pNeg');
    else if (has('EMPH')) add('pEmph'); else if (has('COND')) add('pCond'); else if (has('ADDR')) add('pAddr'); else if (has('INTG')) add('pIntg'); else add('pOther');
  }
}
const topN = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([w, c]) => ({ w, n: c }));
const uniq = Object.fromEntries(Object.entries(top).map(([k, m]) => [k, m.size]));
writeFileSync('public/pos.json', JSON.stringify({ total, cats, unique: uniq, top: Object.fromEntries(Object.entries(top).map(([k, m]) => [k, topN(m, 20)])) }));
console.log(total, JSON.stringify(cats), JSON.stringify(uniq));
console.log(JSON.stringify(topN(top.noun, 8)), JSON.stringify(topN(top.adj, 8)), JSON.stringify(topN(top.verb, 8)));
writeFileSync('public/verbs.json', JSON.stringify({ tense, forms: [...forms].sort((a, b) => a[0] - b[0]).map(([vf, m]) => [vf, [...m].sort((a, b) => b[1] - a[1])]) }));
console.log(JSON.stringify(tense));
