"""Train the reciter embedder with on-the-fly room / microphone / noise / codec augmentation.
usage: python ml/train.py [steps] [batch]"""
import os, sys, glob, json, time, math, random, numpy as np, torch
from scipy import signal
from common import *

STEPS = int(sys.argv[1]) if len(sys.argv) > 1 else 6000
BATCH = int(sys.argv[2]) if len(sys.argv) > 2 else 96
TRAIN_SURAHS = set(range(67, 79)); TEST_SURAHS = set(range(79, 83))
torch.set_num_threads(10)


def index():
    files = {}
    for f in sorted(glob.glob('data/clean/r*_*.npy')):
        rid, mi, s = os.path.basename(f)[:-4].split('_')
        files.setdefault(rid, []).append((int(s), f))
    rids = sorted(files, key=lambda r: int(r[1:]))
    return rids, files


# ---------------- augmentation (numpy, per 3 s crop) ----------------
_sos = {}
def lowpass(x, fc, order=2):
    k = ('lp', int(fc))
    if k not in _sos: _sos[k] = signal.butter(order, fc / (SR / 2), 'low', output='sos')
    return signal.sosfilt(_sos[k], x)
def highpass(x, fc):
    k = ('hp', int(fc))
    if k not in _sos: _sos[k] = signal.butter(2, fc / (SR / 2), 'high', output='sos')
    return signal.sosfilt(_sos[k], x)

def channel(x, rng):
    """Simulate speaker -> room -> microphone -> browser: EQ, reverb, noise, hum, clipping, gain."""
    x = x.astype(np.float32)
    if rng.random() < .8:
        x = lowpass(x, rng.uniform(3500, 7600))
        if rng.random() < .6: x = highpass(x, rng.uniform(60, 350))
    if rng.random() < .6:                                    # reverb
        t = np.arange(int(SR * rng.uniform(.15, .6))) / SR
        ir = rng.standard_normal(len(t)) * np.exp(-t / rng.uniform(.04, .35)); ir[0] = 1.0
        ir *= rng.uniform(.05, .5) if rng.random() < .8 else 1.0
        ir[0] = 1.0
        x = signal.fftconvolve(x, ir.astype(np.float32))[:len(x)]
    rms = np.sqrt(np.mean(x ** 2)) + 1e-8
    if rng.random() < .85:                                   # additive noise, SNR 3..30 dB
        n = rng.standard_normal(len(x)).astype(np.float32)
        if rng.random() < .6: n = lowpass(n, rng.uniform(500, 6000), 1)
        x = x + n * rms / (10 ** (rng.uniform(3, 30) / 20)) / (np.sqrt(np.mean(n ** 2)) + 1e-8)
    if rng.random() < .2:
        x = x + .01 * rms * np.sin(2 * np.pi * rng.choice([50, 60]) * np.arange(len(x)) / SR).astype(np.float32)
    x = x * (10 ** (rng.uniform(-20, 6) / 20))
    if rng.random() < .1: x = np.clip(x * rng.uniform(2, 8), -1, 1)
    return x


class Stream(torch.utils.data.IterableDataset):
    def __init__(self, rids, files, seed, aug=True):
        self.rids, self.files, self.seed, self.aug = rids, files, seed, aug

    def __iter__(self):
        wi = torch.utils.data.get_worker_info()
        rng = np.random.default_rng(self.seed + (wi.id if wi else 0))
        while True:
            c = int(rng.integers(len(self.rids)))
            s, f = self.files[self.rids[c]][int(rng.integers(len(self.files[self.rids[c]])))]
            if rng.random() < .35 and os.path.exists(f.replace('clean', 'opus')): f = f.replace('clean', 'opus')
            a = np.load(f, mmap_mode='r')
            if len(a) <= CLIP: continue
            st = int(rng.integers(len(a) - CLIP)); x = np.asarray(a[st:st + CLIP], dtype=np.float32)
            if self.aug and rng.random() < .85: x = channel(x, rng)
            x = np.clip(x, -1, 1)
            yield torch.from_numpy(x.astype(np.float32)), c


