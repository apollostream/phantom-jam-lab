# Phantom Jam Lab

A traffic simulator for watching jams form on a ring road with no crash, lane closure or bottleneck to
cause them. It comes with a dimensional analysis that maps when traffic stays smooth and when it jams,
and a narrative report that tells the whole story.

## Read the report

**[The Jam Nobody Started: The Ideas Behind Phantom Jam Lab](https://claude.ai/artifact/KTFZrZstqSVB7hAqVYsgQ9)**

The report has animated replays from the simulator, eleven figures and a contents panel you can
collapse. It covers:
- the 2008 ring-road experiment and the car-following models behind the lab;
- the two numbers that decide whether a road jams;
- the regime map, and how many drivers who leave room it takes to keep a road smooth;
- a scale-model test of the analysis.

Its source text, figures and build scripts are in [`report/`](report/).

## Other editions

- **The simulator:** [Phantom Jam Lab](https://claude.ai/artifact/MHSiC7wxrhT9haM1Y5FpnF). Run any number
  of cars on two rings side by side, and choose how many of them leave ample room ahead instead of
  tailgating.
- **The technical report:** [Phantom Traffic Jams: A Szirtes Dimensional Analysis](https://claude.ai/artifact/Nid5md6VqM4DPfdRkrQWe7),
  with every matrix and table, in the notation of Thomas Szirtes' *Applied Dimensional Analysis and
  Modeling*.

## What is here

| Folder | Contents |
| --- | --- |
| `src/` | the traffic model (`engine.js`) and the app page (`app.html`) |
| `test/` | tests of the traffic model |
| `analysis/` | the dimensional analysis, stability theory and simulation sweeps; results in `analysis/results/` |
| `report/` | the narrative report: source text, fact and citation checks, figures, filmed media, page builder |
| `.claude/skills/documentary-report/` | a Claude Code skill that rebuilds or extends the report |

## The model in brief

Each car is one of two kinds of driver.
- **Tailgaters** follow the Human Driver Model: the Intelligent Driver Model with a reaction delay, a
  forward guess of the gap, and random wobble in speed.
- **Drivers who leave room** match the smoothed speed of the traffic ahead and keep a wider gap.

The analysis reduces the road to dimensionless groups. Two decide the outcome:
- **Λ (load):** how full the road is, compared with the space each car wants at its preferred speed.
- **R:** reaction time divided by the chosen time gap.

## Run it

You need Node 24. The report steps also need ffmpeg and a Chromium for Playwright
(`npx playwright install chromium`).

```sh
npm install
npm run build             # writes dist/phantom-jam-lab.html, a single-file copy of the simulator
npm test                  # tests of the traffic model
npm run analysis          # reruns the analysis into analysis/results/ (about 2 minutes)
npm run report:check      # checks every number in the report against the results, and citations against Crossref
npm run report:media      # films the GIFs and stills from the simulator
npm run report:build      # writes the report page to report/dist/
npm run report:test-page  # checks that every contents link lands on its heading
```

Open `dist/phantom-jam-lab.html` in a browser to run the simulator locally. [`report/README.md`](report/README.md)
gives the details of the report pipeline.

## Background

The project started from the YouTube short
[Why Do Phantom Traffic Jams Happen?](https://www.youtube.com/shorts/jBTahEPAr-I) and from Sugiyama and
colleagues' 2008 experiment, in which 22 cars on a circular track made a jam out of nothing.

## License

MIT. See [`LICENSE`](LICENSE).
