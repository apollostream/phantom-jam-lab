// Builds the illustrated HTML edition of "The Jam Nobody Started" from its source text.
//   in:  report/the-jam-nobody-started.md (the text), report/figures.mjs (drawn figures,
//        computed from analysis/results), report/media/ (GIFs and app stills from media.mjs)
//   out: report/dist/index.html and report/dist/media/, ready to publish as an Artifact
// Every figure is placed by a sentence it follows; the build stops if a sentence is missing.
// Run: node report/build-html.mjs
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, rmSync } from 'node:fs';
import { marked } from 'marked';
import katex from 'katex';
import { FIGURES } from './figures.mjs';

const here = f => new URL(f, import.meta.url);
const md = readFileSync(here('./the-jam-nobody-started.md'), 'utf8');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const SIM_URL = 'https://claude.ai/artifact/MHSiC7wxrhT9haM1Y5FpnF';

// ---------------------------------------------------------------- figures
let figNo = 0;
const caption = (text, source) => `<figcaption><span class="fig-no">Figure ${++figNo}.</span> ${text}${source ? `<span class="fig-src">${source}</span>` : ''}</figcaption>`;
const drawn = (name, text, source) => `<figure class="fig fig-svg" id="fig-${name}">${FIGURES[name]().replace(/fig-arrow/g, `${name}-arrow`)}${caption(text, source)}</figure>`;
const anim = (name, alt, text, source) => `<figure class="fig fig-anim" id="fig-${name}"><div class="anim">` +
  `<img src="media/${name}.gif" ${dims(`${name}.gif`)} data-gif="media/${name}.gif" data-still="media/${name}-still.png" alt="${esc(alt)}" loading="lazy" decoding="async">` +
  `<button class="anim-toggle" type="button" aria-label="Pause animation">Pause</button></div>${caption(text, source)}</figure>`;
const still = (name, alt, text, source) => `<figure class="fig fig-still" id="fig-${name}"><img src="media/${name}.png" ${dims(`${name}.png`)} alt="${esc(alt)}" loading="lazy" decoding="async">${caption(text, source)}</figure>`;
const FROM_LAB = 'Filmed from Phantom Jam Lab by report/media.mjs.';
// Pixel size of a PNG or GIF, written into the <img> so the page reserves its space before it loads
// (otherwise images loading above a section push it down while a contents link scrolls to it).
function size(file) {
  const b = readFileSync(here(`./media/${file}`));
  return b.toString('ascii', 1, 4) === 'PNG' ? { w: b.readUInt32BE(16), h: b.readUInt32BE(20) } : { w: b.readUInt16LE(6), h: b.readUInt16LE(8) };
}
const dims = file => { const { w, h } = size(file); return `width="${w}" height="${h}"`; };

