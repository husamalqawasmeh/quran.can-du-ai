// the Quran chatbot (#chat): asks /api/chat, shows the answer in the question's language and the evidence ayahs (checked on the server). One of the page's ordered scripts (see the <script> list at the end of index.html).
'use strict';
/* ---------- Chatbot ---------- */
let chHist = [];   // the last exchanges, sent along so follow-up questions have context
const CH_EX = ['ما فضل الصبر في القرآن؟', 'كيف وصف القرآن الجنة؟', 'ما الآيات التي تتحدث عن بر الوالدين؟', 'What does the Quran say about patience?', 'Who was Prophet Yusuf?', 'What does the Quran say about charity?'];
$('chEx').innerHTML = CH_EX.map((q) => `<button type="button" class="btn" dir="auto">${esc(q)}</button>`).join('');
$('chEx').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; $('chQ').value = b.textContent; $('chForm').requestSubmit(); };
$('chQ').onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('chForm').requestSubmit(); } };   // Shift+Enter: a new line
function chAyahs(d) {
  const en = d.lang === 'en';
  return d.ayahs.length ? `<div class="chay"><div class="tag">${en ? 'Evidence from the Quran' : 'الأدلة من القرآن'}</div>${d.ayahs.map((v) => `<div class="ex"><div class="vt" data-ak="${esc(v.key)}">${esc(v.text)}</div>
    <div class="tag">${en ? `Surah ${esc(v.surah_en)} ${esc(v.key)}` : `سورة ${esc(v.surah_ar)} — الآية ${nA(v.ayah)}`}</div>${en && v.translation ? `<div class="chtr" dir="ltr">${esc(v.translation)}</div>` : ''}${v.why ? `<div class="chwhy" dir="auto">${esc(v.why)}</div>` : ''}</div>`).join('')}</div>`
    : `<div class="tag">${en ? 'No verified ayah to show for this answer.' : 'لا توجد آية موثّقة لعرضها مع هذه الإجابة.'}</div>`;
}
$('chForm').onsubmit = async (e) => {
  e.preventDefault();
  const q = $('chQ').value.trim(); if (q.length < 3) return;
  const box = document.createElement('div'); box.className = 'chturn';
  box.innerHTML = `<div class="chq" dir="auto">${esc(q)}</div><div class="cha"><p class="hint">${/[؀-ۿ]/.test(q) ? 'جارٍ التفكير والتحقق من الآيات…' : 'Thinking and checking the ayahs…'}</p></div>`;
  $('chMsgs').append(box); box.scrollIntoView({ block: 'start', behavior: 'smooth' });
  $('chQ').value = ''; $('chSend').disabled = true;
  const a = box.querySelector('.cha');
  try {
    const r = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: q, history: chHist }) });
    const d = await r.json();
    if (!r.ok || !d.answer) { a.innerHTML = `<p class="hint">${esc(d.error || 'تعذّرت الإجابة الآن.')}</p>`; return; }
    a.setAttribute('dir', d.lang === 'en' ? 'ltr' : 'rtl');
    a.innerHTML = d.answer.split(/\n+/).filter(Boolean).map((p) => `<p>${esc(p)}</p>`).join('') + chAyahs(d);
    chHist = [...chHist, { q, a: d.answer }].slice(-4);
  } catch { a.innerHTML = '<p class="hint">تعذّر الاتصال بالمساعد. / Could not reach the assistant.</p>'; }
  finally { $('chSend').disabled = false; $('chQ').focus(); }
};
