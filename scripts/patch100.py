import re
p='public/index.html'; h=open(p,encoding='utf8').read()
a=h.index("  const posPanel = () => {"); b=h.index("  const kpi = (v, l) =>")
new = r'''  const posPanel = () => {
    const c = P.cats, T = P.total;
    // [label, count, examples, indent]  — an indented row is a part of the row above it
    const G = [
      { k: 'noun', name: 'الأسماء', desc: 'كل كلمة تدل على ذات أو معنى (إنسان، شيء، مكان، زمن، صفة) بلا زمن', rows: [
        ['الأسماء العامة', c.noun, 'رب، أرض، قوم، يوم، عذاب'],
        ['اسم الفاعل', c.actPcpl, 'كافر، صادق، عالم، ظالم', 1], ['اسم المفعول', c.passPcpl, 'مبعوث، مسحور، مقتول', 1], ['المصدر', c.vn, 'ذكر، علم، خلق، عمل', 1],
        ['الصفات', c.adj, 'رحيم، عظيم، عليم، حكيم، رحمن'], ['أسماء الأعلام', c.pn, 'الله، موسى، مريم، مصر'],
        ['ظروف الزمان', c.timeAdv, 'يوم، إذ، حين، بعد'], ['ظروف المكان', c.placeAdv, 'عند، بين، فوق، تحت'], ['أسماء أخرى ملتصقة', c.otherN, '']] },
      { k: 'verb', name: 'الأفعال', desc: 'كل كلمة تدل على حدث مقترن بزمن', rows: [
        ['الفعل الماضي', c.verbPerf, 'قال، كان، آمن، جاء'], ['الفعل المضارع', c.verbImpf, 'يقول، تعلمون، يعبدون'], ['فعل الأمر', c.verbImpv, 'قل، اعبدوا، اتقوا'],
        ['المبني للمجهول (من الأفعال أعلاه)', c.verbPass, 'قُتل، أُنزل، خُلق', 1, 1]] },
      { k: 'pron', name: 'الضمائر وأسماء الإشارة والموصول والاستفهام', desc: 'أسماء تحلّ محل غيرها أو تشير إليه أو تسأل عنه', rows: [
        ['الضمائر المتصلة', c.pronAttached, 'ـه، ـهم، ـك، ـنا، ـكم'], ['الضمائر المنفصلة', c.pronSeparate, 'هو، هم، أنت، نحن'],
        ['الأسماء الموصولة', c.rel, 'الذي، الذين، التي، ما، من'], ['أسماء الإشارة', c.dem, 'هذا، ذلك، أولئك، تلك'], ['أسماء الاستفهام', c.intg, 'من، ما، أين، كيف']] },
      { k: 'part', name: 'الحروف', desc: 'كلمات ربط ومعنى لا يكتمل معناها وحدها', rows: [
        ['«ال» التعريف', c.pDet, 'الـ'], ['حروف العطف', c.pConj, 'و، ف، ثم، أو'], ['حروف الاستئناف', c.pRem, 'و، ف'], ['حروف النفي', c.pNeg, 'لا، ما، لم، لن'],
        ['حروف التوكيد', c.pEmph, 'لـ، قد'], ['حروف الشرط', c.pCond, 'إن، لو، لولا'], ['حروف النداء', c.pAddr, 'يا'], ['حروف أخرى (جر ونصب وغيرها)', c.pOther + c.pIntg, 'من، في، على، إلى، أن، إنّ']] },
    ];
    const tot = (g) => g.rows.filter((r) => !r[4]).reduce((a, r) => a + (r[3] ? 0 : r[1]), 0);
    const sum = G.map(tot), all = sum.reduce((a, b) => a + b, 0);
    const strip = `<div class="pstack">${G.map((g, i) => `<i class="pc-${g.k}" style="width:${(100 * sum[i]) / all}%"></i>`).join('')}</div><div class="pleg">${G.map((g, i) => `<span><b class="pc-${g.k}"></b>${esc(g.name.split(' ')[0])} ${pct(sum[i], all)}</span>`).join('')}</div>`;
    const block = (g, i) => `<section class="pg pc-${g.k}"><div class="pgh"><h4>${esc(g.name)}</h4><div class="pgn"><b>${N(sum[i])}</b><small>${pct(sum[i], all)} من الكل</small></div></div><p class="pgd">${esc(g.desc)}</p>` +
      g.rows.filter((r) => r[1]).map(([lab, n, ex, ind]) => `<div class="pr${ind ? ' pi' : ''}"><div class="pl"><b>${esc(lab)}</b>${ex ? `<small>${esc(ex)}</small>` : ''}</div><div class="pb"><i style="width:${Math.max(1.5, (100 * n) / sum[i])}%"></i></div><div class="pv"><b>${N(n)}</b><small>${pct(n, all)}</small></div></div>`).join('') + '</section>';
    const top = (title, arr, uniq) => `<h3 class="ptl">${title} <small>(${N(uniq)} لفظاً مختلفاً)</small></h3>` + bars(arr.map((x) => ({ k: x.w, n: x.n })), arr[0].n, (r) => N(r.n));
    return `<p class="how">كل كلمة في القرآن تُقسَّم إلى أجزائها (فـ«وبالله» ثلاثة أجزاء: و + بـ + الله)، فمجموع الأجزاء ${N(all)} وهو أكثر من عدد الكلمات. وطول كل شريط نسبة الجزء من <b>مجموعه داخل بطاقته</b>، والنسبة المئوية بجانبه من <b>كل الأجزاء</b>.<br>التصنيف من «مدونة القرآن العربية» (Quranic Arabic Corpus)، وهو اجتهاد لغوي قد يخالفه بعض النحاة، وعدد «الصفات» أقل من الواقع لأن المدونة تصنّف كثيراً منها تحت اسم الفاعل أو الأسماء.</p>` + strip + G.map(block).join('') +
      top('أكثر الأسماء ورودًا', P.top.noun, P.unique.noun) + top('أكثر الصفات ورودًا', P.top.adj, P.unique.adj) + top('أكثر الأفعال ورودًا (بجذر الفعل)', P.top.verb, P.unique.verb) + top('أكثر أسماء الأعلام ورودًا', P.top.pn, P.unique.pn);
  };
'''
h=h[:a]+new+h[b:]
# css: drop the old wide-row rules, add the new design
h=re.sub(r"#statsBody \.srow\.wide\{[^\n]*\n","",h)
h=h.replace("</style>","""/* word classes: four coloured cards */
.pc-noun{--cc:#4c8dff}.pc-verb{--cc:#3fb99a}.pc-pron{--cc:#b388ff}.pc-part{--cc:#f5a524}
.pstack{display:flex;height:16px;border-radius:8px;overflow:hidden;margin:10px 0 6px}.pstack i{display:block;height:100%;background:var(--cc)}
.pleg{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:.9rem;margin-bottom:14px}.pleg span{display:inline-flex;align-items:center;gap:6px}.pleg b{width:12px;height:12px;border-radius:3px;background:var(--cc);display:inline-block}
.pg{border:2px solid var(--cc);border-radius:14px;padding:10px 14px 8px;margin:0 0 14px;background:color-mix(in srgb,var(--cc) 7%,var(--panel))}
.pgh{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}.pgh h4{margin:0;color:var(--cc);font-size:1.2rem}
.pgn{text-align:end;white-space:nowrap}.pgn b{font-size:1.3rem}.pgn small{display:block;color:var(--muted);font-size:.78rem}
.pgd{margin:2px 0 8px;color:var(--muted);font-size:.88rem}
.pr{display:grid;grid-template-columns:minmax(14em,24em) 1fr 6.5em;gap:12px;align-items:center;padding:6px 0;border-top:1px solid color-mix(in srgb,var(--cc) 25%,transparent)}
.pr.pi{padding-inline-start:22px;opacity:.92}.pr.pi .pl b::before{content:"↳ ";color:var(--cc)}
.pl b{display:block;font-size:1rem}.pl small{display:block;color:var(--muted);font-size:.8rem}
.pb{height:12px;background:color-mix(in srgb,var(--cc) 16%,transparent);border-radius:6px;overflow:hidden}.pb i{display:block;height:100%;background:var(--cc);border-radius:6px}
.pv{text-align:end}.pv b{display:block}.pv small{color:var(--muted);font-size:.78rem}
@media(max-width:700px){.pr{grid-template-columns:1fr 5.5em;grid-template-areas:"l v" "b b"}.pr .pl{grid-area:l}.pr .pv{grid-area:v}.pr .pb{grid-area:b}}
</style>""")
open(p,'w',encoding='utf8').write(h)
m=re.search(r'<script type="module">([\s\S]*?)</script>',h).group(1)
open('tmp_check.mjs','w',encoding='utf8').write(re.sub(r'^import .*$','',m,flags=re.M))
