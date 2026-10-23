p = 'public/index.html'
h = open(p, encoding='utf8').read()

def rep(old, new):
    global h
    assert old in h, old[:70]
    h = h.replace(old, new, 1)

# ---------- CSS: full-width 6-column home grid, wider text views
rep(".home{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:20px}\n@media(max-width:480px){.home{grid-template-columns:1fr}}",
""".home{display:grid;grid-template-columns:repeat(6,1fr);gap:18px;margin-top:24px}
.home .tile{grid-column:span 2}.home .tile.half{grid-column:span 3}
@media(max-width:800px){.home{grid-template-columns:1fr 1fr}.home .tile,.home .tile.half{grid-column:span 1}}
@media(max-width:480px){.home{grid-template-columns:1fr}}
#v-home{max-width:1400px;padding:28px 28px 48px}
#v-home h1{font-size:2rem;margin-bottom:8px}
.wrap.mid{max-width:820px}""")
rep(".tile{display:block;background:var(--card);border-radius:18px;padding:22px 16px;",
    ".tile{display:block;background:var(--card);border-radius:18px;padding:34px 18px;min-height:190px;")
rep(".tile .ic{font-size:2.2rem;line-height:1.2}.tile b{display:block;font-size:1.15rem;margin-top:6px}.tile span{display:block;color:var(--mut);font-size:.88rem;margin-top:2px}",
    ".tile .ic{font-size:2.8rem;line-height:1.2}.tile b{display:block;font-size:1.3rem;margin-top:8px}.tile span{display:block;color:var(--mut);font-size:.95rem;margin-top:4px}")
rep(".wrap{width:100%;max-width:560px;", ".wrap{width:100%;max-width:760px;")
rep("</style></head>", """.fact{display:flex;gap:10px;align-items:flex-start;padding:7px 0;border-bottom:1px solid var(--bar)}.fact:last-child{border:0}
.fact b{min-width:8.5em;color:var(--acc)}
.mir .ex{border-top:1px solid var(--bar);padding:8px 0}.mir .vt{font-size:1.25rem;margin:4px 0}
.caveat{border:1px solid #c0762b;border-radius:12px;padding:10px 14px;margin:0 0 12px;font-size:.92rem}
</style></head>""")

# ---------- Home tiles (new order / layout)
a = h.index('<div class="home">')
b = h.index('</div>', h.index('تعليم القرآن</b>')) + len('</div>')
# find the closing of the .home container: it is the first '\n  </div>' after the last tile
end = h.index('\n  </div>', h.index('تعليم القرآن</b>')) + len('\n  </div>')
tiles = '''<div class="home">
    <a class="tile" href="#about"><div class="ic">📜</div><b>عن القرآن</b><span>تعريف بالقرآن الكريم ونزوله وجمعه وترتيبه</span></a>
    <a class="tile" href="#miracles"><div class="ic">🔭</div><b>الإعجاز العلمي في القرآن</b><span>آيات يتأمل فيها المهتمون بباب الإعجاز العلمي</span></a>
    <a class="tile" href="#surahs"><div class="ic">📖</div><b>السور</b><span>سور القرآن الكريم ١١٤ مع الاستماع</span></a>
    <a class="tile half" href="#readers"><div class="ic">🎙️</div><b>القرّاء</b><span>١٠٠ قارئ مع روابط الاستماع والمفضلة</span></a>
    <a class="tile half" href="#identify"><div class="ic">🔍</div><b>تعرّف على القارئ من صوته</b><span>استمع إلى تلاوة وسأخبرك من القارئ</span></a>
    <a class="tile" href="#companion"><div class="ic">🤝</div><b>رفيق القرآن</b><span>يستمع ويقترح آيات ذات صلة بما يسمعه</span></a>
    <a class="tile" href="#memorize"><div class="ic">🧠</div><b>تحفيظ القرآن</b><span>كرّر الآيات واستمع وسمّع محفوظك وتحقّق منه</span></a>
    <a class="tile" href="#learn"><div class="ic">🎓</div><b>تعليم القرآن</b><span>دروس مبسطة في التجويد مع أمثلة مسموعة</span></a>
  </div>'''
