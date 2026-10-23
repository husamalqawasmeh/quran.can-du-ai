import re
p='public/index.html'; h=open(p,encoding='utf8').read()
def rep(o,n):
    global h
    assert h.count(o)==1,o[:70]; h=h.replace(o,n,1)
a=h.index("    const col = {}, count = {}; for (let j = 1;"); b=h.index("    return;\n  }\n",a)
new=r'''    const count = {}; for (let j = 1; j <= 30; j++) juzSurahs(j).forEach((s) => { count[s.id] = (count[s.id] || 0) + 1; });
    $('sgrid').innerHTML = Array.from({ length: 30 }, (_, k) => k + 1).map((j) => {
      // surahs in reading order, four to a row; a short row is stretched to its end: the extra columns go to the surahs that continue into another juz (else to the last one)
      const list = juzSurahs(j), pos = {};
      for (let i = 0; i < list.length; i += 4) {
        const row = list.slice(i, i + 4), r = i / 4 + 1, extra = 4 - row.length, spans = row.map(() => 1);
        let rec = row.map((s, k) => k).filter((k) => count[row[k].id] > 1); if (!rec.length) rec = [row.length - 1];
        for (let e = 0; e < extra; e++) spans[rec[rec.length - 1 - (e % rec.length)]]++;
        let c = 1; row.forEach((s, k) => { pos[s.id] = [c, spans[k], r]; c += spans[k]; });
      }
      return `<div class="jsec${j === 10 || j === 20 ? ' jbig' : ''}"><span class="jnum" title="الجزء ${nA(j)}">${nA(j)}</span><div class="jgrid">${list.map((s) => card(s, count[s.id] > 1, `--c:${pos[s.id][0]};--s:${pos[s.id][1]};--r:${pos[s.id][2]}`)).join('')}</div></div>`;
    }).join('');
'''
h=h[:a]+new+h[b:]
rep("@media(min-width:1001px){#sgrid .jgrid>.sr{grid-column:var(--c);grid-row:var(--r)}}","@media(min-width:1001px){#sgrid .jgrid>.sr{grid-column:var(--c)/span var(--s);grid-row:var(--r)}}")
open(p,'w',encoding='utf8').write(h)
m=re.search(r'<script type="module">([\s\S]*?)</script>',h).group(1)
open('tmp_check.mjs','w',encoding='utf8').write(re.sub(r'^import .*$','',m,flags=re.M))
