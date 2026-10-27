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

- **The simulator:** [Phantom Jam Lab](https://apollostream.github.io/phantom-jam-lab/) on GitHub Pages,
  also published on claude.ai as [Phantom Jam Lab](https://claude.ai/artifact/MHSiC7wxrhT9haM1Y5FpnF). Run
  any number of cars on two rings side by side, and choose how many of them leave ample room ahead instead
  of tailgating.
- **The technical report:** [Phantom Traffic Jams: A Szirtes Dimensional Analysis](https://claude.ai/artifact/Nid5md6VqM4DPfdRkrQWe7),
  with every matrix and table, in the notation of Thomas Szirtes' *Applied Dimensional Analysis and
  Modeling*.

## What is here

| Folder | Contents |
| --- | --- |
| `src/` | the traffic model (`engine.js`) and the app page (`app.html`) |
| `test/` | tests of the traffic model |
| `analysis/` | the dimensional analysis, stability theory and simulation sweeps; results in `analysis/results/` |
| `docs/` | the fuel and stress scores and driver model B: research, parameters and results |
| `report/` | the narrative report: source text, fact and citation checks, figures, filmed media, page builder |
| `.claude/skills/documentary-report/` | a Claude Code skill that rebuilds or extends the report |

## The model in brief

Each car is one of two kinds of driver.
- **Tailgaters** follow the Human Driver Model: the Intelligent Driver Model with a reaction delay, a
  forward guess of the gap, and random wobble in speed.
- **Drivers who leave room** match the smoothed speed of the traffic ahead and keep a wider gap.

Drivers who leave room follow one of two models, chosen in the app under Drivers:
- **Model A, classic (the default):** the original driver, which the report and the analysis describe.
- **Model B, three-state:** closing in, the driver first coasts with the foot off both pedals, and brakes
  only if coasting won't do.

The second road can run the same drivers under the other model, to compare A and B side by side.

Each road also shows two gauges:
- **fuel efficiency**, where 100% is the fuel the road would burn in steady flow at its load;
- **the average distance driven between stressful moments**, meaning firm braking or a close call.

[`docs/fuel-stress-and-variant-b.md`](docs/fuel-stress-and-variant-b.md) gives the research behind both
gauges and model B.

The analysis reduces the road to dimensionless groups. Two decide the outcome:
- **Λ (load):** how full the road is, compared with the space each car wants at its preferred speed.
- **R:** reaction time divided by the chosen time gap.

## Run it

You need Node 24. The report steps also need ffmpeg and a Chromium for Playwright
(`npx playwright install chromium`).

```sh
npm install
npm run build             # writes the simulator: dist/index.html (standalone) and dist/phantom-jam-lab.html (for claude.ai)
npm test                  # tests of the traffic model
npm run analysis          # reruns the analysis into analysis/results/ (about 2 minutes)
npm run analysis:fuel     # fuel and stress for every scene, under both driver models
npm run report:check      # checks every number in the report against the results, and citations against Crossref
npm run report:media      # films the GIFs and stills from the simulator
npm run report:build      # writes the report page to report/dist/
npm run report:test-page  # checks that every contents link lands on its heading
```

Open `dist/index.html` in a browser to run the simulator locally. Every push to `main` rebuilds it and
deploys it to GitHub Pages (`.github/workflows/pages.yml`); the claude.ai pages are republished by hand. [`report/README.md`](report/README.md)
gives the details of the report pipeline.

## Background

The project started from the YouTube short
[Why Do Phantom Traffic Jams Happen?](https://www.youtube.com/shorts/jBTahEPAr-I) and from Sugiyama and
colleagues' 2008 experiment, in which 22 cars on a circular track made a jam out of nothing.

## License

MIT. See [`LICENSE`](LICENSE).
