import re, sys
sys.stdout.reconfigure(encoding='utf-8')
p = 'public/index.html'
h = open(p, encoding='utf8').read()

NEW_CSS = r'''<style>
/* look & feel follows dad.can-du-ai.com: same palette, centred column, bordered cards, blue collapsible panels */
:root{--bg:#e4e1d8;--card:#ffffff;--ink:#141a26;--muted:#4f5868;--line:#b9b2a1;--accent:#0f5c4d;--accent-ink:#ffffff;--ok:#067647;--warn:#b54708;--err:#b42318;--title:#1d4ed8;--panel:#e8effd;--stat-line:#a39b88;--shadow:0 2px 8px rgba(40,32,10,.16);--heart:#d6336c}
@media(prefers-color-scheme:dark){:root{--bg:#0b0d11;--card:#232934;--ink:#f4f2ec;--muted:#b6bfcd;--line:#4a5363;--accent:#3fb99a;--accent-ink:#0b1712;--ok:#47cd89;--warn:#fdb022;--err:#f97066;--title:#6ea8fe;--panel:#1b2233;--stat-line:#5c6678;--shadow:0 2px 10px rgba(0,0,0,.55)}}
:root{--fg:var(--ink);--mut:var(--muted);--acc:var(--accent);--bar:var(--line)}
*{box-sizing:border-box}
html{font-size:18px}
body{margin:0;background:var(--bg);color:var(--ink);font:1rem/1.6 "Segoe UI",Tahoma,"Noto Naskh Arabic",system-ui,sans-serif}
button,input,select{font-family:inherit}
.page{max-width:1400px;margin:0 auto;padding:24px 16px 64px}
.view[hidden]{display:none}
/* header */
.top{display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap;border-bottom:1px solid var(--line);padding-bottom:14px;margin-bottom:28px}
.tagline{color:var(--accent);font-size:1.3rem;font-weight:600}
.brand{font-size:1.3rem;font-weight:700;color:var(--ink);direction:ltr}.brand span{color:var(--accent)}
/* page title row: title + description on the start side, green back button on the other */
.vhead{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:18px}
.vtitle{flex:1;min-width:240px}
.vtitle h1,.vtitle h2{font-size:2rem;line-height:1.3;margin:0 0 6px;color:var(--ink);text-align:start}
.vtitle .sub,.vtitle .hint{color:var(--muted);font-size:.9rem;margin:0;text-align:start}
.back{display:inline-flex;align-items:center;gap:10px;background:var(--accent);color:var(--accent-ink);text-decoration:none;font-weight:600;font-size:.95rem;padding:12px 22px;border-radius:10px;white-space:nowrap}
.back:hover,.back:focus-visible{filter:brightness(1.1);outline:none}
.hint{color:var(--muted);font-size:.9rem;margin:0 0 12px}
.sub{color:var(--muted)}
/* home tiles = dad cards */
.home{display:grid;grid-template-columns:repeat(6,1fr);gap:18px}
.home .tile{grid-column:span 2}.home .tile.half{grid-column:span 3}
@media(max-width:800px){.home{grid-template-columns:1fr 1fr}.home .tile,.home .tile.half{grid-column:span 1}}
@media(max-width:480px){.home{grid-template-columns:1fr}}
.tile,.card,.aib,.col,.vrow{background:var(--card);border:1px solid var(--stat-line);border-radius:14px;box-shadow:var(--shadow)}
.tile{display:flex;flex-direction:column;padding:18px 20px;min-height:160px;text-decoration:none;color:var(--ink)}
.tile:hover,.tile:focus-visible{border-color:var(--accent);outline:none}
.tile .ic{font-size:1.7rem;line-height:1.2;margin-bottom:6px}
.tile b{display:block;font-size:1.3rem;line-height:1.35}
.tile span{display:block;color:var(--muted);font-size:.9rem;margin-top:auto;padding-top:8px}
/* mic button */
.center{text-align:center}
.mic{width:168px;height:168px;border-radius:50%;border:0;background:var(--accent);color:var(--accent-ink);font-size:1.1rem;font-weight:700;cursor:pointer;box-shadow:var(--shadow)}
.mic.rec{animation:p 1.2s infinite}@keyframes p{50%{transform:scale(1.06)}}
.mic:disabled{opacity:.6;cursor:wait}
.st{min-height:1.7em;margin:16px 0;color:var(--muted);text-align:center}
.card{padding:16px;margin-top:12px}
.warn{border-color:var(--warn)}
.top-name,.card .top{font-size:1.3rem;font-weight:700}
.row{margin:10px 0 0;font-size:.95rem}
.bar{height:8px;background:var(--line);border-radius:4px;margin-top:3px}.bar i{display:block;height:100%;background:var(--accent);border-radius:4px}
.btn{font:inherit;font-size:.9rem;padding:7px 16px;border-radius:99px;border:1px solid var(--accent);background:transparent;color:var(--ink);cursor:pointer;margin:4px 3px}
.btn.pri,.btn.on{background:var(--accent);color:var(--accent-ink)}
.aib{padding:14px 16px;margin-top:12px;font-size:.95rem}
.aib h3{margin:0 0 4px;font-size:.85rem;color:var(--muted)}
.vt{font-size:1.35rem;line-height:2.1;margin:6px 0;font-family:"Amiri","Traditional Arabic","Noto Naskh Arabic",serif}
.tag{color:var(--muted);font-size:.8rem}
.aib form{display:flex;gap:6px;margin-top:6px}
.aib input,.inp{flex:1;min-width:0;font:inherit;font-size:.95rem;padding:8px 12px;border-radius:10px;border:1px solid var(--stat-line);background:var(--panel);color:var(--ink)}
.aib form button{padding:8px 18px;border-radius:10px;border:0;background:var(--accent);color:var(--accent-ink);cursor:pointer;font:inherit;font-weight:600}
.ans{margin-top:8px;white-space:pre-wrap}
/* links as pills (like the company chips on dad) */
.lk{margin-top:8px;font-size:.82rem}
.lk a{display:inline-block;margin:4px 0 4px 8px;padding:3px 14px;border:1px solid var(--stat-line);background:var(--panel);color:var(--ink);border-radius:99px;text-decoration:none}
.lk a:hover{border-color:var(--accent)}
.note{color:var(--muted);margin-top:22px;font-size:.85rem;text-align:center}
label.up{color:var(--accent);cursor:pointer;text-decoration:underline}
#fb{margin-top:14px;font-size:.95rem;text-align:center}#fb select{font:inherit;padding:6px;border-radius:8px;background:var(--panel);color:var(--ink);border:1px solid var(--stat-line)}
/* collapsible panels: blue border, blue title, green triangle */
.lesson,.sr{background:var(--panel);border:2px solid var(--title);border-radius:14px;padding:0 18px}
.lesson>summary,.sr>summary{cursor:pointer;list-style:none;font-weight:700;color:var(--title);font-size:1.05rem;padding:14px 0;display:flex;gap:10px;align-items:center}
.lesson>summary::-webkit-details-marker,.sr>summary::-webkit-details-marker{display:none}
.lesson>summary::before,.sr>summary::before{content:"◀";color:var(--accent);font-size:.8em;flex:none}
.lesson[open]>summary::before,.sr[open]>summary::before{content:"▼"}
.lesson[open],.sr[open]{padding-bottom:14px}
/* readers */
#cols{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;align-items:start}
@media(max-width:1000px){#cols{grid-template-columns:repeat(3,1fr)}}@media(max-width:640px){#cols{grid-template-columns:repeat(2,1fr)}}@media(max-width:420px){#cols{grid-template-columns:1fr}}
.col{padding:6px 10px;margin:0;list-style:none}
.rd{display:flex;gap:6px;align-items:flex-start;padding:5px 0;border-bottom:1px solid var(--line);font-size:.8rem}.rd:last-child{border:0}
.rd .n{color:var(--muted);min-width:1.8em;align-self:center}
.rd details{flex:1;min-width:0}.rd summary{cursor:pointer;list-style:none}.rd summary::-webkit-details-marker{display:none}
.rd .nm{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:.85rem}
.heart{border:0;background:none;cursor:pointer;font-size:1.1rem;line-height:1;padding:2px;color:var(--muted);align-self:center}.heart.on{color:var(--heart)}
.rd.fav{background:color-mix(in srgb,var(--heart) 8%,transparent)}
.rd .lk a{display:block;margin:3px 0;border-radius:10px}
/* surahs */
#sgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;align-items:start}
@media(max-width:1000px){#sgrid{grid-template-columns:repeat(3,1fr)}}@media(max-width:640px){#sgrid{grid-template-columns:repeat(2,1fr)}}@media(max-width:380px){#sgrid{grid-template-columns:1fr}}
.sr[open]{grid-column:1/-1}
.sr .n{color:var(--muted);min-width:2em;font-size:.8rem;font-weight:400}.sr .nm{font-size:1.05rem;white-space:nowrap}.sr .m{color:var(--muted);font-size:.72rem;font-weight:400;margin-inline-start:auto;white-space:nowrap}
.sr .body{font-size:.9rem;color:var(--ink)}.sr select{font:inherit;font-size:.9rem;max-width:100%;padding:6px;border-radius:8px;margin:6px 0;background:var(--card);color:var(--ink);border:1px solid var(--stat-line)}.sr audio{width:100%;margin-top:4px}
.sr .vs{margin-top:10px;border-top:1px solid var(--line);padding-top:8px}.sr .vs>summary{font-weight:600;color:var(--accent);cursor:pointer}
.vtext{font-size:1.5rem;line-height:2.4;text-align:justify;font-family:"Amiri","Traditional Arabic","Noto Naskh Arabic",serif;margin-top:8px;color:var(--ink)}
.vtext .bm{display:block;text-align:center;color:var(--accent);margin-bottom:6px}
.vtext .no{font-size:.95rem;color:var(--accent);margin:0 4px;white-space:nowrap}
.sbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px}
/* memorize / learn */
.ctl{display:flex;flex-wrap:wrap;gap:10px;align-items:end;margin-bottom:12px}
.ctl label{display:flex;flex-direction:column;font-size:.82rem;color:var(--muted);gap:2px}
.ctl select,.ctl input[type=number]{font:inherit;font-size:.9rem;padding:6px 10px;border-radius:10px;border:1px solid var(--stat-line);background:var(--panel);color:var(--ink);min-width:90px}
.ctl .chk{flex-direction:row;align-items:center;gap:6px;color:var(--ink)}
.vrow{padding:10px 14px;margin-top:8px;border-width:2px}
.vrow.cur{border-color:var(--accent)}
.vrow .top{display:flex;gap:10px;align-items:flex-start;font-weight:400;font-size:1rem}
.vrow .num{color:var(--muted);font-size:.85rem;min-width:2em;padding-top:10px}
.vrow .vt{flex:1;margin:0}
.vrow.hide .vt{filter:blur(9px);cursor:pointer;user-select:none}
.mbtn{border:1px solid var(--accent);background:transparent;color:var(--ink);border-radius:50%;width:38px;height:38px;cursor:pointer;font-size:1.05rem;flex:none}
.mbtn.rec{background:var(--err);color:#fff;border-color:var(--err)}
.res{margin-top:6px;font-size:1.15rem;line-height:2;font-family:"Amiri","Traditional Arabic","Noto Naskh Arabic",serif}
.res .ok{color:var(--ok)}.res .bad{color:var(--err);text-decoration:underline wavy}
.lesson{margin-top:12px}
.lesson ul{margin:6px 0 10px;padding-inline-start:1.3em}.lesson li{margin:3px 0}
.lesson .ex{border-top:1px solid var(--line);padding:8px 0}
.lesson .exh{display:flex;gap:10px;align-items:center}.lesson .exh .vt{flex:1;margin:0;font-size:1.25rem}
.letters{font-size:1.5rem;letter-spacing:.3em;font-family:"Amiri","Traditional Arabic",serif;line-height:2}
.fact{display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-bottom:1px solid var(--line)}.fact:last-child{border:0}
.fact b{min-width:8.5em;color:var(--accent)}
.mir .ex,.lesson .ex{border-top:1px solid var(--line);padding:8px 0}.mir .vt{font-size:1.25rem;margin:4px 0}
.caveat{border:1px solid var(--warn);border-radius:14px;padding:10px 16px;margin:0 0 12px;font-size:.9rem;background:var(--card)}
mark{background:color-mix(in srgb,var(--accent) 30%,transparent);color:inherit;border-radius:4px;padding:0 2px}
.mgroup{margin-top:24px}.mgroup>h3{margin:0 0 12px;font-size:1.2rem;color:var(--accent);display:flex;align-items:center;gap:8px}
.mgroup>h3::after{content:"";flex:1;height:1px;background:var(--line)}
.mgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;align-items:start}
@media(max-width:900px){.mgrid{grid-template-columns:repeat(2,1fr)}}@media(max-width:600px){.mgrid{grid-template-columns:1fr}}
.mgrid .lesson{margin-top:0}
</style>'''

