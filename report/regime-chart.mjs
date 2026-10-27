// Builds the Act IV regime-map chart of "The Jam Nobody Started" from the analysis
// results, so the chart in the doc can be regenerated after `npm run analysis`.
//   in:  analysis/results/regime.json (simulated boundaries), linear theory,
//        report/regime-chart.template.jsx (the drawing; data slots __SIMS__ etc.)
//   out: report/regime-chart.jsx, the Claude Docs widget module to publish
// Run: node report/regime-chart.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { criticalR } from '../analysis/linear-stability.mjs';
import { loadNumber, BASE } from '../analysis/lib.mjs';

const here = f => new URL(f, import.meta.url);
const { boundary } = JSON.parse(readFileSync(here('../analysis/results/regime.json'), 'utf8'));

// One row per load and upset size; null = no stop-and-go up to R = 1.8.
const sims = boundary.flatMap(r => ['tiny', 'dip15', 'dip50'].map(size => ({ lambda: r.lambda, size, Rc: r[size] })));
// The theory line where linear theory gives a finite boundary, every 0.05 in load.
const theory = [];
for (let l = 0.8; l <= 1.3001; l += 0.05) theory.push({ lambda: +l.toFixed(2), Rc: +criticalR(+l.toFixed(2)).toFixed(3) });
// The two roads the report marks: the lab's default and scene 2 (src/app.html).
const road = cfg => +loadNumber({ ...BASE, ...cfg }).toFixed(2);
const app = [
  { key: 'default', name: 'Lab default', lambda: road({}), R: 1.0 },
  { key: 'scene2', name: 'Scene 2', lambda: road({ length: 860 }), R: 0.8 },
];

// The widget module expects JavaScript object literals with single-quoted strings.
const lit = rows => '[' + rows.map(r => '{' + Object.entries(r).map(([k, v]) =>
  `${k}:${typeof v === 'string' ? `'${v}'` : v}`).join(',') + '}').join(',') + ']';
const code = readFileSync(here('./regime-chart.template.jsx'), 'utf8')
  .replace('__SIMS__', lit(sims)).replace('__THEORY__', lit(theory)).replace('__APP__', lit(app));
writeFileSync(here('./regime-chart.jsx'), code);
console.log(`wrote report/regime-chart.jsx: ${sims.length} simulated points, ${theory.length} theory points, roads ${app.map(a => `${a.name} (Λ ${a.lambda}, R ${a.R})`).join(', ')}`);
