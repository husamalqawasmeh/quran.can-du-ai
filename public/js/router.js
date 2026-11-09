// navigation between the views, page headers, the mushaf (#book) page. One of the page's ordered scripts (see the <script> list at the end of index.html).
'use strict';
/* ---------- التنقل ---------- */
const VIEWS = ['book', 'places', 'validate', 'research', 'userconfig', 'drv', 'jannah2', 'names', 'qiyamah', 'hafiz', 'jews', 'jesus', 'prophets', 'others', 'sifat', 'duasp', 'duasb', 'numbers', 'animals', 'food', 'akhlaq', 'family', 'water', 'falak', 'jannah', 'management', 'stats', 'home', 'identify', 'readers', 'surahs', 'whisper', 'recite', 'learn', 'about', 'miracles', 'school'];
let leaveHooks = [];
/* title row on every inner screen: heading + description, with the green back button */
document.querySelectorAll('.view:not(#v-home)').forEach((v) => {
  const t = v.querySelector(':scope > h1, :scope > h2'); if (!t) return;
  const d = t.nextElementSibling && t.nextElementSibling.matches('p.sub, p.hint') ? t.nextElementSibling : null;
  const head = document.createElement('div'), box = document.createElement('div');
  head.className = 'vhead'; box.className = 'vtitle';
  t.before(head); box.append(t); if (d) box.append(d); head.append(box);
  head.insertAdjacentHTML('beforeend', '<a class="back" href="#home"><span class="tri" aria-hidden="true">▶</span> الرجوع إلى القائمة الرئيسية</a>');
});
/* surahs screen: its two buttons sit next to the back button */
{ const back = document.querySelector('#v-surahs .vhead .back'), wrap = document.createElement('div');
  wrap.className = 'vactions'; back.replaceWith(wrap); wrap.append(back, $('sToggle'), $('sJuz'));
  wrap.closest('.vhead').insertAdjacentHTML('afterend', '<div class="slegend" id="sLegend" hidden><span><i class="sw share"></i>سورة تبدأ في جزء وتنتهي في الجزء الذي يليه</span><span><i class="sw one"></i>سورة تبدأ وتنتهي في الجزء نفسه</span></div>'); }
