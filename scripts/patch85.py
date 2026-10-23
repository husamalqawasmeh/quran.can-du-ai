import re
p='public/index.html'; h=open(p,encoding='utf8').read()
a=h.index("const MOOD = {"); b=h.index("delete TOPICS.people;")
h=h[:a]+h[b:]
h=h.replace('<details class="lesson${m.mood ? \' mood-\' + m.mood : \'\'}" data-i="${i}"><summary>${esc(m.t)}${NC &&','<details class="lesson" data-i="${i}"><summary>${esc(m.t)}${NC &&')
a=h.index('<div class="moodkey">'); b=h.index('<div id="t-others"')
h=h[:a]+h[b:]
a=h.index("/* people: card colour shows"); b=h.index("</style>",a)
h=h[:a]+h[b:]
assert 'mood' not in h
open(p,'w',encoding='utf8').write(h)
m=re.search(r'<script type="module">([\s\S]*?)</script>',h).group(1)
open('tmp_check.mjs','w',encoding='utf8').write(re.sub(r'^import .*$','',m,flags=re.M))
