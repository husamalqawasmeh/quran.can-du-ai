import re, sys
sys.stdout.reconfigure(encoding='utf-8')
p='public/index.html'; h=open(p,encoding='utf8').read()
def rep(o,n):
    global h
    assert o in h,o[:60]; h=h.replace(o,n,1)

# amber tokens + styles
rep("--shadow:0 2px 8px rgba(40,32,10,.16);--heart:#d6336c}","--shadow:0 2px 8px rgba(40,32,10,.16);--heart:#d6336c;--amber:#b45309}")
rep("--shadow:0 2px 10px rgba(0,0,0,.55)}}","--shadow:0 2px 10px rgba(0,0,0,.55);--amber:#ffb020}}")
rep(".vtext .bm{",""".ay{transition:color .15s}.ay.cur{color:var(--amber);text-shadow:0 0 .6px var(--amber)}
.ay.cur .no{color:var(--amber)}
.vrow.cur{border-color:var(--amber)!important}.vrow.cur .vt{color:var(--amber)}
.vtext .bm{""")

# render each verse as its own span
rep("vs.map((v) => `${esc(v.text.trim())} <span class=\"no\">﴿${nA(v.n)}﴾</span>`).join(' ');",
    "vs.map((v) => `<span class=\"ay\" data-n=\"${v.n}\">${esc(v.text.trim())} <span class=\"no\">﴿${nA(v.n)}﴾</span></span>`).join(' ');")

# new playback handler
a=h.index("$('sgrid').addEventListener('change', (e) => {")
b=h.index("/* ---------- التعرّف على القارئ ---------- */")
new=r"""/* verse timing from mp3quran.net (exact start/end of every verse in the full-surah recording) */
let timingMap = null; const timingCache = {};
async function surahTiming(rec, n) {
  try {
    if (!timingMap) timingMap = await (await fetch('/timing.json')).json();
    const t = timingMap[rec.id]; if (!t) return null;
    const k = t.read + ':' + n; if (k in timingCache) return timingCache[k];
    const j = await (await fetch(`https://www.mp3quran.net/api/v3/ayat_timing?surah=${n}&read=${t.read}`)).json();
    return (timingCache[k] = Array.isArray(j) && j.length ? j.filter((x) => x.ayah >= 1).map((x) => ({ n: x.ayah, s: x.start_time, e: x.end_time })) : null);
  } catch { return null; }
}
/* colour the verse being recited amber, and keep it in view */
function setCurAyah(box, n) {
  const prev = box.querySelector('.ay.cur'); if (prev && +prev.dataset.n === n) return;
  if (prev) prev.classList.remove('cur');
  if (!n) return;
  const el = box.querySelector(`.ay[data-n="${n}"]`); if (!el) return;
  el.classList.add('cur');
  const r = el.getBoundingClientRect();
  if (r.top < 90 || r.bottom > innerHeight - 90) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
}
let sPlay = 0;
$('sgrid').addEventListener('change', async (e) => {
  const sel = e.target.closest('select'); if (!sel) return;
  const box = sel.closest('.sr'), au = box.querySelector('audio'), msg = box.querySelector('.msg'), n = +box.dataset.n, my = ++sPlay;
  document.querySelectorAll('#sgrid audio').forEach((x) => { if (x !== au) x.pause(); });
  au.ontimeupdate = au.onended = null; au.pause(); setCurAyah(box, 0);
  const rec = reciters.find((r) => r.id === sel.value);
  if (!rec) { au.hidden = true; msg.textContent = ''; return; }
  const vs = box.querySelector('.vs'); vs.open = true;            // show the text so the verse being read can be coloured
  const url = surahAudio(rec, n), folder = everyFolder(rec);
  const timing = url ? await surahTiming(rec, n) : null;
  if (my !== sPlay) return;
  const unavailable = () => { au.hidden = true; msg.textContent = 'لا يتوفر تسجيل لهذه السورة بصوت هذا القارئ.'; };
  au.onerror = unavailable;
  if (url && timing) {                                              // exact timings: one file, colour follows the playhead
    msg.textContent = ''; au.hidden = false; au.src = url;
    au.ontimeupdate = () => { const t = au.currentTime * 1000, a = timing.find((x) => t >= x.s && t < x.e); setCurAyah(box, a ? a.n : 0); };
    au.onended = () => setCurAyah(box, 0); au.play().catch(() => {}); return;
  }
  if (folder) {                                                     // verse-by-verse recordings: play them in order
    const total = (surahs.find((x) => x.id === n) || {}).verses || 0; let a = 1;
    const next = () => { if (my !== sPlay) return; if (a > total) { setCurAyah(box, 0); return; } setCurAyah(box, a); au.src = ayahUrl(folder, n, a); au.play().catch(() => {}); };
    au.onended = () => { a++; next(); };
    au.onerror = () => { msg.textContent = 'تعذّر تحميل صوت الآية ' + nA(a) + '.'; };
    msg.textContent = 'يُشغَّل هذا القارئ آيةً آيةً.'; au.hidden = false; next(); return;
  }
  if (url) { msg.textContent = 'تلوين الآية تلقائياً غير متاح لهذا القارئ.'; au.hidden = false; au.src = url; au.play().catch(() => {}); return; }
  unavailable();
});

"""
h=h[:a]+new+h[b:]
open(p,'w',encoding='utf8').write(h)
m=re.search(r'<script type="module">([\s\S]*?)</script>',h).group(1)
open('tmp_check.mjs','w',encoding='utf8').write(re.sub(r'^import .*$','',m,flags=re.M))
print('ok')
