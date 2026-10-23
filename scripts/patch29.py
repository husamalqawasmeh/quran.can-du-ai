import re, sys
sys.stdout.reconfigure(encoding='utf-8')
p = 'public/index.html'
h = open(p, encoding='utf8').read()

def rep(old, new):
    global h
    assert old in h, old[:80]
    h = h.replace(old, new, 1)

# ---------- markup: counts panel under the caveat
rep('  <div id="t-names" class="mir"></div>', '  <div id="namesCounts" class="card" hidden></div>\n  <div id="t-names" class="mir"></div>')

# ---------- css
rep("</style>", """/* names screen: action buttons under the back button + counts panel */
.vactions{display:flex;flex-direction:column;gap:8px;align-items:stretch}
button.back{border:0;cursor:pointer;font:inherit;font-weight:600;font-size:.95rem}
#namesCounts{margin:0 0 14px}#namesCounts h3{margin:0 0 6px;color:var(--accent);font-size:1.15rem}
#namesCounts .how{color:var(--muted);font-size:.85rem;margin:0 0 10px}
.cr{display:grid;grid-template-columns:11em 1fr 5.5em 4.5em;gap:10px;align-items:center;padding:3px 0;font-size:.92rem;border-bottom:1px solid var(--line)}
.cr .nm{font-weight:600}.cr .ab{height:9px;background:var(--line);border-radius:5px;overflow:hidden}.cr .ab i{display:block;height:100%;background:var(--accent)}
.cr .num{text-align:end;font-weight:700}.cr .vv{text-align:end;color:var(--muted);font-size:.8rem}
.cr.head{font-size:.78rem;color:var(--muted);font-weight:600;border-bottom:2px solid var(--line)}
.cr .warn{color:var(--warn);margin-inline-start:4px;cursor:help}
@media(max-width:560px){.cr{grid-template-columns:8.5em 1fr 4.5em}.cr .vv{display:none}}
</style>""")

# ---------- js: put a second green button under the back button of the names screen, and render the panel
rep("function route() {", r"""/* names screen: a second green button under the back button */
(() => {
  const head = document.querySelector('#v-names .vhead'); if (!head) return;
  const back = head.querySelector('.back'), wrap = document.createElement('div'); wrap.className = 'vactions';
  back.replaceWith(wrap); wrap.append(back);
  wrap.insertAdjacentHTML('beforeend', '<button class="back" id="namesCountBtn" type="button" aria-expanded="false">📊 عدد مرات ورود كل اسم في القرآن</button>');
})();
function route() {""")

js = r'''
/* ---------- عدد مرات ورود كل اسم ---------- */
const AMBIGUOUS = new Set(['الملك', 'الحق', 'الحي', 'الرب', 'الأول', 'الآخر', 'الظاهر', 'الباطن', 'المؤمن', 'الولي', 'المولى', 'البر', 'النور', 'السلام', 'الغني', 'الكبير', 'العزيز', 'الكريم', 'الأحد', 'الواحد', 'القوي', 'البصير', 'الشهيد', 'النصير', 'القريب', 'الهادي', 'الرحيم', 'الرؤوف', 'العليم', 'الحكيم', 'الحليم', 'الشكور', 'الخبير', 'الوكيل', 'الحسيب', 'الرقيب', 'المجيد', 'العلي', 'العظيم', 'الحفيظ', 'المهيمن', 'الجامع', 'الجبار']);
let ncData = null, ncSort = 'group';
async function renderNameCounts() {
  const box = document.getElementById('namesCounts');
  if (!ncData) { try { ncData = await (await fetch('/names_counts.json')).json(); } catch { box.innerHTML = '<p class="hint">تعذّر تحميل الأعداد.</p>'; return; } }
  const T = TOPICS.names;
  let rows = T.items.filter((i) => i.g < 6 && ncData[i.t]).map((i, idx) => ({ t: i.t, g: i.g, idx, n: ncData[i.t].n, v: ncData[i.t].v }));
  if (ncSort === 'most') rows.sort((a, b) => b.n - a.n); else if (ncSort === 'least') rows.sort((a, b) => a.n - b.n); else rows.sort((a, b) => a.g - b.g || a.idx - b.idx);
  const max = Math.sqrt(Math.max(...rows.map((r) => r.n)));
  const sorters = [['group', 'حسب المجموعات'], ['most', 'الأكثر ورودًا'], ['least', 'الأقل ورودًا']];
  let lastG = -1;
  box.innerHTML = `<h3>عدد مرات ورود كل اسم في القرآن</h3>
    <p class="how">العدد هو مرات ورود <b>لفظ</b> الاسم في نص القرآن (بالألف واللام أو بدونهما، ومع حروف «و ف ب ل ك» الملتصقة بأوله)، والأسماء المركّبة تُعدّ بورود العبارة كاملة. والعدّ لا يفرّق بين ما يُراد به الله وغيره، فعلامة <span class="warn">⚠</span> على الألفاظ التي ترد في القرآن لغير الله أيضاً (كالملك والحق والحي والمؤمن والعظيم)، فعددها يزيد عن عدد ورودها اسماً لله. وهذه العلامة من اجتهادي في مراجعة الاستعمال القرآني. وطول الشريط يتناسب مع الجذر التربيعي للعدد حتى لا يطغى لفظ الجلالة.</p>
    <div class="sorters">${sorters.map(([k, n]) => `<button class="btn${ncSort === k ? ' on' : ''}" data-s="${k}">${n}</button>`).join('')}</div>
    <div class="cr head"><span>الاسم</span><span></span><span style="text-align:end">مرات الورود</span><span style="text-align:end">في آيات</span></div>` +
    rows.map((r) => {
      let sep = '';
      if (ncSort === 'group' && r.g !== lastG) { lastG = r.g; sep = `<div class="tag" style="margin:10px 0 2px;color:var(--accent);font-weight:700">${esc(T.groups[r.g][0] + ' ' + T.groups[r.g][1])}</div>`; }
      return sep + `<div class="cr"><span class="nm">${esc(r.t)}${AMBIGUOUS.has(r.t) ? '<span class="warn" title="يرد هذا اللفظ في القرآن لغير الله أيضاً">⚠</span>' : ''}</span><div class="ab"><i style="width:${(100 * Math.sqrt(r.n)) / max}%"></i></div><span class="num">${nA(r.n)}</span><span class="vv">${nA(r.v)}</span></div>`;
    }).join('');
  box.querySelector('.sorters').onclick = (e) => { const b = e.target.closest('button[data-s]'); if (b) { ncSort = b.dataset.s; renderNameCounts(); } };
}
document.getElementById('namesCountBtn').onclick = async (e) => {
  const box = document.getElementById('namesCounts'), btn = e.currentTarget, open = box.hidden;
  box.hidden = !open; btn.setAttribute('aria-expanded', open);
  if (open) { await renderNameCounts(); box.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
};
'''
rep("route();\n</script>", js + "route();\n</script>")
open(p, 'w', encoding='utf8').write(h)
mm = re.search(r'<script type="module">([\s\S]*?)</script>', h).group(1)
open('tmp_check.mjs', 'w', encoding='utf8').write(re.sub(r'^import .*$', '', mm, flags=re.M))
print('patched')
