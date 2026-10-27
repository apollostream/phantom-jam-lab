// Shared helpers for the dimensional-analysis scripts.
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/engine.js', import.meta.url), 'utf8');
export const { Sim, DEFAULTS, VEHICLES, fuelRate, cruiseFuelPerM } = new Function(src + '\nreturn { Sim, DEFAULTS, VEHICLES, fuelRate, cruiseFuelPerM };')();

// Default vehicle constants of the tailgater model (src/engine.js)
export const MODEL = { a: DEFAULTS.accel, b: DEFAULTS.decel, s0: DEFAULTS.jamGap, ell: DEFAULTS.carLen };
// Vehicle constants of one configuration, falling back to the defaults.
export const vehicle = cfg => ({
  a: cfg.accel ?? MODEL.a, b: cfg.decel ?? MODEL.b, s0: cfg.jamGap ?? MODEL.s0, ell: cfg.carLen ?? MODEL.ell,
});

export const BASE = {
  cars: 30, length: 900, speedLimit: 90, seed: 7,
  absorbers: 0, placement: 'even', manual: null,
  tailT: 1.0, reaction: 1.0, distraction: 0,
  absorbT: 2.6, absorbWindow: 8,
  autoTaps: false, autoTapEvery: 20,
};

// Load number: intended car flow over lane capacity at the speed limit.
export function loadNumber(cfg) {
  const v0 = cfg.speedLimit / 3.6, { ell, s0 } = vehicle(cfg);
  return cfg.cars * (ell + s0 + v0 * cfg.tailT) / cfg.length;
}
// Ring length that gives a load number Λ for N cars.
export function lengthFor(lambda, cfg) {
  const v0 = cfg.speedLimit / 3.6, { ell, s0 } = vehicle(cfg);
  return cfg.cars * (ell + s0 + v0 * cfg.tailT) / lambda;
}

// Run one experiment: settle, one gentle brake tap, then measure the long-time
// speed spread Π_v = σ_v / v0 averaged over the last `window` seconds. Times are in
// seconds of the configuration's own clock.
export function experiment(cfg, { settle = 10, total = 300, window = 60, tap = 0.85 } = {}) {
  const sim = new Sim({ ...BASE, ...cfg });
  const dt = sim.dt, v0 = sim.cfg.speedLimit / 3.6;
  let acc = 0, k = 0, brakes0 = 0;
  for (let i = 0, n = Math.round(total / dt); i < n; i++) {
    if (Math.abs(sim.t - settle) < dt / 2 && tap) sim.tapBrakes(0, tap);
    sim.step();
    if (sim.t > total - window) {
      if (!k) brakes0 = sim.stats.hardBrakes;
      let s = 0, s2 = 0;
      for (const c of sim.cars) { s += c.v; s2 += c.v * c.v; }
      const m = s / sim.n;
      acc += Math.sqrt(Math.max(0, s2 / sim.n - m * m)); k++;
    }
  }
  return {
    piV: acc / k / v0,
    meanKmh: sim.meanSpeed() * 3.6,
    meanOverV0: sim.meanSpeed() / v0,
    brakesPerCarMin: (sim.stats.hardBrakes - brakes0) / sim.n / (window / 60),
  };
}

// Smooth = no stop-and-go: speed spread under 10% of v0 and essentially no hard
// braking (under 0.1 hard brakes per car per minute). Without noise the outcome is
// bimodal (Π_v < 0.001 or > 0.15), so the exact thresholds do not move boundaries.
export const isSmooth = r => r.piV < 0.1 && r.brakesPerCarMin < 0.1;
