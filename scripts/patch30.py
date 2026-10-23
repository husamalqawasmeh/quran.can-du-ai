import re, sys
sys.stdout.reconfigure(encoding='utf-8')
p = 'public/index.html'
h = open(p, encoding='utf8').read()

def rep(old, new):
    global h
    assert old in h, 'NOT FOUND: ' + old[:90]
    h = h.replace(old, new, 1)

def cut(start_marker, end_marker, keep_end=True):
    global h
    a = h.index(start_marker); b = h.index(end_marker, a) + (0 if keep_end else len(end_marker))
    h = h[:a] + h[b:]

# ---------- 1) undo: green counts button under the back button
cut('/* names screen: a second green button under the back button */', 'function route() {')
# ---------- 2) undo: wide cards moved to the end of their groups
cut('/* Names of Allah: a name too wide for one card goes to the END', 'const topicInit = {};')
rep("  if (TOPICS[v]) { initTopic(v); if (v === 'names') { layoutNames(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutNames); } }", "  if (TOPICS[v]) initTopic(v);")
# ---------- 3) the counts panel no longer lives on the names screen
rep('  <div id="namesCounts" class="card" hidden></div>\n', '')

# ---------- 4) css: 7 single-width cards per row, count at the left end of each card
a = h.index('/* Names of Allah: half-width cards (8 per row)')
b = h.index("@media(max-width:420px){#t-names .mgrid{grid-template-columns:repeat(2,1fr)}}\n", a) + len("@media(max-width:420px){#t-names .mgrid{grid-template-columns:repeat(2,1fr)}}\n")
h = h[:a] + """/* Names of Allah: 7 narrow cards per row; the count sits at the left end of each card */
#t-names .mgrid{grid-template-columns:repeat(7,1fr)}
#t-names .lesson{padding:0 12px}
#t-names .lesson>summary{font-size:.95rem;padding:10px 0;gap:6px}
#t-names .lesson[open]{grid-column:span 3}
.nc{margin-inline-start:auto;flex:none;font-size:.75rem;font-weight:700;color:var(--muted);background:var(--panel);border:1px solid var(--stat-line);border-radius:99px;padding:0 8px;white-space:nowrap}
.nc .warn{color:var(--warn);margin-inline-end:3px}
.nsort{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 10px}
@media(max-width:1300px){#t-names .mgrid{grid-template-columns:repeat(5,1fr)}}
@media(max-width:1000px){#t-names .mgrid{grid-template-columns:repeat(4,1fr)}#t-names .lesson[open]{grid-column:span 2}}
@media(max-width:640px){#t-names .mgrid{grid-template-columns:repeat(3,1fr)}#t-names .lesson[open]{grid-column:1/-1}}
@media(max-width:420px){#t-names .mgrid{grid-template-columns:repeat(2,1fr)}}
""" + h[b:]
h = h.replace("#t-names .lesson.wide:not([open]){grid-column:span 2}\n", "")

# ---------- 5) initTopic: async, adds the count badge to every Quranic name card
rep("function initTopic(name) {\n  if (topicInit[name]) return; topicInit[name] = true;\n  const T = TOPICS[name], list = $('t-' + name);",
    "async function initTopic(name) {\n  if (topicInit[name]) return; topicInit[name] = true;\n  const T = TOPICS[name], list = $('t-' + name);\n  const NC = name === 'names' ? await loadNameCounts() : null;      // how many times each name's word occurs (see the statistics screen)")
rep("<summary>${esc(m.t)}</summary><div>${esc(m.note)}</div><div class=\"exs\"><div class=\"tag\">جارٍ تحميل الآيات…</div></div></details>`).join('') + '</div></div>').join('');\n  list.addEventListener('toggle', async (e) => {\n    const d = e.target; if (!d.open || d.dataset.done || !d.dataset.i) return;",
    "<summary>${esc(m.t)}${NC && m.g < 6 && NC[m.t] ? `<span class=\"nc\" title=\"عدد مرات ورود اللفظ في القرآن${AMBIGUOUS.has(m.t) ? ' (يرد اللفظ لغير الله أيضاً)' : ''}\">${AMBIGUOUS.has(m.t) ? '<span class=\"warn\">⚠</span>' : ''}${nA(NC[m.t].n)}</span>` : ''}</summary><div>${esc(m.note)}</div><div class=\"exs\"><div class=\"tag\">جارٍ تحميل الآيات…</div></div></details>`).join('') + '</div></div>').join('');\n  list.addEventListener('toggle', async (e) => {\n    const d = e.target; if (!d.open || d.dataset.done || !d.dataset.i) return;")

