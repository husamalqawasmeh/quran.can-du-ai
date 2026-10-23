import re, sys
sys.stdout.reconfigure(encoding='utf-8')
p = 'public/index.html'
h = open(p, encoding='utf8').read()

def rep(old, new):
    global h
    assert old in h, old[:80]
    h = h.replace(old, new, 1)

# ---------------- markup: replace the whole Whisper section
a = h.index('<!-- Whisper -->'); b = h.index('<!-- عن القرآن -->')
h = h[:a] + '''<!-- Whisper: المستشار الهامس المباشر -->
<section class="view" id="v-whisper" hidden>
  <h1>Whisper</h1>
  <p class="sub">مستشارك القرآني الهامس: شغّله أثناء الحديث أو الجلسة، فيقترح عليك كل ثلاث ثوانٍ تقريباً آية — أو كلمات منها — تناسب ما يُقال وما سيُقال.</p>
  <div class="center"><div class="ringwrap"><svg viewBox="0 0 200 200" aria-hidden="true"><circle class="rtrack" cx="100" cy="100" r="94"/><circle class="rprog" id="wring" cx="100" cy="100" r="94"/></svg><button class="mic" id="wbtn" aria-pressed="false">تشغيل</button></div></div>
  <div class="st" id="wst">اضغط «تشغيل» وابدأ الحديث.</div>
  <div id="wlive"></div>
  <div id="whist"></div>
  <p class="note">يُرسَل الصوت مؤقتاً لتحويله إلى نص ولا يُحفظ. الاقتراحات من عدة نماذج ذكاء اصطناعي تراجع بعضها، وقد تخطئ؛ ونصوص الآيات من Quran.com. تتوقف الجلسة تلقائياً بعد ٢٠ دقيقة.</p>
</section>

''' + h[b:]

# ---------------- tile text
rep('<span>قل بضع كلمات، فأكتبها لك وأجد آيات تذكرها</span>', '<span>مستشار هامس يقترح آية كل ثلاث ثوانٍ أثناء حديثك</span>')

# ---------------- css
rep("</style>", """/* live advisor */
.rprog.cycle{animation:rcycle 3s linear infinite}
@keyframes rcycle{from{stroke-dashoffset:590.6}to{stroke-dashoffset:0}}
.adv{border-color:var(--accent);animation:advin .35s ease-out}
@keyframes advin{from{opacity:.2;transform:translateY(6px)}to{opacity:1;transform:none}}
.advtop{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:6px}
.badge{background:var(--accent);color:var(--accent-ink);border-radius:99px;padding:1px 14px;font-size:.8rem;font-weight:700}
.why{color:var(--muted);font-size:.88rem}
.arow{display:flex;gap:16px;align-items:center;flex-wrap:wrap}
.arow .vt{flex:1;min-width:260px;margin:0;font-size:1.9rem;line-height:2}
.arow .ref{white-space:nowrap;text-align:left;direction:rtl;font-size:.85rem;color:var(--ink)}
.hline{display:flex;gap:14px;align-items:center;flex-wrap:wrap;padding:8px 14px;border:1px solid var(--line);border-radius:12px;margin-top:8px;background:var(--card);opacity:.85}
.hline .vt{flex:1;min-width:200px;margin:0;font-size:1.15rem;line-height:1.8}.hline .ref{white-space:nowrap;direction:rtl;font-size:.78rem;color:var(--muted)}
#whist .hh{margin:18px 4px 0;font-size:.8rem;color:var(--muted)}
</style>""")

