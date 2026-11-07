// Google sign-in, the settings form. One of the page's ordered scripts (see the <script> list at the end of index.html).
'use strict';
/* ---------- تسجيل الدخول بحساب Google: لمن يكون اسمه بريداً في Gmail (يثبت أنه صاحب البريد) ---------- */
const isGmail = (u) => /@gmail\.com$/i.test((u || '').trim());
let gToken = ''; try { gToken = sessionStorage.getItem('qr_gtok') || ''; } catch {}
const gEmail = (t) => { try { const p = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); return p.exp * 1000 > Date.now() + 60000 ? (p.email || '').toLowerCase() : ''; } catch { return ''; } };
const gSigned = (u) => !!u && gEmail(gToken) === u.trim().toLowerCase();   // signed in, as this address, and the sign-in still valid
let gCfg = null, gReady = null;
function gLoad() {   // the Google script, once; null when sign-in is not set up yet
  return (gReady ||= (async () => {
    try { gCfg = await (await fetch('/api/config')).json(); } catch { gCfg = {}; }
    if (!gCfg.googleClientId) return null;
    await new Promise((ok, no) => { const sc = document.createElement('script'); sc.src = 'https://accounts.google.com/gsi/client'; sc.async = true; sc.onload = ok; sc.onerror = no; document.head.append(sc); });
    google.accounts.id.initialize({ client_id: gCfg.googleClientId, auto_select: true, callback: (r) => { gToken = r.credential; try { sessionStorage.setItem('qr_gtok', gToken); } catch {} gListeners.forEach((f) => f(gEmail(gToken))); } });
    return google;
  })().catch(() => null));
}
const gListeners = new Set();
async function gButton(el, onDone) {   // puts «Sign in with Google» in el; onDone(email) after signing in
  const g = await gLoad();
  if (!g) { el.innerHTML = '<small class="hint">تسجيل الدخول بحساب Google لم يُفعَّل بعد في الموقع.</small>'; return; }
  gListeners.clear(); gListeners.add(onDone);
  el.innerHTML = ''; g.accounts.id.renderButton(el, { theme: 'filled_blue', size: 'medium', text: 'signin_with', locale: 'ar' });
}
function ucGmail() {   // the settings form: a Gmail name needs signing in
  const f = $('ucForm'), u = f.uid.value.trim(), st = $('gState'), b = $('gBtn');
  if (!isGmail(u)) { st.textContent = ''; b.hidden = true; return; }
  if (gSigned(u)) { st.innerHTML = '<span class="gok">✓ تم التحقق من بريدك في Gmail</span>'; b.hidden = true; return; }
  st.innerHTML = '<span class="gneed">سجّل الدخول بحساب Google لإثبات أن هذا البريد لك:</span>'; b.hidden = false;
  gButton(b, (email) => { if (email && email !== f.uid.value.trim().toLowerCase()) f.uid.value = email; ucGmail(); });
}
$('ucForm').uid.addEventListener('input', ucGmail);

/* the settings form */
$('ucForm').addEventListener('invalid', (e) => { const d = e.target.closest('details'); if (d) d.open = true; }, true);   // a missing field in a closed part: open it so the browser can point at it
function fillUc() {
  const f = $('ucForm'), p = prefs || { uid: '', email: '', phone: '', expand: 'collapsed', remember: true, scope: 'local' };
  $('ucWelcome').hidden = !!prefs;
  if (!prefs) f.querySelector('.ucsec').open = true;   // first visit: «بياناتك» open, the name is needed
  setTimeout(ucGmail);
  f.uid.value = p.uid; f.email.value = p.email; f.phone.value = p.phone; f.expand.value = p.expand; f.remember.checked = p.remember; f.scope.value = p.scope; f.sorder.value = p.sorder || 'mushaf';
}
function setPrefs(p) {
  try { const other = p.scope === 'session' ? localStorage : sessionStorage; ['qr_prefs', 'qr_reader', 'qr_state'].forEach((k) => other.removeItem(k)); } catch {}
  prefs = p;
  try { store().setItem('qr_prefs', JSON.stringify(p)); if (defReader) store().setItem('qr_reader', defReader); } catch {}
  if (p.remember) saveState(); else { pstate = {}; try { store().removeItem('qr_state'); } catch {} }
}
const goHome = () => (location.hash === '#home' ? route() : (location.hash = '#home'));
$('ucForm').addEventListener('submit', (e) => {
  e.preventDefault(); const f = e.currentTarget;
  if (isGmail(f.uid.value) && gCfg?.googleClientId && !gSigned(f.uid.value)) { $('ucMsg').textContent = 'سجّل الدخول بحساب Google أولاً، أو اكتب اسماً غير بريد Gmail.'; return; }
  setPrefs({ uid: f.uid.value.trim(), email: f.email.value.trim(), phone: f.phone.value.trim(), expand: f.expand.value, remember: f.remember.checked, scope: f.scope.value, sorder: f.sorder.value });
  if (surahs) renderSurahs();
  goHome();
});
$('ucGuest').onclick = () => { setPrefs({ uid: 'ضيف', email: '', phone: '', expand: 'collapsed', remember: false, scope: 'session' }); goHome(); };
$('ucClear').onclick = () => {
  try { for (const st of [localStorage, sessionStorage]) ['qr_prefs', 'qr_reader', 'qr_state', 'qr_favs'].forEach((k) => st.removeItem(k)); } catch {}
  location.hash = '#home'; location.reload();
};
/* #drv: a validation volunteer sends name, mobile and email; the server keeps it and mails it to the site owner */
$('volForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget, msg = form.querySelector('.volmsg'), btn = form.querySelector('button'), data = Object.fromEntries(new FormData(form));
  btn.disabled = true; msg.textContent = 'جارٍ الإرسال…';
  try {
    const r = await fetch('/api/volunteer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
    if (!r.ok) throw new Error(r.status === 400 ? 'تأكد من الاسم ورقم الجوال والبريد.' : 'تعذّر الإرسال، حاول لاحقاً.');
    form.reset(); msg.textContent = 'شكراً لك، وصل طلبك وسيتواصل معك صاحب الموقع.';
  } catch (err) { msg.textContent = err.message || 'تعذّر الإرسال، حاول لاحقاً.'; }
  btn.disabled = false;
});
