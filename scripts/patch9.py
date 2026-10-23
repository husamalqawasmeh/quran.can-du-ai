p='public/index.html'; h=open(p,encoding='utf8').read()
def rep(o,n):
    global h
    assert o in h,o[:60]; h=h.replace(o,n,1)
rep("</style></head>",""".sr[open]{grid-column:1/-1}
.sr summary::after{content:"▾";color:var(--mut);margin-inline-start:6px}.sr[open]>summary::after{content:"▴"}
.sr .vs{margin-top:10px;border-top:1px solid var(--bar);padding-top:6px}.sr .vs>summary{font-weight:600;color:var(--acc);display:block}.sr .vs>summary::after{content:""}
.vtext{font-size:1.5rem;line-height:2.4;text-align:justify;font-family:"Amiri","Traditional Arabic","Noto Naskh Arabic",serif;margin-top:8px}
.vtext .bm{display:block;text-align:center;color:var(--acc);margin-bottom:6px}
.vtext .no{font-size:.95rem;color:var(--acc);margin:0 4px;white-space:nowrap}
.sbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
</style></head>""")
rep("""<div style="margin-bottom:12px"><input class="inp" id="ssearch" placeholder="ابحث عن سورة…" aria-label="بحث عن سورة" style="width:100%;max-width:320px"></div>""",
"""<div class="sbar"><input class="inp" id="ssearch" placeholder="ابحث عن سورة…" aria-label="بحث عن سورة" style="flex:1;max-width:320px"><button class="btn" id="sOpen">▾ فتح الكل</button><button class="btn" id="sClose">▴ طيّ الكل</button></div>""")
rep("""<select aria-label="القارئ">${readerOptions()}</select><div class="tag msg"></div><audio controls preload="none" hidden></audio></div></details>`""",
"""<select aria-label="القارئ">${readerOptions()}</select><div class="tag msg"></div><audio controls preload="none" hidden></audio>
     <details class="vs" data-n="${s.id}"><summary>📜 نص السورة (${nA(s.verses)} آية)</summary><div class="vtext"><span class="tag">جارٍ التحميل…</span></div></details></div></details>`""")
rep("$('ssearch').oninput = () => surahs && renderSurahs();","""$('ssearch').oninput = () => surahs && renderSurahs();
$('sOpen').onclick = () => document.querySelectorAll('#sgrid .sr').forEach((d) => (d.open = true));
$('sClose').onclick = () => document.querySelectorAll('#sgrid .sr').forEach((d) => { d.open = false; d.querySelectorAll('.vs').forEach((v) => (v.open = false)); });
$('sgrid').addEventListener('toggle', async (e) => {
  const d = e.target; if (!d.classList.contains('vs') || !d.open || d.dataset.done) return; d.dataset.done = 1;
  const n = +d.dataset.n, box = d.querySelector('.vtext');
  try {
    const vs = await (await fetch('/api/verses?s=' + n)).json(); if (!Array.isArray(vs)) throw 0;
    box.innerHTML = (n === 1 || n === 9 ? '' : '<span class="bm">بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ</span>') +
      vs.map((v) => `${esc(v.text.trim())} <span class="no">﴿${nA(v.n)}﴾</span>`).join(' ');
  } catch { delete d.dataset.done; box.innerHTML = '<span class="tag">تعذّر تحميل نص السورة.</span>'; }
}, true);""")
open(p,'w',encoding='utf8').write(h)
import re
m=re.search(r'<script type="module">([\s\S]*?)</script>',h).group(1)
open('tmp_check.mjs','w',encoding='utf8').write(re.sub(r'^import .*$','',m,flags=re.M))
print('ok')
