import re
p='public/index.html'; h=open(p,encoding='utf8').read()
def rep(o,n):
    global h
    assert h.count(o)==1,o[:60]; h=h.replace(o,n,1)
cats=[
 ('👤','أسماء أنبياء وأشخاص',[3,10,11,12,14,19,21,31,47,71],'سور سُمّيت بنبي أو رجل صالح أو آل بيت صالح'),
 ('🐪','حيوانات وحشرات',[2,6,16,27,29,100,105],'سور سُمّيت بحيوان أو حشرة أو أنعام'),
 ('🌌','ظواهر الكون والطبيعة',[13,24,51,53,54,77,79,85,86,89,91,92,93,95,113],'رعد ونور ورياح ونجم وقمر وشمس وليل وضحى وغيرها'),
 ('⏳','يوم القيامة وأحواله',[44,45,56,59,64,69,70,75,78,81,82,84,88,99,101],'أسماء ليوم القيامة أو أحداثه أو علاماته'),
 ('👥','أقوام وفئات من الناس',[4,26,30,33,34,37,39,58,60,63,72,76,83,104,106,109,114],'سور سُمّيت بجماعة أو فئة أو قوم'),
 ('📍','أماكن ومواضع',[7,15,18,46,52,90],'سور سُمّيت بمكان أو جبل أو بلد أو منزل'),
 ('🧱','أشياء وأدوات',[5,57,68,107,108,111],'مائدة وحديد وقلم وماعون وكوثر وحبل'),
 ('📜','أحداث وشعائر وأحكام',[8,9,17,22,48,49,61,62,65,66,94,97,110],'أنفال وتوبة وإسراء وحج وفتح وطلاق وغيرها'),
 ('🕋','القرآن والوحي والقيم',[1,23,25,28,32,35,41,42,43,73,74,96,98,102,103],'فاتحة وفرقان وقصص وعلق وعصر وتكاثر وغيرها'),
 ('💚','أسماء الله وصفاته والتوحيد',[40,55,67,87,112],'غافر والرحمن والملك والأعلى والإخلاص'),
 ('🔤','حروف مقطعة',[20,36,38,50],'سور سُمّيت بالحرف أو الحروف التي افتُتحت بها'),
]
ids=[i for c in cats for i in c[2]]
miss=sorted(set(range(1,115))-set(ids)); dup=sorted({i for i in ids if ids.count(i)>1})
print('missing',miss,'dup',dup,len(ids))
import json
js="  const SCAT = "+json.dumps([[c[0],c[1],c[2],c[3]] for c in cats],ensure_ascii=False)+";\n"
rep("  const kpi = (v, l) =>",js+"""  const catPanel = () => {
    const by = Object.fromEntries(S.surahs.map((s) => [s.id, s]));
    return `<p class="how">تصنيف أسماء السور الـ ١١٤ بحسب ما يدل عليه اسم السورة. وهذا التصنيف اجتهاد مني بعد النظر في معنى كل اسم، وليس نصاً ثابتاً؛ فبعض الأسماء يحتمل أكثر من تصنيف، وقد وضعتُ كل سورة في تصنيف واحد. ويُعرض اسم السورة بعدد آياتها.</p>` +
      SCAT.map(([ic, name, list, note]) => `<h3 class="ptl"><span>${ic}</span> ${esc(name)} <small>(${N(list.length)} سورة · ${N(list.reduce((a, i) => a + by[i].verses, 0))} آية)</small></h3><div class="tag" style="margin-bottom:6px">${esc(note)}</div><div class="chips">${list.map((i) => `<span class="chip">${esc(by[i].ar)} <small>${N(by[i].verses)}</small></span>`).join('')}</div>`).join('');
  };
  const kpi = (v, l) =>""")
rep("    panel('أكثر ٣٠ كلمة تكراراً',","    panel('تصنيف أسماء السور', catPanel(), false) +\n    panel('أكثر ٣٠ كلمة تكراراً',")
rep("</style>","#statsBody .chips{display:flex;flex-wrap:wrap;gap:6px}#statsBody .chip{padding:4px 12px;border:1px solid var(--stat-line);border-radius:99px;background:var(--panel);font-size:.95rem}#statsBody .chip small{color:var(--muted);font-size:.75em;margin-inline-start:4px}\n</style>")
open(p,'w',encoding='utf8').write(h)
m=re.search(r'<script type="module">([\s\S]*?)</script>',h).group(1)
open('tmp_check.mjs','w',encoding='utf8').write(re.sub(r'^import .*$','',m,flags=re.M))
