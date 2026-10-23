import re, sys
sys.stdout.reconfigure(encoding='utf-8')
p = 'public/index.html'
h = open(p, encoding='utf8').read()

def rep(old, new):
    global h
    assert h.count(old) == 1, (h.count(old), old[:90])
    h = h.replace(old, new, 1)

# ---------- js: after the generic render, re-arrange the names screen
rep("  list.addEventListener('toggle', async (e) => {\n    const d = e.target; if (!d.open || d.dataset.done || !d.dataset.i) return;",
"""  if (name === 'names') {                                   // last group on top (collapsed); the six main groups become vertical, collapsible columns
    const groups = [...list.querySelectorAll('.mgroup')];
    const make = (g, cls, open) => {
      const d = document.createElement('details'), s = document.createElement('summary'), cards = g.querySelector('.mgrid');
      d.className = cls; d.open = open; s.innerHTML = g.querySelector('h3').innerHTML;
      cards.className = cls === 'ggroup' ? 'mgrid' : 'gcards'; d.append(s, cards); return d;
    };
    const extra = groups.pop(), cols = document.createElement('div');
    cols.className = 'ncols'; groups.forEach((g) => cols.append(make(g, 'gcol', true)));
    list.innerHTML = ''; list.append(make(extra, 'ggroup', false), cols);
  }
  list.addEventListener('toggle', async (e) => {
    const d = e.target; if (!d.open || d.dataset.done || !d.dataset.i) return;""")

# ---------- css
rep("</style>", """/* names screen: collapsible group on top + six vertical collapsible columns */
#t-names .ggroup{margin:0 0 16px}
#t-names .ggroup>.mgrid{margin-top:8px}
#t-names .ggroup>summary,#t-names .gcol>summary{cursor:pointer;list-style:none;display:flex;gap:8px;align-items:center;font-weight:700;color:var(--accent);font-size:1.1rem;padding:8px 4px}
#t-names .ggroup>summary::-webkit-details-marker,#t-names .gcol>summary::-webkit-details-marker{display:none}
#t-names .ggroup>summary::before,#t-names .gcol>summary::before{content:"◀";font-size:.75em;flex:none}
#t-names .ggroup[open]>summary::before,#t-names .gcol[open]>summary::before{content:"▼"}
#t-names .ggroup>summary{background:var(--card);border:1px solid var(--stat-line);border-radius:14px;padding:12px 16px}
#t-names summary .cnt{color:var(--muted);font-size:.8em;font-weight:400}
.ncols{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;align-items:start}
#t-names .gcol{background:var(--card);border:1px solid var(--stat-line);border-radius:14px;padding:2px 10px 10px;box-shadow:var(--shadow)}
#t-names .gcol>summary{font-size:1rem;line-height:1.35;padding:10px 2px;border-bottom:1px solid var(--line);margin-bottom:8px}
#t-names .gcards{display:flex;flex-direction:column;gap:8px}
@media(max-width:1300px){.ncols{grid-template-columns:repeat(3,1fr)}}
@media(max-width:900px){.ncols{grid-template-columns:repeat(2,1fr)}}
@media(max-width:560px){.ncols{grid-template-columns:1fr}}
</style>""")
open(p, 'w', encoding='utf8').write(h)
m = re.search(r'<script type="module">([\s\S]*?)</script>', h).group(1)
open('tmp_check.mjs', 'w', encoding='utf8').write(re.sub(r'^import .*$', '', m, flags=re.M))
print('patched')
