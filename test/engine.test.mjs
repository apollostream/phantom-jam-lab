// Behavior tests for the traffic engine, run with: node --test test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/engine.js', import.meta.url), 'utf8');
const { Sim, VEHICLES, fuelRate, cruiseFuelPerM } = new Function(src + '\nreturn { Sim, VEHICLES, fuelRate, cruiseFuelPerM };')();

const base = {
  cars: 30, length: 900, speedLimit: 90, seed: 7,
  absorbers: 0, placement: 'even', manual: null,
  tailT: 1.0, reaction: 1.0, distraction: 0,
  absorbT: 2.6, absorbWindow: 8,
  autoTaps: false, autoTapEvery: 20,
};

function run(cfg, seconds, onStep) {
  const sim = new Sim({ ...base, ...cfg });
  const steps = Math.round(seconds / 0.05);
  for (let k = 0; k < steps; k++) { sim.step(); onStep?.(sim); }
  return sim;
}

// Tap the brakes once on car 0 after settling, then track the slowest speed
// reached by the car `back` positions behind it.
function tapResponse(cfg, back) {
  const sim = new Sim({ ...base, ...cfg });
  for (let k = 0; k < 200; k++) sim.step();
  sim.tapBrakes(0, 0.5);
  const target = (sim.n - back) % sim.n;
  let minV = Infinity;
  for (let k = 0; k < 600; k++) { sim.step(); minV = Math.min(minV, sim.cars[target].v); }
  return { minKmh: minV * 3.6, sim };
}

test('cars never overlap, even under a hard brake tap', () => {
  const { sim } = tapResponse({}, 10);
  assert.ok(sim.stats.nearMiss < 5, `near misses: ${sim.stats.nearMiss}`);
  for (let i = 0; i < sim.n; i++) assert.ok(sim.gapOf(i) >= 0.29);
});

test('steady traffic with no disturbance stays smooth', () => {
  const sim = run({}, 60);
  const s = sim.snapshot();
  assert.ok(s.sdKmh < 2, `speed spread ${s.sdKmh.toFixed(2)} km/h`);
});

test('tailgaters amplify a brake tap into a standstill further back', () => {
  const { minKmh } = tapResponse({}, 10);
  // car 0 drops to ~half speed; ten cars back, the wave has grown to a near stop
  assert.ok(minKmh < 15, `ten cars back slowest speed ${minKmh.toFixed(1)} km/h`);
});

test('when everyone leaves ample distance, the same tap fades out', () => {
  const { minKmh } = tapResponse({ absorbers: 30 }, 10);
  assert.ok(minKmh > 40, `ten cars back slowest speed ${minKmh.toFixed(1)} km/h`);
});

test('a single ample-distance driver protects the cars behind it', () => {
  // car 29 is the driver directly behind the tapper (car 0)
  const shielded = tapResponse({ manual: { 29: true } }, 10).minKmh;
  const exposed = tapResponse({}, 10).minKmh;
  assert.ok(shielded > exposed + 15, `shielded ${shielded.toFixed(1)} vs exposed ${exposed.toFixed(1)} km/h`);
});

test('Sugiyama ring: a jam forms on its own from small driver noise', () => {
  const sim = run({ cars: 22, length: 230, speedLimit: 40, distraction: 0.5 }, 240);
  const s = sim.snapshot();
  assert.ok(s.sdKmh > 6, `speed spread ${s.sdKmh.toFixed(2)} km/h`);
});

test('absorbers in the mix lower speed variation under noise', () => {
  const cfg = { cars: 40, length: 1000, speedLimit: 90, distraction: 0.6, autoTaps: true, autoTapEvery: 25 };
  let sdA = 0, sdB = 0, k = 0;
  const a = new Sim({ ...base, ...cfg });
  const b = new Sim({ ...base, ...cfg, absorbers: 4 });
  for (let i = 0; i < 6000; i++) {
    a.step(); b.step();
    if (i > 1200 && i % 20 === 0) { sdA += a.snapshot().sdKmh; sdB += b.snapshot().sdKmh; k++; }
  }
  assert.ok(sdB / k < 0.75 * (sdA / k), `with absorbers ${(sdB / k).toFixed(1)} vs without ${(sdA / k).toFixed(1)} km/h`);
});

test('a full scale model (lengths x2, times x4) evolves bit for bit like the original', () => {
  const cfg = { ...base, length: 860, reaction: 0.8, absorbers: 3, distraction: 0.4 };
  const model = {
    ...cfg, speedLimit: cfg.speedLimit / 2, tailT: 4, reaction: 3.2, absorbT: 4 * cfg.absorbT, absorbWindow: 32,
    accel: 1.2 / 8, decel: 2 / 8, carLen: 9, jamGap: 4, noiseMemory: 8, tapDecel: 4.5 / 8, tapHold: 16,
    length: 1720, distraction: 0.4 * 2 / 32, unitL: 2, unitT: 4,
  };
  const a = new Sim(cfg), m = new Sim(model);
  for (let k = 0; k < 3000; k++) {
    if (k === 80) { a.tapBrakes(0, 0.5); m.tapBrakes(0, 0.5); }
    a.step(); m.step();
  }
  for (let i = 0; i < a.n; i++) {
    assert.equal(m.cars[i].x, 2 * a.cars[i].x);
    assert.equal(m.cars[i].v, a.cars[i].v / 2);
  }
});