# ---------- 6) the counts table becomes ONE item of the statistics screen
a = h.index('/* ---------- عدد مرات ورود كل اسم ---------- */'); b = h.index("route();\n</script>")
h = h[:a] + r'''/* ---------- عدد مرات ورود أسماء الله الحسنى (عنصر في شاشة الإحصاءات، وشارة على كل بطاقة اسم) ---------- */
const AMBIGUOUS = new Set(['الملك', 'الحق', 'الحي', 'الرب', 'الأول', 'الآخر', 'الظاهر', 'الباطن', 'المؤمن', 'الولي', 'المولى', 'البر', 'النور', 'السلام', 'الغني', 'الكبير', 'العزيز', 'الكريم', 'الأحد', 'الواحد', 'القوي', 'البصير', 'الشهيد', 'النصير', 'القريب', 'الهادي', 'الرحيم', 'الرؤوف', 'العليم', 'الحكيم', 'الحليم', 'الشكور', 'الخبير', 'الوكيل', 'الحسيب', 'الرقيب', 'المجيد', 'العلي', 'العظيم', 'الحفيظ', 'المهيمن', 'الجامع', 'الجبار']);
let ncData = null, ncSort = 'group';
async function loadNameCounts() {
  if (ncData) return ncData;
  try { ncData = await (await fetch('/names_counts.json')).json(); } catch { ncData = null; }
  return ncData;
}
async function renderNameCounts(box) {
  const data = await loadNameCounts();
  if (!data) { box.innerHTML = '<p class="hint">تعذّر تحميل الأعداد.</p>'; return; }
  const T = TOPICS.names;
  const all = T.items.filter((i) => i.g < 6 && data[i.t]).map((i, idx) => ({ t: i.t, g: i.g, idx, n: data[i.t].n, v: data[i.t].v }));
  const allah = all.find((r) => r.t === 'الله');                      // shown on its own above the table, not in the graph
  let rows = all.filter((r) => r.t !== 'الله');
  if (ncSort === 'most') rows.sort((a, b) => b.n - a.n); else if (ncSort === 'least') rows.sort((a, b) => a.n - b.n); else rows.sort((a, b) => a.g - b.g || a.idx - b.idx);
  const max = Math.max(...rows.map((r) => r.n));
  const flagged = all.filter((r) => AMBIGUOUS.has(r.t)).length;
  const disclaimer = `<div class="disc"><b>تنبيه — طريقة العدّ:</b> عُدّ اللفظ نفسه في نص القرآن، بالألف واللام أو بدونهما، ومع حروف «و ف ب ل ك» الملتصقة بأوله؛ فمثلاً تُعدّ «للرحمن» من «الرحمن». والأسماء المركّبة مثل «ذو الجلال والإكرام» تُعدّ عند ورود العبارة كاملة.<br><b>تحفّظ:</b> لا يستطيع العدّ أن يعرف هل يُراد باللفظ الله أم غيره، فبعض الأعداد أكبر من الحقيقة. وقد وُضعت علامة ⚠ على هذه الألفاظ (${nA(flagged)} من ${nA(all.length)})، ومنها «الملك» و«الحق» و«المؤمن» و«العظيم»، وتوضّح اللوحة ذلك في أعلاها. وقائمة ⚠ اجتهاد بعد مراجعة الاستعمال القرآني، فيُرجى عرضها على أحد أهل العلم قبل الاعتماد على الأرقام الدقيقة.</div>`;
  const sorters = [['group', 'حسب المجموعات'], ['most', 'الأكثر ورودًا'], ['least', 'الأقل ورودًا']];
  let lastG = -1;
  box.innerHTML = `${allah ? `<div class="allah"><span class="nm">الله</span><span class="num">${nA(allah.n)}</span></div>` : ''}
    <p class="how">العدد هو مرات ورود <b>لفظ</b> الاسم في نص القرآن (بالألف واللام أو بدونهما، ومع حروف «و ف ب ل ك» الملتصقة بأوله)، والأسماء المركّبة تُعدّ بورود العبارة كاملة. والعدّ لا يفرّق بين ما يُراد به الله وغيره، فعلامة <span class="warn">⚠</span> على الألفاظ التي ترد في القرآن لغير الله أيضاً (كالملك والحق والحي والمؤمن والعظيم)، فعددها يزيد عن عدد ورودها اسماً لله. وهذه العلامة من اجتهادي في مراجعة الاستعمال القرآني. وطول الشريط يتناسب مع العدد، ويُعرض لفظ الجلالة وحده فوق الجدول. ويظهر العدد نفسه على بطاقة كل اسم في شاشة «أسماء الله الحسنى».</p>
    <div class="nsort">${sorters.map(([k, n]) => `<button class="btn${ncSort === k ? ' on' : ''}" data-s="${k}">${n}</button>`).join('')}</div>
    <div class="key"><span class="warn">⚠</span> = هذا اللفظ يرد في القرآن لغير الله أيضاً، فالعدد يشمل كل ورود اللفظ وليس وروده اسماً لله فقط.</div>
    <div class="cr head"><span>الاسم</span><span></span><span style="text-align:end">مرات الورود</span><span style="text-align:end">في آيات</span></div>` +
    rows.map((r) => {
      let sep = '';
      if (ncSort === 'group' && r.g !== lastG) { lastG = r.g; sep = `<div class="tag" style="margin:10px 0 2px;color:var(--accent);font-weight:700">${esc(T.groups[r.g][0] + ' ' + T.groups[r.g][1])}</div>`; }
      return sep + `<div class="cr"><span class="nm">${esc(r.t)}${AMBIGUOUS.has(r.t) ? '<span class="warn" title="يرد هذا اللفظ في القرآن لغير الله أيضاً">⚠</span>' : ''}</span><div class="ab"><i style="width:${(100 * r.n) / max}%"></i></div><span class="num">${nA(r.n)}</span><span class="vv">${nA(r.v)}</span></div>`;
    }).join('') + disclaimer;
  box.querySelector('.nsort').onclick = (e) => { const b = e.target.closest('button[data-s]'); if (b) { ncSort = b.dataset.s; renderNameCounts(box); } };
}
''' + h[b:]

