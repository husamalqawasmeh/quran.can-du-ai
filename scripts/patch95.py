import re
p='public/index.html'; h=open(p,encoding='utf8').read()
def rep(o,n):
    global h
    assert h.count(o)==1,o[:70]; h=h.replace(o,n,1)
a=h.index("  if (sections) {"); b=h.index("  $('sgrid').innerHTML = surahs.filter(",a)
old = r'''  if (sections) {
    const col = {}, count = {}; for (let j = 1; j <= 30; j++) juzSurahs(j).forEach((s) => { count[s.id] = (count[s.id] || 0) + 1; });
    $('sgrid').innerHTML = Array.from({ length: 30 }, (_, k) => k + 1).map((j) => {
        // a surah continued from the previous juz keeps its column, so its two boxes sit one under the other (wide screens)
        const list = juzSurahs(j), pos = {}, c0 = col[list[0].id] || 1;          // keep the surahs in reading order, starting at the carried surah's column
        list.forEach((s, k) => { const n = c0 - 1 + k; pos[s.id] = [(n % 4) + 1, Math.floor(n / 4) + 1]; });
        for (const k in col) delete col[k];
        list.forEach((s) => { col[s.id] = pos[s.id][0]; });
        return `<div class="jsec${j === 10 || j === 20 ? ' jbig' : ''}"><span class="jnum" title="الجزء ${nA(j)}">${nA(j)}</span><div class="jgrid">${list.map((s) => card(s, count[s.id] > 1, `--c:${pos[s.id][0]};--r:${pos[s.id][1]}`)).join('')}</div></div>`;
      }).join('');
    return;
  }
'''
h=h[:a]+old+h[b:]
rep("const juzCols = () => (innerWidth > 1000 ? 4 : innerWidth > 640 ? 3 : innerWidth > 380 ? 2 : 1);\nlet lastC = 0;\nwindow.addEventListener('resize', () => { if (juzOn && surahs && !$('ssearch').value.trim() && juzCols() !== lastC) renderSurahs(); });\n","")
a=h.index("#sgrid.juz{display:grid;gap:12px"); b=h.index("#sgrid .sr.jshare")
h=h[:a]+"""#sgrid.juz{display:block}
#sgrid .jsec{border:2px solid var(--line);border-radius:16px;padding:10px;margin-bottom:14px;background:var(--card)}
#sgrid .jsec{display:flex;gap:10px;align-items:flex-start}#sgrid .jsec>.jgrid{flex:1;min-width:0}
#sgrid .jnum{flex:none;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border:2px solid var(--accent);border-radius:8px;color:var(--accent);font-weight:700;font-size:.95rem;background:var(--panel)}
@media(min-width:1001px){#sgrid .jgrid>.sr{grid-column:var(--c);grid-row:var(--r)}}
#sgrid .jsec.jbig{margin-bottom:38px}
#sgrid .jgrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;align-items:start}
@media(max-width:1000px){#sgrid .jgrid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:640px){#sgrid .jgrid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:380px){#sgrid .jgrid{grid-template-columns:1fr}}
"""+h[b:]
open(p,'w',encoding='utf8').write(h)
m=re.search(r'<script type="module">([\s\S]*?)</script>',h).group(1)
open('tmp_check.mjs','w',encoding='utf8').write(re.sub(r'^import .*$','',m,flags=re.M))
print('juzCols' in h, '.jbg' in h)
