import re, sys
sys.stdout.reconfigure(encoding='utf-8')

# ================= server: short fragments that grow progressively =================
p = 'src/advisor.js'
s = open(p, encoding='utf8').read()
old = "'يمكنك اقتراح جزء قصير من الآية فقط (كلمة أو بضع كلمات) بتحديد رقم أول كلمة وآخر كلمة كما هي مرقّمة، أو الآية كاملة إن احتاج المعنى إليها. لا تختر آية لا تناسب فعلاً؛ وفي هذه الحال أجب {\"pick\":0}. ' +"
assert old in s, 'judge prompt not found'
new = "'اعرض أقصر مقطع من الآية يؤدي الغرض: كلمة أو كلمتين أو ثلاث كلمات، بتحديد رقم أول كلمة وآخر كلمة كما هي مرقّمة؛ ولا تعرض الآية كاملة إلا إن كانت قصيرة جداً (أقل من ٦ كلمات). وإن كان الكلام ما زال يدور حول الآية نفسها التي اقترحتَها سابقاً فاعرض مقطعاً أطول منها (kind=extend) ليتدرج المعنى مع الحديث. لا تختر آية لا تناسب فعلاً؛ وفي هذه الحال أجب {\"pick\":0}. ' +"
s = s.replace(old, new, 1)
s = s.replace('"kind":"answer|match|next|reflect|revise"', '"kind":"answer|match|next|reflect|revise|extend"', 1)
s = s.replace("const KINDS = ['answer', 'match', 'next', 'reflect', 'revise'];", "const KINDS = ['answer', 'match', 'next', 'reflect', 'revise', 'extend'];", 1)
old = "  if (recent.includes(c.key) && jr.kind !== 'revise') return { transcript, suggestion: null, agents, timing };\n"
assert old in s
s = s.replace(old, "  const growing = jr.kind === 'revise' || jr.kind === 'extend';\n  if (recent.includes(c.key) && !growing) return { transcript, suggestion: null, agents, timing };\n", 1)
old = "  const chap = (await getChapters())[c.v.surah - 1];"
assert old in s
s = s.replace(old, "  const excerptText = c.words.slice(from - 1, to).join(' ');\n  if (prev && prev.endsWith(`[${c.key}]`) && prev.startsWith(excerptText)) return { transcript, suggestion: null, agents, timing };   // same fragment again: nothing new to say\n  const chap = (await getChapters())[c.v.surah - 1];", 1)
s = s.replace("      excerpt: c.words.slice(from - 1, to).join(' '), from, to,", "      excerpt: excerptText, from, to,", 1)
open(p, 'w', encoding='utf8').write(s)

# ================= client =================
p = 'public/index.html'
h = open(p, encoding='utf8').read()
def rep(old, new):
    global h
    assert old in h, old[:80]
    h = h.replace(old, new, 1)

rep('<div class="st" id="wst">اضغط «تشغيل» وابدأ الحديث.</div>', '<div class="st" id="wst">اضغط «تشغيل» وابدأ الحديث.</div>\n  <div class="lvl" id="wlvlbox" hidden aria-label="مستوى الصوت"><i id="wlvl"></i></div>')
rep("</style>", """.lvl{height:8px;max-width:320px;margin:-6px auto 14px;background:var(--line);border-radius:5px;overflow:hidden}.lvl i{display:block;height:100%;width:0;background:var(--accent);transition:width .12s linear}
</style>""")

