// Scene 2 ("One driver leaves room"): the knife-edge road where one ample-distance
// driver behind the tapper decides whether a hard tap becomes a jam.
//   1. The scene as the app plays it (Λ = 1.10, R = 0.80, tap to half speed at 4 s):
//      slowest speed per 30 s window over 5 minutes, with and without the one driver.
//   2. Ten random seeds at Λ = 1.05, R = 0.80: how often one driver turns a jam into
//      smooth flow, how often both rings stay smooth, how often both jam.
// Writes analysis/results/scene2.json.  Run: node analysis/scene2.mjs
import { writeFileSync } from 'node:fs';
import { Sim, BASE, experiment, isSmooth, loadNumber } from './lib.mjs';

const scene = { ...BASE, absorbT: 3.0, reaction: 0.8, length: 860 };
const ONE = { 29: true };   // the driver directly behind car 0, the tapper

// 1. The scene, in 30 s windows.
function play(manual) {
  const sim = new Sim({ ...scene, manual });
  const windows = [];
  let settledAt = null;
  for (let w = 0; w < 10; w++) {
    let minV = Infinity;
    for (let i = 0; i < 30 / sim.dt; i++) {
      if (Math.abs(sim.t - 4) < sim.dt / 2) sim.tapBrakes(0, 0.5);
      sim.step();
      for (const c of sim.cars) minV = Math.min(minV, c.v);
    }
    windows.push(+(minV * 3.6).toFixed(1));
  }
  // settled = the first window from which every later window's slowest car stays above 50 km/h
  for (let w = 0; w < windows.length; w++) if (windows.slice(w).every(v => v > 50)) { settledAt = (w + 1) * 30; break; }
  return { slowestPer30s: windows, settledBySeconds: settledAt, finalKmh: +(sim.meanSpeed() * 3.6).toFixed(1) };
}
const playback = { lambda: +loadNumber(scene).toFixed(3), R: scene.reaction / scene.tailT, none: play(null), one: play(ONE) };
console.log(`scene 2 at Λ ${playback.lambda}, R ${playback.R}`);
for (const k of ['none', 'one']) console.log(`  ${k.padEnd(4)} slowest per 30 s: ${playback[k].slowestPer30s.join(' ')}  settled by ${playback[k].settledBySeconds} s, final ${playback[k].finalKmh} km/h`);

// 2. Ten seeds on the default road with R = 0.8.
const tally = { rescued: 0, bothSmooth: 0, bothJam: 0, other: 0 }, seeds = [];
for (let seed = 1; seed <= 10; seed++) {
  const [none, one] = [null, ONE].map(manual =>
    isSmooth(experiment({ reaction: 0.8, absorbT: 3.0, manual, seed }, { settle: 4, tap: 0.5, total: 180, window: 60 })));
  const kind = !none && one ? 'rescued' : none && one ? 'bothSmooth' : !none && !one ? 'bothJam' : 'other';
  tally[kind]++; seeds.push({ seed, noneSmooth: none, oneSmooth: one });
}
console.log(`ten seeds at Λ 1.05, R 0.8: one driver rescued ${tally.rescued}, both smooth ${tally.bothSmooth}, both jammed ${tally.bothJam}, other ${tally.other}`);

writeFileSync(new URL('./results/scene2.json', import.meta.url), JSON.stringify({ playback, seeds: { lambda: 1.05, R: 0.8, tally, runs: seeds } }, null, 1));
