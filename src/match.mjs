// kNN voice matching over standardised voiceprints. db: [{id, v}], q: vector.
export function classify(q, db, k = 7) {
  const d = db.map((r) => {
    let s = 0;
    for (let i = 0; i < q.length; i++) { const t = q[i] - r.v[i]; s += t * t; }
    return { id: r.id, d: Math.sqrt(s) };
  }).sort((a, b) => a.d - b.d).slice(0, k);
  const score = {};
  for (const n of d) score[n.id] = (score[n.id] || 0) + 1 / (n.d + 1e-6);
  const tot = Object.values(score).reduce((a, b) => a + b, 0);
  return Object.entries(score).map(([id, s]) => ({ id, p: s / tot })).sort((a, b) => b.p - a.p);
}