# the statistics screen: one more panel, filled when it is first opened
rep("    panel('أكثر ٣٠ كلمة تكراراً',", "    panel('عدد مرات ورود أسماء الله الحسنى في القرآن', '<div id=\"namesCounts\"><p class=\"hint\">جارٍ التحميل…</p></div>', false) +\n    panel('أكثر ٣٠ كلمة تكراراً',")
rep("  const tb = body.querySelector('tbody'), sorters = body.querySelector('.sorters');",
    "  const ncPanel = body.querySelector('#namesCounts').closest('details');\n  ncPanel.addEventListener('toggle', () => { if (ncPanel.open && !ncPanel.dataset.done) { ncPanel.dataset.done = 1; renderNameCounts(document.getElementById('namesCounts')); } });\n  const tb = body.querySelector('tbody'), sorters = body.querySelector('.sorters');")
open(p, 'w', encoding='utf8').write(h)
mm = re.search(r'<script type="module">([\s\S]*?)</script>', h).group(1)
open('tmp_check.mjs', 'w', encoding='utf8').write(re.sub(r'^import .*$', '', mm, flags=re.M))
print('refs left -> namesCountBtn:', h.count('namesCountBtn'), '| layoutNames:', h.count('layoutNames'), '| .wide:', h.count('lesson.wide'))