# ---------------- script: replace the whole old Whisper block
a = h.index('/* ---------- Whisper ---------- */'); b = h.index('/* ---------- صوت الآيات')
js = r'''/* ---------- Whisper: المستشار الهامس المباشر ---------- */
const wbtn = $('wbtn'), wst = $('wst'), wlive = $('wlive'), whist = $('whist'), wring = $('wring');
const TICK_MS = 3000, WIN_S = 8, SESSION_MS = 20 * 60 * 1000, RL = 16000 * 14;
const KIND = { answer: 'يجيب عن سؤال سمعتُه', match: 'يطابق ما قلتَه', next: 'يُثري ما سيأتي', reflect: 'تذكرة تناسب المقام', revise: 'تصحيح للاقتراح السابق' };
const WORKLET = `class P extends AudioWorkletProcessor{constructor(){super();this.b=[];this.n=0}process(i){const c=i[0]&&i[0][0];if(c){this.b.push(c.slice(0));this.n+=c.length;if(this.n>=2048){const o=new Float32Array(this.n);let p=0;for(const x of this.b){o.set(x,p);p+=x.length}this.port.postMessage(o,[o.buffer]);this.b=[];this.n=0}}return true}}registerProcessor('cap',P)`;
let W = null;                                            // the running session, or null when OFF
function pushSamples(S, chunk) {                         // mono @ device rate -> 16 kHz ring buffer (box-filter downsample)
  const r = S.ratio;
  for (let i = 0; i < chunk.length; i++) {
    S.acc += chunk[i]; S.cnt++; S.phase += 1;
    if (S.phase >= r) { S.phase -= r; S.ring[S.wp % RL] = S.acc / S.cnt; S.wp++; S.acc = 0; S.cnt = 0; }
  }
}
function lastSeconds(S, secs) {
  const n = Math.min(S.wp, Math.round(secs * 16000)), out = new Float32Array(n);
  for (let k = 0; k < n; k++) out[k] = S.ring[(S.wp - n + k) % RL];
  return out;
}
const refHTML = (s) => `سورة ${esc(s.surah_ar)} — الآية ${nA(s.ayah)} <span class="tag">[${esc(s.key)}]</span> · ${nA(s.confidence)}٪`;
function showSuggestion(S, s) {
  if (wlive.firstElementChild) {                         // the previous suggestion moves into the history
    const old = S.lastS;
    if (old) {
      if (!whist.firstChild) whist.innerHTML = '<div class="hh">اقتراحات سابقة</div>';
      whist.querySelector('.hh').insertAdjacentHTML('afterend', `<div class="hline"><div class="vt">${old.partial ? '… ' : ''}${esc(old.excerpt)}${old.partial ? ' …' : ''}</div><div class="ref">${refHTML(old)}</div></div>`);
      while (whist.querySelectorAll('.hline').length > 10) whist.querySelector('.hline:last-child').remove();
    }
  }
  S.lastS = s;
  wlive.innerHTML = `<div class="card adv"><div class="advtop"><span class="badge">${esc(KIND[s.kind] || KIND.match)}</span><span class="why">${esc(s.why)}${s.votes > 1 ? ` · اتفق ${nA(s.votes)} مستشارين` : ''}</span></div>` +
    `<div class="arow"><div class="vt">${s.partial ? '… ' : ''}${esc(s.excerpt)}${s.partial ? ' …' : ''}</div><div class="ref">${refHTML(s)}</div></div></div>`;
}
async function wTick(S) {
  if (S !== W) return;
  const win = lastSeconds(S, WIN_S);
  if (win.length < 16000 * 2.5) return;
  const tail = win.subarray(Math.max(0, win.length - 48000)); let e = 0; for (let i = 0; i < tail.length; i += 8) e += tail[i] * tail[i];
  if (Math.sqrt(e / (tail.length / 8)) < 0.006) { if (!S.inflight) wst.textContent = 'أنتظر الكلام…'; return; }
  if (S.inflight >= 2) return;
  const n = ++S.tickNo; S.inflight++;
  const fd = new FormData();
  fd.append('audio', new Blob([wav16(win)], { type: 'audio/wav' }), 'w.wav');
  fd.append('ctx', JSON.stringify({ history: S.history.slice(-3), recent: S.recent.slice(-8), prev: S.prev }));
  try {
    const r = await fetch('/api/advisor', { method: 'POST', body: fd, signal: S.ctrl.signal });
    const d = await r.json();
    if (S !== W) return;
    if (!r.ok) { if (r.status === 429) wStop(d.error); else wst.textContent = 'تعذّر التحليل الآن… سأحاول مجدداً.'; return; }
    if (d.transcript) { S.history.push(d.transcript); wst.textContent = 'سمعتُ: ' + d.transcript.slice(-100); }
    if (d.suggestion && n > S.shown) { S.shown = n; S.recent.push(d.suggestion.key); S.prev = d.suggestion.excerpt + ' [' + d.suggestion.key + ']'; showSuggestion(S, d.suggestion); }
  } catch { /* aborted or offline: the next tick tries again */ }
  finally { S.inflight--; }
}
async function wStart() {
  wbtn.disabled = true; wst.textContent = 'جارٍ تشغيل الميكروفون…';
  let stream, ac;
  try {
    stream = await micStream();
    ac = new (window.AudioContext || window.webkitAudioContext)(); await ac.resume();
    const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
    await ac.audioWorklet.addModule(url); URL.revokeObjectURL(url);
    const node = new AudioWorkletNode(ac, 'cap'), mute = ac.createGain(); mute.gain.value = 0;
    ac.createMediaStreamSource(stream).connect(node); node.connect(mute); mute.connect(ac.destination);   // muted: processing runs, nothing is played back
    const S = { stream, ac, ring: new Float32Array(RL), wp: 0, ratio: ac.sampleRate / 16000, acc: 0, cnt: 0, phase: 0, inflight: 0, tickNo: 0, shown: 0, history: [], recent: [], prev: '', ctrl: new AbortController(), lastS: null };
    node.port.onmessage = (e) => pushSamples(S, e.data);
    W = S; wlive.innerHTML = ''; whist.innerHTML = '';
    wbtn.textContent = 'إيقاف'; wbtn.classList.add('rec'); wbtn.setAttribute('aria-pressed', 'true'); wbtn.disabled = false;
    wring.classList.add('cycle'); wst.textContent = 'أستمع… أول اقتراح بعد لحظات.';
    S.timer = setInterval(() => wTick(S), TICK_MS);
    S.end = setTimeout(() => wStop('انتهت الجلسة بعد ٢٠ دقيقة. اضغط «تشغيل» للمتابعة.'), SESSION_MS);
    leaveHooks.push(() => wStop());
  } catch (e) {
    if (stream) stream.getTracks().forEach((x) => x.stop()); if (ac) ac.close();
    wst.textContent = micError(e); wbtn.disabled = false;
  }
}
function wStop(msg) {
  const S = W; W = null;
  if (S) { clearInterval(S.timer); clearTimeout(S.end); S.ctrl.abort(); S.stream.getTracks().forEach((x) => x.stop()); S.ac.close().catch(() => {}); }
  wring.classList.remove('cycle'); wbtn.classList.remove('rec'); wbtn.setAttribute('aria-pressed', 'false'); wbtn.textContent = 'تشغيل'; wbtn.disabled = false;
  if (S) wst.textContent = msg || 'تم الإيقاف.';
}
wbtn.onclick = () => (W ? wStop() : wStart());

'''
h = h[:a] + js + h[b:]
open(p, 'w', encoding='utf8').write(h)
m = re.search(r'<script type="module">([\s\S]*?)</script>', h).group(1)
open('tmp_check.mjs', 'w', encoding='utf8').write(re.sub(r'^import .*$', '', m, flags=re.M))
left = [x for x in ('wstop', 'wout', 'ringRun', 'markWords', 'stemW') if x in h]
print('leftover references:', left)