a = h.index('/* ---------- Whisper: المستشار الهامس المباشر ---------- */'); b = h.index('/* ---------- صوت الآيات')
js = r'''/* ---------- Whisper: المستشار الهامس المباشر ---------- */
const wbtn = $('wbtn'), wst = $('wst'), wlive = $('wlive'), whist = $('whist'), wring = $('wring'), wlvl = $('wlvl'), wlvlbox = $('wlvlbox');
const TICK_MS = 3000, FIRST_TICK_MS = 2500, WIN_S = 8, SESSION_MS = 20 * 60 * 1000, RL = 16000 * 14;
const KIND = { answer: 'يجيب عن سؤال سمعتُه', match: 'يطابق ما قلتَه', next: 'يُثري ما سيأتي', reflect: 'تذكرة تناسب المقام', revise: 'تصحيح للاقتراح السابق', extend: 'يُكمل الآية نفسها' };
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
function blockRms(S, secs) {                             // RMS of every 0.25 s block in the last `secs`
  const n = Math.min(S.wp, Math.round(secs * 16000)), bs = 4000, out = [];
  for (let s = 0; s + bs <= n; s += bs) { let e = 0; for (let k = 0; k < bs; k += 4) { const v = S.ring[(S.wp - n + s + k) % RL]; e += v * v; } out.push(Math.sqrt(e / (bs / 4))); }
  return out;
}
function boost(win) {                                    // bring quiet speech up before it is sent for transcription
  let pk = 0; for (let i = 0; i < win.length; i += 2) pk = Math.max(pk, Math.abs(win[i]));
  const g = pk > 1e-4 ? Math.min(40, 0.8 / pk) : 1; if (g <= 1.05) return win;
  const o = new Float32Array(win.length); for (let i = 0; i < win.length; i++) o[i] = win[i] * g; return o;
}
const refHTML = (s) => `سورة ${esc(s.surah_ar)} — الآية ${nA(s.ayah)} <span class="tag">[${esc(s.key)}]</span> · ${nA(s.confidence)}٪`;
function showSuggestion(S, s) {
  const old = S.lastS;
  if (old && old.key !== s.key) {                        // a different verse: the previous one moves into the history (growing the same verse just replaces it)
    if (!whist.firstChild) whist.innerHTML = '<div class="hh">اقتراحات سابقة</div>';
    whist.querySelector('.hh').insertAdjacentHTML('afterend', `<div class="hline"><div class="vt">${old.partial ? '… ' : ''}${esc(old.excerpt)}${old.partial ? ' …' : ''}</div><div class="ref">${refHTML(old)}</div></div>`);
    while (whist.querySelectorAll('.hline').length > 10) whist.querySelector('.hline:last-child').remove();
  }
  S.lastS = s;
  wlive.innerHTML = `<div class="card adv"><div class="advtop"><span class="badge">${esc(KIND[s.kind] || KIND.match)}</span><span class="why">${esc(s.why)}${s.votes === 2 ? ' · اتفق مستشاران' : s.votes > 2 ? ` · اتفق ${nA(s.votes)} مستشارين` : ''}</span></div>` +
    `<div class="arow"><div class="vt">${s.partial ? '… ' : ''}${esc(s.excerpt)}${s.partial ? ' …' : ''}</div><div class="ref">${refHTML(s)}</div></div></div>`;
}
async function wTick(S) {
  if (S !== W) return;
  const win = lastSeconds(S, WIN_S);
  if (win.length < 16000 * 2) return;
  // speech = a recent block clearly above the room's own noise floor (so it also works for quiet microphones)
  const recent = blockRms(S, 3), all = blockRms(S, 12).sort((a, b) => a - b);
  const floor = all.length ? all[Math.floor(all.length * 0.2)] : 0, loud = recent.length ? Math.max(...recent) : 0;
  if (loud < Math.max(0.0008, floor * 2.5)) { if (!S.inflight) wst.textContent = 'أنتظر الكلام…'; return; }
  if (S.inflight >= 2) return;
  const n = ++S.tickNo; S.inflight++;
  const fd = new FormData();
  fd.append('audio', new Blob([wav16(boost(win))], { type: 'audio/wav' }), 'w.wav');
  fd.append('ctx', JSON.stringify({ history: S.history.slice(-3), recent: S.recent.slice(-8), prev: S.prev }));
  if (!S.history.length) wst.textContent = 'أستمع وأفكّر…';
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
    // for live speech we WANT the browser's automatic gain and noise suppression (unlike voice identification)
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    ac = new (window.AudioContext || window.webkitAudioContext)(); await ac.resume();
    const S = { stream, ac, ring: new Float32Array(RL), wp: 0, ratio: ac.sampleRate / 16000, acc: 0, cnt: 0, phase: 0, inflight: 0, tickNo: 0, shown: 0, history: [], recent: [], prev: '', ctrl: new AbortController(), lastS: null };
    const mute = ac.createGain(); mute.gain.value = 0; mute.connect(ac.destination);           // muted: processing runs, nothing is played back
    const source = ac.createMediaStreamSource(stream); let node = null;
    if (ac.audioWorklet) {
      try {
        const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
        await ac.audioWorklet.addModule(url); URL.revokeObjectURL(url);
        node = new AudioWorkletNode(ac, 'cap'); node.port.onmessage = (e) => pushSamples(S, e.data);
      } catch { node = null; }
    }
    if (!node) { node = ac.createScriptProcessor(4096, 1, 1); node.onaudioprocess = (e) => pushSamples(S, e.inputBuffer.getChannelData(0)); }   // older browsers
    source.connect(node); node.connect(mute);
    W = S; wlive.innerHTML = ''; whist.innerHTML = '';
    wbtn.textContent = 'إيقاف'; wbtn.classList.add('rec'); wbtn.setAttribute('aria-pressed', 'true'); wbtn.disabled = false;
    wring.classList.add('cycle'); wlvlbox.hidden = false; wst.textContent = 'أستمع… تحدّث وسيظهر أول اقتراح بعد لحظات.';
    S.meter = setInterval(() => { const b = blockRms(S, 0.3); const v = b.length ? b[b.length - 1] : 0; wlvl.style.width = Math.min(100, Math.sqrt(v) * 420) + '%'; }, 150);
    S.first = setTimeout(() => { wTick(S); S.timer = setInterval(() => wTick(S), TICK_MS); }, FIRST_TICK_MS);
    S.end = setTimeout(() => wStop('انتهت الجلسة بعد ٢٠ دقيقة. اضغط «تشغيل» للمتابعة.'), SESSION_MS);
    leaveHooks.push(() => wStop());
  } catch (e) {
    if (stream) stream.getTracks().forEach((x) => x.stop()); if (ac) ac.close();
    wst.textContent = e && e.name ? micError(e) : 'تعذّر تشغيل التقاط الصوت في هذا المتصفح.'; wbtn.disabled = false;
  }
}
function wStop(msg) {
  const S = W; W = null;
  if (S) { clearInterval(S.timer); clearInterval(S.meter); clearTimeout(S.first); clearTimeout(S.end); S.ctrl.abort(); S.stream.getTracks().forEach((x) => x.stop()); S.ac.close().catch(() => {}); }
  wring.classList.remove('cycle'); wlvlbox.hidden = true; wlvl.style.width = '0'; wbtn.classList.remove('rec'); wbtn.setAttribute('aria-pressed', 'false'); wbtn.textContent = 'تشغيل'; wbtn.disabled = false;
  if (S) wst.textContent = msg || 'تم الإيقاف.';
}
wbtn.onclick = () => (W ? wStop() : wStart());

'''
h = h[:a] + js + h[b:]
open(p, 'w', encoding='utf8').write(h)
mm = re.search(r'<script type="module">([\s\S]*?)</script>', h).group(1)
open('tmp_check.mjs', 'w', encoding='utf8').write(re.sub(r'^import .*$', '', mm, flags=re.M))
print('patched')
