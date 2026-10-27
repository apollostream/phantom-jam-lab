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
  unitL: 1, unitT: 1,
};
const HIST = 48;              // perception history steps (covers up to 2.4 s delay)

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
  set cfg(cfg) { this._cfg = { ...DEFAULTS, ...cfg }; }

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
    this.brakeLog = [];
    this.nextAutoTap = 6 * c.unitT;
  }

  // Space cars so that everyone can cruise at one common speed: tailgaters at their
  // IDM equilibrium gap, ample-distance drivers with their full buffer.
  placeAtEquilibrium(rng) {
    const c = this.cfg, n = this.n;
    const vlim = c.speedLimit / 3.6;
    const tailGap = v => (c.jamGap + v * c.tailT) / Math.sqrt(Math.max(1e-6, 1 - Math.pow(v / vlim, 4)));
    // "Ample" is relative to the traffic around you: a lone absorber takes its full
    // buffer, while a road of only absorbers shares the space evenly.
    const share = 1 - this.cars.filter(car => car.absorber).length / n;
    const gapFor = (car, v) => {
      const g = tailGap(v);
      return car.absorber ? g + share * Math.max(0, c.jamGap + v * c.absorbT - g) : g;
    };
    const free = this.L - n * this.carLen;
    let lo = 0, hi = vlim * 0.999;
    for (let k = 0; k < 50; k++) {
      const mid = (lo + hi) / 2;
      const need = this.cars.reduce((sum, car) => sum + gapFor(car, mid), 0);
      if (need < free) lo = mid; else hi = mid;
    }
    const v = n > 1 ? lo : vlim;
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

  applyMix() {
    const c = this.cfg;
    const rng = mulberry32(c.seed ^ 0x9e3779b9);
    const slots = new Set(absorberSlots(this.n, c.absorbers, c.placement, rng));
    for (const car of this.cars) {
      const want = c.manual && car.id in c.manual ? c.manual[car.id] : slots.has(car.id);
      if (want && !car.absorber) car.vAvg = car.v;
      car.absorber = want;
    }
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
        if (bReq > (car.absorber ? 3.5 : 5) * uA) a = Math.min(a, -Math.min(9 * uA, bReq * 1.1));
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
      car.braking = a < -1.0 * uA;
      if (v < 1.4 * uV) car.stoppedTime += dt;
      this.stats.distance += Math.max(0, dx);
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
    return {
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
