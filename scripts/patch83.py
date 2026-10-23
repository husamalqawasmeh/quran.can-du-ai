import re
p='public/index.html'; h=open(p,encoding='utf8').read()
def rep(o,n):
    global h
    assert h.count(o)==1,o[:60]; h=h.replace(o,n,1)
rep("  const kpi = (v, l) =>","""  let P = null; try { P = await (await fetch('/pos.json')).json(); } catch { /* panel is skipped */ }
  const posPanel = () => {
    const c = P.cats, T = P.total, row = (k, n, ind) => `<div class="srow${ind ? ' sub' : ''}"><span class="k">${esc(k)}</span><div class="sbarw"><i style="width:${(100 * n) / c.noun}%"></i></div><span class="v">${N(n)} · ${pct(n, T)}</span></div>`;
    const rows = [
      ['الأسماء (عدا ما يأتي بعدها)', c.noun, 0], ['منها: اسم الفاعل', c.actPcpl, 1], ['منها: اسم المفعول', c.passPcpl, 1], ['منها: المصدر', c.vn, 1],
      ['الصفات', c.adj, 0], ['أسماء الأعلام (أشخاص وأماكن)', c.pn, 0],
      ['الأفعال', c.verb, 0], ['منها: الماضي', c.verbPerf, 1], ['منها: المضارع', c.verbImpf, 1], ['منها: الأمر', c.verbImpv, 1], ['منها: المبني للمجهول', c.verbPass, 1],
      ['الضمائر المتصلة (كالهاء والكاف والواو)', c.pronAttached, 0], ['الضمائر المنفصلة (هو، نحن، أنت…)', c.pronSeparate, 0],
      ['الأسماء الموصولة (الذي، الذين، ما، من)', c.rel, 0], ['أسماء الإشارة (هذا، ذلك، أولئك)', c.dem, 0], ['أسماء الاستفهام', c.intg, 0],
      ['ظروف الزمان (يوم، إذ، حين…)', c.timeAdv, 0], ['ظروف المكان (عند، بين، فوق…)', c.placeAdv, 0],
      ['الحروف', c.particle, 0], ['منها: «ال» التعريف', c.pDet, 1], ['منها: حروف العطف', c.pConj, 1], ['منها: حروف الاستئناف', c.pRem, 1], ['منها: حروف النفي', c.pNeg, 1],
      ['منها: حروف التوكيد', c.pEmph, 1], ['منها: حروف الشرط', c.pCond, 1], ['منها: حروف النداء', c.pAddr, 1], ['منها: غيرها (جرّ ونصب وغيرها)', c.pOther + c.pIntg, 1],
    ].map(([k, n, i]) => row(k, n, i)).join('');
    const top = (title, arr, uniq) => `<h3 class="ptl">${title} <small>(${N(uniq)} لفظاً مختلفاً)</small></h3>` + bars(arr.map((x) => ({ k: x.w, n: x.n })), arr[0].n, (r) => N(r.n));
    return `<p class="how">الأرقام عدد <b>الأجزاء الصرفية</b> في نص القرآن: الكلمة المركّبة مثل «وبالله» تُعدّ أجزاءً (حرف عطف + حرف جر + اسم). ومجموعها ${N(T)} جزءاً، وهو أكثر من عدد الكلمات. والتصنيف من «مدونة القرآن العربية» (Quranic Arabic Corpus) كما في مستودع quran-morphology، وهو اجتهاد لغوي قد يخالفه بعض النحاة في مواضع قليلة.</p>` +
      rows + top('أكثر الأسماء ورودًا', P.top.noun, P.unique.noun) + top('أكثر الصفات ورودًا', P.top.adj, P.unique.adj) + top('أكثر الأفعال ورودًا (بجذر الفعل)', P.top.verb, P.unique.verb) + top('أكثر أسماء الأعلام ورودًا', P.top.pn, P.unique.pn);
  };
  const kpi = (v, l) =>""")
rep("    panel('أكثر ٣٠ كلمة تكراراً',","    (P ? panel('أنواع الكلمات: الأسماء والصفات والأفعال والحروف', posPanel(), false) : '') +\n    panel('أكثر ٣٠ كلمة تكراراً',")
rep("</style>","#statsBody .srow.sub{padding-inline-start:18px;opacity:.9;font-size:.9em}\n#statsBody .ptl{margin:18px 0 6px;font-size:1.05rem;color:var(--accent)}#statsBody .ptl small{color:var(--muted);font-weight:400}\n</style>")
open(p,'w',encoding='utf8').write(h)
m=re.search(r'<script type="module">([\s\S]*?)</script>',h).group(1)
open('tmp_check.mjs','w',encoding='utf8').write(re.sub(r'^import .*$','',m,flags=re.M))
