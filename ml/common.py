"""Shared feature extraction + model. The exact same feature maths is re-implemented in public/embed.js."""
import numpy as np, torch, torch.nn as nn, torch.nn.functional as F

SR = 16000
WIN, HOP, NFFT, NMEL = 400, 160, 512, 64
FMIN, FMAX = 60.0, 7600.0
CLIP = 48000            # 3 s analysis window
EMB = 192


def mel_matrix():
    """HTK triangular mel filterbank, shape (NMEL, NFFT//2+1)."""
    hz2mel = lambda f: 2595.0 * np.log10(1.0 + f / 700.0)
    mel2hz = lambda m: 700.0 * (10.0 ** (m / 2595.0) - 1.0)
    freqs = np.linspace(0, SR / 2, NFFT // 2 + 1)
    pts = mel2hz(np.linspace(hz2mel(FMIN), hz2mel(FMAX), NMEL + 2))
    m = np.zeros((NMEL, len(freqs)), dtype=np.float32)
    for i in range(NMEL):
        lo, c, hi = pts[i], pts[i + 1], pts[i + 2]
        up = (freqs - lo) / (c - lo)
        down = (hi - freqs) / (hi - c)
        m[i] = np.maximum(0, np.minimum(up, down))
    return m


_MEL = torch.from_numpy(mel_matrix())
_WIN = torch.hann_window(WIN, periodic=True)


def logmel(x):
    """x: (B, L) float32 waveform -> (B, 1, NMEL, T) log-mel with per-clip mean normalisation (removes channel colouring)."""
    fr = x.unfold(-1, WIN, HOP) * _WIN                       # (B, T, 400)
    fr = F.pad(fr, (0, NFFT - WIN))                          # zero-pad to 512
    p = torch.fft.rfft(fr, dim=-1).abs() ** 2                # (B, T, 257)
    m = torch.log(p @ _MEL.T + 1e-6)                         # (B, T, 64)
    m = m - m.mean(dim=1, keepdim=True)                      # CMN over time
    return m.transpose(1, 2).unsqueeze(1)                    # (B, 1, 64, T)


class Block(nn.Module):
    def __init__(s, cin, cout, stride):
        super().__init__()
        s.c1 = nn.Conv2d(cin, cout, 3, stride, 1, bias=False); s.b1 = nn.BatchNorm2d(cout)
        s.c2 = nn.Conv2d(cout, cout, 3, 1, 1, bias=False); s.b2 = nn.BatchNorm2d(cout)
        s.sc = None
        if stride != 1 or cin != cout:
            s.sc = nn.Sequential(nn.Conv2d(cin, cout, 1, stride, bias=False), nn.BatchNorm2d(cout))

    def forward(s, x):
        y = F.relu(s.b1(s.c1(x)))
        y = s.b2(s.c2(y))
        return F.relu(y + (x if s.sc is None else s.sc(x)))


class Embedder(nn.Module):
    """log-mel (B,1,64,T) -> L2-normalised EMB-d embedding."""
    def __init__(s, emb=EMB):
        super().__init__()
        s.stem = nn.Sequential(nn.Conv2d(1, 24, 3, 2, 1, bias=False), nn.BatchNorm2d(24), nn.ReLU())
        s.s1 = Block(24, 32, 1)
        s.s2 = Block(32, 64, 2)
        s.s3 = Block(64, 128, 2)
        s.fc = nn.Linear(128 * 8 * 2, emb)
        s.bn = nn.BatchNorm1d(emb)

    def forward(s, x):
        x = s.s3(s.s2(s.s1(s.stem(x))))                      # (B,128,8,T')
        b, c, f, t = x.shape
        x = x.reshape(b, c * f, t)
        mu = x.mean(-1)
        sd = torch.sqrt(torch.clamp((x * x).mean(-1) - mu * mu, min=0) + 1e-5)
        e = s.bn(s.fc(torch.cat([mu, sd], 1)))
        return F.normalize(e, dim=1)


class CosHead(nn.Module):
    """Additive-angular-margin softmax over class prototypes."""
    def __init__(s, n_cls, emb=EMB, scale=30.0):
        super().__init__()
        s.w = nn.Parameter(torch.randn(n_cls, emb) * 0.05)
        s.scale = scale

    def logits(s, e):
        return s.scale * e @ F.normalize(s.w, dim=1).T

    def forward(s, e, y, margin):
        cos = (e @ F.normalize(s.w, dim=1).T).clamp(-1 + 1e-6, 1 - 1e-6)
        th = torch.acos(cos)
        tgt = torch.cos(th + margin)
        oh = F.one_hot(y, cos.shape[1]).bool()
        return F.cross_entropy(s.scale * torch.where(oh, tgt, cos), y)
