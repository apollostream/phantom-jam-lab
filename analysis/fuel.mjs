// Fuel efficiency (prototype): what the power-based fuel model says about each scene.
//   1. The model on its own: steady-cruise fuel per 100 km, the thriftiest speed, and the
//      extra fuel one acceleration from rest to 50 km/h costs.
//   2. Every scene as the app plays it, for both vehicles: fuel efficiency (100% = steady
//      flow at the same load) and litres per 100 km, for the scene's mix and for everyone
//      tailgating, with the saving between them.
//   3. How much of the shortfall is the tailgaters' random speed wobble (distraction off).
//   4. How much is the hard-acceleration term (b2 = 0).
//   Each run also reports stressful moments per km (firm brakes plus close calls).
//   Parts 2–4 run under both driver models for those who leave room: A (classic) and
//   B (three-state); results are keyed by model. Roads where everyone tailgates match.
// Writes analysis/results/fuel.json.  Run: node analysis/fuel.mjs
// docs/fuel-stress-and-variant-b.md explains the model and the parameter values.
import { writeFileSync } from 'node:fs';
import { Sim, VEHICLES, fuelRate, cruiseFuelPerM } from './lib.mjs';

// The app's base settings and scenes (src/app.html, BASE and SCENARIOS).
const APP = {
  cars: 30, length: 900, speedLimit: 90, seed: 7,
  absorbers: 0, placement: 'even', manual: null,
  tailT: 1.0, reaction: 1.0, distraction: 0,
  absorbT: 3.0, absorbWindow: 8,
  accel: 1.2, decel: 2.0, carLen: 4.5, jamGap: 2,
  autoTaps: false, autoTapEvery: 20,
};
const SCENES = [
  { key: 'tap', cfg: {}, tap: 0.5 },
  { key: 'one', cfg: { manual: { 29: true }, reaction: 0.8, length: 860 }, tap: 0.5 },
  { key: 'all', cfg: { absorbers: 30 }, tap: 0.5 },
  { key: 'ring', cfg: { cars: 22, length: 230, speedLimit: 40, distraction: 0.5, reaction: 1.0, tailT: 1.0 } },
  { key: 'rush', cfg: { cars: 150, length: 4000, speedLimit: 100, absorbers: 15, placement: 'random', distraction: 0.3, autoTaps: true, autoTapEvery: 12 } },
  { key: 'half', cfg: { cars: 60, length: 1600, speedLimit: 90, absorbers: 30, placement: 'even', autoTaps: true, autoTapEvery: 15, distraction: 0.2 } },
];
const SECONDS = 300;

const r1 = x => +x.toFixed(1), r2 = x => +x.toFixed(2);

// 1. The model alone.
const model = {};
for (const [key, veh] of Object.entries(VEHICLES)) {
  const cruise = {};
  for (const kmh of [30, 50, 60, 100]) cruise[kmh] = r2(cruiseFuelPerM(veh, kmh / 3.6) * 100);
  let best = 1;
  for (let kmh = 1; kmh <= 130; kmh++) if (cruiseFuelPerM(veh, kmh / 3.6) < cruiseFuelPerM(veh, best / 3.6)) best = kmh;
  // one start from rest to 50 km/h at the tailgaters' 1.2 m/s^2, against cruising the same distance
  let fuel = 0, x = 0, v = 0;
  const dt = 0.05, a = 1.2;
  while (v < 50 / 3.6) { fuel += fuelRate(veh, v + 0.5 * a * dt, a) * dt; x += v * dt + 0.5 * a * dt * dt; v += a * dt; }
  model[key] = {
    ...veh, cruiseL100: cruise, thriftiestKmh: best,
    startTo50ExtraML: r1(fuel - cruiseFuelPerM(veh, 50 / 3.6) * x),
    kmAt50ForOneStart: r2((fuel - cruiseFuelPerM(veh, 50 / 3.6) * x) / (cruiseFuelPerM(veh, 50 / 3.6) * 1000)),
  };
  console.log(`${veh.label}: ${Object.entries(cruise).map(([k, l]) => `${k} km/h ${l}`).join(', ')} L/100 km; thriftiest ${best} km/h; a start to 50 km/h costs ${model[key].startTo50ExtraML} mL extra (${model[key].kmAt50ForOneStart} km of cruising)`);
}

// 2–4. The scenes.
function play(scene, cfg) {
  const sim = new Sim({ ...APP, ...scene.cfg, ...cfg });
  const steps = Math.round(SECONDS / sim.dt);
  for (let k = 0; k < steps; k++) {
    if (scene.tap && Math.abs(sim.t - 4) < sim.dt / 2) sim.tapBrakes(0, 1 - scene.tap);
    sim.step();
  }
  const s = sim.snapshot();
  return { eff: r1(s.fuelEff), l100: r2(s.fuelL100), stressPerKm: r2(s.stressPerKm), meanKmh: r1(s.meanKmh), steadyKmh: r1(sim.equilibriumSpeed() * 3.6) };
}
VEHICLES.suvNoB2 = { ...VEHICLES.suv, label: 'Midsize SUV without the hard-acceleration term', b2: 0 };

const scenes = { A: [], B: [] };
for (const driverModel of ['A', 'B']) for (const scene of SCENES) {
  const row = { key: scene.key };
  for (const vehicle of ['suv', 'compact']) {
    const mix = play(scene, { vehicle, driverModel });
    const tailgaters = play(scene, { vehicle, absorbers: 0, manual: null });
    row[vehicle] = { mix, tailgaters, savingPct: r1((1 - mix.l100 / tailgaters.l100) * 100) };
  }
  row.noWobble = { mix: play(scene, { distraction: 0, driverModel }), tailgaters: play(scene, { distraction: 0, absorbers: 0, manual: null }) };
  row.noB2 = { mix: play(scene, { vehicle: 'suvNoB2', driverModel }), tailgaters: play(scene, { vehicle: 'suvNoB2', absorbers: 0, manual: null }) };
  scenes[driverModel].push(row);
  const s = row.suv, c = row.compact;
  console.log(`${driverModel} ${scene.key.padEnd(5)} SUV mix ${s.mix.eff}% (${s.mix.l100} L/100) vs tailgaters ${s.tailgaters.eff}% (${s.tailgaters.l100}), saving ${s.savingPct}%` +
    ` | compact ${c.mix.eff}% vs ${c.tailgaters.eff}%, saving ${c.savingPct}%` +
    ` | stress ${s.mix.stressPerKm} vs ${s.tailgaters.stressPerKm} per km` +
    ` | no wobble ${row.noWobble.mix.eff}% vs ${row.noWobble.tailgaters.eff}% | no b2 ${row.noB2.mix.eff}% vs ${row.noB2.tailgaters.eff}%`);
}
delete VEHICLES.suvNoB2;

writeFileSync(new URL('./results/fuel.json', import.meta.url), JSON.stringify({ seconds: SECONDS, model, scenes }, null, 1) + '\n');
console.log('wrote analysis/results/fuel.json');
