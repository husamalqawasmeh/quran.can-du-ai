// volunteers' validation (#validate). One of the page's ordered scripts (see the <script> list at the end of index.html).
'use strict';
/* ---------- التحقق للمتطوعين (#validate): كل ورود لاسم يرد لغير الله أيضاً، يحكم المتطوع هل هو اسم لله في هذه الآية ---------- */
let vaTrusted = false, vaOcc = null, vaQ = null, vaSur = null, vaTally = {}, vaMine = {}, vaRev = {}, vaName = '', vaShown = 20, vaVerified = null;
const VA_MIN = 2;   // a verse is decided when at least this many volunteers agree, and more agree than disagree
let vaRule = new Map();   // verses settled by the rule (names_occ.json, scripts/name-counts.mjs): 'allah' when the name follows «الله» or another of His names, 'other' for «اليوم الآخر» and the like
const vaDec = (ref) => vaRev[ref] || vaDecided(vaTally[ref]) || vaRule.get(ref) || null;   // a trusted reviewer's answer, enough volunteers agreeing, or the rule
const vaDecided = (t = {}) => { const a = t.allah || 0, o = t.other || 0; return Math.max(a, o) >= VA_MIN && a !== o ? (a > o ? 'allah' : 'other') : null; };
async function vaLoad(text) {   // text: also the verses and surah names, for the page itself
  if (!vaOcc) { vaOcc = await (await fetch('/names_occ.json')).json(); vaRule = new Map(Object.entries(vaOcc).flatMap(([n, l]) => l.filter((x) => x[2]).map(([k, , r]) => [n + '|' + k, r > 0 ? 'allah' : 'other']))); }
  if (text && !vaQ) [vaQ, vaSur] = await Promise.all([fetch('/quran_uthmani.json').then((r) => r.json()), SURAHS]);   // shown with tashkeel; the name is found on the bare letters
  const who = prefs ? '&who=' + encodeURIComponent(prefs.uid) : '';
  const t = await (await fetch('/api/validate?item=names' + who)).json(); vaTally = t.tally || {}; vaMine = t.mine || {}; vaRev = t.rev || {}; vaTrusted = !!t.trusted;
}
// the badge of a name the volunteers have judged: ✓ and the verses judged «a name of Allah»; while some are still open, «+ n؟» after it
const vfBadge = (x) => `<span class="warn ok" title="${x.open ? `حكم المتطوعون: ${nA(x.allah)} مرة اسماً لله، و${nA(x.open)} لم تُحسم بعد` : 'تحقق منه المتطوعون: العدد عدد وروده اسماً لله'}">✓</span>${nA(x.allah)}${x.open ? `<small class="vopen"> + ${nA(x.open)}؟</small>` : ''}`;
async function loadVerified() {   // names with judged verses: how many are a name of Allah, how many are still open
  if (vaVerified) return vaVerified;
  try { await vaLoad(); } catch { return (vaVerified = {}); }
  vaVerified = {};
  for (const [n, list] of Object.entries(vaOcc)) { const d = list.map(([k, c]) => [vaDec(n + '|' + k), c]); if (d.some(([x]) => x)) vaVerified[n] = { allah: d.reduce((a, [x, c]) => a + (x === 'allah' ? c : 0), 0), open: d.reduce((a, [x, c]) => a + (x ? 0 : c), 0) }; }
  return vaVerified;
}
let vaInit = false;
function vaFeatures() {   // the site's pages (the home tiles) and its done analyses (the criteria marked «منجز»), for the volunteers to check
  const box = $('vaFeat'); if (box.firstChild) return;
  const tiles = [...document.querySelectorAll('#v-home a.tile')], done = RS.map(([g, l]) => [g, l.filter((c) => c[2] === 'd')]).filter(([, l]) => l.length);
  box.innerHTML = `<details class="card drvsec ucard"><summary><h2>${ico('layout-grid')} ميزات الموقع للتدقيق: الصفحات (${nA(tiles.length)})</h2></summary><p>كل صفحات الموقع كما في القائمة الرئيسية. افتح الصفحة وراجع نصوصها وآياتها، وأرسل ملاحظتك.</p><ol class="ftlist">${tiles.map((a) => `<li><a href="${a.getAttribute('href')}">${esc(a.querySelector('b').textContent)}</a>${a.querySelector(':scope>span') ? ` <small>${esc(a.querySelector(':scope>span').textContent)}</small>` : ''}</li>`).join('')}</ol></details>` +
    `<details class="card drvsec ucard"><summary><h2>${ico('chart-column')} ميزات الموقع للتدقيق: التحليلات المنجزة (${nA(done.reduce((a, [, l]) => a + l.length, 0))})</h2></summary><p>التحليلات اللغوية والإحصائية المنجزة في الموقع، مرتبة بحسب معايير التحليل اللغوي العميق، مع مكان كل منها.</p>${done.map(([g, l]) => `<h3 class="ptl">${esc(g)}</h3><ol class="ftlist">${l.map(([n, t, , note, href]) => `<li value="${n}">${href ? `<a href="${href}">${esc(t)}</a>` : esc(t)}${note ? ` <small>${esc(note)}</small>` : ''}</li>`).join('')}</ol>`).join('')}</details>`;
}
async function initValidate() {
  const body = $('vaBody');
  if (!vaInit) {
    vaInit = true;
    body.innerHTML = `<div class="card drvsec"><h2>كيف تساعد؟</h2><ul>
      <li>افتح البند، واختر الاسم، ثم احكم على كل آية: هل اللفظ فيها اسم لله أم لغيره؟</li>
      <li>يُحفظ حكمك باسمك المكتوب في <a href="#userconfig">الإعدادات</a>، ويمكنك تغييره أو سحبه في أي وقت.</li>
      <li>تُحسم الآية حين يحكم فيها أحد المراجعين المعتمدين، أو حين يتفق عليها ${nA(VA_MIN)} متطوعين على الأقل ويزيد المتفقون على المخالفين.</li>
      <li><b>قاعدة:</b> الاسم الذي يأتي بعد لفظ الجلالة مباشرة (مثل «والله»، «بالله»، «لله»، «إن الله»، «وكان الله») أو بعد اسم آخر من أسمائه، يُعدّ اسماً لله: «وكان الله عزيزاً حكيماً». ولا تنطبق إذا كان لفظ الجلالة مضافاً إليه («وعد الله حقاً»، «نصر الله قريب»، «من دون الله وليّاً»). وتُحسم «اليوم الآخر» و«آخر» بلا أداة تعريف («إلهاً آخر»، «أيام أُخَر») بأنها ليست اسماً لله. حُسمت بهذه القاعدة <b id="vaRuleN">…</b> آية، ويستطيع المراجعون مخالفتها. وحين تُحسم كل آيات الاسم تُزال علامة <span class="wsign">⚠︎</span> عنه في <a href="#stats">الإحصاءات</a>، ويصير عدده عدد وروده اسماً لله.</li></ul>
      <p class="hint" id="vaWho"></p></div>
      <details class="lesson vaadm"><summary>${ico('user')} إدارة المتطوعين الموثوقين (للمشرف)</summary><div class="vaadmin"><p class="hint">التحكيم متاح للمشرف وللمتطوعين الذين يضيفهم هنا فقط. أدخل كلمة مرور المشرف (تُحفظ على هذا الجهاز).</p><div class="vaadrow"><input class="inp vaatok" type="password" placeholder="كلمة مرور المشرف" autocomplete="current-password"><button type="button" class="btn vaaload">عرض القائمة</button></div><div class="vaadrow"><input class="inp vaanew" placeholder="اسم المتطوع أو بريده كما يكتبه في الإعدادات"><button type="button" class="btn pri vaaadd">إضافة متطوع موثوق</button></div><div class="vaalist"></div></div></details>
      <details class="lesson vaitem" open><summary>١. الأسماء التي ترد في القرآن لغير الله أيضاً (<span class="wsign">⚠︎</span>)</summary><div class="vain"><p class="hint">جارٍ التحميل…</p></div></details>`;
    body.addEventListener('click', vaClick);
    body.addEventListener('change', (e) => { if (e.target.matches('.vasel')) { vaName = e.target.value; vaShown = 20; selSet('va', vaName); vaDraw(); } });
  }
  $('vaWho').innerHTML = prefs ? `تحكم باسم: <b>${esc(prefs.uid)}</b>` : 'لم تكتب اسمك بعد: <a href="#userconfig">اكتبه في الإعدادات</a> لتستطيع الحكم.';
  vaSignIn();
  try { await vaLoad(true); $('vaRuleN').textContent = nA(vaRule.size);
    if (prefs && !vaTrusted) $('vaWho').insertAdjacentHTML('beforeend', ' — <span class="gneed">التحكيم للمتطوعين الموثوقين فقط؛ اطلب من المشرف إضافتك، ويمكنك الاطلاع على الآيات إلى ذلك الحين.</span>'); } catch { body.querySelector('.vain').innerHTML = '<p class="hint">تعذّر التحميل.</p>'; return; }
  vaName = vaName || selGet('va') || Object.keys(vaOcc)[0]; vaDraw();
}
async function vaSignIn() {   // a Gmail name judges only after signing in with Google (when sign-in is set up)
  const w = $('vaWho'); if (!prefs || !isGmail(prefs.uid) || gSigned(prefs.uid)) return;
  const g = await gLoad(); if (!g) return;
  w.insertAdjacentHTML('beforeend', ' — <span class="gneed">سجّل الدخول بحساب Google لتُحفظ أحكامك:</span> <span class="gsbtn"></span>');
  gButton(w.querySelector('.gsbtn'), () => initValidate());
}
const vaProg = (n) => { const l = vaOcc[n]; return [l.filter(([k]) => vaDec(n + '|' + k)).length, l.length]; };
function vaDraw() {
  const box = $('vaBody').querySelector('.vain'), allNames = Object.keys(vaOcc), open = (n) => { const [a, b] = vaProg(n); return b - a; }, names = allNames.filter((n) => open(n) > 0).sort((x, y) => open(x) - open(y)), all = allNames.reduce((a, n) => { const [d, t] = vaProg(n); return [a[0] + d, a[1] + t]; }, [0, 0]);
  if (!names.length) { box.innerHTML = `<p>حُسمت كل الآيات (${nA(all[1])} آية). جزاكم الله خيراً.</p>`; return; }
  if (!names.includes(vaName)) vaName = names[0];   // a finished name leaves the list
  const strip = (t) => t.replace(/[ً-ٰٟـۖ-ۭ]/g, '').replace(/[إأآٱ]/g, 'ا');
  const stem = strip(vaName).replace(/^ال/, ''), re = new RegExp('(^|\\s)([وفبلك]?(?:ال|لل)?' + stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + 'ا?)(?=\\s|$)', 'g');   // the name as a whole word, with or without the article and a joined letter
  const reW = new RegExp('^[وفبلك]?(?:ال|لل)?' + stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + 'ا?$');   // one word of the verse
  const vl = vaOcc[vaName], list = vl.filter(([k]) => !vaDec(vaName + '|' + k)), [d, t] = vaProg(vaName);
  const row = ([k, c]) => { const ref = vaName + '|' + k, tl = vaTally[ref] || {}, mine = vaMine[ref], dec = vaDec(ref), [su, a] = k.split(':');
    return `<div class="varow${dec ? ' done' : ''}" data-ref="${esc(ref)}"><div class="vt vaq" data-ak="${k}">${hlAyah(vaQ[k] || '', (w) => reW.test(strip(w)) || reW.test(strip(w.replace(/ٰ/g, 'ا'))))}</div>
      <div class="vameta"><span class="tag">${esc(vaSur?.[su - 1]?.ar || 'سورة ' + nA(su))} ${nA(a)}${c > 1 ? ` · يرد ${nA(c)} مرات` : ''}</span>
      ${[['allah', 'اسم لله'], ['other', 'لغير الله'], ['unsure', 'غير متأكد']].map(([v, l]) => `<button type="button" class="btn vab${mine === v ? ' on' : ''}" data-v="${v}"${prefs && vaTrusted ? '' : ' disabled'}>${l} <small>${nA(tl[v] || 0)}</small></button>`).join('')}
      ${dec ? `<span class="vadec">✓ حُسمت: ${dec === 'allah' ? 'اسم لله' : 'لغير الله'}</span>` : ''}</div></div>`; };
  box.innerHTML = `<p>كل آية ورد فيها لفظ الاسم. تنتظر الحكم ${nA(all[1] - all[0])} آية في ${nA(names.length)} اسماً.</p>
    <label class="defrow">الاسم: <select class="vasel ucsel">${names.map((n) => { const [a, b] = vaProg(n); return `<option value="${esc(n)}"${n === vaName ? ' selected' : ''}>${esc(n)} (${nA(b - a)})</option>`; }).join('')}</select></label>
    <p class="hint">«${esc(vaName)}»: ${nA(t - d)} آية تنتظر الحكم. اضغط الآية لتسمعها.</p>` +
    (list.length ? '' : '<p class="hint">لا آيات مفتوحة في هذا الاسم: كلها حُسمت.</p>') + list.slice(0, vaShown).map(row).join('') + (list.length > vaShown ? `<button type="button" class="btn vamore">عرض المزيد (${nA(list.length - vaShown)})</button>` : '');
}
async function sortNameCards() {   // #names: in each group, the names with a settled count first (largest count first), then those with verses still open
  const VF = await loadVerified(), NC = await loadNameCounts(), T = TOPICS.names; if (!NC) return;
  const key = (d) => { const t = T.items[+d.dataset.i]?.t, v = VF[t], open = v ? v.open > 0 : AMBIGUOUS.has(t), n = v ? v.allah + v.open : NC[t]?.n || 0; return [open ? 1 : 0, n]; };
  document.querySelectorAll('#t-names .gcards').forEach((col) => {
    const cards = [...col.querySelectorAll(':scope > details[data-i]')].map((d) => [d, key(d)]).sort(([, a], [, b]) => a[0] - b[0] || b[1] - a[1]);
    for (const [d] of cards) { col.append(d); if (d._p && d._p.isConnected) d.after(d._p); }   // an opened card keeps its panel under it
  });
}
async function refreshNameBadges() {   // the newest judgements on the #names cards and the #stats names list, without reloading the page
  vaVerified = null; const VF = await loadVerified(), NC = await loadNameCounts(), T = TOPICS.names;
  document.querySelectorAll('#t-names details[data-i]').forEach((d) => { const m = T.items[+d.dataset.i], nc = d.querySelector(':scope>summary .nc'); if (!m || !nc || !NC || !NC[m.t]) return;
    nc.innerHTML = VF[m.t] ? vfBadge(VF[m.t]) : `${AMBIGUOUS.has(m.t) ? '<span class="warn">⚠</span>' : ''}${nA(NC[m.t].n)}`; });
  const box = document.getElementById('namesCounts'); if (box && box.querySelector('.cr')) renderNameCounts(box);
  sortNameCards();
}
async function vaAdmin(body, b) {   // the admin panel on #validate
  const tok = body.querySelector('.vaatok'), list = body.querySelector('.vaalist');
  if (!tok.value) { try { tok.value = localStorage.getItem('qr_admtok') || ''; } catch {} }
  const call = async (payload) => {
    const r = await fetch('/api/trusted', { method: payload ? 'POST' : 'GET', headers: { authorization: 'Bearer ' + tok.value, 'content-type': 'application/json' }, body: payload ? JSON.stringify(payload) : undefined });
    if (r.status === 401) throw new Error('كلمة مرور المشرف غير صحيحة.');
    if (!r.ok) throw new Error('تعذّر الطلب.');
    try { localStorage.setItem('qr_admtok', tok.value); } catch {}
    return r.json();
  };
  const show = (d) => { list.innerHTML = d.trusted.length ? '<ul class="vaal">' + d.trusted.map((t) => `<li><b>${esc(t.who)}</b> <small>(${esc(t.created || '')})</small> <button type="button" class="btn varem" data-who="${esc(t.who)}">إزالة</button></li>`).join('') + '</ul>' : '<p class="hint">لا يوجد متطوعون موثوقون بعد.</p>'; };
  try {
    if (b.classList.contains('vaaload')) show(await call());
    else if (b.classList.contains('vaaadd')) { const w = body.querySelector('.vaanew').value.trim(); if (w.length < 2) return; show(await call({ who: w })); body.querySelector('.vaanew').value = ''; }
    else if (b.classList.contains('varem')) show(await call({ who: b.dataset.who, remove: true }));
  } catch (err) { list.innerHTML = `<p class="gneed">${esc(err.message)}</p>`; }
}
async function vaClick(e) {
  const ab = e.target.closest('.vaaload, .vaaadd, .varem'); if (ab) { vaAdmin($('vaBody'), ab); return; }
  if (e.target.closest('.vamore')) { vaShown += 30; vaDraw(); return; }
  const b = e.target.closest('.vab'); if (!b || !prefs || !vaTrusted) return;
  const ref = b.closest('.varow').dataset.ref, v = vaMine[ref] === b.dataset.v ? '' : b.dataset.v;   // pressing your own answer again takes it back
  b.disabled = true;
  try {
    const r = await fetch('/api/validate?item=names', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ref, verdict: v, who: prefs.uid, idToken: gToken }) });
    if (r.status === 403) { b.disabled = false; alert('التحكيم للمتطوعين الموثوقين فقط. اطلب من المشرف إضافتك.'); return; }
    if (r.status === 401) { b.disabled = false; alert('انتهى تسجيل الدخول بحساب Google أو لم يتم: سجّل الدخول من أعلى الصفحة ثم أعد المحاولة.'); initValidate(); return; }
    if (!r.ok) throw 0;
    await vaLoad(true); vaDraw(); refreshNameBadges();
  } catch { b.disabled = false; alert('تعذّر حفظ الحكم، حاول مرة أخرى.'); }
}
