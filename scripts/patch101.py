import re, json
p='public/index.html'; h=open(p,encoding='utf8').read()
cats=[
 ('👤','أسماء أنبياء وأشخاص',[3,10,11,12,14,19,21,31,47,71],''),
 ('🐪','حيوانات وحشرات',[2,6,16,27,29,100,105],''),
 ('🌌','ظواهر الكون والطبيعة',[13,24,51,53,54,77,79,85,86,89,91,92,93,95,113],''),
 ('⏳','يوم القيامة وأحواله',[44,45,56,59,64,69,70,75,78,81,82,84,88,99,101],''),
 ('👥','أقوام وفئات من الناس',[4,26,30,33,34,37,39,58,60,63,72,76,83,104,106,109,114],''),
 ('📍','أماكن ومواضع',[7,15,18,46,52,90],''),
 ('🧱','أشياء وأدوات',[5,57,68,107,108,111],''),
 ('📜','أحداث وشعائر وأحكام',[8,9,17,22,48,49,61,62,65,66,80,94,97,110],''),
 ('🕋','القرآن والوحي والقيم',[1,23,25,28,32,35,41,42,43,73,74,96,98,102,103],''),
 ('💚','أسماء الله وصفاته والتوحيد',[40,55,67,87,112],''),
 ('🔤','حروف مقطعة',[20,36,38,50],''),
]
ids=[i for c in cats for i in c[2]]
assert sorted(ids)==list(range(1,115))
js="  const SCAT = "+json.dumps([[c[0],c[1],c[2],c[3]] for c in cats],ensure_ascii=False)+";\n"
js+="""  const catPanel = () => {
    const by = Object.fromEntries(S.surahs.map((s) => [s.id, s]));
    return `<p class="how">تصنيف أسماء السور الـ ١١٤ بحسب ما يدل عليه اسم السورة. وهذا التصنيف اجتهاد مني بعد النظر في معنى كل اسم، وليس نصاً ثابتاً؛ فبعض الأسماء يحتمل أكثر من تصنيف، وقد وضعتُ كل سورة في تصنيف واحد. ويُعرض اسم السورة بعدد آياتها.</p>` +
      SCAT.map(([ic, name, list, note], idx) => `<h3 class="ptl${idx && idx % 3 === 0 ? ' gsp' : ''}"><span>${ic}</span> ${esc(name)} <small>(${N(list.length)} سورة · ${N(list.reduce((a, i) => a + by[i].verses, 0))} آية)</small></h3><div class="chips">${list.map((i) => `<span class="chip">${esc(by[i].ar)} <small>${N(by[i].verses)}</small></span>`).join('')}</div>`).join('');
  };
"""
o="  const kpi = (v, l) =>"
assert h.count(o)==1 and 'const SCAT' not in h
h=h.replace(o,js+o)
open(p,'w',encoding='utf8').write(h)
m=re.search(r'<script type="module">([\s\S]*?)</script>',h).group(1)
open('tmp_check.mjs','w',encoding='utf8').write(re.sub(r'^import .*$','',m,flags=re.M))
