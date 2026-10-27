// Similarity test (Szirtes ch. 17): two physically different roads whose
// dimensionless groups all match should give the same dependent group Π_v = σ_v/v0
// and the same regime boundary R_c.
//   A          the app's car highway (SI defaults)
//   B-model    a truck road: every length x LS and every time x TS, including the brake
//              tap and the engine's hidden reflex constants and time step (cfg.unitL,
//              cfg.unitT). Complete similarity: checks the engine holds no stray constant.
//   B-tap      the truck road with the brake tap scaled as well, but reflexes at their
//              real values in m/s^2, m and s. Tests whether the reflexes matter.
//   B-real     the truck road with the same tap as the cars (4.5 m/s^2 for up to 4 s).
//   C          B-tap with the cars' a and b: only S and β differ (the control).
// Writes analysis/results/similarity.json.  Run: node analysis/similarity.mjs
import { writeFileSync } from 'node:fs';
import { experiment, lengthFor, loadNumber, BASE } from './lib.mjs';

// The car highway, written out in full so every dimensional input is visible.
const roadA = {
  ...BASE, absorbT: 3.0, speedLimit: 90, tailT: 1.0, accel: 1.2, decel: 2.0, carLen: 4.5, jamGap: 2,
  absorbWindow: 8, noiseMemory: 2, tapDecel: 4.5, tapHold: 4,
};
// The same road with lengths x ls and times x ts. `hidden` also scales the reflexes.
function scaled(cfg, ls, ts, { tap = true, hidden = false } = {}) {
  const vs = ls / ts, as = ls / ts ** 2;
  return {
    ...cfg,
    speedLimit: cfg.speedLimit * vs, tailT: cfg.tailT * ts, reaction: cfg.reaction * ts,
    absorbT: cfg.absorbT * ts, absorbWindow: cfg.absorbWindow * ts, noiseMemory: cfg.noiseMemory * ts,
    accel: cfg.accel * as, decel: cfg.decel * as, carLen: cfg.carLen * ls, jamGap: cfg.jamGap * ls,
    length: cfg.length * ls, distraction: cfg.distraction * ls / ts ** 2.5,
    ...(tap ? { tapDecel: cfg.tapDecel * as, tapHold: cfg.tapHold * ts } : {}),
    ...(hidden ? { unitL: ls, unitT: ts } : {}),
  };
}
const LS = 4 / 3, TS = 1.5;
const ROADS = {
  A: { make: c => c, ts: 1 },
  'B-model': { make: c => scaled(c, LS, TS, { hidden: true }), ts: TS },
  'B-tap': { make: c => scaled(c, LS, TS), ts: TS },
  'B-real': { make: c => scaled(c, LS, TS, { tap: false }), ts: TS },
  C: { make: c => ({ ...scaled(c, LS, TS), accel: c.accel, decel: c.decel }), ts: TS },
};
const withLambda = (cfg, lambda) => ({ ...cfg, length: lengthFor(lambda, cfg) });
const run = (cfg, tap, ts, total = 400) => {
  const r = experiment(cfg, { tap, settle: 10 * ts, total: total * ts, window: 100 * ts });
  return { piV: r.piV, vBar: r.meanOverV0 };
};

// 1. Exactness. With lengths x2 and times x4 every floating-point operation in the
// engine scales exactly, so complete similarity must reproduce A bit for bit.
const exact = [];
for (const [name, extra, tap] of [
  ['jam after hard tap', { reaction: 1.0 }, 0.5],
  ['5 ample drivers', { reaction: 1.0, absorbers: 5 }, 0.5],
  ['distraction 0.5', { reaction: 0.8, distraction: 0.5 }, 0],
  ['rush hour mix', { reaction: 1.0, absorbers: 6, placement: 'random', distraction: 0.3, autoTaps: true, autoTapEvery: 12 }, 0],
]) {
  const a = withLambda({ ...roadA, ...extra }, 1.05);
  const m = scaled(a, 2, 4, { hidden: true });
  if (m.autoTaps) m.autoTapEvery = a.autoTapEvery * 4;
  const ra = run(a, tap, 1), rm = run(m, tap, 4);
  exact.push({ name, A: ra.piV, model: rm.piV, identical: ra.piV === rm.piV && ra.vBar === rm.vBar });
  console.log(`exact x2/x4  ${name.padEnd(20)} A ${ra.piV.toFixed(6)}  model ${rm.piV.toFixed(6)}  ${ra.piV === rm.piV ? 'bit-identical' : 'DIFFERENT'}`);
}

// 2. Regime boundary: smallest R that leaves stop-and-go, for each road.
const Rs = [];
for (let r = 0.3; r <= 2.0001; r += 0.025) Rs.push(+r.toFixed(3));
const taps = [{ key: 'tiny', tap: 0 }, { key: '15% tap', tap: 0.85 }, { key: '50% tap', tap: 0.5 }];
const boundary = [];
for (const lambda of [0.9, 1.05, 1.2]) for (const { key, tap } of taps) {
  const row = { lambda, tap: key };
  for (const [road, { make, ts }] of Object.entries(ROADS)) {
    const cfg = withLambda(make(roadA), lambda);
    row[road] = Rs.find(R => run(withLambda(make({ ...roadA, reaction: R }), lambda), tap, ts).piV >= 0.1) ?? null;
    row.lambdaCheck = loadNumber(cfg);
  }
  boundary.push(row);
  console.log(`R_c  Λ ${lambda}  ${key.padEnd(8)} ` + Object.keys(ROADS).map(k => `${k} ${row[k]}`).join('   '));
}

// 3. Statistics of the outcome in a few states.
const cases = [
  { name: 'smooth', cfg: { reaction: 0.6 }, tap: 0.5 },
  { name: 'jam after hard tap', cfg: { reaction: 1.0 }, tap: 0.5 },
  { name: 'unstable', cfg: { reaction: 1.3 }, tap: 0.85 },
  { name: '5 ample drivers', cfg: { reaction: 1.0, absorbers: 5 }, tap: 0.5 },
  { name: 'distraction 0.25', cfg: { reaction: 0.8, distraction: 0.25 }, tap: 0 },
];
const stats = cases.map(c => {
  const row = { name: c.name };
  for (const [road, { make, ts }] of Object.entries(ROADS)) row[road] = run(withLambda(make({ ...roadA, ...c.cfg }), 1.05), c.tap, ts);
  console.log(`Π_v  ${c.name.padEnd(20)} ` + Object.keys(ROADS).map(k => `${k} ${row[k].piV.toFixed(3)}/${row[k].vBar.toFixed(2)}`).join('  '));
  return row;
});

const vs = LS / TS, as = LS / TS ** 2;
const roads = {
  A: { v0Kmh: 90, T: 1, a: 1.2, b: 2, ell: 4.5, s0: 2, L: lengthFor(1.05, roadA) },
  B: { v0Kmh: 90 * vs, T: TS, a: 1.2 * as, b: 2 * as, ell: 4.5 * LS, s0: 2 * LS, L: lengthFor(1.05, roadA) * LS },
};
writeFileSync(new URL('./results/similarity.json', import.meta.url), JSON.stringify({ LS, TS, roads, exact, boundary, stats }, null, 1));
