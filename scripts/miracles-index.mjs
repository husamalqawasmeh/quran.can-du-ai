// Extracts the titles + verse keys of the miracles already on the page, so the weekly agent never proposes duplicates.
import { readFileSync, writeFileSync } from 'node:fs';
const h = readFileSync('public/index.html', 'utf8');
const items = [...h.matchAll(/\{ g: (\d), t: '([^']+)'[\s\S]*?keys: \[([^\]]*)\] \}/g)].map((m) => ({ g: +m[1], t: m[2], keys: [...m[3].matchAll(/'(\d+:\d+)'/g)].map((k) => k[1]) }));
writeFileSync('src/miracles_index.json', JSON.stringify(items));
console.log(items.length, 'items indexed;', new Set(items.flatMap((i) => i.keys)).size, 'distinct verses');
