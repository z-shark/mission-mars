# Mission: Mars

A browser game for the NASA Space Apps Challenge 2026, challenge "Space Mission Design Game". Design a small spacecraft, launch it to Mars and see whether it makes it. Four levels take a player from school age to an engineering review, built on real NASA data.

Team: Tar Solo (one human and one AI assistant, Claude Code).

## Play online

After GitHub Pages is switched on, the game opens at `https://z-shark.github.io/mission-mars/`.

## Download and run locally

You need a web browser and either Git or a ZIP download. The game is a set of static files, so no installation or build step is needed. A small local web server is required because the browser blocks loading data files from a plain file path.

1. Get the files: either `git clone https://github.com/z-shark/mission-mars.git` or press the green Code button on the GitHub page and choose Download ZIP, then unpack it.
2. Open a terminal in the project folder.
3. Start any static web server. With Python 3: `python -m http.server 8765`. With Node.js: `npx serve -l 8765`.
4. Open `http://localhost:8765/` in a browser.

To run the tests you need Node.js 20 or newer: `node --test tests/`.

## Levels

| Level | For | What you do |
|---|---|---|
| Rookie | School students | Choose instruments and fuel; earn stars |
| Explorer | Teenagers | Add launch date, solar panels, observation time and a budget |
| Student | University students | Add rocket, engine and radio band; meet a list of requirements |
| Engineer | Adults, professionals | Shape the orbit, size the radio link, read a requirement matrix, sensitivity table, Monte Carlo and link budget, and export results |

See `docs/RULES.md` for the rules and the physics.

## Real data and game design

The game is built on NASA data and says clearly where it is not.

| Used for | NASA source |
|---|---|
| Positions of Earth and Mars | JPL Horizons |
| Engines, solar cells, launch vehicles, instruments | NASA State of the Art of Small Spacecraft Technology (SOA 2026) |
| Radio blackout near the Sun | NASA ASCEND 2022 study |
| Planet data | NASA NSSDCA fact sheets |
| Radio link (Earth antenna gain and noise) | NASA DSN Telecommunications Link Design Handbook, module 104 |
| Mars missions used for comparison | NASA NSSDCA (MRO, MAVEN, InSight) |

Spacecraft masses, costs, budgets, requirement thresholds and the probabilities of random events are game design. Every source has a direct link in `docs/SOURCES.md`. Values live in `data/mission_params.json` (sourced) and `data/game_assumptions.json` (game design).

## Project layout

```
index.html      redirect to src/index.html
src/            page, styles and JavaScript modules
src/js/         model (rules), physics, transfer solver, texts, glossary, UI
data/           sourced parameters, game assumptions, Earth-Mars table, solar activity table (not used yet)
docs/           RULES.md, SOURCES.md
scripts/        data download and table builders (Python)
tests/          node tests for physics, transfer solver and model
```

## Tests

```
node --test tests/
```

## Rebuilding the data tables

`scripts/fetch_horizons.py` downloads the positions of Earth and Mars from the JPL Horizons service and writes `data/earth_mars_range.json`. `scripts/build_solar_table.py` turns the NASA Marshall sunspot forecast into `data/solar_activity.json`; the game does not use that file yet.

## Licence

The code and texts are released under the MIT licence (see `LICENSE`). NASA data in `data/` are public data from the cited sources and are not covered by this licence; see `docs/SOURCES.md`.

## Use of AI

The code was written with Claude Code (Anthropic). Physics formulas, data choices and all sources were checked by the author. AI did not generate any NASA data; all NASA numbers come from the cited documents.
