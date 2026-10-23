// Browser side of the neural reciter identifier.
// Computes the SAME log-mel features as ml/common.py (verified numerically), runs model.onnx, returns 192-d embeddings.
const SR = 16000, WIN = 400, HOP = 160, NFFT = 512, NMEL = 64, CLIP = 48000;

let melM = null, hann = null, session = null, ort = null;

export function fft(re, im) {                       // in-place radix-2, length NFFT
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}

/** log-mel of one 3 s clip (Float32Array of CLIP samples) -> Float32Array(NMEL * T), mean-normalised over time. T = 298 */
export function logmel(x) {
  const T = Math.floor((x.length - WIN) / HOP) + 1, bins = NFFT / 2 + 1;
  const out = new Float32Array(NMEL * T), re = new Float64Array(NFFT), im = new Float64Array(NFFT), p = new Float64Array(bins);
  for (let t = 0; t < T; t++) {
    re.fill(0); im.fill(0);
    for (let i = 0; i < WIN; i++) re[i] = x[t * HOP + i] * hann[i];
    fft(re, im);
    for (let k = 0; k < bins; k++) p[k] = re[k] * re[k] + im[k] * im[k];
    for (let m = 0; m < NMEL; m++) {
      let a = 0; const row = m * bins;
      for (let k = 0; k < bins; k++) a += melM[row + k] * p[k];
      out[m * T + t] = Math.log(a + 1e-6);
    }
  }
  for (let m = 0; m < NMEL; m++) {            // CMN over time
    let s = 0; for (let t = 0; t < T; t++) s += out[m * T + t];
    s /= T; for (let t = 0; t < T; t++) out[m * T + t] -= s;
  }
  return out;
}

export function initFeatures(mel) {
  melM = Float32Array.from(mel.flat()); hann = Float32Array.from({ length: WIN }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / WIN));
}

export async function loadModel(onStatus) {
  if (session) return session;
  onStatus && onStatus('جارٍ تحميل نموذج الصوت…');
  const [mel] = await Promise.all([fetch('/model/mel.json').then((r) => r.json())]);
  initFeatures(mel);
  ort = await import('https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/ort.min.mjs');
  ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/';
  ort.env.wasm.numThreads = 1;
  session = await ort.InferenceSession.create('/model/embedder.onnx', { executionProviders: ['wasm'] });
  return session;
}

/** pcm: Float32Array @16 kHz. Returns an array of embeddings (one per 3 s window, hop = `hop` seconds). */
export async function embed(pcm, hop = 1.5, maxWindows = 14) {
  const s = await loadModel();
  const wins = [];
  for (let st = 0; st + CLIP <= pcm.length; st += Math.round(hop * SR)) wins.push(pcm.subarray(st, st + CLIP));
  if (!wins.length && pcm.length > SR) { const z = new Float32Array(CLIP); z.set(pcm.subarray(0, Math.min(pcm.length, CLIP))); wins.push(z); }
  // keep the loudest windows (skip silence), at most maxWindows
  const rms = (w) => { let a = 0; for (let i = 0; i < w.length; i += 16) a += w[i] * w[i]; return a; };
  const use = wins.map((w) => [rms(w), w]).sort((a, b) => b[0] - a[0]).slice(0, maxWindows).filter(([r]) => r > 1e-6).map(([, w]) => w);
  if (!use.length) return [];
  const T = Math.floor((CLIP - WIN) / HOP) + 1, feats = new Float32Array(use.length * NMEL * T);
  use.forEach((w, i) => feats.set(logmel(w), i * NMEL * T));
  const res = await s.run({ mel: new ort.Tensor('float32', feats, [use.length, 1, NMEL, T]) });
  const e = res.emb.data, d = e.length / use.length;
  return Array.from({ length: use.length }, (_, i) => Array.from(e.subarray(i * d, (i + 1) * d)));
}