h = h[:a] + tiles + h[end:]

# ---------- New sections
rep("<!-- تحفيظ القرآن -->", '''<!-- عن القرآن -->
<section class="view wrap mid" id="v-about" hidden>
  <h2>عن القرآن الكريم</h2>
  <div class="card">
    <div class="fact"><b>التعريف</b><span>القرآن الكريم كلام الله تعالى المنزَّل على نبيّنا محمد ﷺ بواسطة جبريل عليه السلام، المتعبَّد بتلاوته، المنقول إلينا بالتواتر، المبدوء بسورة الفاتحة والمختوم بسورة الناس.</span></div>
    <div class="fact"><b>بدء نزوله</b><span>بدأ نزوله في غار حراء بمكة المكرمة بأول آيات سورة العلق: ﴿اقرأ باسم ربك الذي خلق﴾، ونزل منجَّماً (مفرَّقاً) على نحو ثلاث وعشرين سنة، في مكة والمدينة.</span></div>
    <div class="fact"><b>تقسيمه</b><span>يتألف من ١١٤ سورة، وهو مقسّم إلى ٣٠ جزءاً و٦٠ حزباً. وعدد آياته ٦٢٣٦ آية على العدّ الشائع (يختلف العدّ قليلاً بين مدارس العدّ).</span></div>
    <div class="fact"><b>أطول وأقصر</b><span>أطول سورة البقرة (٢٨٦ آية)، وأقصر سورة الكوثر (٣ آيات)، وأطول آية آية الدَّيْن في سورة البقرة.</span></div>
    <div class="fact"><b>مكي ومدني</b><span>تُقسَّم السور بحسب زمن النزول إلى مكية (قبل الهجرة) ومدنية (بعدها)؛ وتغلب على المكية موضوعات التوحيد والإيمان والآخرة، وعلى المدنية التشريع والأحكام.</span></div>
    <div class="fact"><b>أسماؤه</b><span>من أسمائه: القرآن، والفرقان، والكتاب، والذكر، والتنزيل.</span></div>
    <div class="fact"><b>جمعه وكتابته</b><span>كان النبي ﷺ يأمر بكتابة الوحي، وجُمع القرآن في صحف في عهد أبي بكر الصديق رضي الله عنه، ثم نُسخت المصاحف وأُرسلت إلى الأمصار في عهد عثمان بن عفان رضي الله عنه.</span></div>
    <div class="fact"><b>القراءات</b><span>نُقل القرآن بقراءات متواترة؛ وأكثرها انتشاراً اليوم رواية حفص عن عاصم، ثم رواية ورش عن نافع. والتسجيلات في هذا الموقع بقراءة حفص عن عاصم.</span></div>
  </div>
  <div style="margin-top:14px"><a class="btn pri" href="#surahs" style="text-decoration:none;display:inline-block">تصفّح السور</a> <a class="btn" href="#learn" style="text-decoration:none;display:inline-block">تعلّم التجويد</a></div>
  <p class="note">هذه الصفحة مختصرة للتعريف العام؛ وللتوسع يُرجع إلى كتب علوم القرآن وأهل العلم.</p>
</section>

<!-- الإعجاز العلمي -->
<section class="view wrap mid" id="v-miracles" hidden>
  <h2>الإعجاز العلمي في القرآن</h2>
  <div class="caveat">يرى كثير من العلماء والباحثين أن في القرآن إشاراتٍ إلى حقائق كونية وطبية، ويحذّر آخرون من ربط الآيات بكل نظرية علمية متغيرة. فالمعروض هنا آيات يتأمل فيها المهتمون بهذا الباب، وهي <b>اجتهادات تُقبل وتُناقش ولا تُعدّ قطعية</b>. والقرآن كتاب هداية في المقام الأول.</div>
  <div id="mirList" class="mir"></div>
</section>

<!-- تحفيظ القرآن -->''')

# ---------- JS
rep("const VIEWS = ['home', 'identify', 'readers', 'surahs', 'companion', 'memorize', 'learn'];",
    "const VIEWS = ['home', 'identify', 'readers', 'surahs', 'companion', 'memorize', 'learn', 'about', 'miracles'];")
