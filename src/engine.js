// ENGINE START
// Ring-road microsimulation. Tailgaters follow the Human Driver Model (IDM with a
// reaction delay, anticipation and attention noise). Ample-distance drivers cruise at
// the smoothed speed of traffic ahead and let their large gap breathe.
const DT = 0.05;              // physics step, s
const CAR_LEN = 4.5;          // m, default car length
// Vehicle constants the app exposes. Every other constant below is written in metres
// and seconds and multiplied by cfg.unitL and cfg.unitT, so a scale model that
// stretches lengths and times (time step included) evolves exactly like the
// original: the model holds no dimensional constant outside its configuration.
const DEFAULTS = {
  accel: 1.2, decel: 2.0, carLen: CAR_LEN, jamGap: 2, noiseMemory: 2,
  tapDecel: 4.5, tapHold: 4,    // a brake tap: braking rate (m/s^2) and longest hold (s)
  liftDecel: 0.6,               // slowing with the foot off both pedals: drag, rolling, engine braking (m/s^2)
  firmBrake: 2.0,               // braking that counts toward stress, about 0.2 g (m/s^2)
  unitL: 1, unitT: 1,
  vehicle: 'suv',
};
const HIST = 48;              // perception history steps (covers up to 2.4 s delay)

// Fuel (prototype). Akcelik's power-based instantaneous model, in the form of Akcelik,
// Smit & Besley (2012): while the engine pushes (tractive power P_T > 0) the fuel rate is
// idle + b1*P_T + b2*a*P_I (the last only when speeding up); otherwise it is the idle
// rate, so energy shed in the brakes earns nothing back. A and B are the fuel cost of
// rolling resistance and of air drag per km. docs/fuel-prototype.md derives each value.
const VEHICLES = {
  compact: { label: 'Compact car', mass: 1250, pMax: 100, idle: 889, A: 12.2, B: 0.0036, b1: 0.0926, b2: 0.030 },
  suv: { label: 'Midsize SUV', mass: 2000, pMax: 200, idle: 1700, A: 19.5, B: 0.0059, b1: 0.0926, b2: 0.030 },
};
// Rolling force (N) and drag coefficient (N per (m/s)^2) implied by A and B.
function fuelForces(veh) {
  return { roll: veh.A / veh.b1, drag: (veh.B / veh.b1) * 3.6 * 3.6 };
}
// Fuel rate in mL/s at speed v (m/s) and acceleration a (m/s^2), on level road.
function fuelRate(veh, v, a) {
  const f = fuelForces(veh);
  const idle = veh.idle / 3600;
  const pT = Math.min(veh.pMax, ((f.roll + f.drag * v * v + veh.mass * a) * v) / 1000);
  if (pT <= 0) return idle;
  const pI = (veh.mass * a * v) / 1000;
  return idle + veh.b1 * pT + (a > 0 ? veh.b2 * a * pI : 0);
}
// Fuel per metre, in mL, cruising steadily at v (m/s).
function cruiseFuelPerM(veh, v) {
  return fuelRate(veh, v, 0) / v;
}

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function idmAccel(v, gap, dv, p) {
  const sStar = p.s0 + Math.max(0, v * p.T + (v * dv) / (2 * Math.sqrt(p.a * p.b)));
  const g = Math.max(gap, p.gMin);
  return p.a * (1 - Math.pow(v / p.v0, 4) - (sStar / g) * (sStar / g));
}

// Which car indices drive with ample distance.
function absorberSlots(n, count, mode, rng) {
  count = Math.max(0, Math.min(n, count | 0));
  const idx = [];
  if (count === 0) return idx;
  if (mode === 'cluster') {
    const start = Math.floor(n * 0.15);
    for (let k = 0; k < count; k++) idx.push((start + k) % n);
  } else if (mode === 'random') {
    const all = [...Array(n).keys()];
    for (let k = all.length - 1; k > 0; k--) {
      const j = Math.floor(rng() * (k + 1));
      [all[k], all[j]] = [all[j], all[k]];
    }
    return all.slice(0, count);
  } else {
    for (let k = 0; k < count; k++) idx.push(Math.floor((k * n) / count + n / (2 * count)) % n);
  }
  return idx;
}

