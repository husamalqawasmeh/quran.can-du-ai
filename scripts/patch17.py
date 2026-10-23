import re, sys
sys.stdout.reconfigure(encoding='utf-8')
p = 'public/index.html'
h = open(p, encoding='utf8').read()

def rep(old, new):
    global h
    assert old in h, old[:70]
    h = h.replace(old, new, 1)

# ---- markup: ring around the mic button + stop button
rep('<div class="center"><button class="mic" id="wbtn">اضغط واستمع</button></div>\n  <div class="st" id="wst"></div>',
    '''<div class="center"><div class="ringwrap"><svg viewBox="0 0 200 200" aria-hidden="true"><circle class="rtrack" cx="100" cy="100" r="94"/><circle class="rprog" id="wring" cx="100" cy="100" r="94"/></svg><button class="mic" id="wbtn">اضغط واستمع</button></div></div>
  <div class="center"><button class="btn pri" id="wstop" hidden>⏹ توقّف الآن وأعطني الجواب</button></div>
  <div class="st" id="wst"></div>''')

# ---- css
rep("</style>", """/* progress ring around the Whisper button */
.ringwrap{position:relative;width:200px;height:200px;margin:0 auto;display:grid;place-items:center}
.ringwrap svg{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg)}
.ringwrap circle{fill:none;stroke-width:7}
.rtrack{stroke:var(--line)}
.rprog{stroke:var(--accent);stroke-linecap:round;stroke-dasharray:590.6;stroke-dashoffset:590.6}
.rprog.spin{transform-origin:100px 100px;animation:rspin 1s linear infinite}
@keyframes rspin{to{transform:rotate(360deg)}}
#wstop{margin-top:14px;font-size:1rem;padding:10px 26px}
</style>""")

# ---- script: stoppable recording + ring
a = h.index("wbtn.onclick = async () => {")
b = h.index("/* ---------- صوت الآيات")
new = r"""const wring = $('wring'), wstop = $('wstop'), RING_C = 2 * Math.PI * 94;
function ringRun(ms) {                                   // fills clockwise over `ms`
  wring.classList.remove('spin'); wring.style.transition = 'none'; wring.style.strokeDasharray = RING_C; wring.style.strokeDashoffset = RING_C;
  void wring.getBoundingClientRect();
  wring.style.transition = `stroke-dashoffset ${ms}ms linear`; wring.style.strokeDashoffset = 0;
}
function ringSpin() { wring.style.transition = 'none'; wring.style.strokeDasharray = `${RING_C * 0.25} ${RING_C}`; wring.style.strokeDashoffset = 0; wring.classList.add('spin'); }
function ringReset() { wring.classList.remove('spin'); wring.style.transition = 'none'; wring.style.strokeDasharray = RING_C; wring.style.strokeDashoffset = RING_C; }
wbtn.onclick = async () => {
  if (wBusy) return; wBusy = true; wout.innerHTML = ''; wbtn.disabled = true;
  let stream, timer, tick;
  try {
    stream = await micStream();
    const rec = new MediaRecorder(stream), chunks = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    const stopped = new Promise((r) => (rec.onstop = r));
    const finish = () => { if (rec.state !== 'inactive') rec.stop(); };
    rec.start(); const t0 = performance.now();
    wbtn.classList.add('rec'); wbtn.textContent = 'أستمع…'; wstop.hidden = false; wstop.onclick = finish;
    ringRun(WHISPER_MS); timer = setTimeout(finish, WHISPER_MS);
    wst.textContent = `أستمع… ${nA(Math.ceil(WHISPER_MS / 1000))} ث`;
    tick = setInterval(() => { wst.textContent = `أستمع… ${nA(Math.max(0, Math.ceil((WHISPER_MS - (performance.now() - t0)) / 1000)))} ث`; }, 250);
    await stopped;
    clearTimeout(timer); clearInterval(tick); stream.getTracks().forEach((x) => x.stop()); wstop.hidden = true;
    ringSpin(); wbtn.classList.remove('rec'); wbtn.textContent = 'جارٍ التحليل…';
    const pcm = await toPcm(await new Blob(chunks).arrayBuffer());
    if (pcm.length < SR * 0.8) { wst.textContent = 'التسجيل قصير جداً. تحدّث لثانية على الأقل ثم حاول مرة أخرى.'; throw 0; }
    let rms = 0; for (let i = 0; i < pcm.length; i += 8) rms += pcm[i] * pcm[i]; rms = Math.sqrt(rms / (pcm.length / 8));
    if (rms < 0.004) { wst.textContent = 'لم أسمع صوتاً واضحاً. اقترب من الميكروفون وحاول مرة أخرى.'; throw 0; }
    wst.textContent = 'أكتب ما سمعتُه وأبحث في الآيات…';
    const r = await fetch('/api/whisper', { method: 'POST', headers: { 'content-type': 'audio/wav' }, body: wav16(pcm) });
    const d = await r.json();
    if (!r.ok) { wst.textContent = r.status === 429 ? d.error : 'تعذّر التعرّف على الكلام الآن.'; throw 0; }
    wst.textContent = '';
    if (!d.transcript) { wst.textContent = 'لم أستطع تمييز كلمات. حاول مرة أخرى.'; throw 0; }
    let html = `<div class="card"><h3 class="tag" style="margin:0 0 4px">ما سمعتُه</h3><div style="font-size:1.3rem;line-height:1.9">${esc(d.transcript)}</div></div>`;
    if (d.verses.length) {
      html += `<h3 class="tag" style="margin:14px 4px 0">${nA(d.verses.length)} آيات تذكر هذه الكلمات</h3>` + d.verses.map((v) =>
        `<div class="aib"><div class="vt">${d.arabic ? markWords(v.text, d.transcript) : esc(v.text)}</div><div>سورة ${esc(v.surah_ar)} — الآية ${nA(v.ayah)} <span class="tag">[${esc(v.key)}]</span></div>${d.arabic && v.score < 100 ? `<div class="tag">تحوي ${nA(v.score)}٪ من الكلمات المسموعة</div>` : ''}</div>`).join('');
    } else html += '<div class="aib"><span class="tag">لم أجد آيات تذكر هذه الكلمات. جرّب كلمات أخرى.</span></div>';
    html += '<p class="note">الكتابة بالتعرّف الآلي على الكلام وقد تحتوي أخطاء؛ والآيات من بحث نصي في Quran.com.</p>';
    wout.innerHTML = html;
  } catch (e) { if (e && e.name) wst.textContent = micError(e); }
  clearTimeout(timer); clearInterval(tick); if (stream) stream.getTracks().forEach((x) => x.stop());
  wstop.hidden = true; ringReset(); wbtn.classList.remove('rec'); wbtn.textContent = 'اضغط واستمع'; wbtn.disabled = false; wBusy = false;
};

"""
h = h[:a] + new + h[b:]
open(p, 'w', encoding='utf8').write(h)
m = re.search(r'<script type="module">([\s\S]*?)</script>', h).group(1)
open('tmp_check.mjs', 'w', encoding='utf8').write(re.sub(r'^import .*$', '', m, flags=re.M))
print('patched')
