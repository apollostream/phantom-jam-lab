// Fact check for "The Jam Nobody Started" (report/the-jam-nobody-started.md).
// Every number the report states is recomputed here from the analysis results
// (analysis/results/*.json, written by `npm run analysis`) or from linear theory,
// and the sentence that states it must appear verbatim in the report snapshot.
// A FAIL means the data and the prose have drifted apart: fix one or the other.
// Run: node report/facts.mjs   (after npm run analysis)
import { readFileSync } from 'node:fs';
import { peakGain, criticalR } from '../analysis/linear-stability.mjs';

const read = f => JSON.parse(readFileSync(new URL(`../analysis/results/${f}.json`, import.meta.url), 'utf8'));
const report = readFileSync(new URL('./the-jam-nobody-started.md', import.meta.url), 'utf8');
const regime = read('regime'), absorbers = read('absorbers'), sim = read('similarity'), pi = read('pi-sweep'), scene2 = read('scene2');

const near = (a, b, tol) => Math.abs(a - b) <= tol;
const pct = x => Math.round(100 * x);
const band = regime.boundary.filter(r => r.lambda >= 0.8 && r.lambda <= 1.3);
const abs26 = absorbers.out.filter(o => o.absorbT === 2.6);
const tailgaters = abs26.map(o => o.runs.find(r => r.n === 0));
const allAmple = abs26.map(o => o.runs.find(r => r.n === 30));
const simRow = (lambda, tap) => sim.boundary.find(r => r.lambda === lambda && r.tap === tap);
const piDrop = pi.out.filter(r => r.theory > 0).map(r => r.theory - r.tap50);

