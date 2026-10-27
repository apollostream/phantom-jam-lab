# The Jam Nobody Started: how to reproduce it

The documentary report on Phantom Jam Lab, and everything needed to rebuild it.

- **Published edition** (HTML, with contents sidebar, figures and animations):
  https://claude.ai/artifact/KTFZrZstqSVB7hAqVYsgQ9
- **Source text:** `the-jam-nobody-started.md` in this folder. Edit the text here, then rebuild.
- An earlier Claude Doc draft is at https://claude.ai/artifact/Te77Qy3AhDUFWDPdwDZGw2. The HTML edition
  supersedes it.

| File | What it is |
| --- | --- |
| `BRIEF.md` | the specification: voice, structure, style sources, figures, rules for numbers |
| `the-jam-nobody-started.md` | the source text |
| `facts.mjs` | recomputes every number the text states and checks the sentence is in the text |
| `sources.json`, `check-sources.mjs` | the cited works, checked against Crossref |
| `figures.mjs` | the six drawn figures, as SVG computed from `analysis/results/` |
| `media.mjs` | films the three GIFs and two app stills from the real simulator, with a fixed clock |
| `page.template.html` | the page design: contents rail, hero sign, typography, theme, scripts |
| `build-html.mjs` | Markdown + figures + media → `dist/index.html` and `dist/media/` |
| `regime-chart.mjs`, `regime-chart.template.jsx` | the regime map as a Claude Docs widget (for the doc draft) |
| `media/`, `regime-map.png` | generated pictures, kept so the page builds without a browser |

## Rebuild

From the project folder, with Node 24, `npm install` (dev tools: Playwright, marked, KaTeX) and ffmpeg:

```sh
npm run analysis        # simulation and theory results into analysis/results/ (about 2 minutes)
npm run report:check    # numbers in the text vs the data; citations vs Crossref (needs network)
npm run report:media    # rebuild the lab, then film the GIFs and stills (about 2 minutes)
npm run report:build    # write report/dist/
npm run report:test-page  # every contents link lands on its heading (desktop and phone)
```

`report:media` needs a Chromium: `npx playwright install chromium`, or set `PW_CHROMIUM` to an existing
binary. The clock in the filmed page is faked and paused, so frames are taken at exact simulated times: two
runs give pixel-identical frames (the GIF bytes can differ in encoding).

Then publish `report/dist/index.html` with its `media/` files to the same artifact. The
`/documentary-report` skill does this; by hand, use the Artifact tool with
`file_path: report/dist/index.html` and a `files` map of `media/<name>` → `report/dist/media/<name>`.

## What is reproducible

Every number, figure, animation and citation rebuilds exactly from the code and the source text. The
prose was written by a language model from `BRIEF.md`. A fresh rewrite would not match word for word, so
revisions edit `the-jam-nobody-started.md` and rerun the checks.

## Adding a figure

1. Draw it in `figures.mjs` from the results (or film it in `media.mjs`).
2. Add a placement to `PLACEMENTS` in `build-html.mjs`, naming the sentence it follows. The build stops if
   that sentence is missing.
3. Rebuild and look at it in both themes and at phone width.
