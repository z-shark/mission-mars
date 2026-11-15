# Mission: Mars. Game Rules

Single-player web game for the NASA Space Apps Challenge 2026 challenge "Space Mission Design Game". The player designs a small spacecraft, launches it to Mars and sees whether it makes it. Everything runs in the browser from static files.

Real data and game design are kept apart. Real values come from NASA material and are listed with direct links in `SOURCES.md`; game-design values (masses and costs of the game spacecraft, budgets, thresholds, probabilities) are illustrative and live in `data/game_assumptions.json`. The interface marks which is which in every "?" popup and in the "What is real, and what is game design?" button.

## 1. Levels

All levels share one calculation engine. A level only decides how many choices are visible and how results are shown.

| Level | Internal id | Audience | Idea | Result style |
|---|---|---|---|---|
| Rookie | `cadet` | School students | Pick instruments and fuel in three steps | Stars and a thrifty bonus |
| Explorer | `explorer` | Teenagers | Free launch date, solar panels, observation time, budget | Stars and a thrifty bonus |
| Student | `engineer` | University students | Launch date, rocket, engine, solar panels, radio band | Requirements met or not |
| Engineer | `analyst` | Adults, professionals | Orbit shape, radio antenna and transmitter, requirement matrix, sensitivity, Monte Carlo, link budget, export. No pictures, minimal animation | Requirements met or not |

Each level contains all the choices of the previous one.

## 2. Missions

Each mission is a letter from scientists with questions to answer, a credit budget, a bonus and level-specific requirements.

| Level | Missions |
|---|---|
| Rookie | First orbit, Dust watch, Landing scouts, Future crew, Landing site, Magnetic mystery |
| Explorer | Dust and cold, Relay for a rover, Magnetic hunt, Grand survey |
| Student | Behind the Sun, Gentle push, Best window, Lander taxi |
| Engineer | AN-1 Climate watch, AN-2 Mapping orbiter |

Every mission from Explorer upwards has a "You will learn" line before the flight and a "Takeaway" after a success.

## 3. What the player chooses

| Choice | Levels | Effect |
|---|---|---|
| Instruments | all | Mass, power, cost, and which scientists' questions can be answered. Each instrument also produces data (Engineer level) |
| Propellant mass | all | Speed change available (rocket equation) against speed change needed |
| Science time | Explorer and up | Months at Mars; every month costs credits |
| Launch date | Explorer and up | Moves Earth and Mars; sets flight time, launch energy C3 and arrival speed |
| Solar panel area | Explorer and up | Electricity at Mars |
| Launch vehicle | Student and up | Mass limit and cost |
| Engine (chemical or electric) | Student and up | Specific impulse, thrust and electricity need. Electric engines are too weak to brake into orbit |
| Radio band (S, X, Ka) | Student and up | How close to the Sun contact survives (blackout days) and cost |
| Closest and farthest orbit point | Engineer | Braking cost, orbit period (Kepler), picture resolution |
| Radio antenna diameter and transmitter power | Engineer | Antenna gain, link budget, mass, electricity, cost |
| Random seed | Engineer | Repeats the same random events |

## 4. Physics

- Positions of Earth and Mars come from the NASA JPL Horizons table (daily, 2026-2035) in `data/earth_mars_range.json`.
- The transfer is solved as Lambert's problem between the real positions; it gives flight time, launch energy C3 and arrival speed V-infinity.
- Rocket equation: delta-v = Isp · g0 · ln(m0 / m1) with Isp from NASA SOA 2026.
- Capture burn into a circular or elliptical orbit around Mars uses the Mars gravitational parameter from NASA NSSDCA.
- Orbit period T = 2π · sqrt(a³ / mu).
- Solar flux at Mars follows the inverse square law (NSSDCA Mars fact sheet) and panel power uses the SOA 2026 cell efficiency.
- One-way light delay is distance divided by the speed of light.
- Solar conjunction: contact is lost when the Sun-Earth-Mars angle is below the band threshold (S 4.0, X 2.3, Ka 1.0 degrees, NASA ASCEND 2022). Lost days are counted from the ephemeris.
- Radio link (Engineer): link budget with the 34 m DSN receive gain and system noise per band from the NASA DSN handbook 810-005 module 104. The largest data rate follows from Eb/N0; data returned is rate times contact time.

## 5. Checks and results

Each design is checked continuously in the forecast panel. Common checks: enough fuel for the trip (with a reserve), engine strong enough to brake in 12 hours, launch energy, has an instrument, answers the scientists' main questions, fits the launch vehicle, enough electricity, radio contact, inside the budget. Engineer adds the radio-link data check.

### 5.1 Stars (Rookie, Explorer)

A mission has three goals; each met goal gives one star. A thrifty bonus is awarded for finishing with enough credits left. The best result per mission is kept in the browser.

### 5.2 Requirements (Student, Engineer)

Each mission lists requirements R1... with a pass or fail test on one number and a live "now" value. The result is "k of N requirements met". Student shows the nominal result; Engineer also shows the Monte Carlo probability of each requirement.

### 5.3 Score

Score = 100 per star or met requirement + 50 for the thrifty bonus + 5 per credit left + 25 per answered scientist question. A design that cannot launch scores zero.

## 6. Credits and budget

Credits are game units, not money. The spacecraft body, instruments, fuel tanks, solar panels, vehicle, engine, radio band, antenna, transmitter and months of operation cost credits. No NASA source gives component prices, so every cost is game design. Real total mission costs (MarCO, InSight) are shown only as context.

## 7. Randomness

From Student upwards every flight rolls two dice. The probabilities are game design.

| Event | Chance | Effect |
|---|---|---|
| Navigation surprise | 30 percent | Needs a random 0-120 m/s of extra speed change. If the reserve is too small the mission is lost |
| Dust storm | 25 percent | Sunlight drops by 40 percent. If the power margin is under 40 percent science time is halved |

The forecast shows the chance of a smooth mission. At Engineer level a Monte Carlo of 500 flights with a fixed seed gives the probability that each requirement is met. A flight uses a random seed that is shown after the flight and can be typed back to repeat it.

## 8. Reporting facts honestly

- Every glossary "?" shows three explanation levels (Simple, More detail, Student) plus a "Real data" and "Game design" line and source links.
- Launch-vehicle mass limits are upper bounds from vendor documents; no C3-to-mass curve is published, and the game says so.
- The margin policy and the thresholds in the requirements are game choices.
- After a mission the game compares the player's design with real NASA missions (Mars Reconnaissance Orbiter, MAVEN).

## 9. Technical notes

- Static ES modules, no build step. Data in `data/`, code in `src/js/`, texts in `src/js/texts.js` and `src/js/glossary.js` (English; separate from logic so a translation is possible).
- Tests: `node --test tests/` covers physics, transfer solver and the model.
