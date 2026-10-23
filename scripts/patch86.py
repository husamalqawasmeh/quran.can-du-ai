import re
p='public/index.html'; h=open(p,encoding='utf8').read()
a=h.index("function renderSurahs() {"); b=h.index("async function loadSurahs()")
new = r'''// juz sections: a surah is listed in EVERY juz it touches (it touches juz j if it ends after the juz starts and begins before the next juz starts)
const cmpKey = (s, a, s2, a2) => (s - s2) || (a - a2);
const juzSurahs = (j) => { const st = JUZ_START[j - 1], nx = JUZ_START[j]; return surahs.filter((s) => cmpKey(s.id, s.verses, st[0], st[1]) >= 0 && (!nx || cmpKey(s.id, 1, nx[0], nx[1]) < 0)); };
function renderSurahs() {
  const q = $('ssearch').value.trim().replace(/[ً-ٟ]/g, '').replace(/[إأآٱ]/g, 'ا');
  const sections = juzOn && !q;
  $('sgrid').classList.toggle('juz', sections);
  const card = (s, shared) => `<details class="sr${shared ? ' jshare' : ''}" data-n="${s.id}"><summary><span class="n">${nA(s.id)}</span><span class="nm">${esc(s.ar)}</span><span class="m">${s.place === 'makkah' ? 'مكية' : 'مدنية'} · ${nA(s.verses)} آية</span></summary>
     <div class="body"><a class="tag" href="https://quran.com/${s.id}" target="_blank" rel="noopener noreferrer" style="color:var(--acc)">📖 افتح السورة في المصحف (Quran.com)</a><br>
     <select aria-label="القارئ">${readerOptions()}</select><div class="tag msg"></div><audio controls preload="none" hidden></audio>
     <details class="vs" data-n="${s.id}"><summary>📜 نص السورة (${nA(s.verses)} آية)</summary><div class="vtext"><span class="tag">جارٍ التحميل…</span></div></details></div></details>`;
  if (sections) {
    const count = {}; for (let j = 1; j <= 30; j++) juzSurahs(j).forEach((s) => { count[s.id] = (count[s.id] || 0) + 1; });
    $('sgrid').innerHTML = Array.from({ length: 30 }, (_, k) => k + 1).map((j) => `<div class="jsec${j === 10 || j === 20 ? ' jbig' : ''}"><div class="jgrid">${juzSurahs(j).map((s) => card(s, count[s.id] > 1)).join('')}</div></div>`).join('');
    return;
  }
  $('sgrid').innerHTML = surahs.filter((s) => !q || s.ar.replace(/[إأآٱ]/g, 'ا').includes(q) || String(s.id) === q || s.en.toLowerCase().includes(q.toLowerCase())).map((s) => card(s, false) + (!q && s.id % 20 === 0 && s.id < 114 ? '<div class="jgap s20"></div>' : '')).join('')
    || '<p class="hint">لا توجد نتائج.</p>';
}
'''
h=h[:a]+new+h[b:]
# css
a=h.index("#sgrid .jgap{grid-column:1/-1;height:26px}"); b=h.index("#sOpen,#sClose{")
h=h[:a]+"""#sgrid .jgap{grid-column:1/-1;height:16px}
#sgrid.juz{display:block}
#sgrid .jsec{border:2px solid var(--line);border-radius:16px;padding:10px;margin-bottom:14px;background:var(--card)}
#sgrid .jsec.jbig{margin-bottom:38px}
#sgrid .jgrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;align-items:start}
@media(max-width:1000px){#sgrid .jgrid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:640px){#sgrid .jgrid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:380px){#sgrid .jgrid{grid-template-columns:1fr}}
#sgrid .sr.jshare{background:color-mix(in srgb,#e0a030 22%,var(--panel));border-color:#e0a030}
"""+h[b:]
open(p,'w',encoding='utf8').write(h)
m=re.search(r'<script type="module">([\s\S]*?)</script>',h).group(1)
open('tmp_check.mjs','w',encoding='utf8').write(re.sub(r'^import .*$','',m,flags=re.M))
