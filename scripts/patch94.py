import re
p='public/index.html'; h=open(p,encoding='utf8').read()
def rep(o,n):
    global h
    assert h.count(o)==1,o[:70]; h=h.replace(o,n,1)
# card signature: style string
rep("const card = (s, shared, pos) => `<details class=\"sr${shared ? ' jshare' : ''}\"${pos ? ` style=\"--c:${pos[0]};--r:${pos[1]}\"` : ''} data-n","const card = (s, shared, style) => `<details class=\"sr${shared ? ' jshare' : ''}\"${style ? ` style=\"${style}\"` : ''} data-n")
a=h.index("  if (sections) {"); b=h.index("  $('sgrid').innerHTML = surahs.filter(",a)
new = r'''  if (sections) {
    // one master grid: a juz is a band of rows with its own background box; a surah that spans several juz is ONE card stretched from its first band to its last
    const C = juzCols(); lastC = C;
    const count = {}; for (let j = 1; j <= 30; j++) juzSurahs(j).forEach((s) => { count[s.id] = (count[s.id] || 0) + 1; });
    const bands = [], first = {}, end = {}, rowsT = []; let col = {}, R = 1;
    for (let j = 1; j <= 30; j++) {
      const list = juzSurahs(j), pos = {}; let c0 = col[list[0].id] || 1; if (c0 > C) c0 = 1;        // a continued surah keeps its column; the others follow it in reading order
      let rows = 1; list.forEach((s, k) => { const n = c0 - 1 + k; pos[s.id] = [(n % C) + 1, Math.floor(n / C) + 1]; rows = Math.max(rows, pos[s.id][1]); });
      col = {}; list.forEach((s) => { col[s.id] = pos[s.id][0]; const r = R + pos[s.id][1] - 1; if (!first[s.id]) first[s.id] = [r, pos[s.id][0]]; end[s.id] = r + 1; });
      bands.push({ j, R, rows, list }); for (let i = 0; i < rows; i++) rowsT.push('minmax(50px,auto)'); rowsT.push(j === 10 || j === 20 ? '40px' : '14px'); R += rows + 1;
    }
    const done = new Set();
    $('sgrid').style.gridTemplateColumns = `36px repeat(${C},minmax(0,1fr))`; $('sgrid').style.gridTemplateRows = rowsT.join(' ');
    $('sgrid').innerHTML = bands.map(({ j, R: r0, rows, list }) => `<div class="jbg" style="grid-column:1/-1;grid-row:${r0}/${r0 + rows}"></div><span class="jnum" style="grid-column:1;grid-row:${r0}" title="الجزء ${nA(j)}">${nA(j)}</span>` +
      list.filter((s) => !done.has(s.id) && done.add(s.id)).map((s) => { const [r, c] = first[s.id]; return card(s, count[s.id] > 1, `grid-column:${c + 1};grid-row:${r}/${end[s.id]};align-self:${end[s.id] - r > 1 ? 'stretch' : 'start'}`); }).join('')).join('');
    return;
  }
  $('sgrid').style.gridTemplateColumns = $('sgrid').style.gridTemplateRows = '';
'''
h=h[:a]+new+h[b:]
rep("const cmpKey =","const juzCols = () => (innerWidth > 1000 ? 4 : innerWidth > 640 ? 3 : innerWidth > 380 ? 2 : 1);\nlet lastC = 0;\nwindow.addEventListener('resize', () => { if (juzOn && surahs && !$('ssearch').value.trim() && juzCols() !== lastC) renderSurahs(); });\nconst cmpKey =")
# css
a=h.index("#sgrid .jsec{border:2px solid"); b=h.index("#sgrid .sr.jshare")
h=h[:a]+"""#sgrid.juz{display:grid;gap:12px;align-items:start;padding-inline:10px}
#sgrid .jbg{margin:-10px;border:2px solid var(--line);border-radius:16px;background:var(--card);pointer-events:none}
#sgrid .jnum{align-self:start;justify-self:center;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border:2px solid var(--accent);border-radius:8px;color:var(--accent);font-weight:700;font-size:.95rem;background:var(--panel);position:relative;z-index:1}
#sgrid.juz>.sr{position:relative;z-index:1}
"""+h[b:]
h=h.replace("#sgrid.juz{display:block}\n","")
open(p,'w',encoding='utf8').write(h)
m=re.search(r'<script type="module">([\s\S]*?)</script>',h).group(1)
open('tmp_check.mjs','w',encoding='utf8').write(re.sub(r'^import .*$','',m,flags=re.M))
