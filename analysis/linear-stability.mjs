// Linear string stability of the delayed IDM used by the tailgaters.
// Linearising about the uniform flow gives, per car, the transfer function from the
// leader's speed to the follower's speed (s = Laplace variable):
//   G(s) = P(s) / (s^2 - f_v s + P(s)),   P(s) = e^{-s tau} [ f_s + (f_s tau - f_dv) s ]
// A disturbance grows car by car when max_w |G(i w)| > 1 (string instability).
// Run: node analysis/linear-stability.mjs
import { MODEL } from './lib.mjs';

// equilibrium speed for a given gap (inverse of s_e(v) = (s0 + vT)/sqrt(1-(v/v0)^4))
function eqSpeed(gap, v0, T, s0) {
  let lo = 0, hi = v0 * 0.999999;
  for (let k = 0; k < 80; k++) {
    const v = (lo + hi) / 2;
    const se = (s0 + v * T) / Math.sqrt(1 - (v / v0) ** 4);
    if (se < gap) lo = v; else hi = v;
  }
  return lo;
}

// Peak of |G(iw)| over frequency, for load number Λ, delay number R = τ/T,
// T, v0 and the vehicle constants a, b, s0, ell in SI units.
export function peakGain({ lambda, R, T = 1, v0 = 25, a = MODEL.a, b = MODEL.b, s0 = MODEL.s0, ell = MODEL.ell }) {
  const tau = R * T;
  const gap = (ell + s0 + v0 * T) / lambda - ell;      // from Λ = (ℓ+s0+v0T)/(L/N)
  if (gap <= s0) return { peak: Infinity, v: 0 };
  const v = eqSpeed(gap, v0, T, s0);
  const sStar = s0 + v * T;
  const fs = 2 * a * sStar ** 2 / gap ** 3;
  const fv = -a * (4 * v ** 3 / v0 ** 4 + 2 * sStar * T / gap ** 2);
  const fdv = -a * sStar * v / (Math.sqrt(a * b) * gap ** 2);
  let peak = 0, wPeak = 0;
  for (let w = 1e-4 / T; w < 6 / T; w *= 1.01) {
    // P(iw) = e^{-iwτ}(fs + (fs τ - fdv) i w)
    const c = Math.cos(w * tau), s = -Math.sin(w * tau);
    const pr0 = fs, pi0 = (fs * tau - fdv) * w;
    const pr = c * pr0 - s * pi0, pi = c * pi0 + s * pr0;
    // denominator (iw)^2 - fv iw + P = -w^2 + pr + i(pi - fv w)
    const dr = -w * w + pr, di = pi - fv * w;
    const g = Math.hypot(pr, pi) / Math.hypot(dr, di);
    if (g > peak) { peak = g; wPeak = w; }
  }
  return { peak, wPeak, v, fs, fv, fdv, gap };
}

// Critical delay number R_c(Λ): the smallest R at which the peak gain exceeds 1.
export function criticalR(lambda, opts = {}) {
  if (peakGain({ lambda, R: 0, ...opts }).peak > 1 + 1e-9) return 0;
  let lo = 0, hi = 3;
  if (peakGain({ lambda, R: hi, ...opts }).peak <= 1) return hi;
  for (let k = 0; k < 40; k++) {
    const m = (lo + hi) / 2;
    if (peakGain({ lambda, R: m, ...opts }).peak > 1 + 1e-9) hi = m; else lo = m;
  }
  return (lo + hi) / 2;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Λ      v_e(km/h)  R_c     peak|G| at R=1');
  for (let L = 0.3; L <= 1.801; L += 0.1) {
    const g = peakGain({ lambda: L, R: 1 });
    console.log(`${L.toFixed(2)}   ${(g.v * 3.6).toFixed(1).padStart(6)}   ${criticalR(L).toFixed(3)}   ${g.peak.toFixed(3)}`);
  }
}