class Sim {
  constructor(cfg) {
    this.cfg = cfg;
    this.reset();
  }

  // Settings can be swapped mid-run; anything left out keeps its default.
  get cfg() { return this._cfg; }
  set cfg(cfg) { this._cfg = { ...DEFAULTS, ...cfg }; this._vEq = null; }

  reset() {
    const c = this.cfg;
    const n = c.cars;
    const rng = mulberry32(c.seed);
    this.t = 0;
    this.dt = DT * c.unitT;
    this.n = n;
    this.L = c.length;
    this.carLen = c.carLen;
    this.cars = [];
    for (let i = 0; i < n; i++) {
      const crng = mulberry32((c.seed * 7919 + i * 104729) >>> 0);
      this.cars.push({
        id: i,
        x: 0,
        v: 0,
        a: 0,
        rng: crng,
        // individual personality, drawn identically regardless of type
        speedFactor: 1 + 0.04 * gauss(crng),
        tFactor: 1 + 0.12 * gauss(crng),
        tauFactor: 0.8 + 0.4 * crng(),
        noise: 0,
        absorber: false,
        vAvg: 0,
        hist: new Float32Array(HIST * 3),
        hi: 0,
        tap: null,
        braking: false,
        hardBraking: false,
        brakeCount: 0,
        onBrake: false,     // stress count: inside a brake-pedal event
        closeCall: false,   // stress count: inside a close call
        stoppedTime: 0,
        laps: 0,
      });
    }
    this.applyMix();
    this.placeAtEquilibrium(rng);
    // Prime perception history with the starting state.
    for (const car of this.cars) {
      const g = this.gapOf(car.id);
      for (let k = 0; k < HIST; k++) car.hist.set([g, car.v, 0], k * 3);
    }
    this.stats = { hardBrakes: 0, nearMiss: 0, distance: 0, speedSeries: [], lastSample: 0 };
    this.resetFuel();
    this.stats.brakeEvents = 0;
    this.stats.closeCalls = 0;
    this.brakeLog = [];
    this.nextAutoTap = 6 * c.unitT;
  }

  // Space cars so that everyone can cruise at one common speed: tailgaters at their
  // IDM equilibrium gap, ample-distance drivers with their full buffer.
  placeAtEquilibrium(rng) {
    const v = this.equilibriumSpeed();
    const gapFor = this.gapRule();
    let x = 0;
    for (const car of this.cars) {
      car.x = x;
      car.v = v;
      car.vAvg = v;
      x += this.carLen + gapFor(car, v) * (1 + (rng() - 0.5) * 0.04);
    }
    const stretch = this.L / x;
    for (const car of this.cars) car.x *= stretch;
  }

  // Start the fuel count afresh, as after switching vehicles mid-run.
  resetFuel() { Object.assign(this.stats, { fuel: 0, fuelIdeal: 0, fuelDist: 0 }); }

  // The gap each car keeps at a common cruising speed v.
  gapRule() {
    const c = this.cfg, n = this.n;
    const vlim = c.speedLimit / 3.6;
    const tailGap = v => (c.jamGap + v * c.tailT) / Math.sqrt(Math.max(1e-6, 1 - Math.pow(v / vlim, 4)));
    // "Ample" is relative to the traffic around you: a lone absorber takes its full
    // buffer, while a road of only absorbers shares the space evenly.
    const share = 1 - this.cars.filter(car => car.absorber).length / n;
    return (car, v) => {
      const g = tailGap(v);
      return car.absorber ? g + share * Math.max(0, c.jamGap + v * c.absorbT - g) : g;
    };
  }

