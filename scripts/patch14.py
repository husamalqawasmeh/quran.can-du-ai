import re, sys
sys.stdout.reconfigure(encoding='utf-8')
p = 'public/index.html'
h = open(p, encoding='utf8').read()

def rep(old, new):
    global h
    assert old in h, old[:70]
    h = h.replace(old, new, 1)

# ---- home grid: 12 columns so rows can hold 3 / 2 / 4 tiles
rep(".home{display:grid;grid-template-columns:repeat(6,1fr);gap:18px}\n.home .tile{grid-column:span 2}.home .tile.half{grid-column:span 3}\n@media(max-width:800px){.home{grid-template-columns:1fr 1fr}.home .tile,.home .tile.half{grid-column:span 1}}",
    ".home{display:grid;grid-template-columns:repeat(12,1fr);gap:18px}\n.home .tile{grid-column:span 4}.home .tile.half{grid-column:span 6}.home .tile.quarter{grid-column:span 3}\n@media(max-width:1000px){.home .tile.quarter{grid-column:span 6}}\n@media(max-width:800px){.home{grid-template-columns:1fr 1fr}.home .tile,.home .tile.half,.home .tile.quarter{grid-column:span 1}}")
for href in ('whisper', 'memorize', 'learn'):
    rep(f'<a class="tile" href="#{href}">', f'<a class="tile quarter" href="#{href}">')
rep('<span>دروس مبسطة في التجويد مع أمثلة مسموعة</span></a>',
    '<span>دروس مبسطة في التجويد مع أمثلة مسموعة</span></a>\n    <a class="tile quarter" href="#stats"><div class="ic">📊</div><b>إحصاءات لغوية لنص القرآن</b><span>عدد الكلمات والحروف وأكثرها تكراراً وغير ذلك</span></a>')

# ---- CSS
rep("</style>", """/* statistics */
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px}
@media(max-width:800px){.kpis{grid-template-columns:1fr 1fr}}
.kpi{background:var(--card);border:1px solid var(--stat-line);border-radius:14px;box-shadow:var(--shadow);padding:14px 16px}
.kpi b{display:block;font-size:1.7rem;line-height:1.3;color:var(--accent)}.kpi span{color:var(--muted);font-size:.85rem}
.srow{display:grid;grid-template-columns:7em 1fr 9em;gap:10px;align-items:center;padding:3px 0;font-size:.9rem}
.srow .k{font-size:1.1rem;font-weight:600}.srow .v{color:var(--muted);text-align:end;font-size:.82rem}
.sbarw{height:10px;background:var(--line);border-radius:5px;overflow:hidden}.sbarw i{display:block;height:100%;background:var(--accent);border-radius:5px}
.tbl{width:100%;border-collapse:collapse;font-size:.88rem}.tbl th,.tbl td{padding:6px 10px;text-align:start;border-bottom:1px solid var(--line)}
.tbl th{color:var(--muted);font-weight:600;position:sticky;top:0;background:var(--panel)}
.tbl td.num,.tbl th.num{text-align:end}
.tscroll{max-height:520px;overflow:auto;border-radius:10px}
.sorters{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 10px}
#v-stats .lesson{margin-top:12px}
</style>""")

# ---- section
rep("<script type=\"module\">", """<!-- إحصاءات لغوية -->
<section class="view" id="v-stats" hidden>
  <h1>إحصاءات لغوية لنص القرآن</h1>
  <p class="sub">أرقام محسوبة من نص المصحف نفسه بالإملاء المعتاد، وتختلف عن غيرها قليلاً بحسب طريقة عدّ الكلمات والحروف.</p>
  <div id="statsBody"><p class="hint">جارٍ التحميل…</p></div>
</section>
</div>
<script type="module">""".replace("</div>\n<script", "<script", 1) if False else "<!-- إحصاءات لغوية -->\n<section class=\"view\" id=\"v-stats\" hidden>\n  <h1>إحصاءات لغوية لنص القرآن</h1>\n  <p class=\"sub\">أرقام محسوبة من نص المصحف نفسه بالإملاء المعتاد، وتختلف عن غيرها قليلاً بحسب طريقة عدّ الكلمات والحروف.</p>\n  <div id=\"statsBody\"><p class=\"hint\">جارٍ التحميل…</p></div>\n</section>\n</div>\n<script type=\"module\">")
# the original code already had a closing wrapper div before the script; keep exactly one
h = h.replace("</div>\n</div>\n<script type=\"module\">", "</div>\n<script type=\"module\">", 1)

