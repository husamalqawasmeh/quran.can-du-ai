import re
p='public/index.html'; h=open(p,encoding='utf8').read()
def rep(o,n):
    global h
    assert h.count(o)==1,o[:60]; h=h.replace(o,n,1)
rep("delete TOPICS.people;","""const MOOD = {
  good: ['لقمان', 'ذو القرنين', 'مريم', 'عمران', 'طالوت', 'زيد بن حارثة', 'جبريل', 'ميكال', 'العبد الصالح (الخضر)', 'امرأة فرعون', 'مؤمن آل فرعون', 'أصحاب الكهف'],
  bad: ['فرعون', 'هامان', 'قارون', 'السامري', 'آزر', 'جالوت', 'أبو لهب', 'إبليس', 'صاحب الجنتين'],
  neutral: ['هاروت وماروت', 'مالك', 'ملكة سبأ', 'امرأة العزيز', 'أصحاب الأخدود'],
};
TOPICS.others.items.forEach((i) => { i.mood = Object.keys(MOOD).find((k) => MOOD[k].includes(i.t)); });
delete TOPICS.people;""")
rep('<details class="lesson" data-i="${i}"><summary>${esc(m.t)}${NC &&','<details class="lesson${m.mood ? \' mood-\' + m.mood : \'\'}" data-i="${i}"><summary>${esc(m.t)}${NC &&')
rep("<div id=\"t-others\" class=\"mir\"></div>","<div class=\"moodkey\"><span class=\"mk good\">أخضر: صالح أو محمود في القرآن</span><span class=\"mk bad\">أحمر: ظالم أو مذموم</span><span class=\"mk neutral\">رمادي: محايد أو أمره مختلط</span></div>\n  <div id=\"t-others\" class=\"mir\"></div>")
rep("</style>","""/* people: card colour shows how the Quran presents the person */
.lesson.mood-good{background:color-mix(in srgb,var(--ok) 20%,var(--panel));border-color:var(--ok)}
.lesson.mood-bad{background:color-mix(in srgb,var(--err) 20%,var(--panel));border-color:var(--err)}
.lesson.mood-neutral{background:color-mix(in srgb,var(--muted) 20%,var(--panel));border-color:var(--muted)}
.moodkey{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 4px}.mk{font-size:.85rem;padding:4px 12px;border-radius:99px;border:2px solid}
.mk.good{background:color-mix(in srgb,var(--ok) 20%,var(--panel));border-color:var(--ok)}.mk.bad{background:color-mix(in srgb,var(--err) 20%,var(--panel));border-color:var(--err)}.mk.neutral{background:color-mix(in srgb,var(--muted) 20%,var(--panel));border-color:var(--muted)}
</style>""")
open(p,'w',encoding='utf8').write(h)
m=re.search(r'<script type="module">([\s\S]*?)</script>',h).group(1)
open('tmp_check.mjs','w',encoding='utf8').write(re.sub(r'^import .*$','',m,flags=re.M))