// [what, sentence in the report, computed value(s), check]
const claims = [
  ['R_c at the default load 1.05', 'At the default load of 1.05 it is 1.10',
    criticalR(1.05), v => near(v, 1.10, 0.005)],
  ['growth per car and over ten cars at R = 1.2', 'At R = 1.2 each car enlarges the ripple by 8%, so after ten cars it is 2.2 times as large',
    [peakGain({ lambda: 1.05, R: 1.2 }).peak, peakGain({ lambda: 1.05, R: 1.2 }).peak ** 10], ([g, g10]) => pct(g - 1) === 8 && near(g10, 2.2, 0.05)],
  ['growth per car and over ten cars at R = 1.4', 'At R = 1.4 each car enlarges it by a third, and after ten cars it is about 18 times as large',
    [peakGain({ lambda: 1.05, R: 1.4 }).peak, peakGain({ lambda: 1.05, R: 1.4 }).peak ** 10], ([g, g10]) => near(g - 1, 1 / 3, 0.005) && near(g10, 18, 0.5)],
  ['R_c falls from load 0.8 to 1.3', 'the critical value falls from 1.8 at a load of 0.8 to 0.81 at a load of 1.3',
    [criticalR(0.8), criticalR(1.3)], ([a, b]) => near(a, 1.8, 0.02) && near(b, 0.81, 0.005)],
  ['tiny-upset boundary vs theory, loads 0.8 to 1.3', "the simulator's boundary fell within 0.05 of the theory line at every load from 0.8 to 1.3",
    Math.max(...band.map(r => Math.abs(r.tiny - r.theory))), v => v <= 0.05 + 1e-9],
  ['hard-tap boundary below theory, loads 0.8 to 1.3', 'For a hard tap to half speed, it fell 15 to 30% lower',
    band.map(r => pct(1 - r.dip50 / r.theory)), v => Math.min(...v) >= 15 && Math.max(...v) <= 30],
  ['drivers who leave room needed, R = 0.8 to 1.4', '| 1.4 | 10 | 33% |',
    abs26.map(o => `${o.R}:${o.minAbsorbers}`).join(' '), v => v === '0.8:0 0.9:1 1:5 1.1:5 1.2:6 1.4:10'],
  ['low in the band, one driver in thirty is enough (R = 0.9 sits in the band)', 'Low in that band, one driver in thirty who leaves ample room is enough to stop a jam',
    [abs26.find(o => o.R === 0.9).minAbsorbers, simRow(1.05, '50% tap').A, criticalR(1.05)], ([n, lo, hi]) => n === 1 && lo < 0.9 && 0.9 < hi],
  ['nearer the theory line, five (R = 1.0 still in the band)', 'Nearer the theory line the tap grows faster on its way back, and it takes five',
    [abs26.find(o => o.R === 1).minAbsorbers, criticalR(1.05)], ([n, hi]) => n === 5 && 1.0 < hi],
  ['five drivers needed at R = 1.0', 'at R = 1.0 it takes five drivers who leave room',
    abs26.find(o => o.R === 1).minAbsorbers, v => v === 5],
  ['smooth ring of drivers who leave room', 'a smooth ring that includes them averages about 55 km/h',
    allAmple.map(r => r.kmh), v => v.every(k => near(k, 55, 1.5))],
  ['smooth ring of tailgaters', 'a smooth ring of tailgaters manages 68 km/h',
    tailgaters.filter(r => r.smooth).map(r => r.kmh), v => v.length > 0 && v.every(k => near(k, 68, 0.5))],
  ['jammed ring of tailgaters, range of average speed', 'a jammed ring of tailgaters averages 39 to 64 km/h',
    tailgaters.filter(r => !r.smooth).map(r => r.kmh), v => near(Math.min(...v), 39, 0.5) && near(Math.max(...v), 64, 0.5)],
  ['scene 2 load and delay numbers', 'a load of 1.10 and a delay number of 0.80',
    [scene2.playback.lambda, scene2.playback.R], ([l, R]) => near(l, 1.10, 0.005) && R === 0.8],
  ['scene 2 with one driver: settles, speed', 'turns a five-minute jam into a road that settles within about 90 seconds',
    [scene2.playback.one.settledBySeconds, scene2.playback.one.finalKmh], ([s, k]) => s === 90 && near(k, 64, 1)],
  ['scene 2 all tailgaters: slowest car per 30 s', 'cars keep grinding down to 0–25 km/h for the full five minutes',
    scene2.playback.none.slowestPer30s, v => v.every(k => k <= 25) && scene2.playback.none.settledBySeconds === null],
  ['scene 2 ten seeds', 'one driver turned a jam into smooth flow in three, both rings stayed smooth in five, and both jammed in two',
    scene2.seeds.tally, t => t.rescued === 3 && t.bothSmooth === 5 && t.bothJam === 2],
  ['scale model bit-identical in four cases', 'It reproduced Road A bit for bit in four cases',
    sim.exact.map(e => e.identical), v => v.length === 4 && v.every(Boolean)],
  ['truck road matches cars for small and 15% taps', 'within one step of the 0.025 grid, at loads of 0.9, 1.05 and 1.2',
    sim.boundary.filter(r => r.tap !== '50% tap').flatMap(r => ['B-model', 'B-tap', 'B-real'].map(k => Math.abs(r[k] - r.A))),
    v => Math.max(...v) <= 0.025 + 1e-9],
  ['hard tap: trucks vs cars at load 1.05', 'the trucks held out to R = 0.925, while the cars jammed from 0.775',
    [simRow(1.05, '50% tap')['B-real'], simRow(1.05, '50% tap').A], ([b, a]) => b === 0.925 && a === 0.775],
  ['road C: theory moves under 0.01', 'moved the theory line by less than 0.01',
    // road C: the truck road's lengths and times (x4/3, x1.5) with the cars' a and b
    Math.abs(criticalR(1.05, { T: 1.5, v0: 80 / 3.6, a: 1.2, b: 2.0, s0: 2 * 4 / 3, ell: 4.5 * 4 / 3 }) - criticalR(1.05)), v => v < 0.01],
  ['road C: simulator boundary moves up to 0.35', 'it moved the simulator\'s boundary by as much as 0.35',
    Math.max(...sim.boundary.filter(r => r.tap !== 'tiny').map(r => Math.abs(r.C - r['B-tap']))), v => near(v, 0.35, 0.001)],
  ['vehicle sweeps: hard-tap boundary below theory', 'the hard-tap boundary sat 0.14 to 0.37 below the theory line',
    [Math.min(...piDrop), Math.max(...piDrop)], ([lo, hi]) => near(lo, 0.14, 0.005) && near(hi, 0.37, 0.005)],
];

let failed = 0;
for (const [what, sentence, value, ok] of claims) {
  const inText = report.includes(sentence), holds = ok(value);
  if (!inText || !holds) failed++;
  const shown = typeof value === 'number' ? +value.toFixed(4) : JSON.stringify(value);
  console.log(`${inText && holds ? 'PASS' : 'FAIL'}  ${what}: ${shown}${inText ? '' : '  [sentence not found in report]'}${holds ? '' : '  [data disagrees]'}`);
}
console.log(`\n${claims.length - failed}/${claims.length} claims hold`);
process.exitCode = failed ? 1 : 0;
