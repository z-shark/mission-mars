# Mission: Mars

A browser game for the NASA Space Apps Challenge 2026, challenge "Space Mission Design Game". Design a small spacecraft, launch it to Mars and see whether it makes it. Four levels take a player from school age to an engineering review, built on real NASA data.

Team: Tar Solo (one human and one AI assistant, Claude Code).

## Play

The game is a set of static files. Serve the project folder with any static web server and open the page:

```
python -m http.server 8765
```

Then open `http://localhost:8765/src/index.html`.

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

## Use of AI

The code was written with Claude Code (Anthropic). Physics formulas, data choices and all sources were checked by the author. AI did not generate any NASA data; all NASA numbers come from the cited documents.
