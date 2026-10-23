# worker
p='src/worker.js'; s=open(p,encoding='utf8').read()
old="      await env.DB.prepare('INSERT INTO feedback(predicted_id,confidence,is_correct,actual_id,vectors) VALUES(?,?,?,?,?)')\n        .bind(b.predicted_id, Number(b.confidence) || null, b.is_correct ? 1 : 0, actual, JSON.stringify(vecs)).run();"
assert old in s
new="""      // free-text name of the real reader (may be someone outside the 100 known readers)
      const name = !b.is_correct && typeof b.actual_name === 'string' ? b.actual_name.replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || null : null;
      await env.DB.prepare('INSERT INTO feedback(predicted_id,confidence,is_correct,actual_id,actual_name,vectors) VALUES(?,?,?,?,?,?)')
        .bind(b.predicted_id, Number(b.confidence) || null, b.is_correct ? 1 : 0, actual, name, JSON.stringify(vecs)).run();"""
s=s.replace(old,new,1); open(p,'w',encoding='utf8').write(s)
# schema (fresh installs) + migration (existing db)
p='schema.sql'; s=open(p,encoding='utf8').read()
s=s.replace("actual_id TEXT, vectors TEXT);","actual_id TEXT, actual_name TEXT, vectors TEXT);",1); open(p,'w',encoding='utf8').write(s)
# page
p='public/index.html'; h=open(p,encoding='utf8').read()
a=h.index("  const send = async (is_correct, actual_id) => {"); b=h.index("async function identify")
newfb=r"""  const send = async (is_correct, actual_id, actual_name) => {
    fb.textContent = 'شكراً على ملاحظاتك!';
    try { await fetch('/api/feedback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ predicted_id: top.id, confidence: top.confidence, is_correct, actual_id, actual_name, vectors }) }); }
    catch { fb.textContent = 'تعذّر حفظ الملاحظات.'; }
  };
  fb.innerHTML = 'اختياري: هل النتيجة صحيحة؟ <button class="btn" id="yes">👍 نعم</button><button class="btn" id="no">👎 لا</button>';
  $('yes').onclick = () => send(true);
  $('no').onclick = () => {
    fb.innerHTML = '<div>من كان القارئ؟ اختر من القائمة أو اكتب اسمه (حتى لو لم يكن بين القرّاء المائة):</div>' +
      '<div style="margin-top:8px"><select id="who"><option value="">اختر من القائمة…</option>' + reciters.map((r) => `<option value="${esc(r.id)}">${esc(arName(r))}</option>`).join('') + '</select></div>' +
      '<div style="margin-top:8px"><input id="whoName" class="inp" maxlength="80" placeholder="اسم القارئ الصحيح (اختياري)" aria-label="اسم القارئ الصحيح" style="width:100%;max-width:360px"></div>' +
      '<div style="margin-top:8px"><button class="btn pri" id="go">إرسال</button></div>';
    $('go').onclick = () => send(false, $('who').value || null, $('whoName').value.trim() || null);
  };
}
"""
h=h[:a]+newfb+h[b:]
open(p,'w',encoding='utf8').write(h)
import re
m=re.search(r'<script type="module">([\s\S]*?)</script>',h).group(1)
open('tmp_check.mjs','w',encoding='utf8').write(re.sub(r'^import .*$','',m,flags=re.M))
print('ok')