  // The one speed at which every car on the ring can cruise with its preferred gap.
  equilibriumSpeed() {
    if (this._vEq != null) return this._vEq;
    const c = this.cfg, n = this.n;
    const vlim = c.speedLimit / 3.6;
    const gapFor = this.gapRule();
    const free = this.L - n * this.carLen;
    let lo = 0, hi = vlim * 0.999;
    for (let k = 0; k < 50; k++) {
      const mid = (lo + hi) / 2;
      const need = this.cars.reduce((sum, car) => sum + gapFor(car, mid), 0);
      if (need < free) lo = mid; else hi = mid;
    }
    return (this._vEq = n > 1 ? lo : vlim);
  }

  applyMix() {
    const c = this.cfg;
    const rng = mulberry32(c.seed ^ 0x9e3779b9);
    const slots = new Set(absorberSlots(this.n, c.absorbers, c.placement, rng));
    for (const car of this.cars) {
      const want = c.manual && car.id in c.manual ? c.manual[car.id] : slots.has(car.id);
      if (want && !car.absorber) car.vAvg = car.v;
      car.absorber = want;
    }
    this._vEq = null;
  }

  leaderOf(i) { return this.cars[(i + 1) % this.n]; }

  gapOf(i) {
    const me = this.cars[i];
    if (this.n === 1) return this.L - this.carLen;
    const ld = this.leaderOf(i);
    let d = ld.x - me.x;
    if (d <= 0) d += this.L;
    return d - this.carLen;
  }

  tapBrakes(i, strength = 0.35) {
    const car = this.cars[i];
    if (!car) return;
    car.tap = { target: car.v * strength, until: this.t + this.cfg.tapHold };
    this.brakeLog.push({ t: this.t, id: i });
  }