// [where: 'after' a block containing the text, or 'replace' it, text, figure builder]
const PLACEMENTS = [
  ['after', 'The knot drifted backward around the ring', () => anim('ring-experiment',
    'A ring of 22 cars in Phantom Jam Lab. The cars start evenly spaced and green; within a minute a cluster of red, crawling cars forms and drifts backward around the ring.',
    'The ring experiment, replayed in the lab: 22 cars on a 230-metre circle, a 40 km/h limit and a little driver distraction. Nobody brakes on purpose. Within the first minute a knot of crawling cars forms and circles backward. Two simulated minutes.', FROM_LAB)],
  ['after', 'the slowdown grows as it travels', () => anim('one-tap',
    'Thirty tailgating cars on a ring. Car 1 taps its brakes; a band of orange and red cars spreads backward and deepens.',
    'One tap of the brakes. At 0:04 the driver of car 1 drops to half speed for a moment. Each tailgater behind brakes a little harder than the one ahead, and the slowdown grows into a jam that travels backward. Fifty-six simulated seconds.', FROM_LAB)],
  ['after', 'Their preferred following time is three seconds rather than one', () => drawn('drivers',
    'The lab’s two kinds of driver. Tailgaters follow the Human Driver Model with a one-second following time and a reaction delay; drivers who leave room smooth out the speed of the car ahead.', 'Drawn by report/figures.mjs from the engine’s defaults.')],
  ['after', 'Under the rings, a time-space record traces', () => still('time-space',
    'Two time-space records. Upper: one driver who leaves room, all lines green with one blue line. Lower: everyone tailgates, a red band slopes downward across the record.',
    'The time-space record after four simulated minutes of scene 2. Each line is one car’s trip around the ring; time runs left to right. Above, one driver who leaves room (blue) and every line stays green. Below, everyone tailgates and a red jam band slides backward around the ring.', FROM_LAB)],
  ['after', 'is Thompson\'s proposed group, exactly', () => drawn('groups',
    'The two governing numbers at the lab’s defaults. Each car at the speed limit needs its length, its stopped gap and its safety margin; the load number compares that need with the road available. The delay number compares a driver’s reaction time with the time between cars.', 'Drawn by report/figures.mjs from the lab’s default settings.')],
  ['after', 'Working it through for the lab\'s tailgaters gives a', () => drawn('growth',
    'How a ripple grows from car to car at the default load, from linear theory. Below the critical delay number it fades; above it, it compounds.', 'Computed by analysis/linear-stability.mjs.')],
  ['replace', 'regime-map.png', () => drawn('regime',
    'The regime map. The black line is linear theory; blue dots are where the simulator first showed stop-and-go for three sizes of upset. Between the smallest-upset dots and the hard-tap dots lies the metastable band. Hover a dot for its value.', 'Data: analysis/regime-sweep.mjs, 12 loads × 33 delay numbers × 3 upset sizes, 400-second runs.')],
  ['replace', 'Chart source:', () => ''],
  ['replace', '| Delay number R | Drivers who leave room', () => drawn('absorbers',
    'What a smooth road costs at the default load. Shaded: the metastable band (from the hard-tap boundary at R = 0.775 to the theory line at 1.10) and the region past the theory line.', 'Data: analysis/absorber-sweep.mjs, drivers who leave room at a 2.6-second following time, evenly spaced, 400-second runs.')],
  ['after', 'turns a five-minute jam into a road that settles', () => anim('one-driver',
    'Two rings of 30 cars side by side after the same hard tap. Left, with one driver who leaves room, the colours return to green. Right, where everyone tailgates, orange and red bands keep circling.',
    'Scene 2, side by side. Both rings get the same tap at 0:04. On the left, the driver just behind the tapper leaves room, and the ring settles. On the right, everyone tailgates and the jam keeps circling. About two and a half simulated minutes.', FROM_LAB)],
  ['after', 'Clicking anywhere on the map moves the road there', () => still('regime-panel',
    'The Regime map panel in Phantom Jam Lab, showing the theory line, the measured hard-tap line, the shaded regions and a dot for the current road.',
    'The Regime map panel in the lab, with scene 2’s road marked.', `Screenshot of <a href="${SIM_URL}" target="_blank" rel="noopener">Phantom Jam Lab</a> by report/media.mjs.`)],
  ['after', 'In linear theory the two roads agree exactly', () => drawn('similarity',
    'The similarity test. For each load and upset size, the delay number at which stop-and-go first appears on the car road and two versions of the truck road. The highlighted row is the one that parts company: after a hard tap, the trucks’ real braking limits matter. The open ring at load 0.9 after a hard tap is the knife-edge rounding miss described in the text.', 'Data: analysis/similarity.mjs.')],
];

