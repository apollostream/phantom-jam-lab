---
name: documentary-report
description: Regenerate, revise or extend "The Jam Nobody Started", the PBS-documentary-toned narrative report on Phantom Jam Lab and its dimensional analysis. Use when asked to rebuild the report, update it after the analysis or app changes, add a section, or write another report in the same voice.
---

# Documentary report on Phantom Jam Lab

The specification is `report/BRIEF.md`; the published edition is the HTML page it describes. Read it first, completely; it fixes the voice, the structure, the
figures and the rules for numbers. `report/README.md` lists the files.

## Steps

1. **Load the style.** Read the decibo exemplar files named in the brief's "Style sources", and invoke the
   `edit-prose` skill. Use the companion technical report
   (https://claude.ai/artifact/Nid5md6VqM4DPfdRkrQWe7) for the analysis details.
2. **Refresh the evidence.** Run `npm run analysis` if the engine or analysis changed, then
   `npm run report:check`. Read the output; every number you write must come from these results.
3. **Write the text.** Edit `report/the-jam-nobody-started.md`, changing only what was asked and keeping
   the voice. For a new section or figure, follow the brief's structure and figure tables.
4. **Figures.** Draw new figures in `report/figures.mjs` from the results, or film them with
   `report/media.mjs`. Place each one in `PLACEMENTS` in `report/build-html.mjs`, after a sentence it
   follows. If the engine or the app changed, run `npm run report:media`.
5. **Check.** Add a `report/facts.mjs` claim for every new number, and a `sources.json` entry for every new
   source. Then run `npm run report:check` and
   `bash ~/.claude/skills/edit-prose/scripts/prose_audit.sh report/the-jam-nobody-started.md`.
6. **Build, look, publish.** Run `npm run report:build`, then `npm run report:test-page`. Screenshot the page from `report/dist/` in light
   and dark and at 400 px wide, and look at every changed figure. Then publish `report/dist/index.html`
   with the Artifact tool:
   - publish to the same URL, https://claude.ai/artifact/KTFZrZstqSVB7hAqVYsgQ9 (pass it as `url` from a
     new conversation);
   - pass `files`: `media/<name>` → `report/dist/media/<name>` for each file in `report/dist/media/`.
7. **Report back** with the page link and the check results, including any claim that failed and how it was
   resolved.
