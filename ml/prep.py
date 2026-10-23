"""Decode every sample to 16 kHz mono float16 .npy; also an opus-32k round-trip copy (what MediaRecorder produces)."""
import subprocess, sys, os, glob, numpy as np, tempfile
from concurrent.futures import ProcessPoolExecutor

def decode(src, extra=None):
    cmd = ['ffmpeg', '-v', 'error', '-i', src, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-']
    raw = subprocess.run(cmd, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32)

def opus_roundtrip(src, kbps=32):
    with tempfile.TemporaryDirectory() as d:
        o = os.path.join(d, 'x.ogg')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-ac', '1', '-ar', '48000', '-c:a', 'libopus', '-b:a', f'{kbps}k', o], capture_output=True)
        return decode(o)

def job(args):
    src, name, opus = args
    try:
        a = decode(src)
        if len(a) < 16000 * 5: return (name, 0)
        np.save(f'data/clean/{name}.npy', a.astype(np.float16))
        if opus:
            b = opus_roundtrip(src, 32)
            if len(b) > 16000 * 5: np.save(f'data/opus/{name}.npy', b.astype(np.float16))
        return (name, len(a))
    except Exception as e:
        return (name, -1)

if __name__ == '__main__':
    jobs = []
    for f in glob.glob('samples3/r*/*.mp3'):
        rid = os.path.basename(os.path.dirname(f)); mi, s = os.path.basename(f)[:-4].split('_')
        jobs.append((f, f'{rid}_{mi}_{s}', True))
    print(len(jobs), 'files')
    with ProcessPoolExecutor(12) as ex:
        res = list(ex.map(job, jobs, chunksize=8))
    ok = [r for r in res if r[1] > 0]
    print('decoded', len(ok), 'bad', len(res) - len(ok), 'hours', sum(r[1] for r in ok) / 16000 / 3600)