rep("  if (v === 'learn') initLearn();", "  if (v === 'learn') initLearn();\n  if (v === 'miracles') initMiracles();")

js = r"""
/* ---------- الإعجاز العلمي ---------- */
const MIRACLES = [
  { t: 'مراحل خلق الإنسان', note: 'تصف الآيات تطور الخلق من نطفة فعلقة فمضغة فعظام يكسوها اللحم؛ ويرى المهتمون أن هذا التسلسل يوافق ما عُرف لاحقاً عن أطوار الجنين.', keys: ['23:12', '23:13', '23:14'] },
  { t: 'أصل الحياة من الماء', note: 'يشير كثيرون إلى أن الماء عنصر أساسي في كل خلية حية، وإلى أن الحياة نشأت في الماء.', keys: ['21:30'] },
  { t: 'اتساع السماء', note: 'يرى بعضهم في كلمة «لموسعون» إشارة إلى توسّع الكون الذي رصده علم الفلك الحديث.', keys: ['51:47'] },
  { t: 'بداية السماء «دخان»', note: 'يرى بعضهم في وصف السماء بالدخان إشارة إلى الحالة الغازية الأولى للكون.', keys: ['41:11'] },
  { t: 'إنزال الحديد', note: 'يتأمل بعضهم في التعبير بـ«أنزلنا» عن الحديد، وقد ذُكر في علم الفلك أن الحديد يتكوّن في النجوم ولا يتكوّن على الأرض.', keys: ['57:25'] },
  { t: 'الجبال أوتاداً', note: 'يربط بعضهم وصف الجبال بالأوتاد بوجود جذور عميقة للجبال تثبّت القشرة الأرضية.', keys: ['78:6', '78:7'] },
  { t: 'الأزواج في الخلق', note: 'تذكر الآية أن الأزواج في النبات والإنسان وفيما لا يعلمه الناس؛ ويشير بعضهم إلى الأزواج في الذرة (الشحنات الموجبة والسالبة) والنبات.', keys: ['36:36'] },
  { t: 'البرزخ بين البحرين', note: 'يرى بعضهم في الآيتين إشارة إلى اختلاف خصائص الماء عند التقاء البحار مع بقاء حدّ فاصل بينها.', keys: ['55:19', '55:20'] },
  { t: 'الأفلاك والمدارات', note: 'تذكر الآية أن الشمس والقمر والليل والنهار يجري كلٌّ في فَلَك، ويرى المهتمون فيها إشارة إلى المدارات الفلكية.', keys: ['21:33', '36:40'] },
  { t: 'البنان (بصمة الأصابع)', note: 'يتأمل بعضهم في تخصيص «البنان» بالذكر إشارة إلى دقة تكوين الإنسان وتميّز بصمات الأصابع.', keys: ['75:3', '75:4'] },
];
let miInit = false;
async function initMiracles() {
  if (miInit) return; miInit = true;
  $('mirList').innerHTML = MIRACLES.map((m, i) => `<details class="lesson" data-i="${i}"><summary>${nA(i + 1)}. ${esc(m.t)}</summary><div>${esc(m.note)}</div><div class="exs"><div class="tag">جارٍ تحميل الآيات…</div></div></details>`).join('');
  $('mirList').addEventListener('toggle', async (e) => {
    const d = e.target; if (!d.open || d.dataset.done) return; d.dataset.done = 1;
    const m = MIRACLES[+d.dataset.i], box = d.querySelector('.exs');
    try {
      const vs = await (await fetch('/api/ayat?keys=' + m.keys.join(','))).json();
      box.innerHTML = vs.map((v) => `<div class="ex"><div class="vt">${esc(v.text)}</div><div class="tag">سورة ${esc(v.surah_ar)} — الآية ${nA(v.ayah)}</div></div>`).join('') || '<div class="tag">تعذّر تحميل الآيات.</div>';
    } catch { box.innerHTML = '<div class="tag">تعذّر تحميل الآيات.</div>'; }
  }, true);
}
"""
rep("route();\n</script>", js + "route();\n</script>")
open(p, 'w', encoding='utf8').write(h)
print('patched')
