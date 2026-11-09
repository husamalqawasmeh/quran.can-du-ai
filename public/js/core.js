// the user and their settings, shared helpers. One of the page's ordered scripts (see the <script> list at the end of index.html).
'use strict';
const $ = (id) => document.getElementById(id);
const nA = (n) => Number(n).toLocaleString('ar-EG');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ico = (n, cls = 'gic') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;   // a line icon from the sprite in index.html
const hlAyah = (t, hit) => t.split(' ').map((w) => (hit(w) ? '<mark>' + esc(w) + '</mark>' : esc(w))).join(' ');   // mark the words of an ayah that pass a test
const arName = (x) => (x.name_ar || x.name).replace(/^شيخ\s+/, '');

/* ---------- المستخدم وإعداداته: في المتصفح فقط (على هذا الجهاز، أو لهذه الجلسة) ---------- */
const readJ = (st, k) => { try { return JSON.parse(window[st].getItem(k) || 'null'); } catch { return null; } };   // storage can be blocked: then nothing is remembered
let prefs = readJ('localStorage', 'qr_prefs') || readJ('sessionStorage', 'qr_prefs');
const storeName = () => (prefs && prefs.scope === 'session' ? 'sessionStorage' : 'localStorage'), store = () => window[storeName()];
const remember = () => !!(prefs && prefs.remember);
let pstate = (remember() && readJ(storeName(), 'qr_state')) || {};   // { open: {view: [section titles]}, kx: {panel: open}, sel: {name: value} }
const saveState = () => { if (remember()) try { store().setItem('qr_state', JSON.stringify(pstate)); } catch {} };
const selGet = (k) => (remember() ? (pstate.sel || {})[k] : undefined);
const selSet = (k, v) => { (pstate.sel ||= {})[k] = v; saveState(); };
const dKey = (d) => { const x = d.querySelector(':scope>summary'); return x ? x.textContent.trim().slice(0, 80) : ''; };
document.addEventListener('toggle', (e) => {   // remember which sections are open on each page
  const d = e.target, v = d.tagName === 'DETAILS' && d.closest('.view'); if (!remember() || !v) return;
  const o = new Set(((pstate.open ||= {})[v.id]) || []), k = dKey(d); d.open ? o.add(k) : o.delete(k);
  pstate.open[v.id] = [...o]; saveState();
}, true);
const reopen = (root) => {   // each section opens or closes as it was left, as soon as the page draws it (pages draw their content later)
  const v = root.closest && root.closest('.view'), keys = v && remember() && (pstate.open || {})[v.id]; if (!keys) return;
  const set = new Set(keys);
  [...(root.matches('details') ? [root] : []), ...root.querySelectorAll('details')].forEach((d) => { if (d.dataset.rs) return; d.dataset.rs = 1; const want = set.has(dKey(d)); if (d.open !== want) d.open = want; });
};
new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) reopen(n); }).observe(document.querySelector('.page'), { childList: true, subtree: true });
document.querySelectorAll('.view').forEach(reopen);
const autoX = new Set();
function autoExpand(v) {   // «all sections open» setting: open them the first time the page is shown, unless the page's own state is remembered
  if (!prefs || prefs.expand !== 'expanded' || autoX.has(v)) return;
  if (remember() && ((pstate.open || {})['v-' + v] || (v === 'stats' && pstate.kx))) return;
  autoX.add(v);
  let i = 0; const t = setInterval(() => {
    const view = $('v-' + v);
    if (v === 'stats') { const ks = view.querySelectorAll('.kexp'); if (ks.length) { clearInterval(t); const seen = new Set(); ks.forEach((b) => { const id = b.getAttribute('aria-controls'); if (!seen.has(id) && !b.classList.contains('on')) b.click(); seen.add(id); }); } }
    else { const btn = view.querySelector('.vactions button.back'); if (btn && view.querySelector('.lesson')) { clearInterval(t); if (!btn.textContent.includes('طيّ')) btn.click(); } }
    if (++i > 50) clearInterval(t);
  }, 200);
}
