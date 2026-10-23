import { readFileSync, readFileSync as rf } from 'node:fs';
import { execFileSync } from 'node:child_process';
const env = Object.fromEntries(readFileSync('.env','utf8').split(/\r?\n/).filter(l=>l&&!l.startsWith('#')&&l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1)]));
const chat = async (name, url, key, model) => {
  try { const r = await fetch(url, { method:'POST', headers:{authorization:'Bearer '+key,'content-type':'application/json'}, body: JSON.stringify({model,max_tokens:30,messages:[{role:'user',content:'Say OK'}]}) });
    const t = await r.text(); console.log(name.padEnd(11), r.status, r.ok ? JSON.parse(t).choices?.[0]?.message?.content?.slice(0,20) : t.slice(0,110)); } catch(e){ console.log(name, 'ERR', e.message) }
};
await chat('openrouter','https://openrouter.ai/api/v1/chat/completions',env.OPENROUTER_API_KEY,'openai/gpt-4o-mini');
await chat('groq','https://api.groq.com/openai/v1/chat/completions',env.GROQ_API_KEY,'llama-3.3-70b-versatile');
await chat('openai','https://api.openai.com/v1/chat/completions',env.OPENAI_API_KEY,'gpt-4o-mini');
await chat('deepseek','https://api.deepseek.com/chat/completions',env.DEEPSEEK_API_KEY,'deepseek-chat');
// STT: Groq whisper on a 12 s Alafasy Al-Fatiha clip
execFileSync('ffmpeg',['-y','-v','error','-i','samples/Alafasy_128kbps/001002.mp3','-ac','1','-ar','16000','probe.wav']);
const fd = new FormData(); fd.append('file', new Blob([rf('probe.wav')],{type:'audio/wav'}),'a.wav'); fd.append('model','whisper-large-v3'); fd.append('language','ar'); fd.append('response_format','json');
const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions',{method:'POST',headers:{authorization:'Bearer '+env.GROQ_API_KEY},body:fd});
const t = await r.text(); console.log('whisper', r.status, t.slice(0,200));
const txt = r.ok ? JSON.parse(t).text : 'الحمد لله رب العالمين';
const sr = await fetch('https://api.quran.com/api/v4/search?size=3&language=en&q='+encodeURIComponent(txt));
const sj = await sr.json(); console.log('quran.com search', sr.status, JSON.stringify(sj.search?.results?.slice(0,2).map(x=>[x.verse_key,x.text])));
