// Regime map in the (Λ, R) plane from the simulator, for three disturbance sizes,
// plus the linear-theory boundary. Writes analysis/results/regime.json.
// Run: node analysis/regime-sweep.mjs
import { writeFileSync } from 'node:fs';
import { experiment, isSmooth, lengthFor, BASE } from './lib.mjs';
import { criticalR } from './linear-stability.mjs';


const lambdas = [], Rs = [];
for (let x = 0.5; x <= 1.601; x += 0.1) lambdas.push(+x.toFixed(2));
for (let r = 0.2; r <= 1.801; r += 0.05) Rs.push(+r.toFixed(2));
const taps = [{ key: 'tiny', tap: 0 }, { key: 'dip15', tap: 0.85 }, { key: 'dip50', tap: 0.5 }];

const grid = [];
const boundary = lambdas.map(lambda => ({ lambda, theory: +criticalR(lambda).toFixed(3) }));
for (const { key, tap } of taps) {
  lambdas.forEach((lambda, li) => {
    let first = null;
    for (const R of Rs) {
      const r = experiment({ length: lengthFor(lambda, BASE), reaction: R }, { tap, total: 400 });
      grid.push({ tap: key, lambda, R, piV: +r.piV.toFixed(4), kmh: +r.meanKmh.toFixed(1), brakes: +r.brakesPerCarMin.toFixed(2), smooth: isSmooth(r) });
      if (first === null && !isSmooth(r)) first = R;
    }
    boundary[li][key] = first;
    process.stdout.write(`${key} Λ=${lambda} R_c=${first}\n`);
  });
}
writeFileSync(new URL('./results/regime.json', import.meta.url), JSON.stringify({ boundary, grid }, null, 1));
console.table(boundary);