  step() {
    const c = this.cfg;
    const n = this.n;
    const vlim = c.speedLimit / 3.6;
    const dt = this.dt;
    const uL = c.unitL, uT = c.unitT, uV = uL / uT, uA = uL / (uT * uT);
    const acc = new Float32Array(n);
    // Fuel is counted only in real units; a rescaled model has no physical car.
    const veh = uL === 1 && uT === 1 ? VEHICLES[c.vehicle] : null;
    const idealPerM = veh && this.equilibriumSpeed() > 1 ? cruiseFuelPerM(veh, this.equilibriumSpeed()) : 0;

    for (let i = 0; i < n; i++) {
      const car = this.cars[i];
      const ld = this.leaderOf(i);
      const gapNow = this.gapOf(i);
      const dvNow = n > 1 ? car.v - ld.v : 0;

      // record perception
      car.hi = (car.hi + 1) % HIST;
      car.hist[car.hi * 3] = gapNow;
      car.hist[car.hi * 3 + 1] = car.v;
      car.hist[car.hi * 3 + 2] = dvNow;

      let a;
      if (car.absorber) {
        // Smooth estimate of how fast traffic ahead is really moving.
        const ldV = n > 1 ? ld.v : vlim;
        car.vAvg += (ldV - car.vAvg) * (dt / c.absorbWindow);
        // Hold that speed and let the buffer breathe; only correct at the band edges.
        const sLo = c.jamGap + car.v * 0.8 * uT, sHi = c.jamGap + car.v * c.absorbT * 1.5 + 10 * uL;
        const corr = gapNow < sLo ? Math.max(-4 * uV, (0.25 / uT) * (gapNow - sLo))
          : gapNow > sHi ? Math.min(2 * uV, (0.06 / uT) * (gapNow - sHi)) : 0;
        const vCmd = Math.max(0, Math.min(vlim * car.speedFactor, car.vAvg + corr));
        a = Math.max(-3 * uA, Math.min(1.0 * uA, (0.6 / uT) * (vCmd - car.v)));
        // Three pedal states. With a long gap, the rule above holds the average speed and lets
        // the gap absorb a dip. Closing in with under 1.5 s of gap left, ease off the gas; brake
        // only as hard as it takes to match the car ahead before the gap reaches the band's floor.
        if (dvNow > 0 && gapNow < c.jamGap + car.v * 1.5 * uT) {
          const room = gapNow - sLo;
          const need = room > 0.1 * uL ? (dvNow * dvNow) / (2 * room) : 3 * uA;
          a = Math.min(a, -Math.min(3 * uA, Math.max(c.liftDecel * uA, need)));
        }
      } else {
        const tau = c.reaction * car.tauFactor;
        const d = Math.min(HIST - 1, Math.round(tau / dt));
        const k = ((car.hi - d) % HIST + HIST) % HIST;
        const gap = car.hist[k * 3], dv = car.hist[k * 3 + 2];
        const p = { v0: vlim * car.speedFactor, T: c.tailT * car.tFactor, a: c.accel, b: c.decel, s0: c.jamGap, gMin: 0.1 * uL };
        // Human Driver Model: extrapolate the stale gap forward by the reaction time
        a = idmAccel(car.v, gap - dv * tau, dv, p);
        // attention noise (Ornstein-Uhlenbeck)
        car.noise += -(1 / c.noiseMemory) * car.noise * dt + c.distraction * 0.9 * Math.sqrt(dt) * gauss(car.rng);
        a += car.noise;
      }

      // panic reflex on the live picture: brake hard enough to stop behind the
      // leader even if the leader stops at full force too
      if (n > 1) {
        const room = gapNow - 1 * uL + (ld.v * ld.v) / (2 * 8 * uA);
        const bReq = room > 0.05 * uL ? (car.v * car.v) / (2 * room) : 9 * uA;
        // one threshold for every driver: at 3.5 m/s^2 the check fired at equal speeds in steady
        // flow when ample-distance drivers shared tailgater-length gaps, jolting them every few seconds
        if (bReq > 5 * uA) a = Math.min(a, -Math.min(9 * uA, bReq * 1.1));
      }

      if (car.tap) {
        if (car.v > car.tap.target && this.t < car.tap.until) a = Math.min(a, -c.tapDecel);
        else car.tap = null;
      }
      acc[i] = Math.max(-9 * uA, Math.min(2.5 * uA, a));
    }

    for (let i = 0; i < n; i++) {
      const car = this.cars[i];
      const a = acc[i];
      let v = car.v + a * dt;
      let dx;
      if (v < 0) { dx = car.v * car.v / (2 * Math.max(1e-6, -a)); v = 0; }
      else dx = car.v * dt + 0.5 * a * dt * dt;
      car.nx = car.x + Math.max(0, dx);
      car.nv = v;
      car.a = a;
      // count hard-brake onsets with hysteresis so one stop counts once
      if (!car.hardBraking && a < -2.5 * uA) { car.hardBraking = true; car.brakeCount++; this.stats.hardBrakes++; }
      else if (car.hardBraking && a > -0.5 * uA) car.hardBraking = false;
      // brake lights and the stress count follow the brake pedal: slowing faster than lifting off
      car.braking = a < -c.liftDecel * uA;
      // a firm brake event lasts until the driver is back on the gas (after Stern et al. 2018)
      if (!car.onBrake && a < -c.firmBrake * uA) { car.onBrake = true; this.stats.brakeEvents++; }
      else if (car.onBrake && a > 0) car.onBrake = false;
      // a close call: under 1.5 s to collision, cleared above 3 s (surrogate-safety thresholds)
      if (n > 1) {
        const dv = car.v - this.leaderOf(i).v, ttc = dv > 0 ? this.gapOf(i) / dv : Infinity;
        if (!car.closeCall && ttc < 1.5 * uT) { car.closeCall = true; this.stats.closeCalls++; }
        else if (car.closeCall && ttc > 3 * uT) car.closeCall = false;
      }
      if (v < 1.4 * uV) car.stoppedTime += dt;
      this.stats.distance += Math.max(0, dx);
      if (veh) {
        // fuel over the step at its mean speed; the ideal is the same distance at the steady speed
        this.stats.fuel += fuelRate(veh, Math.max(0, car.v + 0.5 * a * dt), a) * dt;
        this.stats.fuelIdeal += idealPerM * Math.max(0, dx);
        this.stats.fuelDist += Math.max(0, dx);
      }
    }
    // commit, then enforce no overlap
    for (const car of this.cars) {
      if (car.nx >= this.L) { car.nx -= this.L; car.laps++; }
      car.x = car.nx; car.v = car.nv;
    }
    if (n > 1) {
      for (let i = 0; i < n; i++) {
        const gap = this.gapOf(i);
        if (gap < 0.3 * uL) {
          const car = this.cars[i];
          const ld = this.leaderOf(i);
          car.x = (car.x - (0.3 * uL - gap) + this.L) % this.L;
          car.v = Math.min(car.v, ld.v);
          this.stats.nearMiss++;
        }
      }
    }

    // automatic random taps
    if (c.autoTaps && this.t >= this.nextAutoTap) {
      const r = mulberry32((c.seed + Math.floor((this.t / c.unitT) * 10)) >>> 0);
      this.tapBrakes(Math.floor(r() * n), 0.3 + 0.3 * r());
      this.nextAutoTap = this.t + c.autoTapEvery * (0.6 + 0.8 * r());
    }

    this.t += dt;
    if (this.t - this.stats.lastSample >= 0.5 * uT) {
      this.stats.lastSample = this.t;
      this.stats.speedSeries.push(this.meanSpeed());
      if (this.stats.speedSeries.length > 360) this.stats.speedSeries.shift();
    }
  }

