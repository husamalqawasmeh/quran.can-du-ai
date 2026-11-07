// how often each name of Allah occurs. One of the page's ordered scripts (see the <script> list at the end of index.html).
'use strict';
/* ---------- عدد مرات ورود أسماء الله الحسنى (عنصر في شاشة الإحصاءات، وشارة على كل بطاقة اسم) ---------- */
const AMBIGUOUS = new Set(['الملك', 'الحق', 'الحي', 'الرب', 'الأول', 'الآخر', 'الظاهر', 'الباطن', 'المؤمن', 'الولي', 'المولى', 'البر', 'النور', 'السلام', 'الغني', 'الكبير', 'العزيز', 'الكريم', 'الأحد', 'الواحد', 'القوي', 'البصير', 'الشهيد', 'النصير', 'القريب', 'الهادي', 'الرحيم', 'الرؤوف', 'العليم', 'الحكيم', 'الحليم', 'الشكور', 'الخبير', 'الوكيل', 'الحسيب', 'الرقيب', 'المجيد', 'العلي', 'العظيم', 'الحفيظ', 'المهيمن', 'الجامع', 'الجبار']);
let ncData = null, ncSort = selGet('nc')?.s || 'most', ncMin = selGet('nc')?.m || 0;   // ncMin: leave out the names found fewer than this many times (0 = show all)
const NC_MINS = [3, 5, 10, 20, 50, 100];
async function loadNameCounts() {
  if (ncData) return ncData;
  try { ncData = await (await fetch('/names_counts.json')).json(); } catch { ncData = null; }
  return ncData;
}
async function renderNameCounts(box) {
  const data = await loadNameCounts(); await loadAF();
  if (!data) { box.innerHTML = '<p class="hint">تعذّر تحميل الأعداد.</p>'; return; }
  const T = TOPICS.names;
  const VF = await loadVerified();
  const all = T.items.filter((i) => i.g < 6 && data[i.t]).map((i, idx) => ({ t: i.t, g: i.g, idx, n: VF[i.t] ? VF[i.t].allah + VF[i.t].open : data[i.t].n, v: data[i.t].v }));
  const allah = all.find((r) => r.t === 'الله');                      // shown on its own above the table, not in the graph
  let rows = all.filter((r) => r.t !== 'الله');
  if (ncSort === 'most') rows.sort((a, b) => b.n - a.n); else if (ncSort === 'least') rows.sort((a, b) => a.n - b.n); else rows.sort((a, b) => a.g - b.g || a.idx - b.idx);
  const hidden = rows.filter((r) => r.n < ncMin).length; rows = rows.filter((r) => r.n >= ncMin);
  const max = Math.max(...rows.map((r) => r.n));
  const flagged = all.filter((r) => AMBIGUOUS.has(r.t)).length;
  const disclaimer = `<div class="disc"><b>تنبيه — طريقة العدّ:</b> عُدّ اللفظ نفسه في نص القرآن، بالألف واللام أو بدونهما، ومع حروف «و، ف، ب، ل، ك» الملتصقة بأوله؛ فمثلاً تُعدّ «للرحمن» من «الرحمن». والأسماء المركّبة مثل «ذو الجلال والإكرام» تُعدّ عند ورود العبارة كاملة.<br><b>تحفّظ:</b> لا يستطيع العدّ أن يعرف هل يُراد باللفظ الله أم غيره، فبعض الأعداد أكبر من الحقيقة. وقد وُضعت علامة <span class="wsign">⚠︎</span> على هذه الألفاظ (${nA(flagged)} من ${nA(all.length)})، ومنها «الملك» و«الحق» و«المؤمن» و«العظيم»، وتوضّح اللوحة ذلك في أعلاها. وقائمة <span class="wsign">⚠︎</span> اجتهاد بعد مراجعة الاستعمال القرآني، فيُرجى عرضها على أحد أهل العلم قبل الاعتماد على الأرقام الدقيقة.</div>`;
  const sorters = [['group', 'حسب المجموعات'], ['most', 'الأكثر ورودًا'], ['least', 'الأقل ورودًا']];
  let lastG = -1;
  const ab = document.getElementById('allahCount'); if (ab) ab.innerHTML = allah ? `<div class="allah"><span class="nm">الله</span><span class="num">${nA(allah.n)}</span></div>${AF ? `<p class="how afn">${afNote()}</p>` : ''}` : '';   // «الله» on its own, under its box
  box.innerHTML = `<p class="how">العدد هو مرات ورود <b>لفظ</b> الاسم في نص القرآن (بالألف واللام أو بدونهما، ومع حروف «و، ف، ب، ل، ك» الملتصقة بأوله)، والأسماء المركّبة تُعدّ بورود العبارة كاملة. والعدّ لا يفرّق بين ما يُراد به الله وغيره، فعلامة <span class="wsign">⚠︎</span> على الأسماء التي ترد في القرآن لغير الله أيضاً (كالملك والحق والحي والمؤمن والعظيم)، فعددها يزيد عن عدد ورودها اسماً لله. وهذه العلامة من اجتهادي في مراجعة الاستعمال القرآني. وطول الشريط يتناسب مع العدد، ويُعرض لفظ الجلالة وحده فوق الجدول. ويظهر العدد نفسه على بطاقة كل اسم في شاشة «أسماء الله الحسنى».</p>
    <div class="nsort">${sorters.map(([k, n]) => `<button class="btn${ncSort === k ? ' on' : ''}" data-s="${k}">${n}</button>`).join('')}<label class="btn nhide${ncMin ? ' on' : ''}">إخفاء ما ورد أقل من <select aria-label="الحد الأدنى لمرات الورود">${[0, ...NC_MINS].map((k) => `<option value="${k}"${k === ncMin ? ' selected' : ''}>${k ? nA(k) + (k > 10 ? ' مرة' : ' مرات') : '— (إظهار الكل)'}</option>`).join('')}</select>${ncMin ? ` <small>(المخفي: ${nA(hidden)})</small>` : ''}</label></div>
    <div class="key"><span class="wsign">⚠︎</span> = هذا اللفظ يرد في القرآن لغير الله أيضاً، فالعدد يشمل كل ورود اللفظ وليس وروده اسماً لله فقط.</div>
    <div class="cr head"><span>الاسم</span><span></span><span style="text-align:end">مرات الورود</span><span style="text-align:end">في آيات</span></div>` +
    rows.map((r) => {
      let sep = '';
      if (ncSort === 'group' && r.g !== lastG) { lastG = r.g; sep = `<div class="tag" style="margin:10px 0 2px;color:var(--accent);font-weight:700">${esc(T.groups[r.g][0] + ' ' + T.groups[r.g][1])}</div>`; }
      return sep + `<div class="cr"><span class="nm">${VF[r.t] && !VF[r.t].open ? '<span class="warn ok" title="تحقق منه المتطوعون: العدد عدد وروده اسماً لله">✓</span>' : AMBIGUOUS.has(r.t) ? '<span class="warn" title="يرد هذا اللفظ في القرآن لغير الله أيضاً">⚠</span>' : '<span class="warn"></span>'}${esc(r.t)}</span><div class="ab"><i style="width:${(100 * r.n) / max}%"></i></div><span class="num">${nA(r.n)}</span><span class="vv">${nA(r.v)}</span></div>`;
    }).join('') + disclaimer;
  box.querySelector('.nsort').onclick = (e) => { const b = e.target.closest('button[data-s]'); if (b) { ncSort = b.dataset.s; selSet('nc', { s: ncSort, m: ncMin }); renderNameCounts(box); } };
  box.querySelector('.nhide select').onchange = (e) => { ncMin = +e.target.value; selSet('nc', { s: ncSort, m: ncMin }); renderNameCounts(box); };
}
route();
