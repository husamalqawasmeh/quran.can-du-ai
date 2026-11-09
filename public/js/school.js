// the quiz page (#school): pick a level, a count, question kinds and options; all questions are drawn on the device from the static text files and the topic pages. One of the page's ordered scripts (see the <script> list at the end of index.html).
'use strict';
/* ---------- المدرسة ---------- */
let scQT = null, scW1 = null, scQ = [], scI = 0, scScore = 0, scOpt = {}, scLvl = 'mid', scStreak = 0, scW = null;
const scAudio = new Audio();
const scRand = (n) => Math.floor(Math.random() * n);
const scCoin = () => Math.random() < 0.5;
const scShuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = scRand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const scPick = (a, n) => scShuffle(a).slice(0, n);
const SC_LVLS = ['easy', 'mid', 'hard'], SC_LVL_AR = { easy: 'سهل', mid: 'متوسط', hard: 'صعب' };
const SC_POOL = { easy: (s) => s === 1 || s >= 78, mid: (s) => s === 1 || s >= 36, hard: () => true };   // easy: الفاتحة وجزء عمّ
const SC_TOPICS = {   // question, which boxes of the topic page to use, how a box is named in the choices
  prophets: ['عن أي نبي تتحدث هذه الآية؟', (m) => m.g < 2],   // not the «محمد ﷺ في القرآن» wording boxes
  others: ['عن أي شخصية تتحدث هذه الآية؟'],
  animals: ['أي حيوان ورد في هذه الآية؟'],
  places: ['أي مكان تشير إليه هذه الآية؟'],
  food: ['أي طعام ورد في هذه الآية؟', (m) => m.g < 2 && !['فلينظر الإنسان إلى طعامه', 'يُسقى بماء واحد'].includes(m.t)],
  akhlaq: ['عن أي خُلق تتحدث هذه الآية؟'],
  duasp: ['من صاحب هذا الدعاء من الأنبياء؟', () => true, (m) => m.t.split(':')[0].replace(/ و.*/, '').trim()],
};
const SC_FACTS = [   // general questions with fixed answers: [question, right, wrong…]
  ['كم عدد سور القرآن الكريم؟', '١١٤', '١١٠', '١٢٠', '١٠٠'],
  ['كم عدد أجزاء القرآن الكريم؟', '٣٠', '٢٠', '٤٠', '٦٠'],
  ['ما أطول سورة في القرآن؟', 'البقرة', 'آل عمران', 'النساء', 'الأعراف'],
  ['ما أقصر سورة في القرآن؟', 'الكوثر', 'العصر', 'النصر', 'الإخلاص'],
  ['ما السورة التي لا تبدأ بالبسملة؟', 'التوبة', 'الأنفال', 'يونس', 'هود'],
  ['ما السورة التي وردت فيها البسملة مرتين؟', 'النمل', 'الفاتحة', 'النحل', 'القصص'],
  ['ما السورة الوحيدة المسمّاة باسم امرأة؟', 'مريم', 'النساء', 'المجادلة', 'الممتحنة'],
  ['ما أطول آية في القرآن؟', 'آية الدَّين (البقرة ٢٨٢)', 'آية الكرسي (البقرة ٢٥٥)', 'آية النور (النور ٣٥)', 'آخر آية في البقرة (٢٨٦)'],
  ['كم مرة ورد اسم «محمد» ﷺ في القرآن؟', '٤', '٣', '٥', '٧'],
  ['في أي سورة ذُكر اسم زيد بن حارثة؟', 'الأحزاب', 'النور', 'الأنفال', 'التوبة'],
  ['ما أول ما نزل من القرآن؟', 'اقرأ باسم ربك الذي خلق', 'الحمد لله رب العالمين', 'يا أيها المدثر', 'قل هو الله أحد'],
  ['أي نبي ذُكر اسمه في القرآن أكثر من غيره؟', 'موسى', 'إبراهيم', 'نوح', 'عيسى'],
];
const scStoreGet = () => { try { const d = JSON.parse(store().getItem('qr_school') || 'null'); if (d && Array.isArray(d.w)) return d; } catch {} return { n: 0, w: [] }; };
const scStoreSet = () => { try { store().setItem('qr_school', JSON.stringify(scW)); } catch {} };   // wrong answers to ask again: on this device only
async function initSchool() {
  leaveHooks.push(() => scAudio.pause());
  ensureReaders().then(() => fillEveryReader($('scReader')));
  if (scQT) return;
  try { [scQT, scW1] = await Promise.all([fetch('/quran_text.json').then((r) => r.json()), fetch('/words.json').then((r) => r.json())]); if (!surahs) surahs = await (await fetch('/api/surahs')).json(); }
  catch { scQT = null; $('scBody').innerHTML = '<p class="hint">تعذّر تحميل البيانات.</p>'; return; }
  scW1 = scW1.filter(([w, n, k]) => n === 1 && k && w.length >= 4);   // words that occur once in the Quran, with their verse
}
const scName = (s) => 'سورة ' + surahs[s - 1].ar;
const scMakki = (s) => /^mak/i.test(surahs[s - 1].place || '');
const scAyah = (k) => `<p class="scayah">${esc(scQT[k])}</p>`;
function scMake(kind, lvl) {
  const ok = SC_POOL[lvl], nOpt = lvl === 'easy' ? 3 : 4;
  const keys = Object.keys(scQT).filter((k) => ok(+k.split(':')[0])), key = keys[scRand(keys.length)], s = +key.split(':')[0], text = scQT[key];
  const otherSurahs = (n) => scPick(surahs.map((x) => x.id).filter((x) => x !== s && ok(x)), n);
  const mc = (q, right, wrong, k = key) => ({ q, right, opts: scShuffle([right, ...wrong.slice(0, nOpt - 1)]), key: k });
  const tf = (q, truth, k, hint) => ({ q: '<p>صواب أم خطأ؟</p>' + q, right: truth ? 'صواب' : 'خطأ', opts: ['صواب', 'خطأ'], key: k, hint });
  if (SC_TOPICS[kind]) {   // an ayah from a topic page: which box of that page is it about?
    const [ask, keep = () => true, label = (m) => m.t] = SC_TOPICS[kind];
    const items = TOPICS[kind].items.filter((m) => keep(m) && m.keys && m.keys.some((k) => scQT[k])), m = items[scRand(items.length)];
    const ks = m.keys.filter((k) => scQT[k]), k = ks[scRand(ks.length)], right = label(m);
    const wrong = [...new Set(scShuffle(items).filter((o) => !o.keys.includes(k)).map(label))].filter((x) => x !== right);
    return mc(`<p>${ask}</p>${scAyah(k)}<p class="tag">${esc(scName(+k.split(':')[0]))} — الآية ${nA(k.split(':')[1])}</p>`, right, wrong, k);
  }
  if (kind === 'surah') return mc(`<p>في أي سورة وردت هذه الآية؟</p>${scAyah(key)}`, scName(s), otherSurahs(nOpt - 1).map(scName));
  if (kind === 'place') return { q: `<p>هل هذه الآية من سورة مكية أم مدنية؟</p>${scAyah(key)}`, right: scMakki(s) ? 'مكية' : 'مدنية', opts: ['مكية', 'مدنية'], key, hint: 'الآية من ' + scName(s) };
  if (kind === 'count') {
    const v = surahs[s - 1].verses, spread = { easy: 0.6, mid: 0.35, hard: 0.2 }[lvl], wrong = new Set();
    for (let k = 1; wrong.size < nOpt - 1; k++) { const x = Math.max(3, Math.round(v * (1 + spread * k * (k % 2 ? 1 : -1) / 1.5))); if (x !== v) wrong.add(x); if (k > 20) wrong.add(v + k * 7); }   // spread out around the true count, never below 3
    return mc(`<p>كم عدد آيات ${esc(scName(s))} تقريباً؟</p>`, nA(v), [...wrong].map(nA), null);
  }
  if (kind === 'blank') {
    const ws = text.split(' '), idx = ws.map((w, i) => [w, i]).filter(([w]) => w.length >= 3), [w, i] = idx.length ? idx[scRand(idx.length)] : [ws[0], 0];
    const shown = ws.map((x, j) => (j === i ? '<span class="scgap">_____</span>' : esc(x))).join(' ');
    const wrong = [...new Set(scPick(keys, 30).map((k) => scQT[k].split(' ').filter((x) => x.length >= 3)).map((a) => a[scRand(a.length)]))].filter((x) => x && x !== w);   // words from other verses
    return mc(`<p>أكمل الفراغ في الآية (${esc(scName(s))}):</p><p class="scayah keep">${shown}</p>`, w, wrong);
  }
  if (kind === 'tf') {
    const v = surahs[s - 1].verses, r = scRand(4);
    if (r === 0) { const m = scCoin(); return tf(`<p class="scstmt">${esc(scName(s))} سورة ${m ? 'مكية' : 'مدنية'}.</p>`, m === scMakki(s), null, `عدد آياتها ${nA(v)}`); }
    if (r === 1) { const n = scCoin() ? v : Math.max(3, v + (scCoin() ? 1 : -1) * (1 + scRand(Math.max(3, Math.round(v * 0.3))))); return tf(`<p class="scstmt">عدد آيات ${esc(scName(s))} ${nA(n)} آية.</p>`, n === v, null, `عدد آياتها بين ${nA(Math.max(1, Math.floor(v * 0.7)))} و${nA(Math.ceil(v * 1.3))}`); }
    if (r === 2) { const o = scCoin() ? s : otherSurahs(1)[0]; return tf(`<p class="scstmt">هذه الآية من ${esc(scName(o))}:</p>${scAyah(key)}`, o === s, key, `السورة ${scMakki(s) ? 'مكية' : 'مدنية'}`); }
    const m = scMake(['prophets', 'others', 'animals', 'places'][scRand(4)], lvl), c = scCoin() ? m.right : m.opts.find((o) => o !== m.right);
    return tf(m.q.replace(/^<p>.*?<\/p>/, `<p class="scstmt">هذه الآية تتحدث عن: <b>${esc(c)}</b></p>`), c === m.right, m.key);
  }
  if (kind === 'mcq') { const [q, right, ...wrong] = SC_FACTS[scRand(SC_FACTS.length)]; return mc(`<p>${q}</p>`, right, scShuffle(wrong), null); }
  // match: words that occur only once, each to the surah it is in
  const pairs = []; const used = new Set();
  for (const [w, , k] of scShuffle(scW1)) { const t = +k.split(':')[0]; if (ok(t) && !used.has(t)) { used.add(t); pairs.push([w, t]); } if (pairs.length === nOpt) break; }
  return { match: pairs, q: '<p>صِل كل كلمة بالسورة التي وردت فيها (كل كلمة وردت مرة واحدة فقط في القرآن):</p>' };
}
const scNorm = (t) => String(t).replace(/[ً-ْٰـ]/g, '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[«»()ﷺ.،]/g, '').replace(/^سوره\s+/, '').replace(/^ال/, '').replace(/\s+/g, ' ').trim();
const scTypable = (x) => x.opts && x.opts.length > 2 && !/[(]/.test(x.right) && x.right.split(' ').length <= 3;
function scTypedOk(x, typed) {   // a near count is right too: the question says «تقريباً»
  if (x.kind === 'count') { const v = +scNorm(x.right), n = +scNorm(typed); return n > 0 && Math.abs(n - v) <= Math.max(2, Math.round(v * 0.1)); }
  return scNorm(typed) === scNorm(x.right);
}
const scMakeK = (kind, lvl) => ({ ...scMake(kind, lvl), kind });
function scPlay(key) {
  const rec = reciters.find((r) => r.id === $('scReader').value), folder = rec && everyFolder(rec); if (!folder || !key) return;
  const [s, a] = key.split(':'); scAudio.src = ayahUrl(folder, s, a); scAudio.play().catch(() => {});
}
function scShow() {
  const b = $('scBody'); scAudio.pause(); b.classList.remove('schide');
  if (scI >= scQ.length) {
    const due = scW.w.length;
    b.innerHTML = `<div class="aib"><h3>النتيجة: ${nA(scScore)} من ${nA(scQ.length)}</h3><p>${scScore === scQ.length ? 'ممتاز، بارك الله فيك!' : scScore >= scQ.length / 2 ? 'أحسنت، واصل المراجعة.' : 'لا بأس، أعد المحاولة وراجع السور.'}</p>${scOpt.adapt ? `<p>وصلت إلى المستوى: ${SC_LVL_AR[scLvl]}</p>` : ''}${due ? `<p class="tag">لديك ${nA(due)} من الأسئلة التي أخطأت فيها محفوظة؛ ستعود إليك بعد اختبارين إذا اخترت «أعد الأسئلة التي أخطأت فيها».</p>` : ''}<button type="button" class="btn pri" id="scAgain">اختبار جديد</button></div>`;
    $('scAgain').onclick = () => { b.innerHTML = ''; $('scForm').hidden = false; };
    return;
  }
  const x = scQ[scI], snd = scOpt.snd && x.key, blank = x.kind === 'blank';
  const head = `<p class="tag">السؤال ${nA(scI + 1)} من ${nA(scQ.length)} — الدرجة ${nA(scScore)}${scOpt.adapt ? ' — المستوى: ' + SC_LVL_AR[scLvl] : ''}${x.review ? ' — <b>سؤال للمراجعة</b>' : ''}</p>`;
  const tools = (snd ? `<button type="button" class="mbtn" id="scPlay" aria-label="استمع إلى الآية"${blank ? ' disabled' : ''}>▶</button> ` : '') + (scOpt.clue ? '<button type="button" class="btn" id="scClue">تلميح</button>' : '') + '<span id="scHint" class="tag"></span>';
  x.clued = false;
  if (x.match) {
    const names = scShuffle(x.match.map(([, t]) => t));
    b.innerHTML = head + x.q + `<div class="scmatch">${x.match.map(([w], i) => `<label><b>${esc(w)}</b><select class="ucsel" data-i="${i}"><option value="">— اختر السورة —</option>${names.map((t) => `<option value="${t}">${esc(scName(t))}</option>`).join('')}</select></label>`).join('')}</div><p>${tools}</p><button type="button" class="btn pri" id="scCheck">تحقّق</button><button type="button" class="btn scidk" id="scIdk">لا أعرف</button><p id="scFb"></p>`;
    const sels = [...b.querySelectorAll('.scmatch select')];
    if ($('scClue')) $('scClue').onclick = () => {   // hint: fill one pair correctly
      const s = sels.find((e) => !e.disabled && +e.value !== x.match[+e.dataset.i][1]); if (!s) return;
      s.value = x.match[+s.dataset.i][1]; s.disabled = true; s.closest('label').classList.add('schint'); x.clued = true; $('scClue').disabled = true;
    };
    $('scIdk').onclick = () => {   // show every pair
      sels.forEach((s) => { s.value = x.match[+s.dataset.i][1]; s.disabled = true; s.closest('label').classList.add('schint'); });
      $('scCheck').disabled = true; $('scIdk').disabled = true; if ($('scClue')) $('scClue').disabled = true;
      scAnswer(x, false, 'هذه هي الإجابات الصحيحة');
    };
    $('scCheck').onclick = () => {
      if (sels.some((s) => !s.value)) { $('scFb').textContent = 'صِل كل الكلمات أولاً.'; return; }
      $('scCheck').disabled = true; $('scIdk').disabled = true; if ($('scClue')) $('scClue').disabled = true;
      let good = 0; sels.forEach((s) => { const t = x.match[+s.dataset.i][1], hit = +s.value === t; good += hit; s.disabled = true; s.closest('label').classList.add(hit ? 'scok' : 'scbad'); if (!hit) s.closest('label').insertAdjacentHTML('beforeend', `<small>${esc(scName(t))}</small>`); });
      const all = good === sels.length; scAnswer(x, all, all ? 'إجابة صحيحة ✓' : `صحيح ${nA(good)} من ${nA(sels.length)}`);
    };
    return;
  }
  if (scOpt.type && scTypable(x)) {   // the answer is typed, not chosen
    b.innerHTML = head + x.q + `<p>${tools}</p><form class="sctype"><input class="inp" id="scIn" autocomplete="off" aria-label="اكتب إجابتك" placeholder="اكتب إجابتك هنا"><button class="btn pri">تحقّق</button><button type="button" class="btn scidk">لا أعرف</button></form><p id="scFb"></p>`;
    if (snd) { if (!blank) { b.classList.add('schide'); scPlay(x.key); } $('scPlay').onclick = () => scPlay(x.key); }
    if ($('scClue')) $('scClue').onclick = () => { const r = x.right.replace(/^سورة /, ''); x.clued = true; $('scClue').disabled = true; $('scHint').textContent = x.kind === 'count' ? `بين ${nA(Math.floor(+scNorm(r) * 0.7))} و${nA(Math.ceil(+scNorm(r) * 1.3))}` : `تبدأ بـ«${r[0]}» وعدد حروفها ${nA(r.replace(/\s/g, '').length)}`; };
    b.querySelector('.sctype').onsubmit = (ev) => {
      ev.preventDefault(); const v = $('scIn').value.trim(); if (!v) return;
      $('scIn').disabled = true; ev.target.querySelector('button').disabled = true; if ($('scClue')) $('scClue').disabled = true;
      const hit = scTypedOk(x, v); $('scIn').classList.add(hit ? 'scok' : 'scbad');
      scAnswer(x, hit, hit ? 'إجابة صحيحة ✓' + (scNorm(v) !== scNorm(x.right) ? ' — الدقيق: ' + x.right : '') : 'الإجابة الصحيحة: ' + x.right);
    };
    b.querySelector('.sctype .scidk').onclick = (ev) => { b.querySelectorAll('.sctype :is(input,button)').forEach((e) => (e.disabled = true)); if ($('scClue')) $('scClue').disabled = true; scAnswer(x, false, 'الإجابة الصحيحة: ' + x.right); };
    $('scIn').focus(); return;
  }
  b.innerHTML = head + x.q + `<p>${tools}</p><div class="scopts">${x.opts.map((o) => `<button type="button" class="btn">${esc(o)}</button>`).join('')}<button type="button" class="btn scidk">لا أعرف</button></div><p id="scFb"></p>`;
  if (snd) { if (!blank) { b.classList.add('schide'); scPlay(x.key); } $('scPlay').onclick = () => scPlay(x.key); }
  if ($('scClue')) {
    const canDrop = x.opts.length > 2;
    if (!canDrop && !x.hint) $('scClue').hidden = true;
    $('scClue').onclick = () => {   // hint: drop one wrong choice, or say something that helps
      x.clued = true; $('scClue').disabled = true;
      if (canDrop) { const w = scShuffle([...b.querySelectorAll('.scopts button')].filter((a) => a.textContent !== x.right && !a.disabled))[0]; if (w) { w.disabled = true; w.classList.add('scgone'); } }
      else $('scHint').textContent = x.hint;
    };
  }
  b.querySelector('.scopts').onclick = (e) => {
    const btn = e.target.closest('button'); if (!btn || btn.disabled) return;
    const all = [...b.querySelectorAll('.scopts button')], hit = btn.textContent === x.right;
    all.forEach((a) => { a.disabled = true; if (a.textContent === x.right) a.classList.add('scok'); });
    if (!hit && !btn.classList.contains('scidk')) btn.classList.add('scbad');
    if ($('scClue')) $('scClue').disabled = true;
    scAnswer(x, hit, hit ? 'إجابة صحيحة ✓' : 'الإجابة الصحيحة: ' + x.right);
  };
}
function scAnswer(x, hit, msg) {
  const b = $('scBody'); b.classList.remove('schide');
  if (scOpt.snd && x.key && $('scPlay')) { $('scPlay').disabled = false; if (x.kind === 'blank') scPlay(x.key); }   // fill the blank: the recitation after answering
  scScore += hit ? (x.clued ? 0.5 : 1) : 0;
  if (x.clued && hit) msg += ' (نصف درجة بسبب التلميح)';
  // ask again later: a wrong answer is kept; a kept question answered right is dropped
  const { review, id, clued, ...plain } = x;
  if (hit && review) scW.w = scW.w.filter((e) => e.id !== id);
  if (!hit) { const e = review && scW.w.find((e) => e.id === id); if (e) e.n = scW.n; else scW.w.push({ id: Date.now().toString(36) + scRand(1e6), n: scW.n, x: plain }); scW.w = scW.w.slice(-200); }
  scStoreSet();
  // harder with good marks: three right in a row (without a hint) raises the level of the questions still to come
  if (scOpt.adapt) {
    scStreak = hit && !x.clued ? scStreak + 1 : 0;
    const li = SC_LVLS.indexOf(scLvl);
    if (scStreak >= 3 && li < 2) {
      scLvl = SC_LVLS[li + 1]; scStreak = 0;
      for (let j = scI + 1; j < scQ.length; j++) if (!scQ[j].review) scQ[j] = scMakeK(scQ[j].kind, scLvl);
      msg += ` — أحسنت! ارتفع المستوى إلى «${SC_LVL_AR[scLvl]}»`;
    }
  }
  scNext(msg);
}
function scNext(msg) {
  $('scFb').innerHTML = `${esc(msg)} <button type="button" class="btn pri" id="scGo">${scI + 1 < scQ.length ? 'التالي' : 'النتيجة'}</button>`;
  $('scGo').onclick = () => { scI++; scShow(); }; $('scGo').focus();
}
$('scForm').onsubmit = async (e) => {
  e.preventDefault(); await initSchool(); if (!scQT) return;
  const f = e.target, kinds = [...f.querySelectorAll('[name=kind]:checked')].map((c) => c.value);
  if (!kinds.length) { $('scBody').innerHTML = '<p class="hint">اختر نوعاً واحداً من الأسئلة على الأقل.</p>'; return; }
  scOpt = { review: f.review.checked, adapt: f.adapt.checked, clue: f.clue.checked, snd: f.snd.checked, type: f.type.checked };
  scLvl = f.lvl.value; scStreak = 0; scW = scStoreGet(); scW.n++;
  const n = +f.n.value, due = scOpt.review ? scShuffle(scW.w.filter((w) => scW.n - w.n >= 2)).slice(0, Math.ceil(n / 3)) : [];   // asked again two tests after the mistake, up to a third of the test
  scQ = scShuffle([...due.map((w) => ({ ...w.x, review: true, id: w.id })), ...Array.from({ length: n - due.length }, (_, i) => scMakeK(kinds[i % kinds.length], scLvl))]);
  scStoreSet(); scI = 0; scScore = 0; f.hidden = true; scShow();
};