// ---------------------------------------------------------------- markdown to html
const slug = s => s.normalize('NFKD').toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const toc = [], seen = new Map();
const renderer = new marked.Renderer();
renderer.heading = function ({ tokens, depth }) {
  // Overpass sets a narrow space; widen the gap around the act separator.
  const inner = this.parser.parseInline(tokens).replace(/ · /g, '\u2002·\u2002'), plain = inner.replace(/<[^>]+>/g, '');
  // Repeated headings ("Where it lives in the lab") get -2, -3, ... so every anchor is unique.
  let id = slug(plain);
  seen.set(id, (seen.get(id) ?? 0) + 1);
  if (seen.get(id) > 1) id += `-${seen.get(id)}`;
  if (depth === 2 || depth === 3) toc.push({ depth, id, text: plain });
  return `<h${depth} id="${id}">${inner}</h${depth}>\n`;
};
renderer.code = ({ text, lang }) => lang === 'latex'
  ? `<div class="math">${katex.renderToString(text, { displayMode: true, output: 'mathml', throwOnError: true })}</div>`
  : `<pre><code>${esc(text)}</code></pre>`;
renderer.link = function ({ href, tokens }) {
  const inner = this.parser.parseInline(tokens);
  return /^https?:/.test(href) ? `<a href="${esc(href)}" target="_blank" rel="noopener">${inner}</a>` : `<a href="${esc(href)}">${inner}</a>`;
};
renderer.table = function (token) {
  const cell = (c, tag) => `<${tag}>${this.parser.parseInline(c.tokens)}</${tag}>`;
  return `<div class="table-wrap"><table><thead><tr>${token.header.map(c => cell(c, 'th')).join('')}</tr></thead><tbody>` +
    token.rows.map(r => `<tr>${r.map(c => cell(c, 'td')).join('')}</tr>`).join('') + '</tbody></table></div>\n';
};

const tokens = marked.lexer(md);
// The title, subtitle and byline become the hero; the text starts at the first section.
const start = tokens.findIndex(t => t.type === 'heading' && t.depth === 2);
const body = tokens.slice(start);
const used = new Set();
let html = '';
for (const t of body) {
  const hits = PLACEMENTS.filter(([, text]) => t.raw.includes(text));
  hits.forEach(h => { if (used.has(h)) throw new Error(`placement matched twice: ${h[1]}`); used.add(h); });
  const replace = hits.find(([w]) => w === 'replace');
  html += replace ? replace[2]() : marked.parser([t], { renderer });
  for (const h of hits.filter(([w]) => w === 'after')) html += h[2]();
}
const missing = PLACEMENTS.filter(p => !used.has(p));
if (missing.length) throw new Error(`figure anchors not found in the text:\n${missing.map(m => `  ${m[1]}`).join('\n')}`);

// Contents: each section (h2) with its subsections (h3).
const groups = [];
for (const h of toc) if (h.depth === 2) groups.push({ ...h, kids: [] }); else groups.at(-1)?.kids.push(h);
const tocHtml = groups.map(g => g.kids.length
  ? `<li class="toc-group" data-for="${g.id}"><div class="toc-row"><a href="#${g.id}">${esc(g.text)}</a><button class="toc-twisty" type="button" aria-expanded="false" aria-label="Show subsections of ${esc(g.text)}"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M4 2.5L8 6L4 9.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div><ol hidden>${g.kids.map(k => `<li><a href="#${k.id}">${esc(k.text)}</a></li>`).join('')}</ol></li>`
  : `<li class="toc-group" data-for="${g.id}"><div class="toc-row"><a href="#${g.id}">${esc(g.text)}</a></div></li>`).join('');

const template = readFileSync(here('./page.template.html'), 'utf8');
const page = template.replace('{{TOC}}', tocHtml).replace('{{BODY}}', html).replace(/\{\{SIM_URL\}\}/g, SIM_URL);

const dist = here('./dist/');
rmSync(dist, { recursive: true, force: true });
mkdirSync(here('./dist/media/'), { recursive: true });
writeFileSync(here('./dist/index.html'), page);
const media = readdirSync(here('./media/')).filter(f => /\.(gif|png)$/.test(f) && page.includes(`media/${f}`));
for (const f of media) copyFileSync(here(`./media/${f}`), here(`./dist/media/${f}`));
console.log(`wrote report/dist/index.html (${(page.length / 1024).toFixed(0)} KB, ${figNo} figures, ${groups.length} sections) and ${media.length} media files`);
