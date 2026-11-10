// verse audio and the default reciter. One of the page's ordered scripts (see the <script> list at the end of index.html).
'use strict';
/* ---------- صوت الآيات (everyayah.com) ---------- */
const everyFolder = (rec) => { const l = (rec.links || []).find((x) => /everyayah\.com\/data\//.test(x.url)); const m = l && /data\/([^/]+)\//.exec(l.url); return m && m[1]; };
const ayahUrl = (folder, s, a) => `https://everyayah.com/data/${folder}/${String(s).padStart(3, '0')}${String(a).padStart(3, '0')}.mp3`;
function everyReaders() { return reciters.filter(everyFolder); }
function fillEveryReader(sel) {
  const rs = everyReaders(), f = rs.filter((r) => favs.has(r.id)), o = rs.filter((r) => !favs.has(r.id));
  const keep = sel.value;
  const opt = (r) => `<option value="${esc(r.id)}">${esc(arName(r))}</option>`;
  sel.innerHTML = (f.length ? `<optgroup label="المفضلة">${f.map(opt).join('')}</optgroup>` : '') + `<optgroup label="القرّاء">${o.map(opt).join('')}</optgroup>`;
  sel.value = keep && rs.some((r) => r.id === keep) ? keep : (f[0] || rs.find((r) => r.id === 'r123') || rs[0] || {}).id || '';
}
/* ---------- القارئ الأساسي: الضغط على أي آية في الموقع يشغّلها بصوته ---------- */
let defReader = ''; try { defReader = store().getItem('qr_reader') || ''; } catch {}
const ayAudio = new Audio();
const defRec = () => { const rs = everyReaders(); return rs.find((r) => r.id === defReader) || rs.find((r) => r.id === 'r123') || rs[0]; };
function fillDefReader() { document.querySelectorAll('.defreader').forEach((sel) => { fillEveryReader(sel); const r = defRec(); if (r) sel.value = r.id; }); }
document.addEventListener('change', (e) => {
  if (!e.target.matches('.defreader')) return;
  defReader = e.target.value; try { store().setItem('qr_reader', defReader); } catch {}
  fillDefReader();
});
const stopAyah = () => { ayAudio.pause(); document.querySelectorAll('.playing').forEach((x) => x.classList.remove('playing')); };
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-ak]'); if (!el || e.target.closest('a, button, select, summary') || getSelection().toString()) return;
  const was = el.classList.contains('playing'); stopAyah(); if (was) return;   // a second click stops it
  const rec = defRec(), folder = rec && everyFolder(rec); if (!folder) return;
  document.querySelectorAll('audio').forEach((a) => a.pause());
  const [su, a] = el.dataset.ak.split(':'); ayAudio.src = ayahUrl(folder, su, a); el.classList.add('playing');
  ayAudio.play().catch(stopAyah);
});
ayAudio.onended = ayAudio.onerror = stopAyah;
addEventListener('hashchange', stopAyah);
async function ensureReaders() { for (let i = 0; i < 50 && !reciters.length; i++) await new Promise((r) => setTimeout(r, 100)); }