test('scene 2: one ample-distance driver keeps a knife-edge road from jamming', () => {
  const cfg = { length: 860, reaction: 0.8, absorbT: 3.0 };
  const slowest = (extra) => {
    const sim = new Sim({ ...base, ...cfg, ...extra });
    let minV = Infinity;
    for (let k = 0; k < 6000; k++) {
      if (k === 80) sim.tapBrakes(0, 0.5);
      sim.step();
      if (k > 3600) for (const c of sim.cars) minV = Math.min(minV, c.v);
    }
    return minV * 3.6;
  };
  const one = slowest({ manual: { 29: true } }), none = slowest({});
  assert.ok(one > 50, `with one ample driver, slowest ${one.toFixed(1)} km/h`);
  assert.ok(none < 30, `all tailgaters, slowest ${none.toFixed(1)} km/h`);
});

test('changing settings mid-run keeps the engine defaults (no NaN)', () => {
  const sim = new Sim(base);
  for (let k = 0; k < 100; k++) sim.step();
  sim.cfg = { ...base, absorbers: 3 };   // what the app does when a slider moves
  sim.applyMix();
  for (let k = 0; k < 400; k++) sim.step();
  assert.ok(Number.isFinite(sim.meanSpeed()), `mean speed ${sim.meanSpeed()}`);
  assert.ok(sim.cars.every((c) => Number.isFinite(c.x) && Number.isFinite(c.v)));
});

// Fuel (prototype): the power-based model and the efficiency score.
test('fuel: steady cruise costs idle plus rolling plus drag, per km', () => {
  const suv = VEHICLES.suv;
  // 60 km/h: idle 1700 mL/h over 60 km, plus A, plus B * 60^2
  const handCalc = 1700 / 60 + 19.5 + 0.0059 * 60 * 60;
  assert.ok(Math.abs(cruiseFuelPerM(suv, 60 / 3.6) * 1000 - handCalc) < 1e-9);
});

test('fuel: braking burns only the idle rate', () => {
  for (const veh of Object.values(VEHICLES)) {
    assert.equal(fuelRate(veh, 20, -3), veh.idle / 3600);
    assert.equal(fuelRate(veh, 0, 0), veh.idle / 3600);
  }
});

test('fuel: a quiet road in steady flow scores 100%', () => {
  for (const vehicle of ['suv', 'compact']) {
    const e = run({ vehicle }, 300).snapshot().fuelEff;
    assert.ok(Math.abs(e - 100) < 1, `${vehicle}: ${e}`);
  }
});

test('fuel: a jam started by one tap wastes fuel', () => {
  const sim = run({}, 300, s => { if (Math.abs(s.t - 4) < 0.025) s.tapBrakes(0, 0.5); });
  assert.ok(sim.snapshot().fuelEff < 70, `${sim.snapshot().fuelEff}`);
});

test('fuel: a rescaled model reports no fuel', () => {
  const sim = run({ unitL: 2, unitT: 2 }, 20);
  assert.equal(sim.snapshot().fuelEff, null);
});

// Stress (prototype): firm brakes (over 2 m/s^2) plus close calls (under 1.5 s to collision) per km.
test('stress: a quiet road has no stressful moments', () => {
  assert.equal(run({}, 120).snapshot().stressPerKm, 0);
  assert.equal(run({ absorbers: 30 }, 120).snapshot().stressPerKm, 0);
});

test('stress: a tap that becomes a jam is stressful; one driver leaving room calms it', () => {
  const tap = s => { if (Math.abs(s.t - 4) < 0.025) s.tapBrakes(0, 0.5); };
  const knife = { reaction: 0.8, length: 860, absorbT: 3.0 };
  const jam = run(knife, 300, tap).snapshot().stressPerKm;
  const calm = run({ ...knife, manual: { 29: true } }, 300, tap).snapshot().stressPerKm;
  assert.ok(jam > 1 && calm < 0.5, `everyone tailgates ${jam.toFixed(2)}, one driver leaves room ${calm.toFixed(2)}`);
});

test('three pedals: drivers sharing a crowded road ease off instead of braking hard', () => {
  let hard = 0;
  run({ absorbers: 30, absorbT: 3.0 }, 300, s => {
    if (Math.abs(s.t - 4) < 0.025) s.tapBrakes(0, 0.5);
    else if (s.t > 10) for (const c of s.cars) if (c.a < -3) hard++;
  });
  assert.equal(hard, 0);
});
