// Three more analyses for #stats (criteria 45, 46, 54), from the Quranic Arabic Corpus morphology -> public/research.json (key "sem")
// usage: node scripts/research3-stats.mjs <quran-morphology.txt>   (github.com/mustafa0x/quran-morphology)
//   pronouns: every pronoun by person / number / gender, attached and separate, per 1,000 words in Makki and Madani surahs (54)
//   derivs:   the words of a root by kind: verbs, verbal nouns, active and passive participles, other nouns (45)
//   fields:   time, place, nature and behaviour words, counted by their lemma as a noun (46); «سحر» left out: dawn and magic share the spelling
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert';
const S = JSON.parse(readFileSync('public/stats.json', 'utf8')), PLACE = Object.fromEntries(S.surahs.map((s) => [s.id, s.place]));
const inc = (m, k, n = 1) => m.set(k, (m.get(k) || 0) + n);
const plain = (t) => t.normalize('NFC').replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, '').replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
assert.equal(plain('يَوْم'), 'يوم'); assert.equal(plain('ساعَة'), 'ساعه');

const rows = readFileSync(process.argv[2], 'utf8').split('\n').map((l) => l.trim().split('\t')).filter((p) => p.length > 3);
const words = { makkah: new Set(), madinah: new Set() };
const pron = new Map(), roots = new Map(), lemCount = new Map();
for (const [loc, form, tag, feat] of rows) {
  const [s, v, w] = loc.split(':'), pl = PLACE[+s], f = feat.split('|');
  words[pl].add(`${s}:${v}:${w}`);
  const lem = (f.find((x) => x.startsWith('LEM:')) || '').slice(4), root = (f.find((x) => x.startsWith('ROOT:')) || '').slice(5);
  if (lem && tag === 'N') inc(lemCount, plain(lem));   // nouns only: a verb can share the spelling (ظِلّ / ظَلَّ)
  if (f.includes('PRON')) {
    const p = (f.find((x) => /^[123][MF]?[SDP]$/.test(x)) || '').replace(/^([23])[MF]D$/, '$1D');   // the dual: one row for masculine and feminine
    if (p) { const e = pron.get(p) || pron.set(p, { att: 0, sep: 0, makkah: 0, madinah: 0 }).get(p); e[f.includes('SUFF') ? 'att' : 'sep']++; e[pl]++; }
  }
  if (root && lem) {
    const kind = tag === 'V' ? 'v' : f.includes('VN') ? 'vn' : f.includes('ACT_PCPL') ? 'ap' : f.includes('PASS_PCPL') ? 'pp' : tag === 'N' ? 'n' : '';
    if (!kind) continue;
    const r = roots.get(root) || roots.set(root, { n: 0, k: { v: new Map(), vn: new Map(), ap: new Map(), pp: new Map(), n: new Map() } }).get(root);
    r.n++; inc(r.k[kind], lem.normalize('NFC'));
  }
}
const per1k = (n, pl) => Math.round((10000 * n) / words[pl].size) / 10;
const PRON = ['1S', '1P', '2MS', '2FS', '2D', '2MP', '2FP', '3MS', '3FS', '3D', '3MP', '3FP'];
const pronouns = PRON.filter((p) => pron.has(p)).map((p) => { const e = pron.get(p); return [p, e.att, e.sep, per1k(e.makkah, 'makkah'), per1k(e.madinah, 'madinah')]; });
assert.ok(pron.get('3MP').att > 5000 && pron.get('1P').sep > 100);

// roots with the most different words, each kind as [lemma, times] most used first
const top = (m) => [...m].sort((a, b) => b[1] - a[1]);
const derivs = [...roots].map(([r, x]) => [r, x.n, Object.values(x.k).reduce((a, m) => a + m.size, 0), Object.fromEntries(Object.entries(x.k).map(([k, m]) => [k, top(m)]))])
  .sort((a, b) => b[2] - a[2] || b[1] - a[1]).slice(0, 30);
const kinds = Object.fromEntries(['v', 'vn', 'ap', 'pp', 'n'].map((k) => [k, [...roots.values()].reduce((a, x) => a + [...x.k[k].values()].reduce((p, q) => p + q, 0), 0)]));
assert.ok(derivs[0][2] >= 15 && kinds.v > 19000);

// semantic fields: a fixed list of lemmas for each field (matched in plain spelling); the counts are the lemma's occurrences as a noun, in all its forms
const FIELDS = {
  'الزمان': ['يوم', 'ليل', 'نهار', 'ساعة', 'شهر', 'سنة', 'عام', 'دهر', 'حين', 'صبح', 'فجر', 'عصر', 'ضحى', 'غداة', 'عشي', 'بكرة', 'أصيل', 'أجل', 'أمد'],
  'المكان': ['أرض', 'سماء', 'بيت', 'مسجد', 'بلد', 'قرية', 'مدينة', 'دار', 'مكان', 'سبيل', 'طريق', 'صراط', 'مشرق', 'مغرب', 'وادي', 'كهف', 'غار', 'مقام', 'سوق'],
  'الطبيعة': ['ماء', 'شمس', 'قمر', 'نجم', 'كوكب', 'ريح', 'مطر', 'سحاب', 'نبات', 'شجر', 'شجرة', 'نخل', 'نخلة', 'زرع', 'جبل', 'بحر', 'نهر', 'برق', 'رعد', 'ظل', 'نور', 'تراب', 'حجارة', 'طين'],
  'السلوك': ['صبر', 'صدق', 'كذب', 'ظلم', 'عدل', 'قسط', 'شكر', 'كبر', 'فسق', 'تقوى', 'إحسان', 'عفو', 'رحمة', 'بغي', 'فساد', 'إسراف', 'بخل', 'أمانة', 'خيانة', 'كيد'],
};
const fields = Object.entries(FIELDS).map(([name, list]) => { const l = list.map((w) => [w, lemCount.get(plain(w)) || 0]).filter(([, n]) => n).sort((a, b) => b[1] - a[1]); return [name, l.reduce((a, [, n]) => a + n, 0), l]; });
assert.ok(fields.every(([, n, l]) => n > 100 && l.length >= 10), 'every field finds its words');

const R = JSON.parse(readFileSync('public/research.json', 'utf8'));
R.sem = { pronouns, pronTotal: [...pron.values()].reduce((a, e) => a + e.att + e.sep, 0), derivs, kinds, fields };
writeFileSync('public/research.json', JSON.stringify(R));
console.log('pronouns', R.sem.pronTotal, 'kinds', kinds, 'top root', derivs[0][0], derivs[0][2]);
console.log(fields.map(([n, t, l]) => `${n} ${t}: ${l.map(([w, c]) => w + ' ' + c).join(', ')}`).join('\n'));
const missing = Object.values(FIELDS).flat().filter((w) => !lemCount.get(plain(w))); console.log('not found as a lemma:', missing.join(' '));
