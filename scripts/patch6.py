import re

# ================= verse.js: find verses containing the heard words =================
p = 'src/verse.js'
s = open(p, encoding='utf8').read()
s += r'''
const STOP = new Set('في من على الى عن ان انه انها هو هي هم ما لا لم لن قد ثم او و يا هذا هذه ذلك الذي التي الذين كان كانوا كل بل اذا اذ ان إن'.split(' ').map((w) => skel(normAr(w))));
async function searchAll(q, size = 12) {
  const r = await fetch('https://api.quran.com/api/v4/search?size=' + size + '&language=en&q=' + encodeURIComponent(q));
  if (r.status === 204 || !r.ok) return [];
  const raw = await r.text();
  return raw ? JSON.parse(raw).search?.results || [] : [];
}

/** Up to `max` verses that contain the heard words. Arabic input: ranked by how many of the words each verse contains. */
export async function ayatWithWords(transcript, max = 3) {
  const ws = [...new Set(normAr(transcript).split(' ').filter((w) => w.length > 1))];
  if (!ws.length) return [];
  const key = ws.filter((w) => !STOP.has(skel(w)));
  const core = (key.length ? key : ws).slice().sort((a, b) => b.length - a.length);
  const queries = [ws.slice(0, 5).join(' ')];
  if (core.length > 1) queries.push(core.slice(0, 2).join(' '));
  for (const w of core.slice(0, 3)) queries.push(w);
  const want = new Set((key.length ? key : ws).map(skel));
  const found = new Map();
  for (const q of [...new Set(queries)]) {
    for (const v of await searchAll(q)) {
      if (found.has(v.verse_key)) continue;
      const vw = new Set(normAr(v.text).split(' ').map(skel));
      const hits = [...want].filter((w) => vw.has(w));
      if (hits.length) found.set(v.verse_key, { v, score: hits.length / want.size, len: vw.size });
    }
    if ([...found.values()].filter((x) => x.score >= 0.99).length >= max) break;
  }
  const top = [...found.values()].sort((a, b) => b.score - a.score || a.len - b.len).slice(0, max);
  return (await Promise.all(top.map((t) => verseByKey(t.v.verse_key).catch(() => null)))).map((v, i) => v && { ...v, score: Math.round(top[i].score * 100) }).filter(Boolean);
}

/** English input: let Quran.com search the translations; return the best `max` verses. */
export async function ayatByEnglish(text, max = 3) {
  const res = (await searchAll(text.slice(0, 120), 6)).slice(0, max);
  return (await Promise.all(res.map((v) => verseByKey(v.verse_key).catch(() => null)))).filter(Boolean);
}
'''
open(p, 'w', encoding='utf8').write(s)

# ================= worker.js: /api/whisper replaces /api/companion =================
p = 'src/worker.js'
s = open(p, encoding='utf8').read()
s = s.replace("normAr, skel, chapterVerses } from './verse.js';", "normAr, skel, chapterVerses, ayatWithWords, ayatByEnglish } from './verse.js';")
a = s.index("    // Q-Companion:")
b = s.index("    // Verses of a surah")
route = r'''    // Whisper: transcribe a few seconds of speech, then return 2-3 verses that contain the heard words (text search, no AI guessing).
    if (url.pathname === '/api/whisper' && req.method === 'POST') {
      const wav = await req.arrayBuffer();
      if (wav.byteLength < 20000 || wav.byteLength > 2_500_000) return json({ error: 'bad audio' }, 400);
      if (await limited(env, req, 'whisper', 40)) return json({ error: 'وصلت إلى الحد الأقصى في هذه الساعة، حاول لاحقاً.' }, 429);
      let transcript;
      try { transcript = await transcribe(env, wav, null); } catch { return json({ error: 'transcription unavailable' }, 503); }
      if (transcript.split(/\s+/).filter(Boolean).length < 1 || transcript.length < 2) return json({ transcript: '', verses: [] });
      let verses = [];
      try { verses = /[؀-ۿ]/.test(transcript) ? await ayatWithWords(transcript, 3) : await ayatByEnglish(transcript, 3); } catch { /* search unavailable: still return the transcript */ }
      return json({ transcript, verses, arabic: /[؀-ۿ]/.test(transcript) });
    }

'''
s = s[:a] + route + s[b:]
open(p, 'w', encoding='utf8').write(s)

