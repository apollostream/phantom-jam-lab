# Brief: "The Jam Nobody Started"

This is the specification the report was written from. Give it, with the files it names, to Claude Code
(or follow it yourself) to regenerate or extend the report. `report/README.md` gives the steps.

## What it is

A narrative companion to the technical report *Phantom Traffic Jams: A Szirtes Dimensional Analysis*. It
tells the story of Phantom Jam Lab and its analysis for a reader who wants the ideas and the history,
not the matrices. It is analogous to *Built on Evidence: The Ideas Behind decibo*, and copies that book's
voice and chapter shape.

- **Title:** The Jam Nobody Started. **Subtitle:** The Ideas Behind Phantom Jam Lab.
- **Audience:** an engineer or curious reader who has played with the lab, not a traffic specialist.
- **Length:** about 6,500 words, including the glossary and sources.
- **Format:** an HTML page published as an Artifact, built from `the-jam-nobody-started.md` by
  `build-html.mjs`: a collapsible contents rail on the left (a drawer on phones), a guide-sign hero, a serif
  reading column, numbered figures. Published at https://claude.ai/artifact/KTFZrZstqSVB7hAqVYsgQ9.
- **Earlier draft:** a Claude Doc at https://claude.ai/artifact/Te77Qy3AhDUFWDPdwDZGw2 (doc id
  `d7bbe3f2-d188-478c-9242-5aa7a56818d9`, tab `d190145a-47ba`, body `9e6b1dda-0664`, chart widget
  `02fb8163-e3c6`). The HTML edition supersedes it.

## Style sources

1. **Voice exemplar:** the decibo book, `~/projects/decibo/docs/annotated-bibliography/`. Read
   `OUTLINE.md` (section "Form", the voice bullet), `research/BRIEF.md` (the "Voice" paragraph),
   `index.qmd` (the prologue) and `optimize-now.qmd` (a full chapter). Published:
   https://claude.ai/artifact/SDyR7HTjh6AjBdNJQGroAC
2. **House style:** the `edit-prose` skill (`~/.claude/skills/edit-prose/SKILL.md`), with its audit
   script `scripts/prose_audit.sh`.

## Voice

A documentary narrator, as in a History Channel or PBS profile of American industry.

- Plain words and short sentences. Define a technical term the first time, or avoid it; every term of
  art also goes in the Glossary.
- Each act opens with a **scene** of about 100 words: a real place, a year, people doing something
  concrete (the GM test track, the Bureau of Standards in 1914, Froude's towing tank).
- People appear with **names and dates only**: no biographies, no praise words, no hype. Say what a
  source showed, not how important it is. Do not infer anyone's pronouns from a name; use the name.
- **Failures** appear only in the Epilogue's short retrospective.
- House style: no reflexive "not X, it's Y" frames; no em-dashes; no reached-for clichés; bold only a
  defined term or a section's one or two takeaways; one voice throughout.
- Speak to a chemical engineer where it helps: Reynolds and Damköhler numbers, a reactor's ignited
  branch, column flooding, stages. One analogy per idea.

## Structure

Each act: scene → story (headed subsections) → "Where it lives in the lab/analysis" (code paths).

| Section | Content | Data it rests on |
| --- | --- | --- |
| Prologue: A Ring of Twenty-Two Cars | Sugiyama's 2008 ring; the YouTube short; the two questions; the answer in brief; who built it; map of the acts | Sugiyama et al. 2008 |
| Act I · The Wave | GM car following (1958, 1959: the stability product); Lighthill–Whitham–Richards waves; Kerner–Konhäuser metastability, Bando's optimal velocity model; IDM (2000) and Human Driver Model (2006); the lab's two kinds of driver and the emergency reflex | sources; `src/engine.js` |
| Act II · The Lab | the two rings; time-space record, readout, car card; the four control panels (table); the six scenes; Stern et al. 2018 field test | `src/app.html` `SCENARIOS`; `analysis/results/scene2.json` |
| Act III · Numbers Without Units | Buckingham 1914; Reynolds and Damköhler; the owner's question; Szirtes' Dimensional Set; cars as a unit and the one-car constant; Λ and R as formulas; table of groups as ratios of rates; reduction (fixed, fused, tested); the missing tap size | companion report Steps 1–4; `analysis/dimensional-set.mjs`, `relevancy.mjs` |
| Act IV · The Map | the first user's observation; string stability and R_c; the simulated grid; **chart**; the metastable band (reactor analogy); absorber cost table; smoothness vs speed; scene 2 moved into the band, ten seeds; the Regime map panel | `regime.json`, `absorbers.json` (absorber headway 2.6 s), `scene2.json`, linear theory |
| Act V · Two Roads, One Answer | Froude's tank; the similarity rule; making the engine's hidden constants scale; road A vs B table; four findings (exact scale model, boundaries match, b_max/b missing, S matters after big taps) | `similarity.json`, `pi-sweep.json` |
| Epilogue: How This Was Built | habits: one engine, fingerprint, tests as claims, browser checks, one-command rerun; retrospective (distraction exponent, scene 2 R = 0.9, mid-run NaN); closing paragraph | `test/engine.test.mjs`, `package.json` |
| Glossary | about 20 terms, alphabetical, one or two sentences each | |
| Sources | APA, each with a visible DOI or URL; then the lab and the technical report | `sources.json` |

## Figures

Eleven figures, each placed after a named sentence (`PLACEMENTS` in `build-html.mjs`). Each one:
- has a title that states its finding;
- takes its colours from the lab: blue for drivers who leave room, green to amber to red for speed, and the
  guide-sign green as the page accent;
- follows the page's light or dark theme;
- carries hover values on its marks.

| # | Where | Figure | Made by |
| --- | --- | --- | --- |
| 1 | Prologue | the ring experiment replayed (GIF) | `media.mjs`, scene "ring" |
| 2 | Act I, stimulus and response | one tap growing into a jam (GIF) | `media.mjs`, scene "tap" |
| 3 | Act I, the driver in the machine | the two kinds of driver (diagram) | `figures.mjs` `drivers` |
| 4 | Act II, side by side | the time-space record after scene 2 (still) | `media.mjs` |
| 5 | Act III, after Λ and R | the two governing numbers at the defaults (diagram) | `figures.mjs` `groups` |
| 6 | Act IV, a ripple passed car to car | ripple growth for R = 1.0, 1.2, 1.4 (chart) | `figures.mjs` `growth` |
| 7 | Act IV, thousands of rings | the regime map (chart) | `figures.mjs` `regime` |
| 8 | Act IV, the price of a smooth road | drivers who leave room needed, with the band shaded (chart; replaces the table) | `figures.mjs` `absorbers` |
| 9 | Act IV, scene 2 | one driver against everyone tailgating (GIF) | `media.mjs`, scene "one" |
| 10 | Act IV, the map in the lab | the app's Regime map panel (still) | `media.mjs` |
| 11 | Act V, what the test found | car road against two truck roads (dot plot) | `figures.mjs` `similarity` |

## Rules for numbers and sources

- Every number in the text must be computed by the analysis scripts, and each one is listed in
  `report/facts.mjs` with the sentence that states it. Add a claim there whenever the text gains a
  number.
- Every journal source is checked against Crossref by `report/check-sources.mjs`; add new ones to
  `sources.json`.
- Not machine-checked, from general knowledge: Stern's experiment ran in Arizona in 2016; Froude's tank
  was on the English coast in the 1870s; the GM research laboratories were in Michigan. Verify before
  making any of them more specific.
