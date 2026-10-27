// Captures the report's animations and app screenshots from the real simulator page.
// The browser's clock is faked (Playwright's page.clock), so every frame is taken at an
// exact simulated time and a rerun produces the same pictures.
//   in:  dist/index.html (run `npm run build` first)
//   out: report/media/*.gif and *.png
// Needs ffmpeg on the PATH. Set PW_CHROMIUM to a Chromium binary if Playwright's own
// browser is not installed (npx playwright install chromium).
// Run: node report/media.mjs [name ...]   (no names = everything)
import { chromium } from 'playwright';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const page_url = new URL('../dist/index.html', import.meta.url).href;
const out = new URL('./media/', import.meta.url).pathname;
const tmp = new URL('./media/.frames/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });

// Each GIF: a scene from the app, the element to film, the app's speed setting, how much
// real (faked) time passes between frames, and how many frames. Simulated seconds per
// frame = speed x step / 1000.
const GIFS = {
  'ring-experiment': { scene: 'ring', el: '#roadA', speed: 8, stepMs: 100, frames: 150, width: 520,
    note: '22 cars, 230 m ring, a little distraction: a jam forms with nobody braking on purpose' },
  'one-tap': { scene: 'tap', el: '#roadA', speed: 4, stepMs: 100, frames: 140, width: 520,
    note: 'thirty tailgaters, one tap to half speed at 0:04' },
  'one-driver': { scene: 'one', el: '#roads', speed: 8, stepMs: 100, frames: 200, width: 760,
    note: 'scene 2: one driver leaves room (left) against everyone tailgating (right)' },
};
// Still pictures of app panels, taken after a scene has run for `runS` simulated seconds.
const STILLS = {
  'time-space': { scene: 'one', speed: 8, runS: 240, el: '#ts', width: 1100 },
  'regime-panel': { scene: 'one', speed: 8, runS: 20, el: '.panel.regime', width: 1100 },
};

const want = process.argv.slice(2);
const pick = name => !want.length || want.includes(name);
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});

async function open(scene, speed) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, colorScheme: 'light', deviceScaleFactor: 2 });
  await page.clock.install({ time: 0 });
  await page.goto(page_url);
  await page.evaluate(() => document.fonts.ready);
  // Stop the faked clock: from here on, time moves only when runFor() says so.
  await page.clock.pauseAt(await page.evaluate(() => Date.now()) + 50);
  await page.clock.runFor(300);
  await page.click(`.scn[data-key="${scene}"]`);
  await page.click(`#speedSeg button[data-v="${speed}"]`);
  // A clock stamp on the filmed area, so a reader can tell how much time has passed.
  await page.evaluate(() => {
    const s = document.createElement('div');
    s.id = 'filmClock';
    s.style.cssText = 'position:absolute;right:14px;bottom:10px;font:600 15px var(--mono);color:var(--muted);z-index:5;pointer-events:none';
    for (const id of ['roadA', 'roads']) { const el = document.getElementById(id); if (getComputedStyle(el).position === 'static') el.style.position = 'relative'; }
    document.getElementById('roads').appendChild(s);
  });
  return page;
}
const stamp = page => page.evaluate(() => { document.getElementById('filmClock').textContent = document.getElementById('clock').textContent; });

for (const [name, g] of Object.entries(GIFS)) {
  if (!pick(name)) continue;
  rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
  const page = await open(g.scene, g.speed);
  for (let f = 0; f < g.frames; f++) {
    await stamp(page);
    await page.locator(g.el).screenshot({ path: `${tmp}f${String(f).padStart(4, '0')}.png` });
    await page.clock.runFor(g.stepMs);
  }
  await page.close();
  // 10 frames a second; the last frame held for two seconds before the loop restarts.
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '10', '-i', `${tmp}f%04d.png`, '-vf',
    `tpad=stop_mode=clone:stop_duration=2,scale=${g.width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`,
    `${out}${name}.gif`]);
  // A still of the last frame, shown instead of the animation when motion is reduced or paused.
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${tmp}f${String(g.frames - 1).padStart(4, '0')}.png`, '-vf', `scale=${g.width}:-1:flags=lanczos`, `${out}${name}-still.png`]);
  console.log(`${name}.gif: ${g.frames} frames, ${(g.frames * g.speed * g.stepMs / 1000).toFixed(0)} simulated seconds (${g.note})`);
}
for (const [name, s] of Object.entries(STILLS)) {
  if (!pick(name)) continue;
  const page = await open(s.scene, s.speed);
  await page.clock.runFor(s.runS * 1000 / s.speed);
  await page.clock.runFor(400);   // let the panels redraw
  await page.locator(s.el).screenshot({ path: `${tmp}still.png` });
  await page.close();
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${tmp}still.png`, '-vf', `scale=${s.width}:-1:flags=lanczos`, `${out}${name}.png`]);
  console.log(`${name}.png: scene ${s.scene} after ${s.runS} simulated seconds`);
}
await browser.close();
if (existsSync(tmp)) rmSync(tmp, { recursive: true, force: true });