/* expand all / collapse all, under the back button, on the pages made of expandable cards */
['miracles', 'qiyamah', 'hafiz', 'jannah', 'jannah2', 'animals', 'places', 'food', 'akhlaq', 'family', 'water', 'falak', 'management', 'jesus', 'jews', 'prophets', 'others', 'sifat', 'duasp', 'duasb', 'numbers', 'learn', 'stats', 'names'].forEach((v) => {
  const view = document.getElementById('v-' + v), head = view && view.querySelector('.vhead'), back = head && head.querySelector('.back');
  if (!back) return;
  const wrap = document.createElement('div'); wrap.className = 'vactions'; back.replaceWith(wrap); wrap.append(back);
  const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'back'; wrap.append(btn);
  const cards = () => [...view.querySelectorAll('.lesson:not(.nolink)')];   // boxes without verses do not open
  const allOpen = () => { const c = cards(); return c.length > 0 && c.every((x) => x.open); };
  const label = () => { btn.innerHTML = allOpen() ? '<span class="tri" aria-hidden="true">▲</span> طيّ الكل' : '<span class="tri" aria-hidden="true">▼</span> فتح الكل'; };
  let token = 0;
  btn.onclick = () => {
    const c = cards(); if (!c.length) return;
    const my = ++token;
    if (allOpen()) { c.forEach((x) => (x.open = false)); label(); return; }
    const todo = c.filter((x) => !x.open); let i = 0;
    const step = () => { if (my !== token) return; todo.slice(i, i + 4).forEach((x) => (x.open = true)); i += 4; if (i < todo.length) setTimeout(step, 250); };   // a few at a time: each opening loads its verses
    step();
  };
  view.addEventListener('toggle', label, true); label();
});
function route() {
  if (location.hash === '#memorize') return location.replace('#recite');   // old address of this page
  let v = VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'home';
  if (!prefs && v === 'home') v = 'userconfig';   // first visit: the settings screen is the landing page
  leaveHooks.splice(0).forEach((f) => f());
  for (const n of VIEWS) $('v-' + n).hidden = n !== v;
  if (v === 'surahs') loadSurahs();
  if (v === 'recite') initMemorize();
  if (v === 'learn') initLearn();
  if (v === 'miracles') initMiracles();
  if (v === 'stats') initStats();
  if (v === 'school') initSchool();
  if (TOPICS[v]) Promise.resolve(initTopic(v)).then(() => fitTitles($('v-' + v)));
  if (v === 'names' && topicInit.names) refreshNameBadges();
  if (v === 'userconfig') fillUc();
  if (v === 'research') initResearch();
  if (v === 'book') bookShow(false);
  if (v === 'validate') { initValidate(); vaFeatures(); }
  autoExpand(v);
  window.scrollTo(0, 0);
}
addEventListener('hashchange', route);
/* the book page: «الفهرس» (or the cover) opens it on the surah index, 57 surahs a page; a surah opens in the surahs page */
const BK_PEOPLE = [['jesus', 'leaf', 'عيسى ومريم في القرآن'], ['prophets', 'bird', 'الأنبياء في القرآن'], ['others', 'users', 'أشخاص آخرون في القرآن'], ['sifat', 'triangle-alert', 'الكافرين/المنافقين/المشركين'], ['jews', 'scroll', 'اليهود وبنو إسرائيل في القرآن']];
async function bookShow(mode) {   // mode: 'index', 'people', or false (closed)
  $('bk').querySelector('.bkcover').hidden = !!mode; $('bk').querySelector('.bkopen').hidden = !mode;
  if (!mode || $('bk').dataset.mode === mode) return;
  if (mode === 'people') {   // the people pages: all five on the right page
    const page = (a, title) => `<h3>${title}</h3><div class="bkppl">${a.map(([v, i, t]) => `<a href="#${v}"><svg class="ic" aria-hidden="true"><use href="#i-${i}"/></svg>${t}</a>`).join('')}</div>`;
    $('bkR').innerHTML = page(BK_PEOPLE, 'الأشخاص في القرآن'); $('bkL').innerHTML = '';
    $('bk').dataset.mode = mode; return;
  }
  $('bkL').innerHTML = ''; $('bkR').innerHTML = '<p class="hint">جارٍ التحميل…</p>';
  try { if (!surahs) surahs = await (await fetch('/api/surahs')).json(); }
  catch { $('bkR').innerHTML = '<p class="hint">تعذّر تحميل قائمة السور.</p>'; return; }
  const page = (a, title) => `<h3>${title}</h3><div class="bkidx">${a.map((s) => `<button type="button" data-n="${s.id}"><span class="n">${nA(s.id)}</span><span>${esc(s.ar)}</span><span class="v" title="عدد الآيات">${nA(s.verses)}</span></button>`).join('')}</div>`;
  $('bkR').innerHTML = page(surahs.slice(0, 57), 'فهرس السور'); $('bkL').innerHTML = page(surahs.slice(57), 'فهرس السور (تتمة)');
  $('bk').dataset.mode = mode;
}
$('bk').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-bk]'); if (b) return bookShow(b.dataset.bk === 'close' ? false : b.dataset.bk);
  const s = e.target.closest('.bkidx button'); if (!s) return;
  await new Promise((r) => { addEventListener('hashchange', () => setTimeout(r), { once: true }); location.hash = '#surahs'; });   // after the page switch (it scrolls to the top)
  await loadSurahs(); if (!$('sgrid').querySelector('details.sr')) renderSurahs();   // the list was loaded here, not drawn yet
  const d = $('sgrid').querySelector(`details.sr[data-n="${s.dataset.n}"]`); if (d) { d.open = true; d.scrollIntoView({ block: 'center' }); }
});
/* topic pages: a box title too long for its box gets a little smaller, step by step, until it fits on one line */
function fitTitles(view) {
  if (!view || view.hidden) return;
  view.querySelectorAll('[id^="t-"] .lesson>summary').forEach((s) => {
    s.style.fontSize = ''; s.style.whiteSpace = 'nowrap';
    for (let k = 0.95; s.scrollWidth > s.clientWidth + 1 && k >= 0.75; k -= 0.05) s.style.fontSize = k + 'em';
    if (s.scrollWidth > s.clientWidth + 1) { s.style.fontSize = ''; s.style.whiteSpace = ''; }   // still too long: let it wrap at its normal size
  });
}
let fitT = 0; addEventListener('resize', () => { clearTimeout(fitT); fitT = setTimeout(() => fitTitles(document.querySelector('.view:not([hidden])')), 200); });
