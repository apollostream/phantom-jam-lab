// Minimum absorber fraction φ = N_A/N that keeps the ring smooth after a 50% brake
// tap, as a function of the delay number R, at the default load Λ = 1.05.
// Writes analysis/results/absorbers.json.  Run: node analysis/absorber-sweep.mjs
import { writeFileSync } from 'node:fs';
import { experiment, isSmooth, lengthFor, BASE } from './lib.mjs';

const lambda = 1.05, length = lengthFor(lambda, BASE);
const counts = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30];
const out = [];
for (const absorbT of [2.6, 4.5]) for (const R of [0.8, 0.9, 1.0, 1.1, 1.2, 1.4]) {
  const runs = counts.map(n => {
    const r = experiment({ length, reaction: R, absorbers: n, absorbT }, { tap: 0.5, total: 400 });
    return { n, smooth: isSmooth(r), piV: +r.piV.toFixed(3), kmh: +r.meanKmh.toFixed(1) };
  });
  // smallest count from which every larger count is also smooth
  let min = null;
  for (let k = runs.length - 1; k >= 0 && runs[k].smooth; k--) min = runs[k].n;
  const row = { absorbT, R, minAbsorbers: min, phiMin: min === null ? null : +(min / BASE.cars).toFixed(3), runs };
  out.push(row);
  console.log(`T_A/T=${absorbT} R=${R} min N_A=${min}  ` + runs.map(r => `${r.n}:${r.smooth ? 'ok' : 'jam'}@${r.kmh}`).join(' '));
}
writeFileSync(new URL('./results/absorbers.json', import.meta.url), JSON.stringify({ lambda, out }, null, 1));