  meanSpeed() {
    let s = 0;
    for (const c of this.cars) s += c.v;
    return s / this.n;
  }

  snapshot() {
    const n = this.n;
    let sum = 0, sum2 = 0, stopped = 0;
    const vlim = this.cfg.speedLimit / 3.6;
    for (const c of this.cars) {
      sum += c.v; sum2 += c.v * c.v;
      if (c.v < 0.25 * vlim) stopped++;
    }
    const mean = sum / n;
    const sd = Math.sqrt(Math.max(0, sum2 / n - mean * mean));
    // count jam clusters: runs of slow cars, wrapping around the ring
    let waves = 0;
    const slow = this.cars.map(c => c.v < 0.4 * vlim);
    for (let i = 0; i < n; i++) if (slow[i] && !slow[(i + 1) % n]) waves++;
    if (waves === 0 && slow.every(Boolean)) waves = 1;
    const density = n / (this.L / 1000);
    const st = this.stats, c0 = this.cfg;
    const fuelOn = st.fuelIdeal > 0 && st.fuelDist > 0;
    return {
      // 100% = the fuel this distance needs in steady flow at the same load; lower is waste
      fuelEff: fuelOn ? (st.fuelIdeal / st.fuel) * 100 : null,
      // stressful moments (firm brake events plus close calls) per vehicle-km
      stressPerKm: st.distance > 0 ? (st.brakeEvents + st.closeCalls) / (st.distance / (1000 * c0.unitL)) : null,
      // its reciprocal, km driven between stressful moments; with none yet, Infinity, and
      // kmPerCar (how far the average car has gone) is the lower bound to show instead
      stressFreeKm: st.distance > 0 ? st.distance / (1000 * c0.unitL) / (st.brakeEvents + st.closeCalls) : null,
      kmPerCar: st.distance / (1000 * c0.unitL) / n,
      // litres per 100 km, all cars together
      fuelL100: fuelOn ? (st.fuel / st.fuelDist) * 100 : null,
      meanKmh: mean * 3.6,
      sdKmh: sd * 3.6,
      flow: density * mean * 3.6,
      stoppedPct: (stopped / n) * 100,
      waves,
      brakesPerMin: this.t > 1 ? this.stats.hardBrakes / (this.t / 60) : 0,
      density,
    };
  }
}
// ENGINE END