def specaug(m):
    for i in range(m.shape[0]):
        if random.random() < .5:
            w = random.randint(0, 6); f0 = random.randint(0, NMEL - w); m[i, :, f0:f0 + w, :] = 0
        if random.random() < .5:
            w = random.randint(0, 30); t0 = random.randint(0, m.shape[3] - w); m[i, :, :, t0:t0 + w] = 0
    return m


def eval_windows(model, head, rids, files, split, mode, n_per_class=60, seed=1):
    """held-out surahs; mode: clean | opus | noisy. Returns per-window and per-20s-clip accuracy (+ logits for calibration)."""
    rng = np.random.default_rng(seed)
    model.eval(); res = []
    with torch.no_grad():
        for ci, r in enumerate(rids):
            cand = [f for s, f in files[r] if s in split]
            if not cand: continue
            wins = []
            for f in cand:
                f2 = f.replace('clean', 'opus') if mode == 'opus' and os.path.exists(f.replace('clean', 'opus')) else f
                a = np.asarray(np.load(f2, mmap_mode='r'), dtype=np.float32)
                for st in range(0, len(a) - CLIP, CLIP): wins.append((f, a[st:st + CLIP]))
            if len(wins) > n_per_class: idx = rng.choice(len(wins), n_per_class, replace=False); wins = [wins[i] for i in sorted(idx)]
            x = np.stack([channel(w, rng) if mode == 'noisy' else w for _, w in wins]); x = np.clip(x, -1, 1)
            lg = head.logits(model(logmel(torch.from_numpy(x.astype(np.float32))))).numpy()
            res.append((ci, lg))
    return res


def score(res, clip=6):
    w_ok = w_n = c_ok = c_n = 0
    for ci, lg in res:
        w_ok += (lg.argmax(1) == ci).sum(); w_n += len(lg)
        ls = lg - np.log(np.exp(lg - lg.max(1, keepdims=True)).sum(1, keepdims=True)) - lg.max(1, keepdims=True)
        for i in range(0, len(lg) - clip + 1, clip):
            c_n += 1; c_ok += int(ls[i:i + clip].mean(0).argmax() == ci)
    return w_ok / max(w_n, 1), c_ok / max(c_n, 1)


if __name__ == '__main__':
    rids, files = index()
    tr = {r: [(s, f) for s, f in files[r] if s in TRAIN_SURAHS] for r in rids}
    rids = [r for r in rids if len(tr[r]) >= 4]
    print(len(rids), 'reciters; train files', sum(len(v) for v in tr.values()), flush=True)
    model, head = Embedder(), CosHead(len(rids))
    opt = torch.optim.AdamW(list(model.parameters()) + list(head.parameters()), lr=2e-3, weight_decay=2e-4)
    dl = torch.utils.data.DataLoader(Stream(rids, tr, 1234), batch_size=BATCH, num_workers=6, prefetch_factor=4)
    it = iter(dl); t0 = time.time(); best = 0
    for step in range(1, STEPS + 1):
        model.train()
        lr = 2e-3 * min(1, step / 300) * (0.5 * (1 + math.cos(math.pi * step / STEPS)) * .98 + .02)
        for g in opt.param_groups: g['lr'] = lr
        x, y = next(it)
        m = specaug(logmel(x))
        loss = head(model(m), y, margin=0.25 * min(1, step / (STEPS * .3)))
        opt.zero_grad(); loss.backward(); torch.nn.utils.clip_grad_norm_(model.parameters(), 5); opt.step()
        if step % 50 == 0: print(f'step {step} loss {loss.item():.3f} lr {lr:.5f} {(time.time() - t0) / step:.2f}s/step', flush=True)
        if step % 500 == 0:
            torch.save({'model': model.state_dict(), 'head': head.state_dict(), 'rids': rids, 'step': step, 'eval': None}, 'ml/ckpt.pt')
        if step % 1000 == 0 or step == STEPS:
            out = {}
            for mode in ('clean', 'opus', 'noisy'):
                w, c = score(eval_windows(model, head, rids, files, TEST_SURAHS, mode)); out[mode] = (round(100 * w, 1), round(100 * c, 1))
            print('EVAL window%/clip20s% ->', out, flush=True)
            torch.save({'model': model.state_dict(), 'head': head.state_dict(), 'rids': rids, 'step': step, 'eval': out}, 'ml/ckpt.pt')
    print('done', (time.time() - t0) / 60, 'min')
