// The report's drawn figures, as SVG strings computed from the analysis results and the
// lab's defaults. Colours are CSS variables, so each figure follows the page's light or
// dark theme. Used by report/build-html.mjs; run alone to write report/figures/*.svg
// for a look:  node report/figures.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { peakGain, criticalR } from '../analysis/linear-stability.mjs';
import { loadNumber, BASE } from '../analysis/lib.mjs';

const read = f => JSON.parse(readFileSync(new URL(`../analysis/results/${f}.json`, import.meta.url), 'utf8'));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const f1 = x => x.toFixed(1), f2 = x => x.toFixed(2);
const INK = 'var(--ink)', MUTED = 'var(--muted)', GRID = 'var(--grid)', AXIS = 'var(--axis)';
const BLUE = 'var(--blue)', RED = 'var(--red)', AMBER = 'var(--amber)', GREEN = 'var(--green)', SURF = 'var(--paper)';

const svg = (w, h, label, body) =>
  `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
const text = (x, y, s, o = {}) =>
  `<text x="${x}" y="${y}" fill="${o.fill ?? INK}"${o.anchor ? ` text-anchor="${o.anchor}"` : ''}${o.size ? ` font-size="${o.size}"` : ''}${o.weight ? ` font-weight="${o.weight}"` : ''}${o.cls ? ` class="${o.cls}"` : ''}>${esc(s)}</text>`;
const title = (s, sub) => text(24, 30, s, { size: 16, weight: 700 }) + (sub ? text(24, 50, sub, { fill: MUTED, size: 12.5 }) : '');
const tip = s => `<title>${esc(s)}</title>`;

// A car seen from above, pointing right.
function car(x, y, len, fill, { brake = false, ring = null } = {}) {
  const w = 18;
  return `<g>${brake ? `<rect x="${x - 3}" y="${y - w / 2 + 1}" width="4" height="${w - 2}" rx="1.5" fill="${RED}"/>` : ''}` +
    `<rect x="${x}" y="${y - w / 2}" width="${len}" height="${w}" rx="5" fill="${fill}"${ring ? ` stroke="${ring}" stroke-width="2.5"` : ''}/>` +
    `<rect x="${x + len * 0.62}" y="${y - w / 2 + 3}" width="${len * 0.16}" height="${w - 6}" rx="2" fill="${SURF}" opacity="0.55"/></g>`;
}
const road = (x, y, w) => `<rect x="${x}" y="${y - 17}" width="${w}" height="34" rx="6" fill="var(--road)"/>` +
  `<line x1="${x + 6}" x2="${x + w - 6}" y1="${y}" y2="${y}" stroke="var(--lane)" stroke-dasharray="10 9" stroke-width="1.2" opacity="0.6"/>`;
const arrowDefs = `<defs><marker id="fig-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${MUTED}"/></marker></defs>`;
const span = (x1, x2, y, label, o = {}) =>
  `<line x1="${x1}" x2="${x2}" y1="${y}" y2="${y}" stroke="${o.stroke ?? MUTED}" stroke-width="1.25" marker-start="url(#fig-arrow)" marker-end="url(#fig-arrow)"/>` +
  text((x1 + x2) / 2, y + (o.below ? 17 : -7), label, { anchor: 'middle', size: 12.5, fill: o.fill ?? INK });

// ---------------------------------------------------------------- 1. the two drivers
export function drivers() {
  const L = 46, y = 132, colW = 356;
  const left = (x0) =>
    road(x0, y, colW - 20) +
    car(x0 + 34, y, L, GREEN) + car(x0 + 34 + L + 34, y, L, AMBER, { brake: true }) + car(x0 + 34 + 2 * L + 68, y, L, RED, { brake: true }) +
    span(x0 + 34 + L + 4, x0 + 34 + L + 32, y - 30, '1 s') +
    text(x0, y + 50, 'Acts on the gap and closing speed it saw', { size: 13 }) +
    text(x0, y + 68, 'a reaction time ago, then brakes a little', { size: 13 }) +
    text(x0, y + 86, 'harder than the car ahead did.', { size: 13 }) +
    text(x0, y + 112, 'Its following time: 1 second.', { size: 12.5, fill: MUTED });
  const right = (x0) => {
    const gapW = 132;
    return road(x0, y, colW - 20) +
      `<rect x="${x0 + 30 + L}" y="${y - 13}" width="${gapW}" height="26" rx="4" fill="${BLUE}" opacity="0.16"/>` +
      car(x0 + 30, y, L, GREEN, { ring: BLUE }) + car(x0 + 30 + L + gapW, y, L, AMBER, { brake: true }) +
      span(x0 + 30 + L + 4, x0 + 30 + L + gapW - 4, y - 30, '3 s of room') +
      text(x0, y + 50, 'Cruises at the average speed of the car', { size: 13 }) +
      text(x0, y + 68, 'ahead over the last 8 seconds, and lets', { size: 13 }) +
      text(x0, y + 86, 'the gap shrink rather than braking.', { size: 13 }) +
      text(x0, y + 112, 'Corrects only when the gap leaves a wide band.', { size: 12.5, fill: MUTED });
  };
  return svg(760, 268, 'A tailgater copies the car ahead late; a driver who leaves room averages it out',
    arrowDefs + title('A tailgater copies the car ahead, late; a driver who leaves room averages it out') +
    text(24, 84, 'Tailgater', { weight: 700, size: 14, fill: RED }) + text(404, 84, 'Leaves ample room', { weight: 700, size: 14, fill: BLUE }) +
    left(24) + right(404) + `<line x1="384" x2="384" y1="76" y2="258" stroke="${GRID}"/>`);
}

// ---------------------------------------------------------------- 2. the two governing numbers
export function groups() {
  const v0 = BASE.speedLimit / 3.6, T = BASE.tailT, ell = 4.5, s0 = 2, foot = ell + s0 + v0 * T;
  const N = BASE.cars, Lr = BASE.length, lambda = loadNumber({ ...BASE });
  const x0 = 24, scale = 600 / foot, y = 108;
  const seg = (a, b, fill, op) => `<rect x="${x0 + a * scale}" y="${y - 13}" width="${(b - a) * scale}" height="26" rx="3" fill="${fill}" opacity="${op}"/>`;
  const top = road(x0 - 6, y, 600 + 12) +
    seg(ell, ell + s0, AMBER, 0.35) + seg(ell + s0, foot, GREEN, 0.25) + car(x0, y, ell * scale, GREEN) +
    span(x0, x0 + ell * scale, y + 34, `car ${ell} m`, { below: true }) +
    span(x0 + ell * scale, x0 + (ell + s0) * scale, y - 30, `stopped gap ${s0} m`) +
    span(x0 + (ell + s0) * scale, x0 + foot * scale, y + 34, `speed limit × following time = ${f1(v0)} m/s × ${T} s = ${f1(v0 * T)} m`, { below: true }) +
    text(x0 + 600 + 20, y - 4, `${f1(foot)} m`, { weight: 700, size: 14 }) + text(x0 + 600 + 20, y + 13, 'per car', { size: 12.5, fill: MUTED }) +
    text(x0, y + 82, `Load number Λ = ${N} cars × ${f1(foot)} m ÷ ${Lr} m of road = ${f2(lambda)}`, { size: 14, weight: 700 }) +
    text(x0, y + 101, 'Above 1, the cars cannot all fit at the speed limit and their following time.', { size: 12.5, fill: MUTED });
  // time line: cars passing a point every T, and one driver's reaction time
  const ty = 290, px = 80, sc = 120;
  let ticks = '';
  for (let k = 0; k <= 5; k++) ticks += car(px + k * sc - 16, ty, 32, k === 0 ? AMBER : GREEN, { brake: k === 0 });
  const bottom = `<line x1="${px - 30}" x2="${px + 5 * sc + 40}" y1="${ty + 26}" y2="${ty + 26}" stroke="${AXIS}"/>` +
    [0, 1, 2, 3, 4, 5].map(k => `<line x1="${px + k * sc}" x2="${px + k * sc}" y1="${ty + 22}" y2="${ty + 30}" stroke="${AXIS}"/>` + text(px + k * sc, ty + 46, `${k} s`, { anchor: 'middle', size: 12, fill: MUTED })).join('') +
    ticks + span(px, px + sc, ty - 26, `following time T = ${T} s per car`) +
    `<rect x="${px}" y="${ty + 56}" width="${BASE.reaction * sc}" height="10" rx="5" fill="${RED}" opacity="0.8"/>` +
    text(px + BASE.reaction * sc + 10, ty + 65, `reaction time τ = ${BASE.reaction} s: the next car is already arriving`, { size: 12.5 }) +
    text(x0, ty + 100, `Delay number R = τ ÷ T = ${f1(BASE.reaction / T)}`, { size: 14, weight: 700 }) +
    text(x0, ty + 119, 'Above about 1.1 at this load, each driver passes on a slowdown larger than the one received.', { size: 12.5, fill: MUTED });
  return svg(760, 430, 'The load number compares road needed with road available; the delay number compares reaction time with following time',
    arrowDefs + title('Two ratios govern the ring', 'The lab’s defaults: 30 cars, 900 m, 90 km/h, following time 1 s, reaction time 1 s') +
    `<line x1="24" x2="736" y1="232" y2="232" stroke="${GRID}"/>` + top + bottom);
}

// ---------------------------------------------------------------- 3. ripple growth car by car
export function growth() {
  const lambda = 1.05, Rs = [1.0, 1.2, 1.4], cars = 10;
  const x0 = 64, x1 = 560, y0 = 76, yB = 336, ymax = 20;
  const X = n => x0 + n / cars * (x1 - x0), Y = v => yB - v / ymax * (yB - y0);
  const shade = [0.4, 0.7, 1];
  let body = '';
  for (const v of [0, 5, 10, 15, 20]) body += `<line x1="${x0}" x2="${x1}" y1="${Y(v)}" y2="${Y(v)}" stroke="${GRID}"/>` + text(x0 - 10, Y(v) + 4, `${v}×`, { anchor: 'end', size: 12, fill: MUTED });
  for (let n = 0; n <= cars; n += 2) body += text(X(n), yB + 20, n, { anchor: 'middle', size: 12, fill: MUTED });
  body += `<line x1="${x0}" x2="${x1}" y1="${Y(1)}" y2="${Y(1)}" stroke="${AXIS}" stroke-dasharray="4 4"/>` + text(x0 + 8, Y(1) - 8, 'no growth (1×)', { size: 12, fill: MUTED });
  Rs.forEach((R, i) => {
    const g = peakGain({ lambda, R }).peak, pts = [];
    for (let n = 0; n <= cars; n++) pts.push([X(n), Y(Math.min(ymax, g ** n))]);
    body += `<polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="${RED}" stroke-opacity="${shade[i]}" stroke-width="2.5"/>`;
    body += pts.map(([x, yy], n) => `<circle cx="${x}" cy="${yy}" r="4" fill="${RED}" fill-opacity="${shade[i]}" stroke="${SURF}" stroke-width="1.5">${tip(`R = ${R}: after ${n} cars the ripple is ${(g ** n).toFixed(2)} times its size`)}</circle>`).join('');
    const end = g ** cars;
    body += text(X(cars) + 12, Y(Math.min(ymax, end)) + (i === 0 ? 14 : i === 1 ? -2 : 4), `R = ${f1(R)}: ${end < 1.05 ? 'fades' : `${end.toFixed(1)}× after ${cars} cars`}`, { size: 12.5, weight: 600 });
  });
  body += text((x0 + x1) / 2, yB + 42, 'cars the ripple has passed through', { anchor: 'middle', size: 12.5, fill: MUTED });
  const g14 = peakGain({ lambda, R: 1.4 }).peak;
  return svg(760, 392, 'Past the critical delay number a ripple compounds car by car',
    title(`Past the critical delay number, a ripple compounds: ${(g14 ** cars).toFixed(0)}× in ten cars at R = 1.4`,
      `Size of the fastest-growing ripple, load 1.05, linear theory (critical R = ${f2(criticalR(lambda))})`) + body);
}

// ---------------------------------------------------------------- 4. the regime map
export function regime() {
  const { boundary } = read('regime');
  const x0 = 64, x1 = 700, y0 = 92, yB = 400;
  const X = l => x0 + (l - 0.5) / 1.1 * (x1 - x0), Y = r => yB - r / 2 * (yB - y0);
  const cap = v => v === null ? 2 : Math.min(2, v);
  const pts = (rows, key) => rows.map(r => `L${X(r.lambda)} ${Y(cap(r[key]))}`).join('');
  const smooth = `M${X(0.5)} ${yB}${pts(boundary, 'dip50')}L${X(1.6)} ${yB}Z`;
  const meta = `M${X(0.5)} ${y0}${pts(boundary, 'dip50')}${pts([...boundary].reverse(), 'tiny')}Z`;
  const unst = `M${X(0.5)} ${y0}${pts(boundary, 'tiny')}L${X(1.6)} ${y0}Z`;
  const theory = []; for (let l = 0.8; l <= 1.3001; l += 0.05) theory.push([+l.toFixed(2), criticalR(+l.toFixed(2))]);
  const sizes = [['tiny', 0.35, -5, 'smallest upset'], ['dip15', 0.65, 0, '15% brake tap'], ['dip50', 1, 5, '50% brake tap']];
  let body = `<path d="${smooth}" fill="${GREEN}" opacity="0.13"/><path d="${meta}" fill="${AMBER}" opacity="0.25"/><path d="${unst}" fill="${RED}" opacity="0.12"/>`;
  for (const v of [0, 0.5, 1, 1.5, 2]) body += `<line x1="${x0}" x2="${x1}" y1="${Y(v)}" y2="${Y(v)}" stroke="${GRID}"/>` + text(x0 - 10, Y(v) + 4, v.toFixed(1), { anchor: 'end', size: 12, fill: MUTED });
  for (let l = 0.5; l <= 1.601; l += 0.1) body += text(X(l), yB + 20, l.toFixed(1), { anchor: 'middle', size: 12, fill: MUTED });
  body += `<polyline points="${theory.map(([l, r]) => `${X(l)},${Y(r)}`).join(' ')}" fill="none" stroke="${INK}" stroke-width="2"/>`;
  for (const r of boundary) for (const [k, op, dx, name] of sizes) if (r[k] !== null)
    body += `<circle cx="${X(r.lambda) + dx}" cy="${Y(r[k])}" r="5" fill="${BLUE}" fill-opacity="${op}" stroke="${BLUE}">${tip(`Simulator, ${name}: load ${r.lambda}, stop-and-go from R = ${r[k]}`)}</circle>`;
  const roads = [['Lab default', loadNumber(BASE), 1.0, X(0.93)], ['Scene 2', loadNumber({ ...BASE, length: 860 }), 0.8, X(1.3)]];
  for (const [name, l, R, lx] of roads)
    body += `<circle cx="${X(l)}" cy="${Y(R)}" r="8" fill="none" stroke="${INK}" stroke-width="2">${tip(`${name}: load ${f2(l)}, R ${f2(R)}`)}</circle>` +
      `<line x1="${X(l)}" y1="${Y(R) + 9}" x2="${lx}" y2="${Y(0.34) - 12}" stroke="${MUTED}"/>` + text(lx, Y(0.34), `${name} (Λ ${f2(l)}, R ${f2(R)})`, { anchor: 'middle', size: 12.5 });
  body += text(X(0.53), Y(1.9), 'Metastable band: small upsets fade,', { weight: 700, size: 13 }) + text(X(0.53), Y(1.9) + 17, 'a hard tap starts a jam', { weight: 700, size: 13 }) +
    `<line x1="${X(0.8)}" y1="${Y(1.9) + 24}" x2="${X(0.86)}" y2="${Y(1.47)}" stroke="${MUTED}"/>` +
    text(X(1.2), Y(1.78), 'Stop-and-go grows from', { weight: 700, size: 13 }) + text(X(1.2), Y(1.78) + 17, 'the smallest upset', { weight: 700, size: 13 }) +
    text(X(0.53), Y(0.12), 'Smooth after any upset', { weight: 700, size: 13 });
  // legend
  let lx = 24;
  body += `<line x1="${lx}" x2="${lx + 22}" y1="70" y2="70" stroke="${INK}" stroke-width="2"/>` + text(lx + 28, 74, 'linear theory', { size: 12.5 });
  lx = 150;
  for (const [, op, , name] of sizes) { body += `<circle cx="${lx + 6}" cy="70" r="5" fill="${BLUE}" fill-opacity="${op}" stroke="${BLUE}"/>` + text(lx + 16, 74, `simulator, ${name}`, { size: 12.5 }); lx += 170; }
  body += text((x0 + x1) / 2, yB + 44, 'Load number Λ: intended flow of cars ÷ what the lane can carry', { anchor: 'middle', size: 12.5 }) +
    `<text transform="translate(18 ${(y0 + yB) / 2}) rotate(-90)" text-anchor="middle" fill="${INK}" font-size="12.5">Delay number R = reaction time ÷ following time</text>`;
  return svg(760, 460, 'A hard tap jams traffic 15 to 30 percent below the theory line, opening a metastable band',
    title('A hard tap jams traffic 15–30% below the theory line, opening a metastable band') + body);
}

// ---------------------------------------------------------------- 5. what a smooth road costs
export function absorbers() {
  const rows = read('absorbers').out.filter(o => o.absorbT === 2.6);
  const { boundary } = read('regime');
  const lambda = 1.05, Rc = criticalR(lambda), lo = 0.775;   // band at Λ 1.05: 50%-tap boundary (similarity.json, road A) to theory
  const x0 = 64, x1 = 700, y0 = 84, yB = 330, Rmin = 0.75, Rmax = 1.45, nmax = 12;
  const X = r => x0 + (r - Rmin) / (Rmax - Rmin) * (x1 - x0), Y = n => yB - n / nmax * (yB - y0);
  let body = `<rect x="${X(lo)}" y="${y0}" width="${X(Rc) - X(lo)}" height="${yB - y0}" fill="${AMBER}" opacity="0.22"/>` +
    text((X(lo) + X(Rc)) / 2, y0 + 18, 'metastable band', { anchor: 'middle', size: 12.5, weight: 700 }) +
    `<rect x="${X(Rc)}" y="${y0}" width="${x1 - X(Rc)}" height="${yB - y0}" fill="${RED}" opacity="0.08"/>` +
    text((X(Rc) + x1) / 2, y0 + 18, 'past the theory line', { anchor: 'middle', size: 12.5, weight: 700 });
  for (const n of [0, 3, 6, 9, 12]) body += `<line x1="${x0}" x2="${x1}" y1="${Y(n)}" y2="${Y(n)}" stroke="${GRID}"/>` + text(x0 - 10, Y(n) + 4, n, { anchor: 'end', size: 12, fill: MUTED });
  const bw = 34;
  for (const r of rows) {
    const h = yB - Y(r.minAbsorbers);
    body += `<rect x="${X(r.R) - bw / 2}" y="${Y(r.minAbsorbers)}" width="${bw}" height="${Math.max(h, 1.5)}" rx="4" fill="${BLUE}">${tip(`R = ${r.R}: ${r.minAbsorbers} of 30 drivers must leave room (${Math.round(r.phiMin * 100)}%)`)}</rect>` +
      text(X(r.R), Y(r.minAbsorbers) - 8, r.minAbsorbers === 0 ? 'none' : `${r.minAbsorbers} of 30`, { anchor: 'middle', size: 12.5, weight: 700 }) +
      text(X(r.R), yB + 20, r.R.toFixed(1), { anchor: 'middle', size: 12, fill: MUTED });
  }
  body += `<line x1="${x0}" x2="${x1}" y1="${yB}" y2="${yB}" stroke="${AXIS}"/>` +
    text((x0 + x1) / 2, yB + 42, 'Delay number R at load 1.05', { anchor: 'middle', size: 12.5 }) +
    `<text transform="translate(22 ${(y0 + yB) / 2}) rotate(-90)" text-anchor="middle" fill="${INK}" font-size="12.5">drivers who leave room</text>`;
  void boundary;
  return svg(760, 390, 'One driver who leaves room is enough near the bottom of the band; past it, five to ten are needed',
    title('One driver in thirty is enough low in the band; nearer the theory line it takes five', 'Fewest evenly spaced drivers who leave room that keep a ring of 30 smooth after a hard tap') + body);
}

// ---------------------------------------------------------------- 6. two roads, one answer
export function similarity() {
  const s = read('similarity');
  const rows = s.boundary;
  const x0 = 250, x1 = 700, y0 = 96, step = 30, Rlo = 0.6, Rhi = 1.6;
  const X = r => x0 + (r - Rlo) / (Rhi - Rlo) * (x1 - x0);
  const yB = y0 + rows.length * step + 6;
  // drawn in this order, so a marker that lands on another stays visible: diamond under dot under ring
  const series = [['B-real', 'trucks, real braking limits', 'diamond', AMBER], ['A', 'cars', 'circle', INK], ['B-model', 'trucks, every constant scaled', 'ring', BLUE]];
  const mark = (shape, x, y, c) => shape === 'circle' ? `<circle cx="${x}" cy="${y}" r="5" fill="${c}"/>`
    : shape === 'ring' ? `<circle cx="${x}" cy="${y}" r="8" fill="none" stroke="${c}" stroke-width="2.5"/>`
    : `<path d="M${x} ${y - 10}l10 10l-10 10l-10 -10z" fill="${c}" fill-opacity="0.9"/>`;
  let body = '';
  for (let r = 0.6; r <= 1.601; r += 0.2) body += `<line x1="${X(r)}" x2="${X(r)}" y1="${y0 - 8}" y2="${yB}" stroke="${GRID}"/>` + text(X(r), yB + 18, r.toFixed(1), { anchor: 'middle', size: 12, fill: MUTED });
  rows.forEach((row, i) => {
    const y = y0 + i * step + step / 2;
    const odd = row.lambda === 1.05 && row.tap === '50% tap';
    if (odd) body += `<rect x="16" y="${y - step / 2 + 2}" width="${x1 + 40 - 16}" height="${step - 4}" rx="6" fill="${AMBER}" opacity="0.16"/>`;
    body += text(24, y + 4, `load ${row.lambda}, ${row.tap === 'tiny' ? 'smallest upset' : row.tap === '15% tap' ? '15% brake tap' : '50% brake tap'}`, { size: 12.5, weight: odd ? 700 : 400 });
    const vals = series.map(([k]) => row[k]);
    body += `<line x1="${X(Math.min(...vals))}" x2="${X(Math.max(...vals))}" y1="${y}" y2="${y}" stroke="${AXIS}"/>`;
    for (const [k, name, shape, c] of series) body += `<g>${tip(`${name}: stop-and-go from R = ${row[k]} (load ${row.lambda}, ${row.tap})`)}${mark(shape, X(row[k]), y, c)}</g>`;
  });
  let lx = 24;
  for (const [, name, shape, c] of series) { body += mark(shape, lx + 8, 72, c) + text(lx + 22, 76, name, { size: 12.5 }); lx += 222; }
  body += text((x0 + x1) / 2, yB + 40, 'critical delay number R', { anchor: 'middle', size: 12.5 });
  return svg(760, yB + 56, 'Trucks and cars jam at the same delay number until a hard tap meets the braking limit',
    title('Trucks and cars jam at the same delay number, until a hard tap meets the braking limit') + body);
}

export const FIGURES = { drivers, groups, growth, regime, absorbers, similarity };

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = new URL('./figures/', import.meta.url);
  mkdirSync(dir, { recursive: true });
  for (const [name, fn] of Object.entries(FIGURES)) writeFileSync(new URL(`${name}.svg`, dir), fn());
  console.log('wrote', Object.keys(FIGURES).map(n => `report/figures/${n}.svg`).join(', '));
}
