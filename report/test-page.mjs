// Page test for the built HTML edition: every contents link, clicked on a fresh page at
// desktop and phone width with images arriving slowly, must leave its heading at the top of
// the screen. Guards against layout shifts and scripts that interrupt the scroll.
// Run after npm run report:build:  node report/test-page.mjs   (set PW_CHROMIUM if needed)
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const dist = new URL('./dist/', import.meta.url).pathname;
writeFileSync(dist + 'preview.html', '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style></head><body>' + readFileSync(dist + 'index.html', 'utf8') + '</body></html>');
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
let bad = 0, n = 0;
for (const [w, h] of [[1400, 900], [400, 860]]) {
  // a fresh page for every link: the worst case, nothing loaded yet
  const ids = await (async () => { const p = await browser.newPage(); await p.goto('file://' + dist + 'preview.html'); const r = await p.$$eval('.toc a', as => as.map(a => a.getAttribute('href').slice(1))); await p.close(); return r; })();
  for (const id of ids) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.route('**/media/**', async route => { await new Promise(r => setTimeout(r, 300 + Math.random() * 900)); route.continue(); });  // slow network
    await page.goto('file://' + dist + 'preview.html'); await page.waitForTimeout(300);
    if (w < 900) { await page.click('#openRail'); await page.waitForTimeout(350); }
    await page.evaluate(id => { const a = document.querySelector(`.toc a[href="#${id}"]`); const g = a.closest('.toc-group'); const t = g.querySelector('.toc-twisty'); if (a.closest('ol') && t && t.getAttribute('aria-expanded') !== 'true') t.click(); }, id);
    await page.click(`.toc a[href="#${id}"]`);
    await page.waitForTimeout(2500);
    const top = await page.evaluate(id => document.getElementById(id).getBoundingClientRect().top, id);
    const atEnd = await page.evaluate(() => innerHeight + scrollY >= document.documentElement.scrollHeight - 2);
    const ok = (top > -2 && top < (w < 900 ? 100 : 40)) || (atEnd && top > 0 && top < h);
    n++; if (!ok) { bad++; console.log(`MISS ${w}px ${id}: heading at ${Math.round(top)} px`); }
    await page.close();
  }
}
console.log(`${n - bad}/${n} contents links land on their heading`);
process.exitCode = bad ? 1 : 0;
await browser.close();
