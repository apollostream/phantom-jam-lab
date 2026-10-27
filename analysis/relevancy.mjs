// Relevancy checks (Szirtes Ch. 11): does a group change the regime boundary?
// 1) ring size N at fixed Λ;  2) noise Π_n.  Writes analysis/results/relevancy.json.
// Run: node analysis/relevancy.mjs
import { writeFileSync } from 'node:fs';
import { experiment, isSmooth, lengthFor, BASE } from './lib.mjs';


function firstUnsmooth(cfg, opts, Rs) {
  for (const R of Rs) if (!isSmooth(experiment({ ...cfg, reaction: R }, opts))) return R;
  return null;
}
const Rs = []; for (let r = 0.2; r <= 1.801; r += 0.05) Rs.push(+r.toFixed(2));

const ringSize = [];
for (const lambda of [0.9, 1.05, 1.2, 1.5]) for (const cars of [30, 60, 120]) {
  const cfg = { cars, length: lengthFor(lambda, { ...BASE, cars }) };
  const row = { lambda, cars, tiny: firstUnsmooth(cfg, { tap: 0, total: 400 }, Rs), dip50: firstUnsmooth(cfg, { tap: 0.5, total: 400 }, Rs) };
  ringSize.push(row); console.log(row);
}
// noise: σ = 0.9·distraction (m·s^-2.5), θ = 2 s, T = 1 s, v0 = 25 m/s
const noise = [];
for (const distraction of [0, 0.25, 0.5, 1.0]) {
  const sigma = 0.9 * distraction, piN = sigma ** 2 * 4 * 1 / 625;
  const cfg = { length: lengthFor(1.05, BASE), distraction };
  const row = { distraction, piN: +piN.toExponential(2), tiny: firstUnsmooth(cfg, { tap: 0, total: 400 }, Rs) };
  noise.push(row); console.log(row);
}
writeFileSync(new URL('./results/relevancy.json', import.meta.url), JSON.stringify({ ringSize, noise }, null, 1));
