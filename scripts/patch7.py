p = 'public/index.html'
h = open(p, encoding='utf8').read()

def rep(old, new):
    global h
    assert old in h, old[:70]
    h = h.replace(old, new, 1)

# ---- CSS
rep("</style></head>", """.mgroup{margin-top:22px}.mgroup>h3{margin:0 0 10px;font-size:1.15rem;color:var(--acc);display:flex;align-items:center;gap:8px}
.mgroup>h3::after{content:"";flex:1;height:1px;background:var(--bar)}
.mgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;align-items:start}
@media(max-width:900px){.mgrid{grid-template-columns:repeat(2,1fr)}}@media(max-width:600px){.mgrid{grid-template-columns:1fr}}
.mgrid .lesson{margin-top:0}
</style></head>""")

# ---- data + rendering
a = h.index("const MIRACLES = [")
b = h.index("let miInit = false;")
data = r'''const MIRACLE_GROUPS = [
  { g: 'الإنسان والحياة', ic: '🧬' },
  { g: 'الفلك والكون', ic: '🔭' },
  { g: 'الأرض والجغرافيا', ic: '🌍' },
  { g: 'البحار والمياه والجو', ic: '🌊' },
];
const MIRACLES = [
  { g: 0, t: 'مراحل خلق الإنسان', note: 'تصف الآيات تطور الخلق من نطفة فعلقة فمضغة فعظام يكسوها اللحم؛ ويرى المهتمون أن هذا التسلسل يوافق ما عُرف لاحقاً عن أطوار الجنين.', keys: ['23:12', '23:13', '23:14'] },
  { g: 0, t: 'أصل الحياة من الماء', note: 'يشير كثيرون إلى أن الماء عنصر أساسي في كل خلية حية، وإلى أن الحياة نشأت في الماء.', keys: ['21:30'] },
  { g: 0, t: 'الأزواج في الخلق', note: 'تذكر الآية أن الأزواج في النبات والإنسان وفيما لا يعلمه الناس؛ ويشير بعضهم إلى الأزواج في الذرة (الشحنات الموجبة والسالبة) والنبات.', keys: ['36:36'] },
  { g: 0, t: 'البنان (بصمة الأصابع)', note: 'يتأمل بعضهم في تخصيص «البنان» بالذكر إشارة إلى دقة تكوين الإنسان وتميّز بصمات الأصابع.', keys: ['75:3', '75:4'] },
  { g: 0, t: 'الجلد والإحساس بالألم', note: 'يرى بعضهم في الآية إشارة إلى أن مستقبلات الألم في الجلد هي موضع الإحساس بالألم.', keys: ['4:56'] },
  { g: 0, t: 'النحل والعسل', note: 'تذكر الآيات وحي الله إلى النحل وخروج شراب مختلف الألوان فيه شفاء للناس، ويتأمل فيها المهتمون بعلم الأحياء والطب.', keys: ['16:68', '16:69'] },
  { g: 1, t: 'اتساع السماء', note: 'يرى بعضهم في كلمة «لموسعون» إشارة إلى توسّع الكون الذي رصده علم الفلك الحديث.', keys: ['51:47'] },
  { g: 1, t: 'بداية السماء «دخان»', note: 'يرى بعضهم في وصف السماء بالدخان إشارة إلى الحالة الغازية الأولى للكون.', keys: ['41:11'] },
  { g: 1, t: 'الأفلاك والمدارات', note: 'تذكر الآية أن الشمس والقمر والليل والنهار يجري كلٌّ في فَلَك، ويرى المهتمون فيها إشارة إلى المدارات الفلكية.', keys: ['21:33', '36:40'] },
  { g: 1, t: 'تكوير الليل والنهار', note: 'يتأمل بعضهم في فعل «يكوّر» (يلفّ) إشارة إلى كروية الأرض وتعاقب الليل والنهار عليها.', keys: ['39:5'] },
  { g: 2, t: 'الجبال أوتاداً', note: 'يربط بعضهم وصف الجبال بالأوتاد بوجود جذور عميقة للجبال تثبّت القشرة الأرضية.', keys: ['78:6', '78:7'] },
  { g: 2, t: 'حركة الجبال', note: 'يرى بعضهم في الآية إشارة إلى حركة الأرض التي تحمل الجبال وهي تبدو ساكنة.', keys: ['27:88'] },
  { g: 2, t: 'دَحْو الأرض', note: 'يتأمل بعضهم في «دحاها» (بسطها ومهّدها) إشارة إلى تهيئة الأرض للحياة، ويذكر آخرون شكلها الكروي المبسوط.', keys: ['79:30'] },
  { g: 2, t: 'إنزال الحديد', note: 'يتأمل بعضهم في التعبير بـ«أنزلنا» عن الحديد، وقد ذُكر في علم الفلك أن الحديد يتكوّن في النجوم ولا يتكوّن على الأرض.', keys: ['57:25'] },
  { g: 3, t: 'البرزخ بين البحرين', note: 'يرى بعضهم في الآيتين إشارة إلى اختلاف خصائص الماء عند التقاء البحار مع بقاء حدّ فاصل بينها.', keys: ['55:19', '55:20'] },
  { g: 3, t: 'ظلمات البحر اللجّي', note: 'يرى بعضهم في وصف الظلمات والموج فوق الموج إشارة إلى الأمواج الداخلية في أعماق البحار وانعدام الضوء فيها.', keys: ['24:40'] },
  { g: 3, t: 'السحاب والمطر', note: 'تصف الآية تكوّن السحاب وتجمّعه حتى ينزل المطر، ويتأمل فيها المهتمون بعلم الأرصاد.', keys: ['24:43'] },
  { g: 3, t: 'الرياح لواقح', note: 'يربط بعضهم وصف الرياح بـ«لواقح» بدورها في تلقيح النبات وتكوين السحب.', keys: ['15:22'] },
];
'''
h = h[:a] + data + h[b:]

old_render = "  $('mirList').innerHTML = MIRACLES.map((m, i) => `<details class=\"lesson\" data-i=\"${i}\"><summary>${nA(i + 1)}. ${esc(m.t)}</summary><div>${esc(m.note)}</div><div class=\"exs\"><div class=\"tag\">جارٍ تحميل الآيات…</div></div></details>`).join('');"
assert old_render in h
new_render = """  $('mirList').innerHTML = MIRACLE_GROUPS.map((G, gi) => `<div class="mgroup"><h3><span>${G.ic}</span>${esc(G.g)}</h3><div class="mgrid">` +
    MIRACLES.map((m, i) => [m, i]).filter(([m]) => m.g === gi).map(([m, i]) => `<details class="lesson" data-i="${i}"><summary>${esc(m.t)}</summary><div>${esc(m.note)}</div><div class="exs"><div class="tag">جارٍ تحميل الآيات…</div></div></details>`).join('') + '</div></div>').join('');"""
h = h.replace(old_render, new_render, 1)
open(p, 'w', encoding='utf8').write(h)

# ---- worker: never let browsers cache the page itself
p = 'src/worker.js'
s = open(p, encoding='utf8').read()
old = "    return env.ASSETS.fetch(req);"
assert s.count(old) == 1
s = s.replace(old, """    const res = await env.ASSETS.fetch(req);
    if (!(res.headers.get('content-type') || '').includes('text/html')) return res;
    const out = new Response(res.body, res);
    out.headers.set('cache-control', 'no-cache');
    return out;""", 1)
open(p, 'w', encoding='utf8').write(s)
print('patched')
