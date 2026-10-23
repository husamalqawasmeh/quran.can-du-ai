"""Export the trained embedder to ONNX, fit a calibration temperature, and write everything the site needs:
   public/model/embedder.onnx, public/model/mel.json, model_seed.sql (class weights + temperature for D1)."""
import sys, json, glob, os, numpy as np, torch
sys.path.insert(0, 'ml')
from common import *
import train as T

ck = torch.load('ml/ckpt.pt', map_location='cpu', weights_only=False)
rids = ck['rids']
model, head = Embedder(), CosHead(len(rids))
model.load_state_dict(ck['model']); head.load_state_dict(ck['head']); model.eval(); head.eval()

os.makedirs('public/model', exist_ok=True)
dummy = torch.randn(2, 1, NMEL, 298)
torch.onnx.export(model, dummy, 'public/model/embedder.onnx', input_names=['mel'], output_names=['emb'],
                  dynamic_axes={'mel': {0: 'n'}, 'emb': {0: 'n'}}, opset_version=17, dynamo=False)
json.dump(np.round(mel_matrix(), 6).tolist(), open('public/model/mel.json', 'w'))
print('onnx bytes', os.path.getsize('public/model/embedder.onnx'))

# parity check: onnxruntime vs torch
import onnxruntime as ort
s = ort.InferenceSession('public/model/embedder.onnx')
x = logmel(torch.randn(3, CLIP) * .1)
a = model(x).detach().numpy(); b = s.run(None, {'mel': x.numpy()})[0]
print('onnx vs torch max diff', float(np.abs(a - b).max()))

# ---- calibration: fit a temperature so that "confidence" means what it says (20 s clips of the noisy held-out set)
files = T.index()[1]
rng = np.random.default_rng(5)
lg_all, y_all = [], []
with torch.no_grad():
    for mode in ('clean', 'opus', 'noisy'):
        for ci, lg in T.eval_windows(model, head, rids, files, T.TEST_SURAHS, mode, n_per_class=48, seed=7):
            ls = torch.log_softmax(torch.from_numpy(lg), 1).numpy()
            for i in range(0, len(lg) - 6 + 1, 6):
                lg_all.append(lg[i:i + 6]); y_all.append(ci)
L = torch.from_numpy(np.stack(lg_all)); Y = torch.tensor(y_all)          # (N, 6, C)
best = (1e9, 1.0)
for temp in np.arange(0.5, 6.01, 0.25):
    p = torch.log_softmax(L / temp, 2).mean(1)                             # average log-prob over the 6 windows
    nll = torch.nn.functional.cross_entropy(p, Y).item()
    if nll < best[0]: best = (nll, float(temp))
temp = best[1]
pr = torch.softmax(torch.log_softmax(L / temp, 2).mean(1), 1)
conf, pred = pr.max(1)
ok = (pred == Y)
print('temperature', temp, '| clip acc', ok.float().mean().item())
for th in (.5, .6, .7, .8, .9):
    m = conf >= th
    print(f'  conf>={th}: answers {int(m.sum())}/{len(m)}  precision {ok[m].float().mean().item() if m.any() else float("nan"):.3f}')

w = torch.nn.functional.normalize(head.w.detach(), dim=1).numpy()
sql = "DELETE FROM model_meta;\n"
classes = list(rids)
sql += "INSERT INTO model_meta(k,v) VALUES('classes','%s');\n" % json.dumps(classes)
for c, row in zip(classes, np.round(w, 5).tolist()):     # one row per reader: D1 limits a statement to ~100 KB
    sql += "INSERT INTO model_meta(k,v) VALUES('w:%s','%s');\n" % (c, json.dumps(row))
sql += "INSERT INTO model_meta(k,v) VALUES('scale','%s');\n" % head.scale
sql += "INSERT INTO model_meta(k,v) VALUES('temperature','%s');\n" % temp
open('model_seed.sql', 'w').write(sql)
print('wrote model_seed.sql', len(sql) // 1000, 'KB; classes', len(rids))
