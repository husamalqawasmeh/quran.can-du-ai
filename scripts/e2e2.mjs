import { execFileSync } from 'node:child_process';
import { voiceprints } from '../public/voiceprint.js';
let ok = 0, hi = 0, hiOk = 0, n = 0;
for (const id of [123,51,54,31,112,118,125,102,30,92,76,89,4,5,121,70,60,21,56,43,221,273,10,300]) {
  const f = `samples3/r${id}/0_80.mp3`;
  let raw; try { raw = execFileSync('ffmpeg',['-v','error','-i',f,'-t','20','-ac','1','-ar','16000','-f','f32le','-'],{maxBuffer:1<<28,stdio:['ignore','pipe','ignore']}); } catch { continue; }
  const v = voiceprints(new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset+raw.byteLength)), 5);
  const d = await (await fetch('https://quran.can-du-ai.com/api/identify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({vectors:v})})).json();
  const t = d.results[0]; n++; const good = t.id === 'r'+id; if (good) ok++; if (t.confidence >= 0.8) { hi++; if (good) hiOk++; }
  console.log(good ? 'OK  ' : 'MISS', 'r'+id.toString().padEnd(4), t.name.padEnd(28), (t.confidence*100).toFixed(0)+'%', t.links?.length+' links');
}
console.log(`${ok}/${n} correct; confidence>=80%: ${hiOk}/${hi} correct`);