# ---- JS
rep("const VIEWS = ['home',", "const VIEWS = ['stats', 'home',")
rep("  if (v === 'miracles') initMiracles();", "  if (v === 'miracles') initMiracles();\n  if (v === 'stats') initStats();")
js = r"""
/* ---------- إحصاءات لغوية ---------- */
let stInit = false;
async function initStats() {
  if (stInit) return; stInit = true;
  const body = $('statsBody');
  let S;
  try { S = await (await fetch('/stats.json')).json(); } catch { stInit = false; body.innerHTML = '<p class="hint">تعذّر تحميل الإحصاءات.</p>'; return; }
  const t = S.totals, N = (n) => nA(n), pct = (a, b) => nA(((100 * a) / b).toFixed(1)) + '٪';
  const bars = (rows, max, fmt) => rows.map((r) => `<div class="srow"><span class="k">${esc(r.k)}</span><div class="sbarw"><i style="width:${(100 * r.n) / max}%"></i></div><span class="v">${fmt(r)}</span></div>`).join('');
  const panel = (title, html, open) => `<details class="lesson"${open ? ' open' : ''}><summary>${esc(title)}</summary><div>${html}</div></details>`;
  const kpi = (v, l) => `<div class="kpi"><b>${v}</b><span>${l}</span></div>`;
  const place = (p) => S.byPlace[p];
  const mk = place('makkah'), md = place('madinah');
  const verseBox = (v, label) => `<div class="aib"><h3>${label} — ${N(v.words)} ${v.words === 1 ? 'كلمة' : 'كلمات'} [${esc(v.key)}]</h3><div class="vt">${esc(v.text)}</div></div>`;
  body.innerHTML =
    `<div class="kpis">${kpi(N(t.surahs), 'سورة')}${kpi(N(t.verses), 'آية')}${kpi(N(t.words), 'كلمة (بالتكرار)')}${kpi(N(t.letters), 'حرفاً')}` +
    `${kpi(N(t.uniqueWords), 'كلمة مختلفة')}${kpi(N(t.hapax), 'كلمة وردت مرة واحدة')}${kpi(N(t.wordsPerVerse), 'متوسط الكلمات في الآية')}${kpi(N(t.lettersPerWord), 'متوسط الحروف في الكلمة')}</div>` +
    panel('أكثر ٣٠ كلمة تكراراً', bars(S.topWords.map((x) => ({ k: x.w, n: x.n })), S.topWords[0].n, (r) => `${N(r.n)} · ${pct(r.n, t.words)}`), true) +
    panel('تكرار الحروف', bars(S.letters.map((x) => ({ k: x.l === 'ء' ? 'ء (همزة)' : x.l === 'ة' ? 'ة' : x.l, n: x.n })), S.letters[0].n, (r) => `${N(r.n)} · ${pct(r.n, t.letters)}`), false) +
    panel('توزيع أطوال الكلمات (بعدد الحروف)', bars(S.wordLength.map((x) => ({ k: x.len === 10 ? '١٠ فأكثر' : N(x.len) + ' حروف', n: x.n })), Math.max(...S.wordLength.map((x) => x.n)), (r) => `${N(r.n)} · ${pct(r.n, t.words)}`), false) +
    panel('المكي والمدني', `<table class="tbl"><tr><th></th><th class="num">السور</th><th class="num">الآيات</th><th class="num">الكلمات</th><th class="num">الحروف</th></tr>` +
      [['مكية', mk], ['مدنية', md]].map(([n, p]) => `<tr><td>${n}</td><td class="num">${N(p.surahs)}</td><td class="num">${N(p.verses)} (${pct(p.verses, t.verses)})</td><td class="num">${N(p.words)} (${pct(p.words, t.words)})</td><td class="num">${N(p.letters)}</td></tr>`).join('') + `</table>` +
      `<p class="tag">التصنيف المكي/المدني كما ورد في بيانات Quran.com.</p>`, false) +
    panel('أطول آية وأقصر آية', verseBox(S.longestVerse, 'أطول آية (بعدد الكلمات)') + verseBox(S.shortestVerse, 'أقصر آية (بعدد الكلمات)'), false) +
    panel('جميع السور مرتّبة حسب…', `<div class="sorters"></div><div class="tscroll"><table class="tbl"><thead><tr><th>#</th><th>السورة</th><th></th><th class="num">آياتها</th><th class="num">كلماتها</th><th class="num">حروفها</th></tr></thead><tbody></tbody></table></div>`, false) +
    `<p class="note">المصدر: ${esc(S.source)} — حُسبت بتاريخ ${esc(S.generated)}. تُعدّ الكلمة ما يفصله فراغ في الرسم الإملائي المعتاد، وتُحسب ى ياءً وؤ/ئ همزةً.</p>`;
  const tb = body.querySelector('tbody'), sorters = body.querySelector('.sorters');
  const SORTS = [['الترتيب في المصحف', (a, b) => a.id - b.id], ['الأكثر آيات', (a, b) => b.verses - a.verses], ['الأكثر كلمات', (a, b) => b.words - a.words], ['الأقل كلمات', (a, b) => a.words - b.words], ['الأكثر حروفاً', (a, b) => b.letters - a.letters]];
  const draw = (i) => {
    sorters.querySelectorAll('.btn').forEach((b, j) => b.classList.toggle('on', i === j));
    tb.innerHTML = S.surahs.slice().sort(SORTS[i][1]).map((s) => `<tr><td>${N(s.id)}</td><td>${esc(s.ar)}</td><td>${s.place === 'makkah' ? 'مكية' : 'مدنية'}</td><td class="num">${N(s.verses)}</td><td class="num">${N(s.words)}</td><td class="num">${N(s.letters)}</td></tr>`).join('');
  };
  sorters.innerHTML = SORTS.map(([n], i) => `<button class="btn" data-i="${i}">${n}</button>`).join('');
  sorters.onclick = (e) => { const b = e.target.closest('.btn'); if (b) draw(+b.dataset.i); };
  draw(0);
}
"""
rep("route();\n</script>", js + "route();\n</script>")
open(p, 'w', encoding='utf8').write(h)
m = re.search(r'<script type="module">([\s\S]*?)</script>', h).group(1)
open('tmp_check.mjs', 'w', encoding='utf8').write(re.sub(r'^import .*$', '', m, flags=re.M))
print('patched; closing wrappers:', h.count('</div>\n<script type="module">'))
