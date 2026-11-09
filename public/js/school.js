// the quiz page (#school): pick a level, a count and question kinds; all questions are drawn on the device from the static text files. One of the page's ordered scripts (see the <script> list at the end of index.html).
'use strict';
/* ---------- المدرسة ---------- */
let scQT = null, scW1 = null, scQ = [], scI = 0, scScore = 0;
const scRand = (n) => Math.floor(Math.random() * n);
const scShuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = scRand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const scPick = (a, n) => scShuffle(a).slice(0, n);
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
async function initSchool() {
  if (scQT) return;
  try { [scQT, scW1] = await Promise.all([fetch('/quran_text.json').then((r) => r.json()), fetch('/words.json').then((r) => r.json())]); if (!surahs) surahs = await (await fetch('/api/surahs')).json(); }
  catch { scQT = null; $('scBody').innerHTML = '<p class="hint">تعذّر تحميل البيانات.</p>'; return; }
  scW1 = scW1.filter(([w, n, k]) => n === 1 && k && w.length >= 4);   // words that occur once in the Quran, with their verse
}
const scName = (s) => 'سورة ' + surahs[s - 1].ar;
const scMakki = (s) => /^mak/i.test(surahs[s - 1].place || '');
function scMake(kind, lvl) {
  const ok = SC_POOL[lvl], nOpt = lvl === 'easy' ? 3 : 4;
  const keys = Object.keys(scQT).filter((k) => ok(+k.split(':')[0])), key = keys[scRand(keys.length)], s = +key.split(':')[0], text = scQT[key];
  const otherSurahs = (n) => scPick(surahs.map((x) => x.id).filter((x) => x !== s && ok(x)), n);
  const mc = (q, right, wrong) => ({ q, right, opts: scShuffle([right, ...wrong.slice(0, nOpt - 1)]) });
  if (SC_TOPICS[kind]) {   // an ayah from a topic page: which box of that page is it about?
    const [ask, keep = () => true, label = (m) => m.t] = SC_TOPICS[kind];
    const items = TOPICS[kind].items.filter((m) => keep(m) && m.keys && m.keys.some((k) => scQT[k])), m = items[scRand(items.length)];
    const ks = m.keys.filter((k) => scQT[k]), k = ks[scRand(ks.length)], right = label(m);
    const wrong = [...new Set(scShuffle(items).filter((o) => !o.keys.includes(k)).map(label))].filter((x) => x !== right);
    return mc(`<p>${ask}</p><p class="scayah">${esc(scQT[k])}</p><p class="tag">${esc(scName(+k.split(':')[0]))} — الآية ${nA(k.split(':')[1])}</p>`, right, wrong);
  }
  if (kind === 'surah') return mc(`<p>في أي سورة وردت هذه الآية؟</p><p class="scayah">${esc(text)}</p>`, scName(s), otherSurahs(nOpt - 1).map(scName));
  if (kind === 'place') return { q: `<p>هل هذه الآية من سورة مكية أم مدنية؟</p><p class="scayah">${esc(text)}</p>`, right: scMakki(s) ? 'مكية' : 'مدنية', opts: ['مكية', 'مدنية'] };
  if (kind === 'count') {
    const v = surahs[s - 1].verses, spread = { easy: 0.6, mid: 0.35, hard: 0.2 }[lvl], wrong = new Set();
    for (let k = 1; wrong.size < nOpt - 1; k++) { const x = Math.max(3, Math.round(v * (1 + spread * k * (k % 2 ? 1 : -1) / 1.5))); if (x !== v) wrong.add(x); if (k > 20) wrong.add(v + k * 7); }   // spread out around the true count, never below 3
    return mc(`<p>كم عدد آيات ${esc(scName(s))} تقريباً؟</p>`, nA(v), [...wrong].map(nA));
  }
  if (kind === 'blank') {
    const ws = text.split(' '), idx = ws.map((w, i) => [w, i]).filter(([w]) => w.length >= 3), [w, i] = idx.length ? idx[scRand(idx.length)] : [ws[0], 0];
    const shown = ws.map((x, j) => (j === i ? '<span class="scgap">_____</span>' : esc(x))).join(' ');
    const wrong = [...new Set(scPick(keys, 30).map((k) => scQT[k].split(' ').filter((x) => x.length >= 3)).map((a) => a[scRand(a.length)]))].filter((x) => x && x !== w);   // words from other verses
    return mc(`<p>أكمل الفراغ في الآية (${esc(scName(s))}):</p><p class="scayah">${shown}</p>`, w, wrong);
  }
  // match: words that occur only once, each to the surah it is in
  const pairs = []; const used = new Set();
  for (const [w, , k] of scShuffle(scW1)) { const t = +k.split(':')[0]; if (ok(t) && !used.has(t)) { used.add(t); pairs.push([w, t]); } if (pairs.length === nOpt) break; }
  return { match: pairs, q: '<p>صِل كل كلمة بالسورة التي وردت فيها (كل كلمة وردت مرة واحدة فقط في القرآن):</p>' };
}
function scShow() {
  const b = $('scBody');
  if (scI >= scQ.length) {
    b.innerHTML = `<div class="aib"><h3>النتيجة: ${nA(scScore)} من ${nA(scQ.length)}</h3><p>${scScore === scQ.length ? 'ممتاز، بارك الله فيك!' : scScore >= scQ.length / 2 ? 'أحسنت، واصل المراجعة.' : 'لا بأس، أعد المحاولة وراجع السور.'}</p><button type="button" class="btn pri" id="scAgain">اختبار جديد</button></div>`;
    $('scAgain').onclick = () => { b.innerHTML = ''; $('scForm').hidden = false; };
    return;
  }
  const x = scQ[scI], head = `<p class="tag">السؤال ${nA(scI + 1)} من ${nA(scQ.length)} — الدرجة ${nA(scScore)}</p>`;
  if (x.match) {
    const names = scShuffle(x.match.map(([, t]) => t));
    b.innerHTML = head + x.q + `<div class="scmatch">${x.match.map(([w], i) => `<label><b>${esc(w)}</b><select class="ucsel" data-i="${i}"><option value="">— اختر السورة —</option>${names.map((t) => `<option value="${t}">${esc(scName(t))}</option>`).join('')}</select></label>`).join('')}</div><button type="button" class="btn pri" id="scCheck">تحقّق</button><p id="scFb"></p>`;
    $('scCheck').onclick = () => {
      const sels = [...b.querySelectorAll('.scmatch select')]; if (sels.some((s) => !s.value)) { $('scFb').textContent = 'صِل كل الكلمات أولاً.'; return; }
      let good = 0; sels.forEach((s) => { const t = x.match[+s.dataset.i][1], hit = +s.value === t; good += hit; s.disabled = true; s.closest('label').classList.add(hit ? 'scok' : 'scbad'); if (!hit) s.closest('label').insertAdjacentHTML('beforeend', `<small>${esc(scName(t))}</small>`); });
      const all = good === sels.length; scScore += all; scNext(all ? 'إجابة صحيحة ✓' : `صحيح ${nA(good)} من ${nA(sels.length)}`);
    };
    return;
  }
  b.innerHTML = head + x.q + `<div class="scopts">${x.opts.map((o) => `<button type="button" class="btn">${esc(o)}</button>`).join('')}</div><p id="scFb"></p>`;
  b.querySelector('.scopts').onclick = (e) => {
    const btn = e.target.closest('button'); if (!btn) return;
    const all = [...b.querySelectorAll('.scopts button')], hit = btn.textContent === x.right; scScore += hit;
    all.forEach((a) => { a.disabled = true; if (a.textContent === x.right) a.classList.add('scok'); });
    if (!hit) btn.classList.add('scbad');
    scNext(hit ? 'إجابة صحيحة ✓' : 'الإجابة الصحيحة: ' + x.right);
  };
}
function scNext(msg) {
  $('scFb').innerHTML = `${esc(msg)} <button type="button" class="btn pri" id="scGo">${scI + 1 < scQ.length ? 'التالي' : 'النتيجة'}</button>`;
  $('scGo').onclick = () => { scI++; scShow(); }; $('scGo').focus();
}
$('scForm').onsubmit = async (e) => {
  e.preventDefault(); await initSchool(); if (!scQT) return;
  const f = e.target, kinds = [...f.querySelectorAll('[name=kind]:checked')].map((c) => c.value);
  if (!kinds.length) { $('scBody').innerHTML = '<p class="hint">اختر نوعاً واحداً من الأسئلة على الأقل.</p>'; return; }
  scQ = Array.from({ length: +f.n.value }, (_, i) => scMake(kinds[i % kinds.length], f.lvl.value)); scQ = scShuffle(scQ);
  scI = 0; scScore = 0; f.hidden = true; scShow();
};
