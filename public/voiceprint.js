// Shared voiceprint extractor (browser + Node). Input: Float32 mono PCM at 16 kHz.
// Output: fixed-length vector of MFCC + delta statistics (mean/std) per segment.
export const SR = 16000;
const FRAME = 400, HOP = 160, NFFT = 512, NMEL = 40, NMFCC = 20;
export const DIM = NMFCC * 2 + NMFCC; // mean, std of MFCC + std of delta

const hz2mel = (f) => 2595 * Math.log10(1 + f / 700);
const mel2hz = (m) => 700 * (10 ** (m / 2595) - 1);

const win = new Float32Array(FRAME).map((_, i) => 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (FRAME - 1)));

const melBank = (() => {
  const bins = NFFT / 2 + 1;
  const pts = [];
  const lo = hz2mel(60), hi = hz2mel(SR / 2);
  for (let i = 0; i < NMEL + 2; i++) pts.push(Math.floor(((NFFT + 1) * mel2hz(lo + ((hi - lo) * i) / (NMEL + 1))) / SR));
  const bank = [];
  for (let m = 1; m <= NMEL; m++) {
    const f = new Float32Array(bins);
    for (let k = pts[m - 1]; k < pts[m]; k++) f[k] = (k - pts[m - 1]) / Math.max(1, pts[m] - pts[m - 1]);
    for (let k = pts[m]; k < pts[m + 1]; k++) f[k] = (pts[m + 1] - k) / Math.max(1, pts[m + 1] - pts[m]);
    bank.push(f);
  }
  return bank;
})();

const dct = Array.from({ length: NMFCC }, (_, n) =>
  Float32Array.from({ length: NMEL }, (_, m) => Math.cos((Math.PI * n * (m + 0.5)) / NMEL)));

const cosT = new Float32Array(NFFT / 2), sinT = new Float32Array(NFFT / 2);
for (let i = 0; i < NFFT / 2; i++) { cosT[i] = Math.cos((2 * Math.PI * i) / NFFT); sinT[i] = -Math.sin((2 * Math.PI * i) / NFFT); }

function fftPower(re) {
  const n = NFFT, im = new Float32Array(n);
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { const t = re[i]; re[i] = re[j]; re[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const step = n / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = cosT[k * step], wi = sinT[k * step];
        const a = i + k, b = a + len / 2;
        const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
      }
    }
  }
  const p = new Float32Array(n / 2 + 1);
  for (let i = 0; i <= n / 2; i++) p[i] = re[i] * re[i] + im[i] * im[i];
  return p;
}

function mfccFrames(pcm) {
  const out = [];
  const buf = new Float32Array(NFFT);
  let energyMax = 0;
  const energies = [];
  for (let s = 0; s + FRAME <= pcm.length; s += HOP) {
    let e = 0;
    for (let i = 0; i < FRAME; i++) { const v = pcm[s + i]; e += v * v; }
    energies.push(e); if (e > energyMax) energyMax = e;
  }
  let fi = 0;
  for (let s = 0; s + FRAME <= pcm.length; s += HOP, fi++) {
    if (energies[fi] < energyMax * 1e-3) continue; // drop silence
    buf.fill(0);
    for (let i = 0; i < FRAME; i++) buf[i] = (pcm[s + i] - (i ? pcm[s + i - 1] * 0.97 : 0)) * win[i];
    const p = fftPower(buf);
    const mel = new Float32Array(NMEL);
    for (let m = 0; m < NMEL; m++) { let a = 0; const f = melBank[m]; for (let k = 0; k < f.length; k++) a += f[k] * p[k]; mel[m] = Math.log(a + 1e-10); }
    const c = new Float32Array(NMFCC);
    for (let n = 0; n < NMFCC; n++) { let a = 0; for (let m = 0; m < NMEL; m++) a += dct[n][m] * mel[m]; c[n] = a; }
    out.push(c);
  }
  return out;
}

/** Voiceprint vector for one audio segment, or null if too little speech. */
export function voiceprint(pcm) {
  const fr = mfccFrames(pcm);
  if (fr.length < 100) return null;
  // cepstral mean normalisation removes channel/microphone coloration
  const mean = new Float32Array(NMFCC);
  for (const f of fr) for (let i = 0; i < NMFCC; i++) mean[i] += f[i] / fr.length;
  const v = new Float32Array(DIM);
  const dsq = new Float32Array(NMFCC);
  for (let t = 0; t < fr.length; t++) {
    for (let i = 0; i < NMFCC; i++) {
      const x = fr[t][i] - mean[i];
      v[NMFCC + i] += (x * x) / fr.length;
      if (t > 1 && t < fr.length - 2) { const d = fr[t + 2][i] - fr[t - 2][i]; dsq[i] += (d * d) / fr.length; }
    }
  }
  // after CMN the mean is zero, so keep the raw (channel-dependent) mean only for coarse timbre, down-weighted
  for (let i = 0; i < NMFCC; i++) { v[i] = mean[i] * 0.5; v[NMFCC + i] = Math.sqrt(v[NMFCC + i]); v[2 * NMFCC + i] = Math.sqrt(dsq[i]); }
  return Array.from(v);
}

/** Split PCM into ~seg-second windows and return their voiceprints. */
export function voiceprints(pcm, seg = 6) {
  const n = seg * SR, out = [];
  for (let s = 0; s + n <= pcm.length; s += n) { const v = voiceprint(pcm.subarray(s, s + n)); if (v) out.push(v); }
  if (!out.length) { const v = voiceprint(pcm); if (v) out.push(v); }
  return out;
}