a = h.index('<style>'); b = h.index('</style>') + len('</style>')
h = h[:a] + NEW_CSS + h[b:]

def rep(old, new):
    global h
    assert old in h, old[:70]
    h = h.replace(old, new, 1)

# header + page wrapper; remove the old nav
rep('<div id="nav" hidden><a href="#home">← الرئيسية</a></div>\n',
    '<div class="page">\n<header class="top"><div class="tagline">بسم الله الرحمن الرحيم</div><div class="brand">Quran<span>.can-du-ai</span>.com</div></header>\n')
# views are no longer individually width-wrapped
h = re.sub(r'<section class="view wrap(?: wide| mid)?"', '<section class="view"', h)
# home has no big title (the header carries the name)
h = h.replace('  <h1>قارئ القرآن</h1>\n  <div class="home">', '  <div class="home">', 1)
# close the wrapper before the script
rep('<script type="module">', '</div>\n<script type="module">')
# title/back row is assembled in JS; remove the old nav handling
rep("  $('nav').hidden = v === 'home';\n", '')
rep("function route() {", r"""/* title row on every inner screen: heading + description, with the green back button */
document.querySelectorAll('.view:not(#v-home)').forEach((v) => {
  const t = v.querySelector(':scope > h1, :scope > h2'); if (!t) return;
  const d = t.nextElementSibling && t.nextElementSibling.matches('p.sub, p.hint') ? t.nextElementSibling : null;
  const head = document.createElement('div'), box = document.createElement('div');
  head.className = 'vhead'; box.className = 'vtitle';
  t.before(head); box.append(t); if (d) box.append(d); head.append(box);
  head.insertAdjacentHTML('beforeend', '<a class="back" href="#home">الرجوع إلى القائمة الرئيسية <span aria-hidden="true">→</span></a>');
});
function route() {""")
open(p, 'w', encoding='utf8').write(h)
m = re.search(r'<script type="module">([\s\S]*?)</script>', h).group(1)
open('tmp_check.mjs', 'w', encoding='utf8').write(re.sub(r'^import .*$', '', m, flags=re.M))
print('patched')
