import re, sys
sys.stdout.reconfigure(encoding='utf-8')
p='public/index.html'; h=open(p,encoding='utf8').read()
def rep(o,n):
    global h
    assert o in h,o[:70]; h=h.replace(o,n,1)

card = '''  <div class="card" id="walid" style="margin-top:14px">
    <h3 class="wh">شهادة من خصوم القرآن: الوليد بن المغيرة</h3>
    <p>كان الوليد بن المغيرة المخزومي من سادة قريش وأعلمهم بالشعر والكلام، وهو غير مسلم. وتروي كتب السيرة والتفسير أنه سمع القرآن من النبي ﷺ فتأثر به، فلما سألته قريش عن رأيه قال:</p>
    <blockquote class="quote">«والله إنَّ لهُ لحلاوةً، وإنَّ عليهِ لطلاوةً، وإنهُ لَمُثمِرٌ أعلاهُ، مُغدِقٌ أسفلُهُ، وإنهُ ليعلو ولا يُعلى عليه»</blockquote>
    <p>وتذكر الروايات أنه ردّ على اتهامات قريش للقرآن وصاحبه، فنفى أن يكون شعراً، لأنه خبر الشعر كله رجزه وقصيده فلم يجده يشبهه، ونفى أن يكون سحراً أو جنوناً، لأنه عرف السحر والجنون ولم يجد القرآن منهما.</p>
    <p>ثم لما ألحّت عليه قريش، وتروي بعض الروايات أن أبا جهل ضغط عليه، قال: «إن هذا إلا سحر يُؤثر»، ولم يُسلم. فنزلت في موقفه آيات من سورة المدثر. ويذكر العلماء هذه الواقعة في باب بلاغة القرآن لأن الشهادة بجماله جاءت من خصم عارف بالكلام، وتختلف ألفاظ الروايات بين كتب السيرة والتفسير.</p>
    <details class="lesson" data-keys="74:18,74:19,74:20,74:21,74:22,74:23,74:24,74:25"><summary>الآيات التي نزلت في موقفه (المدثر)</summary><div class="exs"><div class="tag">جارٍ تحميل الآيات…</div></div></details>
  </div>
'''
rep('  <div style="margin-top:14px"><a class="btn pri" href="#surahs"', card + '  <div style="margin-top:14px"><a class="btn pri" href="#surahs"')
rep("</style>", """.quote{margin:10px 0;padding:10px 18px;border-inline-start:4px solid var(--accent);background:var(--panel);border-radius:0 10px 10px 0;font-size:1.45rem;line-height:2.1;font-family:"Amiri","Traditional Arabic","Noto Naskh Arabic",serif}
#walid .wh{margin:0 0 8px;color:var(--accent);font-size:1.15rem}
#walid p{margin:6px 0}
</style>""")
rep("route();\n</script>", """/* generic lazy loader for <details data-keys="s:a,s:a"> panels (verse texts straight from Quran.com) */
document.addEventListener('toggle', async (e) => {
  const d = e.target;
  if (!(d instanceof HTMLDetailsElement) || !d.dataset.keys || !d.open || d.dataset.done) return;
  d.dataset.done = 1; const box = d.querySelector('.exs'), keys = d.dataset.keys.split(',');
  try {
    let vs = []; for (let k = 0; k < keys.length; k += 8) vs = vs.concat(await (await fetch('/api/ayat?keys=' + keys.slice(k, k + 8).join(','))).json());
    box.innerHTML = vs.map((v) => `<div class="ex"><div class="vt">${esc(v.text)}</div><div class="tag">سورة ${esc(v.surah_ar)} — الآية ${nA(v.ayah)}</div></div>`).join('') || '<div class="tag">تعذّر تحميل الآيات.</div>';
  } catch { box.innerHTML = '<div class="tag">تعذّر تحميل الآيات.</div>'; }
}, true);
route();
</script>""")
open(p,'w',encoding='utf8').write(h)
m=re.search(r'<script type="module">([\s\S]*?)</script>',h).group(1)
open('tmp_check.mjs','w',encoding='utf8').write(re.sub(r'^import .*$','',m,flags=re.M))
print('ok')
