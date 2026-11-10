// memorisation (#recite). One of the page's ordered scripts (see the <script> list at the end of index.html).
'use strict';
/* ---------- تحفيظ القرآن ---------- */
let mInit = false, mVerses = [], mSurah = 1, mPlaying = false, mRec = null;
const mAudio = $('mAudio');
function mStop() { mPlaying = false; mAudio.pause(); $('mPlay').textContent = '▶ تشغيل'; document.querySelectorAll('.vrow.cur').forEach((e) => e.classList.remove('cur')); }
async function initMemorize() {
  leaveHooks.push(() => { mStop(); if (mRec) mRec.cancel(); });
  if (mInit) return; mInit = true;
  await ensureReaders(); fillEveryReader($('mReader'));
  try {
    if (!surahs) surahs = await (await fetch('/api/surahs')).json();
    $('mSurah').innerHTML = surahs.map((s) => `<option value="${s.id}">${nA(s.id)}. ${esc(s.ar)}</option>`).join('');
  } catch { $('mMsg').textContent = 'تعذّر تحميل قائمة السور.'; }
}
async function mShow() {
  mStop();
  mSurah = +$('mSurah').value;
  $('mMsg').textContent = 'جارٍ تحميل الآيات…';
  try { mVerses = await surahVerses(mSurah); if (!Array.isArray(mVerses)) throw 0; } catch { $('mMsg').textContent = 'تعذّر تحميل الآيات.'; return false; }
  const max = mVerses.length;
  let from = Math.min(Math.max(+$('mFrom').value || 1, 1), max), to = Math.min(Math.max(+$('mTo').value || from, from), max);
  $('mFrom').value = from; $('mTo').value = to; $('mFrom').max = $('mTo').max = max;
  $('mMsg').textContent = `${nA(to - from + 1)} آية من ${nA(max)} آية في السورة.`;
  const hide = $('mHide').checked;
  $('mList').innerHTML = mVerses.filter((v) => v.n >= from && v.n <= to).map((v) =>
    `<div class="vrow${hide ? ' hide' : ''}" data-n="${v.n}"><div class="top"><span class="num">${nA(v.n)}</span><div class="vt">${esc(v.text)}</div><button class="mbtn" title="سمّع هذه الآية" aria-label="سمّع الآية ${nA(v.n)}">${ico('mic')}</button></div><div class="res"></div></div>`).join('');
  return true;
}
$('mLoad').onclick = mShow;
$('mSurah').onchange = () => { $('mFrom').value = 1; $('mTo').value = 5; mShow(); };
$('mHide').onchange = () => document.querySelectorAll('#mList .vrow').forEach((r) => r.classList.toggle('hide', $('mHide').checked));
$('mList').onclick = (e) => {
  const row = e.target.closest('.vrow'); if (!row) return;
  if (e.target.closest('.vt') && row.classList.contains('hide')) { row.classList.remove('hide'); return; }
  if (e.target.closest('.mbtn')) mRecite(row, e.target.closest('.mbtn'));
};
$('mPlay').onclick = async () => {
  if (mPlaying) { mStop(); return; }
  if (!(await mShow())) return;
  const rec = reciters.find((r) => r.id === $('mReader').value), folder = rec && everyFolder(rec);
  if (!folder) { $('mMsg').textContent = 'اختر قارئاً.'; return; }
  const rep = +$('mRep').value, from = +$('mFrom').value, to = +$('mTo').value;
  const queue = []; for (let a = from; a <= to; a++) for (let k = 1; k <= rep; k++) queue.push([a, k]);
  let i = 0; mPlaying = true; $('mPlay').textContent = '⏹ إيقاف';
  const next = () => {
    if (!mPlaying) return;
    if (i >= queue.length) { mStop(); $('mMsg').textContent = 'انتهى التشغيل. أحسنت!'; return; }
    const [a, k] = queue[i++];
    document.querySelectorAll('.vrow.cur').forEach((e) => e.classList.remove('cur'));
    const row = document.querySelector(`#mList .vrow[data-n="${a}"]`);
    if (row) { row.classList.add('cur'); row.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    $('mMsg').textContent = `الآية ${nA(a)} — المرة ${nA(k)} من ${nA(rep)}`;
    mAudio.src = ayahUrl(folder, mSurah, a); mAudio.play().catch(() => { $('mMsg').textContent = 'تعذّر تشغيل الصوت.'; mStop(); });
  };
  mAudio.onended = () => setTimeout(next, 350);
  mAudio.onerror = () => { $('mMsg').textContent = 'تعذّر تحميل صوت هذه الآية.'; mStop(); };
  next();
};
async function mRecite(row, b) {
  if (mRec) { const r = mRec; mRec = null; r.finish(); return; }
  mStop();
  let stream;
  try { stream = await micStream(); } catch (e) { row.querySelector('.res').textContent = micError(e); return; }
  const rec = new MediaRecorder(stream), chunks = []; let cancelled = false;
  rec.ondataavailable = (e) => chunks.push(e.data);
  const stopped = new Promise((r) => (rec.onstop = r));
  const timer = setTimeout(() => api.finish(), 25000);
  const api = { finish: () => { clearTimeout(timer); if (rec.state !== 'inactive') rec.stop(); }, cancel: () => { cancelled = true; api.finish(); } };
  mRec = api; rec.start(); b.classList.add('rec'); b.textContent = '⏹';
  row.querySelector('.res').textContent = 'أستمع إلى تسميعك… اضغط ⏹ عند الانتهاء.';
  await stopped; stream.getTracks().forEach((x) => x.stop()); mRec = null; b.classList.remove('rec'); b.innerHTML = ico('mic');
  if (cancelled) return;
  const res = row.querySelector('.res'); res.textContent = 'جارٍ التحقق…';
  try {
    const pcm = await toPcm(await new Blob(chunks).arrayBuffer());
    const r = await fetch(`/api/check?key=${mSurah}:${row.dataset.n}`, { method: 'POST', headers: { 'content-type': 'audio/wav' }, body: wav16(pcm) });
    const d = await r.json();
    if (!r.ok) { res.textContent = r.status === 429 ? d.error : 'تعذّر التحقق الآن.'; return; }
    res.innerHTML = d.words.map((w) => `<span class="${w.ok ? 'ok' : 'bad'}">${esc(w.w)}</span>`).join(' ') +
      `<div class="tag">${d.score === 100 ? ico('star') + ' ممتاز! ' : ''}نسبة الكلمات الصحيحة: ${nA(d.score)}٪ — سُمع: «${esc(d.heard)}»</div>`;
  } catch { res.textContent = 'تعذّر التحقق الآن.'; }
}
