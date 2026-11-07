// identify the reciter by voice. One of the page's ordered scripts (see the <script> list at the end of index.html).
'use strict';
/* ---------- التعرّف على القارئ ---------- */
const btn = $('btn'), st = $('st'), out = $('out'), LISTEN_MS = 20000;
function box(html) { const d = document.createElement('div'); d.className = 'aib'; d.innerHTML = html; $('ai').appendChild(d); return d; }
function showVerse(el, v, tagText) {
  el.insertAdjacentHTML('beforeend', `<div class="vt" data-ak="${esc(v.key)}">${esc(v.text)}</div><div>سورة ${esc(v.surah_ar)} — الآية ${nA(v.ayah)} <span class="tag">[${esc(v.key)}]</span></div>${tagText ? `<div class="tag">${esc(tagText)}</div>` : ''}`);
}
async function aiExtras(pcm, top, confident) {
  $('ai').innerHTML = '';
  const vb = box('<h3>الآية المسموعة</h3><span class="tag">جارٍ الاستماع إلى الكلمات…</span>');
  fetch('/api/verse', { method: 'POST', headers: { 'content-type': 'audio/wav' }, body: wav16(pcm) }).then((r) => r.json()).then((d) => {
    vb.innerHTML = '<h3>الآية المسموعة</h3>';
    if (d.verse) showVerse(vb, d.verse, `مطابقة من التعرّف على الكلام (توافق ${nA(d.verse.match)}٪ من الكلمات) وقد لا تكون دقيقة.`);
    else vb.insertAdjacentHTML('beforeend', '<span class="tag">تعذّرت مطابقة الكلمات مع آية بثقة كافية.</span>');
  }).catch(() => (vb.innerHTML = '<h3>الآية المسموعة</h3><span class="tag">ميزة تحديد الآية غير متاحة حالياً.</span>'));
  if (!confident) return;
  const bb = box('<h3>نبذة عن القارئ</h3><span class="tag">جارٍ التحميل…</span>');
  fetch('/api/bio?id=' + encodeURIComponent(top.id)).then((r) => r.json()).then((d) => {
    bb.innerHTML = '<h3>نبذة عن القارئ</h3>'; const p = document.createElement('div'); p.textContent = d.bio || 'لا توجد معلومات متاحة.'; bb.appendChild(p);
    if (d.bio) bb.insertAdjacentHTML('beforeend', '<div class="tag">نبذة مكتوبة بالذكاء الاصطناعي — قد تحتوي أخطاء.</div>');
  }).catch(() => bb.remove());
  const ab = box('<h3>اسأل عن هذا القارئ</h3><form><input maxlength="300" placeholder="مثال: من أين هو؟ وما أسلوبه في التلاوة؟" aria-label="السؤال"><button>اسأل</button></form><div class="ans"></div>');
  ab.querySelector('form').onsubmit = async (e) => {
    e.preventDefault(); const q = ab.querySelector('input').value.trim(), o = ab.querySelector('.ans'); if (q.length < 3) return;
    o.textContent = 'جارٍ التفكير…';
    try {
      const r = await fetch('/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: top.id, question: q }) });
      const d = await r.json();
      o.textContent = d.answer || (r.status === 429 ? d.error : 'تعذّرت الإجابة الآن.');
      if (d.answer) o.insertAdjacentHTML('beforeend', '<div class="tag">إجابة بالذكاء الاصطناعي — قد تحتوي أخطاء.</div>');
    } catch { o.textContent = 'الذكاء الاصطناعي غير متاح حالياً.'; }
  };
}
function askFeedback(results, vectors) {
  const fb = $('fb'), top = results[0];
  const send = async (is_correct, actual_id, actual_name) => {
    fb.textContent = 'شكراً على ملاحظاتك!';
    try { await fetch('/api/feedback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ predicted_id: top.id, confidence: top.confidence, is_correct, actual_id, actual_name, vectors }) }); }
    catch { fb.textContent = 'تعذّر حفظ الملاحظات.'; }
  };
  fb.innerHTML = 'اختياري: هل النتيجة صحيحة؟ <button class="btn" id="yes">👍 نعم</button><button class="btn" id="no">👎 لا</button>';
  $('yes').onclick = () => send(true);
  $('no').onclick = () => {
    fb.innerHTML = '<div>من كان القارئ؟ اختر من القائمة أو اكتب اسمه (حتى لو لم يكن بين القرّاء المائة):</div>' +
      '<div style="margin-top:8px"><select id="who"><option value="">اختر من القائمة…</option>' + reciters.map((r) => `<option value="${esc(r.id)}">${esc(arName(r))}</option>`).join('') + '</select></div>' +
      '<div style="margin-top:8px"><input id="whoName" class="inp" maxlength="80" placeholder="اسم القارئ الصحيح (اختياري)" aria-label="اسم القارئ الصحيح" style="width:100%;max-width:360px"></div>' +
      '<div style="margin-top:8px"><button class="btn pri" id="go">إرسال</button></div>';
    $('go').onclick = () => send(false, $('who').value || null, $('whoName').value.trim() || null);
  };
}
async function identify(pcm) {
  st.textContent = 'جارٍ تحليل الصوت…';
  let d, r, vectors;
  try {                                                  // neural model (runs in the browser), scored on the server
    const embs = await embed(pcm);
    if (embs.length) { r = await fetch('/api/identify2', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ emb: embs }) }); if (r.ok) { d = await r.json(); vectors = embs; } }
  } catch (e) { console.warn('neural model unavailable, using fallback', e); }
  if (!d) {                                              // fallback: the earlier statistical method
    vectors = voiceprints(pcm, 5);
    if (!vectors.length) { st.textContent = 'لم يُسمع كلام كافٍ. حاول مرة أخرى وأنت أقرب إلى مصدر الصوت.'; return; }
    try { r = await fetch('/api/identify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ vectors }) }); d = await r.json(); }
    catch { st.textContent = 'تعذّر الاتصال بالخادم.'; return; }
    if (!r.ok) { st.textContent = 'حدث خطأ أثناء التحليل.'; return; }
  }
  st.textContent = '';
  askFeedback(d.results, vectors);
  const top = d.results[0], low = top.confidence < 0.8;
  aiExtras(pcm, top, !low);
  const pct = (x) => nA(Math.round(x * 100)) + '٪';
  const warn = low ? '<div class="card warn"><b>لست متأكداً.</b> لم أستطع تحديد هذا القارئ بثقة كافية (أقل من ٨٠٪). قد يكون التخمين أدناه خاطئاً — جرّب مرة أخرى بالقرب من مصدر الصوت وبضجيج أقل ولمدة أطول.</div>' : '';
  const line = (x) => `<div class="row">${esc(arName(x))} — ${pct(x.confidence)}<div class="bar"><i style="width:${x.confidence * 100}%"></i></div></div>`;
  out.innerHTML = warn + (low
    ? '<div class="row" style="color:var(--mut);margin-top:14px">أقرب النتائج:</div>' + d.results.map(line).join('')
    : `<div class="card"><div class="top">${esc(arName(top))}</div><div class="row">نسبة الثقة ${pct(top.confidence)}<div class="bar"><i style="width:${top.confidence * 100}%"></i></div></div><div class="lk">استمع لهذا القارئ:<br>${links(top)}</div></div>` + d.results.slice(1).map(line).join(''));
}
const reset = () => { out.innerHTML = ''; $('ai').innerHTML = ''; $('fb').innerHTML = ''; };
btn.onclick = async () => {
  reset(); btn.disabled = true;
  try {
    const stream = await micStream();
    btn.classList.add('rec'); btn.textContent = 'أستمع…';
    let left = LISTEN_MS / 1000; st.textContent = `أستمع… ${nA(left)} ث`;
    const t = setInterval(() => (st.textContent = `أستمع… ${nA(--left)} ث`), 1000);
    const pcm = await recordChunk(stream, LISTEN_MS);
    clearInterval(t); stream.getTracks().forEach((x) => x.stop());
    await identify(pcm);
  } catch (e) { st.textContent = micError(e); }
  btn.classList.remove('rec'); btn.textContent = 'استمع'; btn.disabled = false;
};
$('file').onchange = async (e) => {
  const f = e.target.files[0]; if (!f) return; reset();
  try { await identify(await toPcm(await f.arrayBuffer())); } catch { st.textContent = 'تعذّرت قراءة الملف الصوتي.'; }
};
