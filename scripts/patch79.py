import re, sys
p='public/index.html'; h=open(p,encoding='utf8').read()
def rep(o,n):
    global h
    assert h.count(o)==1,o[:60]; h=h.replace(o,n,1)
rep('<button class="btn" id="sClose">▴ طيّ الكل</button></div>','<button class="btn" id="sClose">▴ طيّ الكل</button><button class="btn" id="sJuz" aria-pressed="false">🎨 تحديد الأجزاء للسور</button></div>')
rep('#sOpen,#sClose{min-width:150px;','#sJuz{min-width:150px;padding-block:10px;font-size:1rem}\n#sJuz[aria-pressed=true]{border-color:var(--accent);color:var(--accent)}\n#sgrid .jgap{grid-column:1/-1;height:26px}\n#sgrid.juz .sr.ja{background:color-mix(in srgb,var(--accent) 16%,var(--panel))}\n#sgrid.juz .sr.jb{background:color-mix(in srgb,#e0a030 18%,var(--panel))}\n#sOpen,#sClose{min-width:150px;')
rep("function renderSurahs() {","""const JUZ_START = [[1,1],[2,142],[2,253],[3,93],[4,24],[4,148],[5,82],[6,111],[7,88],[8,41],[9,93],[11,6],[12,53],[15,2],[17,1],[18,75],[21,1],[23,1],[25,21],[27,56],[29,46],[33,31],[36,28],[39,32],[41,47],[46,1],[51,31],[58,1],[67,1],[78,1]];
const juzOf = (id) => JUZ_START.filter(([s, a]) => s < id || (s === id && a === 1)).length;   // the juz in which the surah begins
let juzOn = false;
function renderSurahs() {""")
rep("  $('sgrid').innerHTML = surahs.filter(","  $('sgrid').classList.toggle('juz', juzOn);\n  let lastJ = 0;\n  $('sgrid').innerHTML = surahs.filter(")
rep("(s) =>\n    `<details class=\"sr\" data-n=\"${s.id}\">","(s) => {\n    const j = juzOn ? juzOf(s.id) : 0, gap = juzOn && !q && lastJ && ((lastJ <= 10 && j > 10) || (lastJ <= 20 && j > 20)) ? '<div class=\"jgap\"></div>' : ''; if (j) lastJ = j;\n    return gap + `<details class=\"sr${j ? (j % 2 ? ' ja' : ' jb') : ''}\" data-n=\"${s.id}\">")
rep("</div></details>`).join('')\n    || '<p class=\"hint\">لا توجد نتائج.</p>';","</div></details>`; }).join('')\n    || '<p class=\"hint\">لا توجد نتائج.</p>';")
rep("$('ssearch').oninput =","$('sJuz').onclick = (e) => { juzOn = !juzOn; e.currentTarget.setAttribute('aria-pressed', juzOn); if (surahs) renderSurahs(); };\n$('ssearch').oninput =")
open(p,'w',encoding='utf8').write(h)
m=re.search(r'<script type="module">([\s\S]*?)</script>',h).group(1)
open('tmp_check.mjs','w',encoding='utf8').write(re.sub(r'^import .*$','',m,flags=re.M))
