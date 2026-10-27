// Sweep the vehicle groups that the app now exposes, one at a time, at load Λ = 1.05:
//   S = v0/(aT)   acceleration number (vary a)
//   β = b/a       braking ratio (vary b)
//   ℓ/s0          car length over jam gap (vary both, keeping ℓ + s0 = 6.5 m)
// For each, the critical delay number R_c from linear theory and from the simulator
// after a tiny disturbance and after a 50% brake tap.
// Writes analysis/results/pi-sweep.json.  Run: node analysis/pi-sweep.mjs
import { writeFileSync } from 'node:fs';
import { experiment, lengthFor, vehicle, BASE } from './lib.mjs';
import { criticalR } from './linear-stability.mjs';

const lambda = 1.05, v0 = BASE.speedLimit / 3.6, T = BASE.tailT;
const Rs = [];
for (let r = 0.3; r <= 2.0001; r += 0.025) Rs.push(+r.toFixed(3));
const simRc = (cfg, tap) => Rs.find(R => experiment({ ...cfg, reaction: R }, { tap, total: 400, window: 100 }).piV >= 0.1) ?? null;

const sweeps = [
  { group: 'S', label: 'S = v0/(aT)', points: [0.6, 0.9, 1.2, 1.8, 2.4].map(a => ({ accel: a })), value: c => v0 / (c.accel * T) },
  { group: 'β', label: 'β = b/a', points: [1.2, 2, 3, 4.5].map(b => ({ decel: b })), value: c => c.decel / 1.2 },
  { group: 'ℓ/s0', label: 'ℓ/s0', points: [[5.5, 1], [4.5, 2], [3.5, 3], [2.5, 4]].map(([carLen, jamGap]) => ({ carLen, jamGap })), value: c => c.carLen / c.jamGap },
];
const out = [];
for (const sw of sweeps) for (const p of sw.points) {
  const cfg = { ...BASE, absorbT: 3.0, accel: 1.2, decel: 2.0, carLen: 4.5, jamGap: 2, ...p };
  cfg.length = lengthFor(lambda, cfg);
  const { a, b, s0, ell } = vehicle(cfg);
  const row = {
    group: sw.group, value: +sw.value(cfg).toFixed(3), ...p,
    theory: +criticalR(lambda, { a, b, s0, ell }).toFixed(3),
    tiny: simRc(cfg, 0), tap50: simRc(cfg, 0.5),
  };
  out.push(row);
  console.log(`${sw.label.padEnd(12)} ${String(row.value).padEnd(6)} theory ${row.theory}  sim tiny ${row.tiny}  sim 50% tap ${row.tap50}`);
}
writeFileSync(new URL('./results/pi-sweep.json', import.meta.url), JSON.stringify({ lambda, out }, null, 1));
