import { execFileSync } from 'node:child_process';
import { voiceprints } from '../public/voiceprint.js';
for (const [folder, want] of [['Alafasy_128kbps','alafasy'],['Husary_128kbps','husary'],['Ghamadi_40kbps','ghamdi']]) {
  const raw = execFileSync('ffmpeg', ['-v','error','-i',`samples/${folder}/055001.mp3`,'-ac','1','-ar','16000','-f','f32le','-'],{maxBuffer:1<<28});
  const v = voiceprints(new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength/4), 5);
  const r = await fetch('https://quran.can-du-ai.com/api/identify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({vectors:v})});
  const d = await r.json(); console.log(want, '->', r.status, JSON.stringify(d.results?.slice(0,2)));
}
