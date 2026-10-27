// Source check for "The Jam Nobody Started": every DOI in report/sources.json is looked
// up in Crossref and its first author, year, volume and pages compared with what the
// report cites; every DOI and URL must also appear in the report snapshot.
// Needs network access.  Run: node report/check-sources.mjs
import { readFileSync } from 'node:fs';

const sources = JSON.parse(readFileSync(new URL('./sources.json', import.meta.url), 'utf8'));
const report = readFileSync(new URL('./the-jam-nobody-started.md', import.meta.url), 'utf8');
let failed = 0;
const fail = (what, why) => { failed++; console.log(`FAIL  ${what}: ${why}`); };

for (const s of sources) {
  const what = s.doi ?? s.url;
  if (!report.includes(what)) { fail(what, 'not cited in the report'); continue; }
  if (!s.doi) { console.log(`skip  ${what} (${s.note})`); continue; }
  const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(s.doi)}`);
  if (!res.ok) { fail(what, `Crossref HTTP ${res.status}`); continue; }
  const m = (await res.json()).message;
  const got = {
    firstAuthor: m.author?.[0]?.family, year: m.issued?.['date-parts']?.[0]?.[0],
    volume: m.volume, page: m.page ?? m['article-number'], authors: m.author?.length,
  };
  const bad = Object.keys(got).filter(k => s[k] !== undefined && String(s[k]) !== String(got[k]));
  if (bad.length) fail(what, bad.map(k => `${k} is ${got[k]}, cited as ${s[k]}`).join('; '));
  else console.log(`PASS  ${what}  ${got.firstAuthor} ${got.year}, ${m['container-title']?.[0]} ${got.volume}, ${got.page}`);
}
console.log(`\n${failed ? `${failed} problem(s)` : 'all sources check out'}`);
process.exitCode = failed ? 1 : 0;