# ================= index.html =================
p = 'public/index.html'
h = open(p, encoding='utf8').read()

def rep(old, new):
    global h
    assert old in h, old[:70]
    h = h.replace(old, new, 1)

rep('<a class="tile" href="#companion"><div class="ic">🤝</div><b>رفيق القرآن</b><span>يستمع ويقترح آيات ذات صلة بما يسمعه</span></a>',
    '<a class="tile" href="#whisper"><div class="ic">🎧</div><b>Whisper</b><span>قل بضع كلمات، فأكتبها لك وأجد آيات تذكرها</span></a>')
a = h.index('<!-- رفيق القرآن -->'); b = h.index('<!-- عن القرآن -->')
h = h[:a] + '''<!-- Whisper -->
<section class="view wrap mid" id="v-whisper" hidden>
  <h1>Whisper</h1>
  <p class="sub">اضغط الزر وقل بضع كلمات أو شغّل تلاوة؛ سأستمع لثوانٍ، وأكتب ما سمعتُه، ثم أعرض آيات تذكر هذه الكلمات.</p>
  <div class="center"><button class="mic" id="wbtn">اضغط واستمع</button></div>
  <div class="st" id="wst"></div>
  <div id="wout"></div>
</section>

''' + h[b:]
rep("const VIEWS = ['home', 'identify', 'readers', 'surahs', 'companion',", "const VIEWS = ['home', 'identify', 'readers', 'surahs', 'whisper',")

a = h.index('/* ---------- رفيق القرآن ---------- */'); b = h.index('/* ---------- صوت الآيات')
h = h[:a] + r'''/* ---------- Whisper ---------- */
const wbtn = $('wbtn'), wst = $('wst'), wout = $('wout'), WHISPER_MS = 8000;
let wBusy = false;
function markWords(text, heard) {
  const want = new Set(heard.split(/\s+/).map((w) => w.replace(/[^ء-ي]/g, '')).filter(Boolean).map((w) => w.replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[اءؤئ]/g, '')));
  return text.split(/\s+/).map((w) => {
    const k = w.replace(/[ً-ٰٟۖ-ۭـ]/g, '').replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[اءؤئ]/g, '');
    return want.has(k) && k ? `<mark>${esc(w)}</mark>` : esc(w);
  }).join(' ');
}
wbtn.onclick = async () => {
  if (wBusy) return; wBusy = true; wout.innerHTML = ''; wbtn.disabled = true;
  try {
    const stream = await micStream();
    wbtn.classList.add('rec'); wbtn.textContent = 'أستمع…';
    let left = WHISPER_MS / 1000; wst.textContent = `أستمع… ${nA(left)} ث`;
    const t = setInterval(() => (wst.textContent = `أستمع… ${nA(--left)} ث`), 1000);
    const pcm = await recordChunk(stream, WHISPER_MS);
    clearInterval(t); stream.getTracks().forEach((x) => x.stop());
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
        `<div class="aib"><div class="vt">${d.arabic ? markWords(v.text, d.transcript) : esc(v.text)}</div><div>سورة ${esc(v.surah_ar)} — الآية ${nA(v.ayah)} <span class="tag">[${esc(v.key)}]</span></div>${!d.arabic && v.translation ? `<div class="tag">${esc(v.translation)}</div>` : ''}${d.arabic && v.score < 100 ? `<div class="tag">تحوي ${nA(v.score)}٪ من الكلمات المسموعة</div>` : ''}</div>`).join('');
    } else html += '<div class="aib"><span class="tag">لم أجد آيات تذكر هذه الكلمات. جرّب كلمات أخرى.</span></div>';
    html += '<p class="note">الكتابة بالتعرّف الآلي على الكلام وقد تحتوي أخطاء؛ والآيات من بحث نصي في Quran.com.</p>';
    wout.innerHTML = html;
  } catch (e) { if (e && e.name) wst.textContent = micError(e); }
  wbtn.classList.remove('rec'); wbtn.textContent = 'اضغط واستمع'; wbtn.disabled = false; wBusy = false;
};

''' + h[b:]
rep("</style></head>", "mark{background:color-mix(in srgb,var(--acc) 30%,transparent);color:inherit;border-radius:4px;padding:0 2px}\n</style></head>")
open(p, 'w', encoding='utf8').write(h)
print('patched')
