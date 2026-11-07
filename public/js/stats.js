// the linguistic statistics page (#stats). One of the page's ordered scripts (see the <script> list at the end of index.html).
'use strict';
/* ---------- إحصاءات لغوية ---------- */
let stInit = false;
async function initStats() {
  if (stInit) return; stInit = true;
  const body = $('statsBody');
  let S;
  try { S = await (await fetch('/stats.json')).json(); } catch { stInit = false; body.innerHTML = '<p class="hint">تعذّر تحميل الإحصاءات.</p>'; return; }
  const t = S.totals, N = (n) => nA(n), pct = (a, b) => nA(((100 * a) / b).toFixed(1)) + '٪';
  const bars = (rows, max, fmt) => rows.map((r) => `<div class="srow"><span class="k">${esc(r.k)}</span><div class="sbarw"><i style="width:${(100 * r.n) / max}%"></i></div><span class="v">${fmt(r)}</span></div>`).join('');
  const panel = (title, html, open) => `<details class="lesson"${open ? ' open' : ''}><summary>${esc(title)}</summary><div>${html}</div></details>`;
  const NCD = await loadNameCounts();
  let P = null; try { P = await (await fetch('/pos.json')).json(); } catch { /* panel is skipped */ }
  await loadAF();
  let NP = null; try { NP = await (await fetch('/names_pairs.json')).json(); } catch { /* section is skipped */ }   // scripts/name-counts.mjs
  let R2 = null; try { R2 = await (await fetch('/research2.json')).json(); } catch { /* sections are skipped */ }   // scripts/research2-stats.mjs
  let RJ = null; try { RJ = await (await fetch('/research.json')).json(); } catch { /* sections are skipped */ }   // scripts/research-stats.mjs
  let VB = null; try { VB = await (await fetch('/verbs.json')).json(); } catch { /* panel is skipped */ }   // { tense, forms: [[verb form, [[lemma, count]...]]...] } from scripts/pos.mjs
  const VFORM = { 1: ['فَعَلَ', 'الثلاثي المجرد'], 2: ['فَعَّلَ', 'بتضعيف العين'], 3: ['فاعَلَ', 'بزيادة ألف'], 4: ['أَفْعَلَ', 'بزيادة همزة'], 5: ['تَفَعَّلَ', 'بزيادة التاء والتضعيف'], 6: ['تَفاعَلَ', 'بزيادة التاء والألف'], 7: ['انْفَعَلَ', 'بزيادة الهمزة والنون'], 8: ['افْتَعَلَ', 'بزيادة الهمزة والتاء'], 9: ['افْعَلَّ', 'للألوان والعيوب'], 10: ['اسْتَفْعَلَ', 'بزيادة الهمزة والسين والتاء'] };
  const tenseBox = () => {   // Arabic has no future form: the future is a present verb after سـ / سوف, so it is a part of the present row
    const t = VB.tense, all = t.perf + t.impf + t.impv;
    const row = (lab, n, ex, ind) => `<div class="pr${ind ? ' pi' : ''}"><div class="pl"><b>${esc(lab)}</b> <small>(${esc(ex)})</small></div><div class="pb"><i style="width:${Math.max(1.5, (100 * n) / all)}%"></i></div><div class="pv"><b>${N(n)}</b><small>${pct(n, all)}</small></div></div>`;
    return `<details class="pg pc-verb"><summary class="pgh"><h4>أزمنة الأفعال</h4><div class="pgn inl"><b>${N(all)}</b><small>فعلاً بالتكرار</small></div></summary>` +
      row('الفعل الماضي', t.perf, 'قال، كان، آمن، جاء') + row('الفعل المضارع', t.impf, 'يقول، تعلمون، يعبدون') +
      row('منه للمستقبل (بعد سـ أو سوف)', t.fut, 'سيقول، سوف تعلمون', 1) + row('فعل الأمر', t.impv, 'قل، اعبدوا، اتقوا') + '</details>';
  };
  const AR_ABC = new Intl.Collator('ar', { sensitivity: 'base' });   // alphabetical, ignoring the vowel marks
  const verbPanel = () => `<p class="how">كل الأفعال الواردة في القرآن مصنّفة بحسب وزنها الصرفي، وبجانب كل فعل عدد مرات وروده بكل تصريفاته (ماضياً ومضارعاً وأمراً). والفعل مكتوب بصيغة أصله في «مدونة القرآن العربية» (Quranic Arabic Corpus)، وقد يرد الفعل نفسه في أكثر من وزن بمعنيين مختلفين (عَلِمَ وعَلَّمَ).</p>` +
    `<details class="pg pc-verb vwrap"><summary class="pgh"><h4>الأفعال بحسب وزنها الصرفي</h4><small class="pgnote">(${N(VB.forms.reduce((a, x) => a + x[1].length, 0))} فعلاً)</small></summary>` + VB.forms.map(([vf, list], fi) => `<details class="pg pc-verb"><summary class="pgh"><h4>${esc(VFORM[vf] ? VFORM[vf][0] : 'أخرى')}</h4><small class="pgnote">${VFORM[vf] ? esc(VFORM[vf][1]) + ' · ' : ''}(${N(list.length)} فعلاً · ${N(list.reduce((a, x) => a + x[1], 0))} مرة)</small></summary><div class="chips vgrid">${list.map((x, i) => [x, i]).sort(([[a]], [[b]]) => AR_ABC.compare(a, b)).map(([[w, n], i]) => `<button type="button" class="chip vbtn" data-f="${fi}" data-i="${i}" title="${esc(w)}">${esc(w)} <small>${N(n)}</small></button>`).join('')}</div></details>`).join('') + '</details>';
  const posPanel = () => {
    const c = new Proxy(P.cats, { get: (t, k) => t[k] || 0 }), T = P.total;
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
      { k: 'pron', name: 'الضمائر وأسماء الإشارة والموصول والاستفهام', desc: '', rows: [
        ['الضمائر المتصلة', c.pronAttached, 'ـه، ـهم، ـك، ـنا، ـكم'], ['الضمائر المنفصلة', c.pronSeparate, 'هو، هم، أنت، نحن'],
        ['الأسماء الموصولة', c.rel, 'الذي، الذين، التي، ما، من'], ['أسماء الإشارة', c.dem, 'هذا، ذلك، أولئك، تلك'], ['أسماء الاستفهام', c.intg, 'من، ما، أين، كيف']] },
      { k: 'part', name: 'الحروف', desc: 'كلمات ربط ومعنى لا يكتمل معناها وحدها', rows: [
        ['«ال» التعريف', c.pDet, 'الـ'], ['حروف العطف', c.pConj, 'و، ف، ثم، أو'], ['حروف الاستئناف', c.pRem, 'و، ف'], ['حروف النفي', c.pNeg, 'لا، ما، لم، لن'],
        ['حروف التوكيد', c.pEmph, 'لـ، قد'], ['حروف الشرط', c.pCond, 'إن، لو، لولا'], ['حروف النداء', c.pAddr, 'يا'], ['حروف أخرى (جر ونصب وغيرها)', c.pOther + c.pIntg, 'من، في، على، إلى، أن، إنّ']] },
    ];
    const tot = (g) => g.rows.filter((r) => !r[4]).reduce((a, r) => a + (r[3] ? 0 : r[1]), 0);
    const sum = G.map(tot), all = sum.reduce((a, b) => a + b, 0);
    const strip = `<div class="pstack">${G.map((g, i) => `<i class="pc-${g.k}" style="width:${(100 * sum[i]) / all}%"></i>`).join('')}</div><div class="pticks" aria-hidden="true"></div><div class="pleg">${G.map((g, i) => `<span><b class="pc-${g.k}"></b>${esc(g.name.split(' ')[0])} ${pct(sum[i], all)}</span>`).join('')}</div>`;
    const block = (g, i) => `<details class="pg pc-${g.k}" open><summary class="pgh"><h4>${esc(g.name)}</h4><div class="pgn inl"><b>${N(sum[i])}</b><small>${pct(sum[i], all)} من الكل</small></div></summary>${g.desc ? `<p class="pgd">${esc(g.desc)}</p>` : ''}` +
      g.rows.filter((r) => r[1]).map(([lab, n, ex, ind]) => `<div class="pr${ind ? ' pi' : ''}"><div class="pl"><b>${esc(lab)}</b>${ex ? ` <small>(${esc(ex)})</small>` : ''}</div><div class="pb"><i style="width:${Math.max(1.5, (100 * n) / sum[i])}%"></i></div><div class="pv"><b>${N(n)}</b><small>${pct(n, sum[i])}</small></div></div>`).join('') + '</details>';
    const top = (title, arr, uniq, note) => `<details class="pg pc-top" open><summary class="pgh"><h4>${title} <small>(${N(uniq)} لفظاً مختلفاً)</small></h4>${note ? `<small class="pgnote">${note}</small>` : ''}</summary>` + bars(arr.map((x) => ({ k: x.w, n: x.n })), arr[0].n, (r) => N(r.n)) + '</details>';
    return `<p class="how">كل كلمة في القرآن تُقسَّم إلى أجزائها (فـ«وبالله» ثلاثة أجزاء: و + بـ + الله)، فمجموع الأجزاء ${N(all)} وهو أكثر من عدد الكلمات. وطول كل شريط نسبة الجزء من <b>مجموعه داخل بطاقته</b>، وكذلك النسبة المئوية بجانبه، أما نسبة البطاقة كلها من <b>كل الأجزاء</b> فمكتوبة في رأسها.<br>التصنيف من «مدونة القرآن العربية» (Quranic Arabic Corpus)، وهو اجتهاد لغوي قد يخالفه بعض النحاة، وعدد «الصفات» أقل من الواقع لأن المدونة تصنّف كثيراً منها تحت اسم الفاعل أو الأسماء.</p>` + strip + G.map(block).join('') +
      top('أكثر الأسماء ورودًا', P.top.noun, P.unique.noun) + top('أكثر الصفات ورودًا', P.top.adj, P.unique.adj) + top('أكثر الأفعال ورودًا (بجذر الفعل)', P.top.verb, P.unique.verb) + top('أكثر أسماء الأعلام ورودًا', P.top.pn.filter((x) => x.w !== 'الله'), P.unique.pn, 'لفظ الجلالة «الله» غير مدرج في هذه القائمة، وعدد وروده مذكور أعلاه');
  };
  const SCAT = [["👤", "أسماء أنبياء وأشخاص", [3, 10, 11, 12, 14, 19, 21, 31, 47, 71], ""], ["🐪", "حيوانات وحشرات", [2, 6, 16, 27, 29, 100, 105], ""], ["🌌", "ظواهر الكون والطبيعة", [13, 24, 51, 53, 54, 77, 79, 85, 86, 89, 91, 92, 93, 95, 113], ""], ["⏳", "يوم القيامة وأحواله", [44, 45, 56, 59, 64, 69, 70, 75, 78, 81, 82, 84, 88, 99, 101], ""], ["👥", "أقوام وفئات من الناس", [4, 26, 30, 33, 34, 37, 39, 58, 60, 63, 72, 76, 83, 104, 106, 109, 114], ""], ["📍", "أماكن ومواضع", [7, 15, 18, 46, 52, 90], ""], ["🧱", "أشياء وأدوات", [5, 57, 68, 107, 108, 111], ""], ["📜", "أحداث وشعائر وأحكام", [8, 9, 17, 22, 48, 49, 61, 62, 65, 66, 80, 94, 97, 110], ""], ["🕋", "القرآن والوحي والقيم", [1, 23, 25, 28, 32, 35, 41, 42, 43, 73, 74, 96, 98, 102, 103], ""], ["💚", "أسماء الله وصفاته والتوحيد", [40, 55, 67, 87, 112], ""], ["🔤", "حروف مقطعة", [20, 36, 38, 50], ""]];
  const catPanel = () => {
    const by = Object.fromEntries(S.surahs.map((s) => [s.id, s]));
    return `<p class="how">تصنيف أسماء السور الـ ١١٤ بحسب ما يدل عليه اسم السورة. وهذا التصنيف اجتهاد مني بعد النظر في معنى كل اسم، وليس نصاً ثابتاً؛ فبعض الأسماء يحتمل أكثر من تصنيف، وقد وضعتُ كل سورة في تصنيف واحد. ويُعرض اسم السورة بعدد آياتها، واضغط اسم السورة لعرض نصها.</p>` +
      '<div class="catgrid scatg">' + SCAT.map(([ic, name, list, note], idx) => `<div class="catrow${[3, 5, 8].includes(idx) ? ' gsp' : ''}"><h3 class="ptl scath"><span class="sct"><span${ic === '👥' ? ' class="ic-bright"' : ''}>${ic}</span> ${esc(name)}</span><small>(${N(list.length)} سورة · ${N(list.reduce((a, i) => a + by[i].verses, 0))} آية)</small></h3><div class="chips">${list.map((i) => `<button type="button" class="chip sbtn" data-s="${i}">${esc(by[i].ar)} <small>${N(by[i].verses)}</small></button>`).join('')}</div></div>`).join('') + '</div>';
  };
  const TW = S.topWords.filter((x) => x.w !== 'الله');      // the divine name has its own boxes and panel
  const big = (v, l) => `<span class="kpi kbig">${v ? `<b>${v}</b>` : ''}<span>${l}</span></span>`;   // a row's heading box
  const kpi = (v, l, id, row) => `<button type="button" class="kpi klink kexp${row ? ' krow' : ''}" aria-expanded="false" aria-controls="${id}"><b>${v}</b><span><i class="ktri" aria-hidden="true"></i>${l}</span></button>`;   // id: the panel the box opens; row: starts a new row of boxes
  const place = (p) => S.byPlace[p];
  const mk = place('makkah'), md = place('madinah');
  const verseBox = (v, label) => `<div class="aib"><h3>${label} — ${N(v.words)} ${v.words === 1 ? 'كلمة' : 'كلمات'} [${esc(v.key)}]</h3><div class="vt" data-ak="${esc(v.key)}">${esc(v.text)}</div></div>`;
  let D = null; try { D = await (await fetch('/deep.json')).json(); } catch { /* panel is skipped */ }
  const tab = (head, rows) => `<div class="tscroll"><table class="tbl"><tr>${head.map((h, i) => `<th${typeof rows[0][i] === 'number' ? ' class="num"' : ''}>${h}</th>`).join('')}</tr>` +
    rows.map((r) => `<tr>${r.map((c) => typeof c === 'number' ? `<td class="num">${N(c)}</td>` : `<td>${c}</td>`).join('')}</tr>`).join('') + '</table></div>';
  const stab = (head, rows, col, dir, id) => `<div class="tscroll"><table class="tbl stbl" data-id="${id}" data-c="${col}" data-d="${dir}"><tr>${head.map((h, i) => `<th${i ? ' class="num"' : ''} data-c="${i}"><span class="srt"><i data-d="asc" title="تصاعدي"${i === col && dir === 'asc' ? ' class="on"' : ''}>▲</i><i data-d="desc" title="تنازلي"${i === col && dir === 'desc' ? ' class="on"' : ''}>▼</i></span>${h}</th>`).join('')}</tr>` +
    rows.map((r) => `<tr>${r.map(([t, v], i) => `<td${i ? ' class="num"' : ''} data-v="${esc(String(v))}">${t}</td>`).join('')}</tr>`).join('') + '</table></div>';
  const sortT = (t) => {
    const c = +t.dataset.c, up = t.dataset.d === 'asc', val = (tr) => tr.cells[c].dataset.v, num = c > 0;
    t.querySelectorAll('.wpanel').forEach((x) => x.remove()); t.querySelectorAll('tr.on').forEach((x) => x.classList.remove('on'));   // an open word's verses close on sorting
    [...t.rows].slice(1).sort((p, q) => { const a = val(p), b = val(q), r = num ? a - b : a.localeCompare(b, 'ar'); return up ? r : -r; }).forEach((tr) => t.tBodies[0].append(tr));
    t.querySelectorAll('.srt i').forEach((i) => i.classList.toggle('on', +i.closest('th').dataset.c === c && i.dataset.d === t.dataset.d));
  };
  const letPanel = () => {   // letters: entropy, word-initial and word-final letters, letter pairs
    const L = RJ.letters, byN = (a) => [...a].sort((p, q) => q[1] - p[1]);
    const lt = (head, a, id) => stab([head, 'المرات', 'النسبة'], byN(a).map(([c, n, p]) => [[`<b>${c}</b>`, c], [N(n), n], [N(p) + '٪', p]]), 1, 'desc', id);
    return `<p class="how"><b>إنتروبيا الحروف:</b> ${N(L.entropy)} بت للحرف، من حد أقصى ${N(L.maxEntropy)} لو تساوت الحروف الـ${N(L.alphabet)} في تكرارها. والفرق يعني أن بعض الحروف أكثر وروداً بكثير من غيرها (الألف واللام خاصة)، وهذا معتاد في العربية.</p>` +
      `<div class="lrow"><details class="pg pc-top lsub"><summary class="pgh"><h4>أكثر الحروف أول الكلمة وآخرها</h4></summary><div class="rs2">${lt('أول الكلمة', L.first, 'lfirst')}${lt('آخر الكلمة', L.last, 'llast')}</div></details>` +
      `<details class="pg pc-top lsub"><summary class="pgh"><h4>الأزواج المتتالية لحروف الكلمة</h4></summary><p class="how">الزوج حرفان متجاوران داخل كلمة واحدة؛ فكلمة «العلم» فيها أربعة أزواج: «ال» و«لع» و«عل» و«لم». تُعدّ الأزواج في كل كلمات القرآن، ولا يُعدّ ما بين آخر حرف في كلمة وأول حرف في الكلمة التي بعدها. «المرات» عدد ورود الزوج، و«النسبة» حصته من كل الأزواج.</p>${lt('الزوج', L.pairs, 'lpairs')}<p class="hint">«ال» وحدها ${N(L.pairs[0][2])}٪ من كل الأزواج، بسبب أداة التعريف.</p></details>` +
      `<details class="pg pc-top lsub"><summary class="pgh"><h4>سلاسل الحروف الثلاثية</h4></summary>${lt('السلسلة', L.tri, 'ltri')}</details></div>`;
  };
  const gramPanel = () => {   // morphology and syntax markers, per 1,000 words in Makki and Madani surahs
    const G = RJ.grammar, ratio = (a, b) => (Math.min(a, b) ? Math.max(a, b) / Math.min(a, b) : 0);
    const rows = [...G.rows].sort((p, q) => q[1] - p[1]).map(([k, n, a, b]) => [[GRAM_L[k] || k, GRAM_L[k] || k], [N(n), n], [N(a), a], [N(b), b], [ratio(a, b) ? `×${N(ratio(a, b).toFixed(1))} ${a > b ? 'مكي' : 'مدني'}` : '—', ratio(a, b)]]);
    return `<p class="how">العدد في القرآن كله، ثم عدد المرات في كل ألف كلمة من السور المكية (${N(G.makkahWords)} كلمة) والمدنية (${N(G.madinahWords)} كلمة)، ليمكن المقارنة رغم اختلاف الحجم. و«الفرق» كم مرة يزيد أحدهما على الآخر. المصدر: «مدونة القرآن العربية».</p>` +
      stab(['الظاهرة', 'العدد', 'في كل ألف كلمة: المكي', 'المدني', 'الفرق'], rows, 1, 'desc', 'gram') +
      `<p class="how"><b>الجذور:</b> ${N(G.roots.all)} جذراً، منها ${N(G.roots.tri)} ثلاثياً و${N(G.roots.quad)} رباعياً. أكثر الرباعية وروداً: ${G.roots.quadTop.map(([r, n]) => `${esc(r)} (${N(n)})`).join('، ')}.</p>`;
  };
  /* more criteria from research.json; each section opens under its box at the top */
  const MORE = RJ ? (() => {
    const T = RJ.structure, Lt = RJ.letters, W = RJ.words, G = RJ.grammar, Mk = RJ.marks, SN = Object.fromEntries(S.surahs.map((x) => [x.id, x.ar]));
    const key = (k) => { const [a, b] = k.split(':'); return `${esc(SN[a] || a)} ${N(+b)}`; };
    return {
      ayat: [
        ['الآيات الأطول من المعتاد', `<p class="how">متوسط الآية ${N(T.verseLen.mean)} كلمة والانحراف المعياري ${N(T.verseLen.sd)}. منها ${N(T.verseLen.over3sd)} آية أطول من المتوسط بثلاثة انحرافات فأكثر، و${N(T.verseLen.oneOrTwo)} آية من كلمة أو كلمتين. أطول عشر آيات (اضغط الآية لتسمعها):</p>` +
          `<div class="cards10">${T.verseLen.long.map(([k, n, z]) => `<div class="wcard" data-ak="${k}"><b>${key(k)}</b><span>${N(n)} كلمة</span><span>${N(z)} انحرافاً</span></div>`).join('')}</div>`],   // one row of boxes, each plays its verse
        ['أول آية وآخر آية في كل سورة', `<p class="how">متوسط أول آية في السور ${N(T.firstLast.first)} كلمة، ومتوسط آخر آية ${N(T.firstLast.last)} كلمة. فالخاتمة أطول من المطلع في ${N(T.firstLast.longerLast)} سورة، والمطلع أطول في ${N(T.firstLast.longerFirst)}، ويتساويان في البقية. ومن أسباب قِصر المطلع الحروفُ المقطعة (الم، حم…) التي تُعدّ آية مستقلة في سور كثيرة.</p>`],
        ['تتابع الفواصل في السور', `<p class="how">في ${N(T.fawasil.same)}٪ من الآيات المتتالية تنتهي الآية بالحرف نفسه الذي انتهت به التي قبلها. والجدولان لكل سورة من عشر آيات فأكثر: نسبة الآيات التي وافقت فاصلتُها فاصلةَ ما قبلها.</p><div class="rs2">` +
          stab(['أكثر السور تتابعاً', 'الآيات', 'النسبة'], T.fawasil.top.map(([a, n, p]) => [[esc(a), a], [N(n), n], [N(p) + '٪', p]]), 2, 'desc', 'fwtop') +
          stab(['أقلها تتابعاً', 'الآيات', 'النسبة'], T.fawasil.low.map(([a, n, p]) => [[esc(a), a], [N(n), n], [N(p) + '٪', p]]), 2, 'asc', 'fwlow') + '</div>'],
        ['آيات السور مكية ومدنية', '<div></div>'],   // the same table as «المكي والمدني», copied in below
      ],
      letters: [
        ['الحروف في كل سورة', `<p class="how">اختر سورة لترى نسبة كل حرف فيها، وبجانبها نسبته في القرآن كله.</p><select class="lsur" aria-label="السورة">${S.surahs.map((x) => `<option value="${x.id}">${N(x.id)}. ${esc(x.ar)}</option>`).join('')}</select><div class="lsbars"></div>`],
        ['حروف السور الطويلة/القصيرة', `<p class="how">نسبة كل حرف في أطول ٣٨ سورة (بعدد الكلمات) وفي أقصر ٣٨ سورة، والحروف العشرة الأكثر اختلافاً بينهما.</p>` +
          stab(['الحرف', 'في السور الطويلة', 'في السور القصيرة', 'الفرق (القصيرة − الطويلة)'], Lt.longShort.map(([c, a, b, d]) => [[`<b>${c}</b>`, c], [N(a) + '٪', a], [N(b) + '٪', b], [N(d), d]]), 3, 'desc', 'lls')],
        ['الحركات وعلامات الرسم العثماني والوقف', Mk ? `<p class="how">عدّ العلامات في نص الرسم العثماني (Quran.com) لآياته الـ${N(Mk.verses)}.</p>` +
          `<div class="mkgrid">${[...new Set(Mk.rows.map((x) => x[0]))].map((g) => `<div class="mkh" style="grid-row:span ${Math.ceil(Mk.rows.filter((x) => x[0] === g).length / 4)}">${esc(g)}</div>` + Mk.rows.filter((x) => x[0] === g).map(([, n, c, k]) => `<div class="wcard"><b class="mkc">ـ${c}</b><span>${esc(n)}</span><span>${N(k)}</span></div>`).join('')).join('')}</div>` : '<p class="hint">غير متاح.</p>'],   // a row per group: its name, then its marks
      ],
      words: [
        ['البحث في كل كلمات القرآن', `<p class="how">كل كلمات القرآن بصيغها كما تُكتب (${N(W.forms)} صيغة)، منها ${N(W.hapax)} وردت مرة واحدة. اكتب كلمة أو جزءاً منها (بلا تشكيل).</p><div class="wsearch"><div class="sfield wsf"><input class="inp wq" placeholder="ابحث عن كلمة…" aria-label="ابحث عن كلمة"><button type="button" class="gbtn wgo" title="ابحث" aria-label="ابحث"><svg viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" aria-hidden=\"true\"><circle cx=\"10.5\" cy=\"10.5\" r=\"6.5\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.4\"/><line x1=\"15.5\" y1=\"15.5\" x2=\"21\" y2=\"21\" stroke=\"currentColor\" stroke-width=\"2.6\" stroke-linecap=\"round\"/></svg></button></div><label class="ucchk"><input type="checkbox" class="wh"> ما ورد مرة واحدة فقط</label></div><div class="wres"><p class="hint">جارٍ التحميل…</p></div>`],
        ['تكرار الكلمة وطولها', `<p class="how">ميل الخط بين لوغاريتم ترتيب الكلمة ولوغاريتم تكرارها ${N(W.zipf)}، قريب من −١ الذي يتوقعه «قانون زيبف» في اللغات الطبيعية: الكلمة الثانية في الترتيب تتكرر نحو نصف الأولى، والعاشرة نحو عُشرها. والكلمات الأكثر تكراراً أقصر:</p>` +
          `<div class="cards4">${W.bands.map(([a, l]) => `<div class="wcard"><b>${a}</b><span>متوسط طول الكلمة ${N(l)} حرف</span></div>`).join('')}</div>`],   // the four bands as boxes in one row
        ['المفاهيم بجذورها', `<p class="how">عدد مرات ورود الجذر بكل صيغه، وعدد الألفاظ المختلفة المشتقة منه. الجذر يقارب المفهوم ولا يطابقه: فجذر «أمن» يشمل الإيمان والأمن والأمانة معاً.</p>` +
          stab(['المفهوم', 'الجذر', 'مرات الورود', 'الألفاظ المشتقة'], G.concepts.map(([c, r, n, l]) => [[c, c], [r, r], [N(n), n], [N(l), l]]), 2, 'desc', 'conc')],
        ['أدوات التشبيه', `<p class="how">عدد أدوات التشبيه في القرآن كما صنّفتها «مدونة القرآن العربية». العدّ آلي، وقد تأتي بعض هذه الأدوات لغير التشبيه (فـ«مِثْل» قد تعني المساواة)، فالنتيجة تقريبية تحتاج مراجعة.</p>` +
          `<div class="cards4">${[...G.similes].sort((p, q) => q[1] - p[1]).map(([a, n]) => `<div class="wcard"><b>${a}</b><span>${N(n)} مرة</span></div>`).join('')}</div>`],   // the four tools as boxes, most used first
        ...(RJ.sem ? (() => { const SM = RJ.sem, cnt = (a) => a.map(([w, n]) => `${esc(w)} <small>${N(n)}</small>`).join('، ') || '—';
          const PL = { '1S': 'المتكلم (أنا، ـي، ـتُ)', '1P': 'المتكلمون (نحن، ـنا)', '2MS': 'المخاطَب (أنتَ، ـكَ، ـتَ)', '2FS': 'المخاطَبة (أنتِ، ـكِ)', '2D': 'المخاطَبان (أنتما، ـكما)', '2MP': 'المخاطَبون (أنتم، ـكم، ـتم، ـوا)', '2FP': 'المخاطَبات (أنتن، ـكن)', '3MS': 'الغائب (هو، ـه)', '3FS': 'الغائبة (هي، ـها)', '3D': 'الغائبان (هما، ـهما، ـا)', '3MP': 'الغائبون (هم، ـهم، ـوا)', '3FP': 'الغائبات (هن، ـهن، ـنَ)' };
          const KN = { v: 'الأفعال', vn: 'المصادر', ap: 'أسماء الفاعل', pp: 'أسماء المفعول', n: 'أسماء أخرى' };
          return [
            ['الضمائر متكلم-مخاطب-غائب', `<p class="how">كل الضمائر في القرآن (${N(SM.pronTotal)} ضميراً) بحسب «مدونة القرآن العربية»: المتصلة بالكلمة، ومنها ضمائر الفاعل في الأفعال مثل «ـتَ» و«ـوا» و«ـنا»، والمنفصلة مثل «هو» و«نحن». والعمودان الأخيران عددها لكل ١٠٠٠ كلمة في السور المكية والمدنية. أما على من يعود الضمير (على الله، أو النبي، أو المؤمنين) فيحتاج تفسيراً، ولا يُحسب آلياً.</p>` +
              stab(['الضمير', 'متصل', 'منفصل', 'المجموع', 'المكية /١٠٠٠', 'المدنية /١٠٠٠'], SM.pronouns.map(([p, a, s, mk, md]) => [[PL[p] || p, p], [N(a), a], [N(s), s], [N(a + s), a + s], [N(mk), mk], [N(md), md]]), 3, 'desc', 'pron')],
            ['ألفاظ الجذر فعل-مصدر-فاعل-.', `<p class="how">ألفاظ الجذر الواحد مصنّفة بنوع اشتقاقها كما في «مدونة القرآن العربية»، مع عدد مرات ورود كل لفظ. فتظهر صلة الألفاظ بعضها ببعض: الفعل ومصدره واسم فاعله واسم مفعوله، ثم الأسماء الأخرى. وفي القرآن كله: ${Object.entries(KN).map(([k, t]) => `${t} ${N(SM.kinds[k])}`).join('، ')}. والجدول لأكثر ${N(SM.derivs.length)} جذراً ألفاظاً مختلفة؛ أما معنى كل لفظ فمن كتب التفسير والمعاجم.</p>` +
              stab(['الجذر', 'الألفاظ', ...Object.values(KN)], SM.derivs.map(([r, n, l, k]) => [[`<b>${esc(r)}</b> <small>${N(n)}</small>`, r], [N(l), l], ...Object.keys(KN).map((x) => [cnt(k[x]), k[x].length])]), 1, 'desc', 'derivs')],
            ['الحقول الدلالية بالأرقام', `<p class="how">ألفاظ مختارة من أربعة حقول، وعدد مرات ورود كل لفظ اسماً بكل صيغه (المفرد والجمع والمعرّف وغيرها) بحسب «مدونة القرآن العربية». القوائم مختارة وليست حصراً، ولا تدخل فيها الأفعال: فـ«الصبر» هنا الاسم دون «صبر» و«اصبر».</p>` +
              `<div class="cards4 fcards">${SM.fields.map(([t, n, l]) => `<div class="wcard"><b>${esc(t)} <small>${N(n)}</small></b><span class="fl">${l.map(([w, c]) => `<i>${esc(w)} <small>${N(c)}</small></i>`).join('')}</span></div>`).join('')}</div>`],
          ]; })() : []),
      ],
      distinct: [
        ['ثراء المفردات في السور', `<p class="how">نسبة الكلمات غير المكررة في كل نافذة من ١٠٠ كلمة متتالية، متوسطةً على السورة كلها؛ وهذا المقياس لا يتأثر بطول السورة. محسوب لـ${N(W.rich.n)} سورة من ٢٠٠ كلمة فأكثر.</p><div class="rs2">` +
          stab(['أكثرها تنوعاً', 'الكلمات', 'النسبة'], W.rich.top.map(([a, n, p]) => [[esc(a), a], [N(n), n], [N(p) + '٪', p]]), 2, 'desc', 'richtop') +
          stab(['أقلها تنوعاً', 'الكلمات', 'النسبة'], W.rich.low.map(([a, n, p]) => [[esc(a), a], [N(n), n], [N(p) + '٪', p]]), 2, 'asc', 'richlow') + '</div><p class="hint">تكرار اللازمة يخفض النسبة، كما في سورة الرحمن («فبأي آلاء ربكما تكذبان»).</p>'],
        ['الجذور بتكرارها وعدد ألفاظها', `<p class="how">${N(G.rootTable.length)} جذراً. ومعامل الارتباط بين لوغاريتم تكرار الجذر وعدد ألفاظه المختلفة ${N(G.rootCorr)}: الجذور الأكثر وروداً يُشتق منها ألفاظ أكثر. (هذا مقياس تقريبي لتنوع المعنى؛ قياس المعاني نفسها يحتاج معجماً.) اضغط الحرف لعرض جذوره.</p>` +
          (() => { const by = new Map(); for (const x of G.rootTable) (by.get(x[0][0]) || by.set(x[0][0], []).get(x[0][0])).push(x);   // grouped by first letter, as the words found once
            return '<div class="psort rsort"><button type="button" class="btn on" data-m="a">أبجدياً</button><button type="button" class="btn" data-m="n">الأكثر جذوراً</button></div><div class="hcols rlets">' + [...by].sort((a, b) => AR_ABC.compare(a[0], b[0])).map(([c, rs], i) => `<details class="hlet" data-i="${i}" data-n="${rs.length}"><summary><b class="hl">${esc(c)}</b><small class="hn">${N(rs.length)} جذر</small></summary>` +
              stab(['الجذر', 'مرات الورود', 'الألفاظ المختلفة'], rs.map(([r, n, l]) => [[esc(r), r], [N(n), n], [N(l), l]]), 1, 'desc', 'roots') + '</details>').join('') + '</div>'; })()],
      ],
      surahs: [
        ['السور المبدوءة بالقسم', `<p class="how">${N(G.oathOpen.length)} سورة تبدأ بالقسم (بالواو، أو «لا أقسم»، أو بعد الحروف المقطعة). العدّ آلي من أول آيتين، فيحتاج مراجعة.</p><div class="chips oathg">${G.oathOpen.map((a) => `<span class="chip">${esc(a)}</span>`).join('')}</div>`],
      ],
    };
  })() : null;
  const MORE2 = R2 ? (() => {   // second batch of criteria (scripts/research2-stats.mjs)
    const key = (k) => { const [a, b] = k.split(':'); const x = S.surahs[+a - 1]; return `<span data-ak="${k}">${esc(x ? x.ar : a)} ${N(+b)}</span>`; };
    return {
      surahs: [
        ['سور تحوي ألفاظ متقاربة', `<p class="how">قُسّمت السور التي فيها ٢٠٠ كلمة فأكثر إلى ${N(R2.clusters.length)} مجموعات بحسب تقارب ألفاظها (طريقة k-means)، وبجانب كل مجموعة أكثر ألفاظها تمييزاً لها. التقسيم آلي يقرّب ولا يحسم.</p>` +
          stab(['المجموعة', 'عدد السور', 'منها مكية', 'أبرز ألفاظها', 'السور'], R2.clusters.map((c, i) => [[N(i + 1), i], [N(c.surahs.length), c.surahs.length], [N(c.makki), c.makki], [esc(c.words.join('، ')), c.words[0]], [esc(c.surahs.join('، ')), c.surahs[0]]]), 1, 'desc', 'clus')],
        ['تقارب السور المتجاورة', `<p class="how">متوسط تقارب كل سورة مع التي تليها في المصحف ${N(R2.neighbours.adjMean)}٪، ومتوسط التقارب بين أي سورتين ${N(R2.neighbours.allMean)}٪؛ و${N(R2.neighbours.higher)} من ١١٣ زوجاً متجاوراً أقرب من المتوسط. فالسور المتجاورة أقرب في ألفاظها في الغالب.</p>` +
          stab(['السورة', 'التي تليها', 'التقارب'], R2.neighbours.top.map(([a, b, p]) => [[esc(a), a], [esc(b), b], [N(p) + '٪', p]]), 2, 'desc', 'adj')],
        ['السور المتشابهة في بنائها', `<p class="how">أزواج السور الأقرب في بنائها: عدد الآيات، وطول الآية، وغلبة فاصلة واحدة، والبدء بالحروف المقطعة. وبجانب كل زوج تقارب ألفاظه؛ ومتوسطه ${N(R2.structure.twinMean)}٪ مقابل ${N(R2.structure.allMean)}٪ لأي سورتين.</p>` +
          `<div class="cards4">${[...R2.structure.twins].sort((x, y) => x[2] - y[2]).map(([a, b, p]) => `<div class="wcard"><b>${esc(a)} ↔ ${esc(b)}</b><span>تقارب الألفاظ ${N(p)}٪</span></div>`).join('')}</div>`],   // the pairs as boxes, least word overlap first
        ['مطلع السورة وخاتمتها', `<p class="how">نسبة الألفاظ المشتركة بين أول ثلاث آيات وآخر ثلاث آيات في السورة (لـ${N(R2.openEnd.n)} سورة من ١٢ آية فأكثر): متوسطها ${N(R2.openEnd.mean)}٪، مقابل ${N(R2.openEnd.base)}٪ بين مطلع سورة وخاتمة سورة أخرى. فالمطلع والخاتمة يشتركان في ألفاظ أكثر بقليل.</p>` +
          stab(['السورة', 'الألفاظ المشتركة'], R2.openEnd.top.map(([a, p]) => [[esc(a), a], [N(p) + '٪', p]]), 1, 'desc', 'oe')],
        ['عبارات مشتركة بين سورتين', `<p class="how">أزواج السور التي تشترك في أكثر العبارات المكررة (خمس كلمات متتالية فأكثر، مع استبعاد اللوازم الكثيرة التكرار)، وتقارب ألفاظها عامة.</p>` +
          stab(['السورة', 'السورة', 'عبارات مشتركة', 'تقارب الألفاظ'], R2.shared.map(([a, b, n, p]) => [[esc(a), a], [esc(b), b], [N(n), n], [N(p) + '٪', p]]), 2, 'desc', 'shph')],
      ],
      ayat: [
        ['آيات متباعدة فيها عبارة واحدة', `<p class="how">أبعد الآيات موضعاً في المصحف التي تشترك في عبارة من خمس كلمات (اضغط الآية لتسمعها).</p>` +
          stab(['الآية', 'والآية', 'المسافة (بالآيات)', 'العبارة'], R2.far.map(([a, b, d, g]) => [[key(a), a], [key(b), b], [N(d), d], [esc(g), g]]), 2, 'desc', 'far')],
        ['تكرار صوت ساكن في الآية', `<p class="how">آيات (من ست كلمات فأكثر) يتكرر فيها حرف واحد أكثر من نسبته المعتادة في القرآن بكثير، مع استبعاد الحروف الأكثر شيوعاً. فائدته محدودة، وهو وصف لا تفسير.</p>` +
          stab(['الآية', 'الحرف', 'مراته في الآية', 'أكثر من المعتاد بـ'], R2.alliteration.map(([k, c, n, x]) => [[key(k), k], [`<b>${c}</b>`, c], [N(n), n], [`×${N(x)}`, x]]), 3, 'desc', 'allit')],
        ['السجع الداخلي في الآية', `<p class="how">نسبة كلمات الآية التي تنتهي بآخر حرفين من الآية نفسها؛ متوسطها ${N(R2.internalRhyme.mean)}٪. وهذه أعلى الآيات (من ست كلمات فأكثر).</p>` +
          stab(['الآية', 'آخر حرفين', 'كلمات توافقها', 'كلمات الآية', 'النسبة'], R2.internalRhyme.top.map(([k, e, n, w, p]) => [[key(k), k], [esc(e), e], [N(n), n], [N(w), w], [N(Math.round(p * 100)) + '٪', p]]), 4, 'desc', 'rhyme')],
        ['تمييز الآيات مكية/مدنية آلياً', `<p class="how">هل يمكن معرفة كون الآية مكية أو مدنية من خصائصها الصرفية وحدها (نسبة الأفعال والأسماء والحروف وأزمنة الأفعال وطول الآية)؟ دُرّب نموذج «الانحدار اللوجستي» على أربعة أخماس الآيات واختُبر على الخمس الباقي، خمس مرات.</p>` +
          `<p class="how">الدقة المتوازنة ${N(R2.classify.balanced)}٪ مقابل ٥٠٪ للتخمين، والدقة العامة ${N(R2.classify.accuracy)}٪. فالفرق موجود لكنه ليس حاسماً على مستوى الآية الواحدة. أقوى الخصائص:</p>` +
          stab(['الخاصية', 'وزنها', 'تميل إلى'], R2.classify.features.map(([k, w, p]) => [[esc(({ LEN: 'طول الآية', N: 'الأسماء', V: 'الأفعال', P: 'الحروف', PN: 'أسماء الأعلام', '1S': 'المتكلم المفرد', '1P': 'المتكلم الجمع', '2MP': 'المخاطبون', '3MP': 'الغائبون', PERF: 'الماضي', IMPF: 'المضارع', IMPV: 'الأمر', PASS: 'المبني للمجهول', COND: 'الشرط', NEG: 'النفي', INTG: 'الاستفهام', VOC: 'النداء', EMPH: 'التوكيد', RES: 'الحصر', ACC: 'المنصوب', GEN: 'المجرور', NOM: 'المرفوع', DET: 'المعرّف', INDEF: 'النكرة', CONJ: 'العطف', REM: 'الاستئناف' })[k] || k), k], [N(w), w], [p === 'madinah' ? 'المدني' : 'المكي', p]]), 1, 'desc', 'cls')],
      ],
      words: [
        ['ألفاظ في مواضع متناظرة', `<p class="how">الألفاظ التي ترد في أول آية من أكثر السور، وفي آخر آية من أكثرها، وفي أول آية وآخرها من السورة نفسها (عدد السور).</p><div class="rs2 rs3">` +
          stab(['في أول آية', 'العدد'], R2.positions.first.filter(([, n]) => n > 3).map(([l, n]) => [[esc(l), l], [N(n), n]]), 1, 'desc', 'pfirst') +   // words in the first verse of four surahs or more
          stab(['في آخر آية', 'العدد'], R2.positions.last.filter(([, n]) => n > 3).map(([l, n]) => [[esc(l), l], [N(n), n]]), 1, 'desc', 'plast') +
          (R2.positions.both ? stab(['في أول آية وآخرها', 'السور', 'عددها'], R2.positions.both.map(([l, n, su]) => [[esc(l), l], [`<span class="psur">${esc((su || []).join('، '))}</span>`, (su || []).join(' ')], [N(n), n]]), 2, 'desc', 'pboth') : '') + '</div>'],
        ['موضوعات متكررة-نمذجة آلية', `<p class="how">قسّم نموذج «LDA» ألفاظ الآيات إلى ${N(R2.topics.length)} موضوعاً بحسب الألفاظ التي تتصاحب في الآيات. لكل موضوع أبرز ألفاظه وأكثر السور التي يغلب فيها. تسمية الموضوعات وتفسيرها تحتاج نظراً علمياً؛ فهذا عرض آلي للألفاظ المتصاحبة فقط.</p>` +
          stab(['الموضوع', 'أبرز ألفاظه', 'أكثر السور ظهوراً فيه', 'حجمه'], R2.topics.map((t, i) => [[N(i + 1), i], [esc(t.words.join('، ')), t.words[0]], [esc(t.surahs.map(([a]) => a).join('، ')), t.surahs[0]?.[0] || ''], [N(t.size), t.size]]), 3, 'desc', 'topics')],
      ],
      letters: R2.rasm ? [
        ['الرسم العثماني والإملاء الحديث', `<p class="how">قورنت ${N(R2.rasm.words)} كلمة في ${N(R2.rasm.verses)} آية لها عدد الكلمات نفسه في الرسمين، بعد حذف الحركات: ${N(R2.rasm.differ)} كلمة (${N(((100 * R2.rasm.differ) / R2.rasm.words).toFixed(1))}٪) تُكتب بالرسم العثماني على غير الإملاء الحديث، أكثرها بحذف الألف. أكثرها وروداً:</p>` +
          `<div class="cards5">${R2.rasm.top.map(([p, n]) => `<div class="wcard"><b>${esc(p)}</b><span>${N(n)} مرة</span></div>`).join('')}</div>`],   // الإملاء الحديث ← الرسم العثماني، five a row
      ] : [],
    };
  })() : null;
  const chordSvg = (P) => {   // the pairs as a circle: an arc per name (its length = how often it is in a pair), a ribbon per pair (its width = how often, both orders together)
    const L = new Map(), D = new Map(), W = new Map(), add = (m, k, n) => m.set(k, (m.get(k) || 0) + n);
    for (const [p, n] of P) { const [a, b] = p.split(' '); add(L, [a, b].sort().join(' '), n); D.set(p, n); add(W, a, n); add(W, b, n); }
    const nodes = [...W.keys()].sort((x, y) => W.get(y) - W.get(x)), R = 230, TAU = 2 * Math.PI, GAP = 0.008, MIN = 0.06;   // MIN: room for a label
    let k = 0; for (let it = 0, small = new Set(); it < 30; it++) { const big = nodes.filter((t) => !small.has(t)); k = (TAU - small.size * MIN - big.length * GAP) / big.reduce((a, t) => a + W.get(t), 0); big.forEach((t) => W.get(t) * k + GAP < MIN && small.add(t)); }
    const pos = new Map(); let at = 0;
    nodes.forEach((t, i) => { const w = W.get(t) * k, slot = Math.max(MIN, w + GAP); pos.set(t, { a0: at + (slot - w) / 2, mid: at + slot / 2, cur: at + (slot - w) / 2, col: `hsl(${Math.round((i * 360) / nodes.length)} 65% 58%)` }); at += slot; });
    const pt = (r, a) => `${(r * Math.sin(a)).toFixed(1)},${(-r * Math.cos(a)).toFixed(1)}`;
    const links = [...L].sort((x, y) => y[1] - x[1]).map(([p, n]) => { const [a, b] = p.split(' '); return { a, b, n }; });
    for (const t of nodes) links.filter((l) => l.a === t || l.b === t).sort((x, y) => pos.get(x.a === t ? x.b : x.a).mid - pos.get(y.a === t ? y.b : y.a).mid).forEach((l) => { const P0 = pos.get(t), s0 = P0.cur; P0.cur += l.n * k; l[l.a === t ? 'sa' : 'sb'] = [s0, P0.cur]; });
    const rib = links.map(({ a, b, n, sa, sb }) => { const big = W.get(a) >= W.get(b) ? a : b, ord = [`${a} ${b}`, `${b} ${a}`].filter((x) => D.get(x)).map((x) => `«${x}» ${N(D.get(x))}`).join('، ');
      return `<path class="rb" data-a="${esc(a)}" data-b="${esc(b)}" fill="${pos.get(big).col}" d="M${pt(R, sa[0])}A${R},${R} 0 0 1 ${pt(R, sa[1])}Q0,0 ${pt(R, sb[0])}A${R},${R} 0 0 1 ${pt(R, sb[1])}Q0,0 ${pt(R, sa[0])}Z"><title>${esc(ord)}</title></path>`; }).join('');
    const arcs = nodes.map((t) => { const { a0, mid, col } = pos.get(t), a1 = a0 + W.get(t) * k, deg = (mid * 180) / Math.PI, right = mid < Math.PI;
      return `<g data-n="${esc(t)}"><title>${esc(t)}: ${N(W.get(t))}</title><path fill="${col}" d="M${pt(R + 2, a0)}A${R + 2},${R + 2} 0 0 1 ${pt(R + 2, a1)}L${pt(R + 12, a1)}A${R + 12},${R + 12} 0 0 0 ${pt(R + 12, a0)}Z"/><text transform="rotate(${(right ? deg - 90 : deg + 90).toFixed(1)}) translate(${right ? R + 17 : -(R + 17)},0)" text-anchor="${right ? 'start' : 'end'}" dominant-baseline="central">${esc(t)}</text></g>`; }).join('');
    return `<div class="chordw"><svg class="chord" viewBox="-345 -345 690 690" direction="ltr" role="img" aria-label="مخطط دائري لأزواج الأسماء">${rib}${arcs}</svg></div><p class="hint">كل قوس اسمٌ، وطوله بعدد مرات وروده في زوج؛ وكل شريط زوجٌ، وعرضه بعدد مرات مجيء الاسمين متتاليين (بالترتيبين معاً). مرّر المؤشر على اسم لتظهر أزواجه.</p>`;
  };
  const pairsPanel = () => {   // names of Allah that come one right after the other, most frequent first
    const SN = Object.fromEntries(S.surahs.map((x) => [x.id, x.ar])), key = ([su, c, ay]) => `<button type="button" class="chip npc" data-k="${ay.map((a) => su + ':' + a).join(',')}"><span>${esc(SN[su] || su)}</span><b>${N(c)}</b></button>`;
    return `<p class="how">كل اسمين من أسماء الله الحسنى جاءا متتاليين في الآية («عليم حكيم»، «غفور رحيم»، «الرحمن الرحيم»)، بترتيبهما في الآية، وعدد المرات، والسور التي جاءا فيها مع عدد المرات في كل سورة (اضغط السورة لترى الآيات). وقد يصف الزوجُ أحياناً غيرَ الله، كقوله عن النبي ﷺ: «بالمؤمنين رءوف رحيم».</p>` +
      chordSvg(NP) +
      `<div class="wsearch npsearch"><div class="sfield wsf"><input class="inp npq" placeholder="ابحث عن اسم أو سورة…" aria-label="ابحث عن اسم أو سورة"><button type="button" class="gbtn npgo" title="ابحث" aria-label="ابحث"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.4"/><line x1="15.5" y1="15.5" x2="21" y2="21" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg></button></div></div>` +
      stab(['الاسمان', 'المرات', 'السور'], NP.map(([p, n, ss]) => [[`<b>${esc(p.replace(' ', ' · '))}</b>`, p], [N(n), n], [`<div class="npx">${ss.map(key).join('')}</div>`, ss.length]]), 1, 'desc', 'npairs');
  };
  const moreSecs = (k) => [MORE && MORE[k], MORE2 && MORE2[k]].filter(Boolean).flat().map(([t, h]) => panel(t, h, false)).join('');
  const oppPanel = () => {   // opposite pairs: how often each side comes, how often both come in one verse, and what the numbers show
    const O = D.opposites.map(([an, a, bn, b, both, minV, x]) => ({ an, a, bn, b, both, minV, x, gap: Math.abs(a - b) / Math.max(a, b) }));
    const nm = (o) => `${esc(o.an)} / ${esc(o.bn)}`, li = (o) => `${nm(o)} (${N(o.a)} / ${N(o.b)})`;
    const equal = O.filter((o) => o.gap <= 0.05), far = [...O].sort((p, q) => q.gap - p.gap).slice(0, 5);
    const xs = O.filter((o) => o.both).map((o) => o.x).sort((p, q) => p - q), median = xs[Math.floor(xs.length / 2)];
    const tight = O.filter((o) => o.minV >= 3 && o.both / o.minV >= 0.7), apart = O.filter((o) => !o.both);
    return '<p class="how">عُدّ كل لفظ بأصله المعجمي وصيغه كلها بحسب «مدونة القرآن العربية» (Quranic Arabic Corpus)؛ فـ«الموت» مثلاً يشمل: الموت، الميت، مات، أمات، الممات، و«الحياة» يشمل: الحياة، الحي، أحيا، المحيا. و«آيات اجتمعا فيها» عدد الآيات التي ورد فيها الطرفان معاً.</p>' +
      `<div class="concl"><h3 class="ptl">ماذا تُظهر الأرقام؟</h3><ul>` +
      (apart.length ? `<li><b>أزواج لم يجتمع طرفاها في آية واحدة</b>: ${apart.map(nm).join('، ')}.</li>` : '') +
      `<li><b>أزواج متفاوتة كثيراً</b>: ${far.map(li).join('، ')}؛ فالتساوي ليس قاعدة عامة في الأضداد.</li>` +      `<li><b>أزواج متساوية أو متقاربة</b>: ${equal.map(li).join('، ')}.</li>` +
      `<li><b>الضدّان يجتمعان في الآية الواحدة</b> أكثر مما تقتضيه الصدفة بنحو ${N(Math.round(median))} مرة (الوسيط)، وهذا هو النمط الأوضح: القرآن يذكر الشيء مع ضده كثيراً (الطباق والمقابلة). وفي هذه الأزواج يأتي الأقل وروداً مع ضده في ٧٠٪ من آياته فأكثر: ${tight.map(nm).join('، ')}.</li>` +
      `<li>تتغير الأعداد بتغير طريقة العدّ (أي الصيغ تدخل في كل لفظ)، فالتساوي في بعض الأزواج ملاحظة تابعة لطريقة العدّ هذه، ولا يُبنى عليها إعجاز عددي.</li></ul></div>` +
      stab(['الضدّان', 'مرات الأول', 'مرات الثاني', 'آيات اجتمعا فيها', 'من آيات الأقل وروداً', 'أكثر من الصدفة بـ'], [...O].sort((p, q) => q.a - p.a).map((o) => { const p = Math.round((100 * o.both) / o.minV); return [[nm(o), `${o.an} ${o.bn}`], [N(o.a), o.a], [N(o.b), o.b], [N(o.both), o.both], [`${N(p)}٪`, p], [o.both ? `×${N(Math.round(o.x))}` : '—', o.both ? o.x : 0]]; }), 1, 'desc', 'opp');
  };
  const phraseTable = (mode) => {   // most repeated phrases: by count, or each longer phrase indented under the shorter phrase it contains
    const P = D.phrases.map(([t, c, n]) => ({ t, c, n, kids: [] })), has = (a, b) => ` ${a} `.includes(` ${b} `);
    const row = (d) => (p) => [`${'<span class="pind"></span>'.repeat(d)}${d ? `<span class="parr">↲ ${esc(p.t)}</span>` : esc(p.t)}`, p.c, p.n];
    const head = ['العبارة', 'مرات ورودها', 'في عدد من السور'];
    if (mode === 'c') return tab(head, [...P].sort((a, b) => b.c - a.c).map(row(0)));
    for (const p of P) { const up = P.filter((q) => q !== p && q.t.length < p.t.length && has(p.t, q.t)).sort((a, b) => b.t.length - a.t.length)[0]; if (up) { up.kids.push(p); p.up = up; } }   // nearest phrase it contains
    const out = [], walk = (p, d) => { out.push(row(d)(p)); p.kids.sort((a, b) => b.c - a.c).forEach((k) => walk(k, d + 1)); };
    P.filter((p) => !p.up).sort((a, b) => b.c - a.c).forEach((p) => walk(p, 0));
    return tab(head, out);
  };
  const deepPanel = () => {   // level 2: links and patterns between words (from scripts/deep-stats.mjs)
    const box = (title, how, html) => `<details class="pg pc-top"><summary class="pgh"><h4>${title}</h4></summary><p class="how">${how}</p>${html}</details>`;
    const chips = (list, cls) => `<div class="chips${cls ? ' ' + cls : ''}">${list.map(([w, n]) => `<span class="chip">${esc(w)} <small>${N(n)}</small></span>`).join('')}</div>`;
    return '<p class="how">المستوى الثاني من الإحصاءات: الروابط بين الألفاظ وأنماط تكرارها. يُعدّ اللفظ هنا بأصله المعجمي (فـ«يعلمون» و«علموا» لفظ واحد هو «عَلِمَ») بحسب «مدونة القرآن العربية» (Quranic Arabic Corpus)، ولا تدخل الضمائر والحروف، وتُؤخذ العبارات من النص المجرد من التشكيل. وهي ملاحظات لغوية إحصائية، لا يُدّعى فيها إعجاز عددي.</p>' +
      box('أزواج كلمات مجتمعة في آية', 'أزواج من الألفاظ يكثر أن يُذكر أحدهما مع الآخر في الآية نفسها. يُعدّ اللفظ بأصله (فـ«الأرض» و«أرضه» و«الأرضين» لفظ واحد).<br><b>كيف يُقرأ السطر؟</b> مثلاً «عَذاب + أَلِيم»: وردت كلمة «أليم» في ٧٢ آية، وجاءت معها كلمة «عذاب» في ٧٠ منها (٩٧٪)، فكلمة «أليم» لا تكاد تأتي إلا وصفاً للعذاب. و«الأرض + السماء»: «السماء» في ٢٩٧ آية، ومعها «الأرض» في ٢٢٢ منها (٧٥٪).<br><b>والترتيب</b> من الأقوى ارتباطاً: الزوج الذي يجتمع طرفاه في آيات كثيرة، ويجتمعان أكثر بكثير مما لو كان كل لفظ يأتي في آياته مستقلاً عن الآخر.',
        tab(['اللفظان', 'آيات اللفظ الأول', 'آيات اللفظ الثاني', 'آيات اجتمعا فيها', 'من آيات الأقل وروداً'], D.strongPairs.map(([a, b, c, p, na, nb]) => [`${esc(a)} + ${esc(b)}`, na, nb, c, `${N(Math.round((100 * c) / Math.min(na, nb)))}٪`]))) +
      box('خريطة الألفاظ: رفقاء كل لفظ', 'لكل لفظ: الألفاظ التي تصحبه في الآية نفسها أكثر من غيرها، وبجانب كلٍّ منها عدد الآيات التي اجتمعا فيها. وبجانب اللفظ عدد الآيات التي ورد فيها. اضغط أي لفظ لترى الآيات التي اجتمع فيها مع لفظه.',
        `<div class="catgrid cmap">${D.companions.map(([k, n, list], ki) => `<div class="catrow"><h3 class="ptl">${esc(k)} <small>(${N(n)} آية)</small></h3><div class="chips">${list.map(([w, c], j) => `<button type="button" class="chip cbtn" data-k="${ki}" data-j="${j}">${esc(w)} <small>${N(c)}</small></button>`).join('')}</div></div>`).join('')}</div>`) +
      box('ألفاظ لا تأتي إلا مع لفظ آخر', 'كل آية ورد فيها اللفظ الأول ورد فيها اللفظ الثاني أيضاً، بلا استثناء (في خمس آيات فأكثر).',
        `<div class="cards6">${D.always.map(([a, b, c]) => `<div class="wcard wrow"><b>${esc(a)} <small>←</small> ${esc(b)}</b><span>${N(c)} آية</span></div>`).join('')}</div>`) +
      box('آيات تكررت بنصها', 'آيات تكرر نصها كاملاً ثلاث مرات فأكثر.',
        `<div class="cards4 cards2">${D.repeatedVerses.map(([t, c, su]) => `<div class="wcard vcard"><b>${esc(t)}</b><span>${N(c)} مرات · ${esc(su)}</span></div>`).join('')}</div>`) +
      box('أكثر العبارات تكراراً', 'عبارات من ثلاث كلمات فأكثر تكررت أربع مرات فأكثر. وإذا كانت العبارة جزءاً من عبارة أطول في أغلب مواضعها عُرضت الأطول وحدها.',
        '<div class="psort"><button type="button" class="btn on" data-m="c">حسب مرات الورود</button><button type="button" class="btn" data-m="t">العبارات المتفرعة تحت أصلها</button></div><div class="ptab">' + phraseTable('c') + '</div>') +
      box('أطول العبارات المكررة', 'أطول العبارات التي وردت بنصها في موضعين أو أكثر (ثماني كلمات فأكثر)، غير الآيات المكررة كاملة.',
        tab(['العبارة', 'مرات ورودها', 'المواضع'], D.longest.map(([t, c, at]) => [esc(t), c, esc(at)]))) +
      box('كيف تبدأ الآيات وكيف تنتهي', 'الكلمة الأخيرة من الآية (موضع الفاصلة) والكلمتان الأخيرتان، ثم الكلمة الأولى، وبجانب كلٍّ منها عدد الآيات.',
        `<h3 class="ptl">أكثر الكلمات في آخر الآية</h3>${chips(D.verseEnds, 'c10')}<h3 class="ptl">أكثر الكلمتين في آخر الآية</h3>${chips(D.verseEnds2, 'c10')}<h3 class="ptl">أكثر الكلمات في أول الآية</h3>${chips(D.verseStarts, 'c10')}`) +
      box('الجذور: جذر واحد وألفاظ كثيرة', 'الجذور التي اشتُقّ منها أكبر عدد من الألفاظ المختلفة في القرآن، مع أكثر ألفاظها وروداً.',
        tab(['الجذر', 'ألفاظ مختلفة', 'مرات الورود', 'من ألفاظه'], D.roots.map(([r, n, c, ls]) => [esc(r), n, c, esc(ls.join('، '))]))) +
      box('ألفاظ مكية وألفاظ مدنية', `ألفاظ يغلب ورودها في السور المكية أو في المدنية، بعد مراعاة أن ألفاظ السور المكية أكثر (${N(D.totals.makkah)} لفظاً مقابل ${N(D.totals.madinah)})، بحسب تصنيف السور في بيانات الموقع. والعمود الأخير: مرات الورود في كل ١٠ آلاف لفظ.`,
        '<div class="pair2">' + ['makki', 'madani'].map((k) => `<details class="pg pc-top" open><summary class="pgh"><h4>${k === 'makki' ? 'ألفاظ يغلب ورودها في المكي' : 'ألفاظ يغلب ورودها في المدني'}</h4></summary>` + tab(['اللفظ', 'في المكي', 'في المدني', 'لكل ١٠ آلاف (مكي / مدني)'], D[k].map(([l, a, b, ra, rb]) => [esc(l), a, b, `${N(ra)} / ${N(rb)}`])) + '</details>').join('') + '</div>') +
      box('ألفاظ تجمّعت في سورة واحدة', 'ألفاظ وردت ثماني مرات فأكثر، وجاء أكثر من ٦٠٪ منها في سورة واحدة.',
        `<div class="cards3">${[...D.concentrated].sort((a, b) => AR_ABC.compare(a[2], b[2]) || b[3] - a[3]).map(([l, n, su, c]) => `<div class="wcard"><b>${esc(l)}</b><span>${esc(su)}${su === 'البقرة' ? ' *' : ''}: ${N(c)} من ${N(n)}</span></div>`).join('')}</div><p class="hint">* ما تجمّع منها في سورة البقرة قد يعود إلى طولها، فهي أطول سور القرآن.</p>`) +
      box('السور المتقاربة في ألفاظها', 'مدى تقارب كل سورتين في ألفاظهما، مع إعطاء الألفاظ النادرة وزناً أكبر من الشائعة (١٠٠٪ تعني التطابق).',
        `<div class="simg">${D.similar.map(([a, b, c]) => `<div class="wcard"><b>${esc(a)} ↔ ${esc(b)}</b><span>${N(c)}٪</span></div>`).join('')}</div>`) +
      box('السور ذات الألفاظ الخاصة بها', 'عدد الألفاظ التي لم ترد في القرآن إلا في هذه السورة، من مجموع ألفاظها المختلفة، ونسبتها.',
        `<div class="cards3 cards8">${D.exclusive.map(([su, n, all, p]) => `<div class="wcard"><b>${esc(su)}</b><span>${N(n)} من ${N(all)} · ${N(p)}٪</span></div>`).join('')}</div>`);
  };
  const lettersBars = bars(S.letters.map((x) => ({ k: x.l === 'ء' ? 'ء (همزة)' : x.l === 'ة' ? 'ة' : x.l, n: x.n })), S.letters[0].n, (r) => `<span class="pair"><b>${N(r.n)}</b><b>${pct(r.n, t.letters)}</b></span>`);
  body.innerHTML =
    `<div class="kpis kstack"><div class="ksec"><div class="khead">${big(N(t.surahs), 'سورة')}</div><div class="kbody"><div class="kxp" id="kSurahs"></div></div></div>` +
    `<div class="ksec"><div class="khead">${big(N(t.verses), 'آية')}</div><div class="kbody"><div class="kxp" id="kAyat"></div></div></div>` +
    `<div class="ksec"><div class="khead">${big(0, 'أسماء الله الحسنى')}</div><div class="kbody kmini">${NCD && NCD['الله'] ? kpi(N(NCD['الله'].n), `<span title="${esc(afNote())}">ورد لفظ الجلالة «الله»</span>`, 'kNames') : ''}${NCD ? kpi(N(Object.values(NCD).reduce((a, x) => a + x.n, 0)), 'ذُكرت الأسماء الحسنى <span class="kwarn">⚠︎</span>', 'kNames2') : ''}${NP ? kpi(N(NP.length), `<span title="وردت هذه الأزواج ${N(NP.reduce((a, x) => a + x[1], 0))} مرة في القرآن">زوجاً من الأسماء المتتالية</span> <span class="kwarn">⚠︎</span>`, 'kPairs') : ''}<div class="kxp" id="kNames" hidden></div><div class="kxp" id="kNames2" hidden></div><div class="kxp" id="kPairs" hidden></div></div></div>` +
    `<div class="ksec"><div class="khead">${big(N(t.words), 'كلمة (بالتكرار) <small>تحليل الكلمات</small>')}</div><div class="kbody"><div class="kxp" id="kWords">${kpi(N(t.uniqueWords), 'كلمة مختلفة', 'kDistinct')}${kpi(N(t.hapax), 'كلمة وردت مرة واحدة', 'kHapax')}</div><div class="kxp" id="kDistinct" hidden></div><div class="kxp" id="kHapax" hidden><p class="how">الكلمات التي وردت في القرآن مرة واحدة فقط، بصيغتها كما تُكتب، مرتبة ترتيباً هجائياً.</p><div class="sfield hsf"><input class="inp hq" placeholder="ابحث في القائمة…" aria-label="ابحث في الكلمات التي وردت مرة واحدة"><button type="button" class="gbtn hgo" title="ابحث" aria-label="ابحث"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.4"/><line x1="15.5" y1="15.5" x2="21" y2="21" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg></button></div><div class="hlist"><p class="hint">جارٍ التحميل…</p></div></div></div></div><div class="ksec"><div class="khead">${big(0, 'إحصائيات حروف وكلمات')}</div><div class="kbody kmini">${kpi(N(6), 'متوسطات حول الكلمات والحروف', 'kAvg')}${kpi(N(t.letters), 'حرفاً <small>تكرار الحروف</small>', 'kLetters')}<div class="kxp" id="kAvg" hidden><div class="kavg">${[[N((t.words / t.surahs).toFixed(1)), 'متوسط الكلمات في السورة'], [N(t.wordsPerVerse), 'متوسط الكلمات في الآية'], [N(t.lettersPerWord), 'متوسط الحروف في الكلمة'], [N((t.letters / t.verses).toFixed(1)), 'متوسط الحروف في الآية'], [N((t.letters / t.surahs).toFixed(1)), 'متوسط الحروف في السورة'], [N((t.verses / t.surahs).toFixed(1)), 'متوسط الآيات في السورة']].map(([v, l]) => `<div class="kpi"><b>${v}</b><span>${l}</span></div>`).join('')}</div></div>` +
    `<div class="kxp" id="kLetters" hidden>${lettersBars}</div></div></div></div>` +
    panel('لفظ الجلالة «الله» في القرآن', '<div id="allahCount"><p class="hint">جارٍ التحميل…</p></div>', false) +
    panel('عدد مرات ورود أسماء الله الحسنى في القرآن', '<div id="namesCounts"><p class="hint">جارٍ التحميل…</p></div>', false) +
    (P ? panel('نوع الكلمة: اسم-صفة-فعل', posPanel(), false) : '') +
    (VB ? panel(`الأفعال بحسب وزنها الصرفي`, verbPanel(), false) : '') +
    (NP ? panel('الرسم الأول', pairsPanel(), false) : '') +
    panel('الرسم الثاني', '<iframe src="/names8finalf" title="احصائية الاسماء الحسنى المتتالية في القرآن الكريم" loading="lazy" onload="const f = this, d = f.contentDocument; if (!d.querySelector(\'svg\') || f._ro) return; d.documentElement.style.overflowY = \'hidden\'; (f._ro = new ResizeObserver(() => { const h = d.body.scrollHeight; if (f.offsetWidth && h > 300 && Math.abs(f.offsetHeight - h) > 1) f.style.height = h + \'px\'; })).observe(f)" style="display:block;width:100%;aspect-ratio:4/5;border:0;border-radius:12px"></iframe>', false) +   // a standalone page with its own styles, so it sits in a frame
    (NP ? panel('الأزواج في الاتجاهين', (() => {   // pairs found in both orders, e.g. «الغفور الرحيم» and «الرحيم الغفور»
      const M = new Map(NP.map(([k, n]) => [k, n])), rows = [];
      for (const [k, n] of M) { const [a, b] = k.split(' '), r = M.get(b + ' ' + a); if (r && (n > r || (n === r && a > b))) rows.push([a, b, n, r]); }
      return `<p class="how">${N(rows.length)} أزواج وردت بالترتيبين: «أ ب» و«ب أ».</p>` + stab(['الزوج', 'بهذا الترتيب', 'بالترتيب المعكوس'], rows.map(([a, b, n, r]) => [[`${esc(a)} ← ${esc(b)}`, a + b], [N(n), n], [N(r), r]]), 1, 'desc', 'pairs2');
    })(), false) : '') +
    (RJ ? panel('الصرف والنحو للسور', gramPanel(), false) : '') +
    (RJ ? panel('الحروف: الإنتروبيا وأول الكلمة وآخرها والأزواج المتتالية', letPanel(), false) : '') +
    (VB ? panel('الأفعال بحسب الظرف الزمني', tenseBox().replace('<details class="pg pc-verb">', '<details class="pg pc-verb" open>'), false) : '') +
    panel(`تصنيف أسماء السور (${N(SCAT.length)})`, catPanel(), false) +
    panel(`${N(TW.length)} كلمة أكثر تكراراً`, bars(TW.map((x) => ({ k: x.w, n: x.n })), TW[0].n, (r) => `<span class="pair"><b>${N(r.n)}</b><b>${pct(r.n, t.words)}</b></span>`) + (AF ? `<p class="how afn">${afNote()}</p>` : ''), false).replace(`<summary>${N(TW.length)}`, `<summary><b class="snum">${N(TW.length)}</b>`) +
    panel('تكرار الحروف', lettersBars, false) +
    panel('أطوال الكلمات (بعدد الحروف)', bars(S.wordLength.map((x) => ({ k: x.len === 10 ? '١٠ فأكثر' : N(x.len) + ' حروف', n: x.n })), Math.max(...S.wordLength.map((x) => x.n)), (r) => `<span class="pair"><b>${N(r.n)}</b><b>${pct(r.n, t.words)}</b></span>`), false) +
    panel('المكي والمدني', `<table class="tbl"><tr><th></th><th class="num">السور</th><th class="num">الآيات</th><th class="num">الكلمات</th><th class="num">الحروف</th>${RJ ? '<th class="num">متوسط الآيات في السورة</th><th class="num">متوسط كلمات الآية</th>' : ''}</tr>` +
      [['مكية', mk, 'makkah'], ['مدنية', md, 'madinah']].map(([n, p, k]) => `<tr><td>${n}</td><td class="num">${N(p.surahs)}</td><td class="num">${N(p.verses)} (${pct(p.verses, t.verses)})</td><td class="num">${N(p.words)} (${pct(p.words, t.words)})</td><td class="num">${N(p.letters)}</td>${RJ ? `<td class="num">${N(RJ.structure.place[k].vps)}</td><td class="num">${N(RJ.structure.place[k].wpv)}</td>` : ''}</tr>`).join('') + `</table>` +
      (RJ ? `<p class="how">الآية المدنية أطول بنحو ${N((RJ.structure.place.madinah.wpv / RJ.structure.place.makkah.wpv).toFixed(1))} مرة من المكية في المتوسط.</p>` : '') +
      `<p class="tag">التصنيف المكي/المدني كما ورد في بيانات Quran.com.</p>`, false) +
    panel('أطول آية وأقصر آية', verseBox(S.longestVerse, 'أطول آية (بعدد الكلمات)') + verseBox(S.shortestVerse, 'أقصر آية (بعدد الكلمات)'), false) +
    (D ? panel(`الأضداد في القرآن (${N(D.opposites.length)} زوجاً)`, oppPanel(), false) : '') +
    (D ? panel('تحليلات أعمق للألفاظ: الروابط والأنماط (المستوى الثاني)', deepPanel(), false) : '') +
    moreSecs('ayat') + moreSecs('letters') + moreSecs('words') + moreSecs('distinct') + moreSecs('surahs') +
    `<p class="note">المصدر: ${esc(S.source)} — حُسبت بتاريخ ${esc(S.generated)}. تُعدّ الكلمة ما يفصله فراغ في الرسم الإملائي المعتاد، وتُحسب ى ياءً وؤ/ئ همزةً.</p>`;
  /* category rows (.catgrid): equal-width item boxes, 8–16 per row, with a gap between each small group of boxes */
  const GROUP = { 8: 4, 9: 3, 10: 5, 12: 3, 14: 7, 15: 3, 16: 4 };   // boxes per row -> boxes per group
  const layoutChips = (grid) => {
    const rows = [...grid.querySelectorAll(':scope > .catrow > .chips')]; if (!rows.length || !rows[0].offsetWidth) return;   // hidden (closed panel): done when it opens
    rows.forEach((c) => { c.classList.remove('cgrid'); c.style.gridTemplateColumns = ''; [...c.children].forEach((x) => (x.style.gridColumn = '')); });
    const w = Math.max(...rows.flatMap((c) => [...c.children].map((x) => x.offsetWidth))) - 12,   // in the grid a box has 6px less padding on each side
      most = Math.max(...rows.map((c) => c.children.length)), W = rows[0].clientWidth;
    const fits = (n) => n * w + (n - 1) * 6 + (n / GROUP[n] - 1) * 10 <= W, ns = Object.keys(GROUP).map(Number);
    const fixed = grid.classList.contains('scatg');   // surah-name categories: always 8 a row, 4 + 4
    const n = fixed ? (W >= 560 ? 8 : 0) : ns.find((k) => k >= most && fits(k)) || ns.filter(fits).pop(); if (!n) return;   // too narrow even for 8: boxes keep wrapping freely
    const g = GROUP[n], cols = Array.from({ length: n / g }, () => `repeat(${g},minmax(0,1fr))`).join(fixed ? ' 18px ' : ' 4px ');
    rows.forEach((c) => { c.classList.add('cgrid'); c.style.gridTemplateColumns = cols; [...c.children].forEach((x, k) => { const i = k % n; x.style.gridColumn = i + Math.floor(i / g) + 1; }); });
  };
  body.addEventListener('toggle', (e) => { if (e.target.open) setTimeout(() => body.querySelectorAll('.catgrid').forEach(layoutChips)); }, true);   // after the section has opened (and moved under its row)
  addEventListener('resize', () => body.querySelectorAll('.catgrid').forEach(layoutChips));
  body.addEventListener('click', async (e) => {   // word map: a companion box opens, under its row, the verses where it comes with its key word
    const b = e.target.closest('.cbtn'); if (!b) return;
    const grid = b.closest('.catgrid'), was = b.classList.contains('on');
    grid.querySelectorAll('.cbtn.on').forEach((x) => x.classList.remove('on')); grid.querySelectorAll('.cpanel').forEach((p) => p.remove());
    if (was) return;
    const [k, , list] = D.companions[+b.dataset.k], [w, c, keys] = list[+b.dataset.j];
    b.classList.add('on');
    const p = document.createElement('div'); p.className = 'cpanel';
    p.innerHTML = `<p class="how">«${esc(k)}» مع «${esc(w)}»: ${N(c)} آية${c > keys.length ? ` (تُعرض أول ${N(keys.length)})` : ''}</p><p class="hint">جارٍ التحميل…</p>`;
    b.closest('.catrow').append(p);
    try {
      let vs = []; for (let i = 0; i < keys.length; i += 8) vs = vs.concat(await (await fetch('/api/ayat?keys=' + keys.slice(i, i + 8).join(','))).json());
      p.querySelector('.hint').outerHTML = vs.map((v) => `<div class="vt" data-ak="${esc(v.key)}"><span class="tag">سورة ${esc(v.surah_ar)} — الآية ${N(v.ayah)}:</span> ${esc(v.text)}</div>`).join('');
    } catch { p.querySelector('.hint').textContent = 'تعذّر تحميل الآيات.'; }
  });
  body.addEventListener('click', async (e) => {   // name pairs: a surah box opens, under the boxes, the verses of that surah where the pair comes
    const b = e.target.closest('.npc'); if (!b) return;
    const cell = b.closest('td'), was = b.classList.contains('on');
    cell.querySelectorAll('.npc.on').forEach((x) => x.classList.remove('on')); cell.querySelectorAll('.cpanel').forEach((p) => p.remove());
    if (was) return;
    b.classList.add('on');
    const keys = b.dataset.k.split(','), p = document.createElement('div'); p.className = 'cpanel';
    p.innerHTML = '<p class="hint">جارٍ التحميل…</p>'; cell.append(p);
    try {
      let vs = []; for (let i = 0; i < keys.length; i += 8) vs = vs.concat(await (await fetch('/api/ayat?keys=' + keys.slice(i, i + 8).join(','))).json());
      p.querySelector('.hint').outerHTML = vs.map((v) => `<div class="vt" data-ak="${esc(v.key)}"><span class="tag">سورة ${esc(v.surah_ar)} — الآية ${N(v.ayah)}:</span> ${esc(v.text)}</div>`).join('');
    } catch { p.querySelector('.hint').textContent = 'تعذّر تحميل الآيات.'; }
  });
  body.addEventListener('click', async (e) => {   // verbs by form: a verb box opens, under its row, the verses that contain the verb
    const b = e.target.closest('.vbtn'); if (!b) return;
    const grid = b.parentNode, was = b.classList.contains('on');
    grid.querySelectorAll('.vbtn.on').forEach((x) => x.classList.remove('on')); grid.querySelectorAll('.cpanel').forEach((p) => p.remove());
    if (was) return;
    const [w, c, keys] = VB.forms[+b.dataset.f][1][+b.dataset.i];
    b.classList.add('on');
    let last = b; for (let x = b.nextElementSibling; x && x.offsetTop === b.offsetTop; x = x.nextElementSibling) last = x;   // the last box of this row
    const p = document.createElement('div'); p.className = 'cpanel';
    p.innerHTML = `<p class="how">«${esc(w)}»: ${N(c)} مرة في ${N(keys.length)}${keys.length === 30 ? ' آية أو أكثر (تُعرض أول ٣٠ آية)' : ' آية'}</p><p class="hint">جارٍ التحميل…</p>`;
    last.after(p);
    try {
      let vs = []; for (let i = 0; i < keys.length; i += 8) vs = vs.concat(await (await fetch('/api/ayat?keys=' + keys.slice(i, i + 8).join(','))).json());
      p.querySelector('.hint').outerHTML = vs.map((v) => `<div class="vt" data-ak="${esc(v.key)}"><span class="tag">سورة ${esc(v.surah_ar)} — الآية ${N(v.ayah)}:</span> ${esc(v.text)}</div>`).join('');
    } catch { p.querySelector('.hint').textContent = 'تعذّر تحميل الآيات.'; }
  });
  body.addEventListener('click', async (e) => {   // surah categories: a surah box opens, under its category, the full text of the surah
    const b = e.target.closest('.sbtn'); if (!b) return;
    const grid = b.closest('.catgrid'), was = b.classList.contains('on');
    grid.querySelectorAll('.sbtn.on').forEach((x) => x.classList.remove('on')); grid.querySelectorAll('.cpanel').forEach((p) => p.remove());
    if (was) return;
    const n = +b.dataset.s, su = S.surahs.find((x) => x.id === n);
    b.classList.add('on');
    const p = document.createElement('div'); p.className = 'cpanel';
    p.innerHTML = `<p class="how">سورة ${esc(su.ar)} (${N(su.verses)} آية)</p><div class="vtext"><span class="tag">جارٍ التحميل…</span></div>`;
    b.closest('.catrow').append(p);
    try {
      const vs = await (await fetch('/api/verses?s=' + n)).json(); if (!Array.isArray(vs)) throw 0;
      p.querySelector('.vtext').innerHTML = (n === 1 || n === 9 ? '' : '<span class="bm">بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ</span>') +
        vs.map((v) => `<span class="ay" data-ak="${n}:${v.n}">${esc(v.text.trim())} <span class="no">﴿${N(v.n)}﴾</span></span>`).join(' ');
    } catch { p.querySelector('.vtext').innerHTML = '<span class="tag">تعذّر تحميل نص السورة.</span>'; }
  });
  body.addEventListener('click', (e) => {   // ▲ ascending, ▼ descending; a click elsewhere on the header flips the order
    const th = e.target.closest('.stbl th'); if (!th) return;
    const t = th.closest('table'), c = th.dataset.c, i = e.target.closest('.srt i');
    t.dataset.d = i ? i.dataset.d : t.dataset.c === c ? (t.dataset.d === 'desc' ? 'asc' : 'desc') : c === '0' ? 'asc' : 'desc'; t.dataset.c = c; sortT(t); selSet('tbl:' + t.dataset.id, { c: t.dataset.c, d: t.dataset.d });
  });
  /* every section of the page lives under one of the boxes at the top, and opens under that box's row */
  const KW = ['الضمائر متكلم-مخاطب', 'ألفاظ الجذر فعل-مصدر', 'الحقول الدلالية بالأرقام', 'نوع الكلمة:', 'ألفاظ في مواضع متناظرة', 'موضوعات متكررة', 'تكرار الكلمة وطولها', 'المفاهيم بجذورها', 'أدوات التشبيه', 'الصرف والنحو للسور', 'الأفعال بحسب', 'كلمة أكثر تكراراً', 'أطوال الكلمات (بعدد', 'الأضداد في القرآن', 'أزواج كلمات مجتمعة', 'خريطة الألفاظ', 'ألفاظ لا تأتي إلا', 'أكثر العبارات تكراراً', 'أطول العبارات المكررة', 'كيف تبدأ الآيات', 'جذر واحد وألفاظ كثيرة', 'الجذور بتكرارها', 'ألفاظ مكية وألفاظ مدنية', 'ألفاظ تجمّعت في سورة'];
  const secs = (L) => [...body.querySelectorAll('details.lesson, details.pg.pc-top')].filter((d) => { const t = d.querySelector(':scope>summary').textContent; return L.some((k) => t.includes(k)); });
  const kxSecs = { kDistinct: secs(['البحث في كل كلمات القرآن']), kLetters: secs(['الحروف: الإنتروبيا', 'الرسم العثماني والإملاء', 'الحروف في كل سورة', 'حروف السور الطويلة', 'الحركات وعلامات الرسم']), kWords: secs(KW), kNames: secs(['لفظ الجلالة «الله» في القرآن']), kNames2: secs(['عدد مرات ورود أسماء الله الحسنى']), kPairs: secs(['الرسم الأول', 'الرسم الثاني', 'الأزواج في الاتجاهين']), kSurahs: secs(['تصنيف أسماء السور', 'سور تحوي ألفاظ متقاربة', 'تقارب السور المتجاورة', 'السور المتشابهة في بنائها', 'مطلع السورة وخاتمتها', 'عبارات مشتركة بين سورتين', 'المكي والمدني', 'السور المبدوءة بالقسم', 'السور المتقاربة في ألفاظها', 'السور ذات الألفاظ الخاصة بها', 'ثراء المفردات في السور']), kAyat: secs(['آيات تكررت بنصها', 'أطول آية وأقصر آية', 'آيات متباعدة فيها', 'تكرار صوت ساكن', 'السجع الداخلي', 'تمييز الآيات مكية', 'الآيات الأطول من المعتاد', 'أول آية وآخر آية في كل سورة', 'تتابع الفواصل في السور', 'آيات السور مكية ومدنية']) };   // the two names boxes share one panel
  // the letter sections (kLetters): boxes in the row itself, after «حرفاً»
  for (const [id, L] of Object.entries(kxSecs)) { const x = id === 'kLetters' ? $(id).parentNode : $(id); if (id === 'kLetters') body.querySelector('.kexp[aria-controls="kLetters"]').after(...L); else x.append(...L); if (id === 'kNames' || id === 'kNames2') L[0].replaceWith(...[...L[0].children].slice(1)); else if (L.length === 1) L[0].open = true;   // the names panels: the section's content straight under the box, no inner box to open
   else { panelize(x, (d) => d.parentNode === x && d.tagName === 'DETAILS'); x.style.setProperty('--n', L.length > 5 ? 4 : L.length); } }   // --n: one row of equal boxes
  { const ent = [...$('kLetters').parentNode.children].find((d) => d.tagName === 'DETAILS' && d.querySelector(':scope>summary').textContent.includes('الحروف: الإنتروبيا'));   // its three tables: boxes in the row in its place; its note: with the letter bars
    if (ent) { $('kLetters').prepend(ent.querySelector('p.how')); ent.replaceWith(...ent.querySelector('.lrow').children); } }
  { const lbox = (t) => [...$('kLetters').parentNode.children].find((d) => d.tagName === 'DETAILS' && d.querySelector(':scope>summary').textContent.includes(t)); lbox('أكثر الحروف أول الكلمة')?.before(lbox('الحروف في كل سورة') || ''); lbox('حروف السور الطويلة')?.classList.add('fit1'); }   // «الحروف في كل سورة» before «أكثر الحروف أول الكلمة وآخرها»
{ const lbox = (t) => [...$('kLetters').parentNode.children].find((d) => d.tagName === 'DETAILS' && d.querySelector(':scope>summary').textContent.includes(t)), L = ['الحركات وعلامات الرسم', 'الرسم العثماني والإملاء'].map(lbox).filter(Boolean);; if (L.length) { const s = document.createElement('div'); s.className = 'ksec'; s.innerHTML = `<div class="khead">${big(0, 'الرسم العثماني')}</div><div class="kbody kmini" style="grid-template-columns:repeat(2,minmax(0,1fr))"></div>`; const m = s.lastChild; m.append(...L); body.querySelector('.kstack').append(s); panelize(m, (d) => d.parentNode === m && d.tagName === 'DETAILS'); } }   // the two رسم boxes: a row of their own, «الرسم العثماني», each half the row
  body.querySelector('.kexp[aria-controls="kLetters"]').after(...$('kAvg').querySelectorAll('.kavg>.kpi')); body.querySelector('.kexp[aria-controls="kAvg"]').remove(); $('kAvg').remove();   // the six averages: boxes in the row after «حرفاً», in place of the «متوسطات» box
  { const box = (t) => [...$('kSurahs').children].find((d) => d.querySelector(':scope>summary')?.textContent.includes(t)); box('السور المتقاربة في ألفاظها')?.before(box('السور المبدوءة بالقسم') || '');   // «السور المبدوءة بالقسم» before «السور المتقاربة في ألفاظها»
    const wbox = (t) => [...$('kWords').children].find((d) => d.querySelector(':scope>summary')?.textContent.includes(t)); wbox('جذر واحد وألفاظ كثيرة')?.after(...['الجذور بتكرارها', 'المفاهيم بجذورها'].map(wbox).filter(Boolean)); wbox('كلمة أكثر تكراراً')?.before(...['تكرار الكلمة وطولها', 'موضوعات متكررة'].map(wbox).filter(Boolean));   // the roots table, then «المفاهيم بجذورها», right after «الجذور: جذر واحد وألفاظ كثيرة»
    wbox('ألفاظ الجذر فعل-مصدر')?.classList.add('fit1');   // its title on one line
    { const a = wbox('نوع الكلمة:'), b = wbox('بحسب الظرف الزمني'); if (a && b) { const m = document.createComment(''); a.replaceWith(m); b.replaceWith(a); m.replaceWith(b); } } }   // swap «نوع الكلمة» and «الأفعال بحسب الظرف الزمني»
  { const pick = (id, t) => [...$(id).children].find((d) => d.tagName === 'DETAILS' && d.querySelector(':scope>summary').textContent.includes(t));
    const swap = (a, b) => { if (!a || !b) return; const m = document.createComment(''); a.replaceWith(m); b.replaceWith(a); m.replaceWith(b); };
    const mk = pick('kSurahs', 'المكي والمدني'), len = pick('kAyat', 'آيات السور مكية ومدنية');
    if (mk && len) { [...len.children].slice(1).forEach((n) => n.remove()); len.append(...[...mk.children].slice(1).map((n) => n.cloneNode(true))); }   // both boxes: one table, counts and verse lengths
    swap(mk, pick('kSurahs', 'مطلع السورة وخاتمتها'));   // «المكي والمدني» two rows down
    swap(len, pick('kAyat', 'آيات تكررت بنصها'));   // «آيات السور مكية ومدنية» one row up
    swap(pick('kAyat', 'أطول آية وأقصر آية'), pick('kAyat', 'تمييز الآيات مكية')); }   // the first and the last boxes of the آية row
  body.querySelector('.kstack').prepend($('kNames').closest('.ksec'));   // the names of Allah: the first row
  $('kWords').prepend(...$('kWords').querySelectorAll(':scope>.kexp'));   // «كلمة مختلفة» and «كلمة وردت مرة واحدة» first in the word sections
  body.querySelectorAll(':scope>details.lesson').forEach((d) => d.remove());   // what is left below: the letters (shown in the letters box) and the emptied level-2 panel
  body.querySelectorAll('.kexp').forEach((b) => (b.onclick = () => {
    const x = $(b.getAttribute('aria-controls')), open = x.hidden || !b.classList.contains('on'); x.hidden = !open;
    if (open && b.parentNode.matches('.kmini,#kWords')) { let last = b; for (let n = b.nextElementSibling; n; n = n.nextElementSibling) if (!n.matches('.kxp,.npanel') && n.offsetTop === b.offsetTop) last = n; last.after(x); }   // the panel right under the box's own row   // another box of the same panel: the panel stays open, the highlight moves to this box
    body.querySelectorAll(`.kexp[aria-controls="${x.id}"]`).forEach((k) => { const on = open && k === b; k.classList.toggle('on', on); k.setAttribute('aria-expanded', on); });
    (pstate.kx ||= {})[x.id] = open; saveState();
  }));
  if (remember()) {   // the page as the visitor left it
    const kx = { ...(pstate.kx || {}) }; for (const id in kx) if (kx[id]) body.querySelector(`.kexp[aria-controls="${id}"]`)?.click();
    body.querySelectorAll('.stbl').forEach((t) => { const o = selGet('tbl:' + t.dataset.id) || (t.dataset.id === 'opp' && selGet('opp')); if (o) { t.dataset.c = o.c; t.dataset.d = o.d; sortT(t); } });
  }
  { // the words found only once: loaded the first time their box opens
    const hp = $('kHapax'), q = hp.querySelector('.hq'), out = hp.querySelector('.hlist'); let H = null;
    panelize(out, (d) => d.classList.contains('hlet'));   // four letters a row; an opened letter's words show under its row
    const rl = body.querySelector('.rlets');
    if (rl) {   // the roots: the same letter boxes, in alphabetical order or by how many roots a letter has
      panelize(rl, (d) => d.classList.contains('hlet'));
      const bar = rl.previousElementSibling, sortR = (m) => {
        bar.querySelectorAll('.btn').forEach((b) => b.classList.toggle('on', b.dataset.m === m)); rl.querySelectorAll('.hlet[open]').forEach((d) => (d.open = false));
        [...rl.querySelectorAll(':scope>.hlet')].sort((a, b) => (m === 'n' && b.dataset.n - a.dataset.n) || a.dataset.i - b.dataset.i).forEach((d) => rl.append(d));
      };
      bar.onclick = (e) => { const b = e.target.closest('.btn'); if (b) { sortR(b.dataset.m); selSet('rsort', b.dataset.m); } };
      if (selGet('rsort') === 'n') sortR('n');
    }
    const nrm = (t) => t.replace(/[ً-ٰٟـۖ-ۭ]/g, '').trim();   // as the word list: «ى» and «ي» stay different
    const chip = ([w, k]) => `<span class="chip" data-k="${esc(k)}" tabindex="0" role="button">${esc(w)}</span>`;   // k: the verse of the word
    const draw = () => { tipOff(); const t = nrm(q.value), m = t ? H.filter(([w]) => w.includes(t)) : H, by = new Map(); for (const x of m) (by.get(x[0][0]) || by.set(x[0][0], []).get(x[0][0])).push(x);
      out.innerHTML = `<p class="how">${N(m.length)} كلمة، مجمّعة بحرفها الأول (اضغط الحرف لعرض كلماته).</p>` + (t ? [...by].map(([c, ws]) => `<p class="hhead"><b class="hl">${esc(c)}</b> <small class="hn">${N(ws.length)} كلمة</small></p><div class="hgrid">${ws.map(chip).join('')}</div>`).join('') :   // a search: the matches under their letters, nothing to open
        '<div class="hcols">' + [...by].map(([c, ws]) => `<details class="hlet"><summary><b class="hl">${esc(c)}</b><small class="hn">${N(ws.length)} كلمة</small></summary><div class="hgrid">${ws.map(chip).join('')}</div></details>`).join('') + '</div>'); };
    const load = async () => { if (H) return; try { H = (await (await fetch('/words.json')).json()).filter(([, n]) => n === 1).map(([w, , k]) => [w, k]).sort((a, b) => AR_ABC.compare(a[0], b[0])); draw(); } catch { out.innerHTML = '<p class="hint">تعذّر التحميل.</p>'; } };
    body.querySelector('.kexp[aria-controls="kHapax"]').addEventListener('click', () => { if (!hp.hidden) load(); });
    if (!hp.hidden) load();
    /* a word's verse: shown under the word while the pointer is on it; a click keeps it open, and a click on the verse plays it */
    const AY = new Map(), ayah = (k) => AY.get(k) || AY.set(k, fetch('/api/ayat?keys=' + k).then((r) => r.json()).then((v) => v[0])).get(k);
    const tip = document.createElement('div'); tip.className = 'htip'; tip.hidden = true; document.body.append(tip);
    function tipOff() { tip.hidden = true; tip.on = null; tip.pin = false; out.querySelectorAll('.chip.on').forEach((x) => x.classList.remove('on')); }
    async function tipOn(c, pin) {
      const r = c.getBoundingClientRect(); tip.on = c; tip.pin = pin; c.classList.toggle('on', pin);
      tip.style.top = r.bottom + scrollY + 6 + 'px'; tip.style.left = Math.max(8, Math.min(r.left + r.width / 2 - 170, innerWidth - 356)) + scrollX + 'px';
      tip.innerHTML = '<p class="hint">جارٍ التحميل…</p>'; tip.hidden = false;
      try { const v = await ayah(c.dataset.k); if (tip.on === c) tip.innerHTML = `<b>«${esc(c.textContent)}»</b><div class="vt" data-ak="${esc(v.key)}"><span class="tag">سورة ${esc(v.surah_ar)} — الآية ${N(v.ayah)}:</span> ${esc(v.text)}</div>` + (pin ? '<p class="hint">اضغط الآية لسماعها.</p>' : ''); }
      catch { if (tip.on === c) tip.innerHTML = '<p class="hint">تعذّر تحميل الآية.</p>'; }
    }
    out.addEventListener('mouseover', (e) => { const c = e.target.closest('.chip[data-k]'); if (c && !tip.pin && tip.on !== c) tipOn(c, false); });
    out.addEventListener('mouseout', (e) => { const c = e.target.closest('.chip[data-k]'); if (c && !tip.pin && !c.contains(e.relatedTarget)) tipOff(); });
    out.addEventListener('click', (e) => { const c = e.target.closest('.chip[data-k]'); if (!c) return; const was = tip.pin && tip.on === c; tipOff(); if (!was) tipOn(c, true); });
    out.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.chip[data-k]')) { e.preventDefault(); e.target.click(); } });
    document.addEventListener('click', (e) => { if (tip.pin && !tip.contains(e.target) && !e.target.closest('#kHapax .chip')) tipOff(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !tip.hidden) tipOff(); });
    q.oninput = () => H && draw(); hp.querySelector('.hgo').onclick = () => { if (H) draw(); q.focus(); };
  }
  const lsur = body.querySelector('.lsur');
  if (lsur) {   // letters of the chosen surah against the whole Quran
    const Lt = RJ.letters, tot = Lt.alpha.map((c, i) => S.surahs.reduce((a, x, j) => a + Lt.perSurah[j][i], 0)), all = tot.reduce((a, b) => a + b, 0);
    const draw = () => { const j = +lsur.value - 1, row = Lt.perSurah[j], n = row.reduce((a, b) => a + b, 0), items = Lt.alpha.map((c, i) => ({ k: c, n: row[i], q: tot[i] })).sort((a, b) => b.n - a.n);
      lsur.nextElementSibling.innerHTML = `<p class="how">${N(n)} حرفاً.</p>` + bars(items, items[0].n, (r) => `<span class="pair"><b>${N(((100 * r.n) / n).toFixed(1))}٪</b><b class="muted">${N(((100 * r.q) / all).toFixed(1))}٪</b></span>`); };
    lsur.value = selGet('lsur') || 1; draw(); lsur.onchange = () => { selSet('lsur', lsur.value); draw(); };
  }
  const nps = body.querySelector('.npsearch');
  if (nps) {   // name pairs: show only the rows with the name or surah typed
    const q = nps.querySelector('.npq'), t = nps.nextElementSibling.querySelector('table');
    const nrm = (x) => x.replace(/[ً-ٰٟـۖ-ۭ]/g, '').replace(/[إأآٱ]/g, 'ا').trim();
    const draw = () => { const v = nrm(q.value); for (const r of [...t.rows].slice(1)) r.hidden = !!v && !nrm(r.textContent).includes(v); };
    q.value = selGet('npq') || ''; draw(); q.oninput = () => { selSet('npq', q.value); draw(); }; nps.querySelector('.npgo').onclick = () => { draw(); q.focus(); };
  }
  const ws = body.querySelector('.wsearch:not(.npsearch)');
  if (ws) {   // every word form with its count: loaded the first time the section opens
    let WL = null; const q = ws.querySelector('.wq'), h = ws.querySelector('.wh'), out = ws.nextElementSibling;
    const nrm = (t) => t.replace(/[ً-ٰٟـۖ-ۭ]/g, '').trim();   // as the word list: «ى» and «ي» stay different
    const draw = () => { if (!WL) return; let r = 0; const t = nrm(q.value),   // r: words with the same count share one rank (WL is sorted by count)
      af = AF && AF.forms.some(([w]) => w === t) ? new Set(AF.forms.map(([w]) => w)) : null,   // «الله» typed: only the forms of the name, not «اللهو» or «اللهب»
      m = WL.map(([w, n], i) => [w, n, n === WL[i - 1]?.[1] ? r : (r = i + 1)]).filter(([w, n]) => (!t || w.includes(t)) && (!af || af.has(w)) && (!h.checked || n === 1));
      out.innerHTML = `<p class="how">${N(m.length)} كلمة${m.length > 200 ? '، تُعرض أول ٢٠٠' : ''}.</p><div class="tscroll">` + stab(['الكلمة', 'مرات الورود', 'ترتيبها في التكرار'], m.slice(0, 200).map(([w, n, r]) => [[`<span class="wlink" tabindex="0" role="button">${esc(w)}</span>`, w], [N(n), n], [N(r), r]]), 1, 'desc', 'words') + '</div>'; };
    ws.closest('details').addEventListener('toggle', async () => { if (WL) return; try { WL = await (await fetch('/words.json')).json(); await loadAF(); } catch { out.innerHTML = '<p class="hint">تعذّر التحميل.</p>'; return; } q.value = selGet('wq') || ''; h.checked = !!selGet('wh'); draw(); });
    /* a word of the table: a click opens, under its row, the verses it comes in (from the published text, matched the way the counts were made) */
    let QT = null; const asW = (x) => x.replace(/[ً-ٰٟـۖ-ۭ]/g, '');
    out.addEventListener('click', async (e) => {
      const td = e.target.closest('table[data-id="words"] td:first-child'); if (!td || e.target.closest('.wpanel')) return;
      const tr = td.parentNode, was = tr.classList.contains('on'); out.querySelectorAll('.wpanel').forEach((x) => x.remove()); out.querySelectorAll('tr.on').forEach((x) => x.classList.remove('on')); if (was) return;
      const w = td.dataset.v, p = document.createElement('tr'); p.className = 'wpanel'; p.innerHTML = '<td colspan="3"><p class="hint">جارٍ التحميل…</p></td>'; tr.classList.add('on'); tr.after(p);
      try { QT ||= await (await fetch('/quran_text.json')).json(); } catch { p.cells[0].innerHTML = '<p class="hint">تعذّر تحميل الآيات.</p>'; return; }
      const ks = Object.keys(QT).filter((k) => QT[k].split(/\s+/).some((x) => asW(x) === w));
      p.cells[0].innerHTML = `<p class="how">«${esc(w)}» في ${N(ks.length)} آية${ks.length > 30 ? ' (تُعرض أول ٣٠)' : ''}. اضغط الآية لسماعها.</p>` +
        ks.slice(0, 30).map((k) => { const [su, a] = k.split(':'); return `<div class="vt" data-ak="${k}"><span class="tag">سورة ${esc(S.surahs[su - 1].ar)} — الآية ${N(+a)}:</span> ${esc(QT[k])}</div>`; }).join('');
    });
    out.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.wlink')) { e.preventDefault(); e.target.click(); } });
    q.oninput = () => { selSet('wq', q.value); draw(); }; h.onchange = () => { selSet('wh', h.checked); draw(); }; ws.querySelector('.wgo').onclick = () => { draw(); q.focus(); };
  }
  body.querySelectorAll('.psort:not(.rsort)').forEach((bar) => bar.addEventListener('click', (e) => {
    const b = e.target.closest('.btn'); if (!b) return;
    bar.querySelectorAll('.btn').forEach((x) => x.classList.toggle('on', x === b)); bar.nextElementSibling.innerHTML = phraseTable(b.dataset.m); selSet('psort', b.dataset.m);
  }));
  const ncLoad = () => { if (!body.dataset.ncDone && !($('kNames').hidden && $('kNames2').hidden)) { body.dataset.ncDone = 1; renderNameCounts(document.getElementById('namesCounts')); } };   // either panel fills both, the first time one opens
  ['kNames', 'kNames2'].forEach((id) => body.querySelector(`.kexp[aria-controls="${id}"]`)?.addEventListener('click', ncLoad)); ncLoad();
}
