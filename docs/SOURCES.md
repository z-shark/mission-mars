# Sources

Every number used by the game must trace to an entry here. Status values: `used` (in the data files), `read` (read, not yet entered), `pending` (to find), `weak` (secondary or inconsistent, verify before use).

## Rules for adding a source

1. Record the direct URL of the exact document or page, not a landing page or a search result.
2. Record where in the document the value is (table, section, PDF page).
3. Add the entry here at the moment the source is used, before the value goes into a data file.
4. A value without an entry here does not enter the code. If a source cannot be opened, it is marked `weak` or left out.

## Locations inside SOA2026 (PDF page numbers of the downloaded file)

| Content | Location |
|---|---|
| Solar cells | Table 3-1, PDF page 48 |
| Propulsion summary ranges | Table 4-1, PDF page 86 |
| Propulsion maturity classes C, D, E, F | Section 4, PDF pages 83 to 84 |
| Hydrazine monopropellant | Table 4-2, PDF page 125 |
| Alternative mono and bipropellant (Moog, Busek BGT-X5, NanoAvionics, ECAPS) | Table 4-3, PDF page 126 |
| Gridded-ion thrusters (Busek BIT-3) | Table 4-9, PDF page 133 |
| Deep-space transponders (Iris, SDST) | Table 5-11, PDF page 182 |

## Primary NASA sources

| ID | Source | URL | Used for | Status |
|---|---|---|---|---|
| HORIZONS | NASA JPL Horizons System API, heliocentric vectors of Earth (399) and Mars (499), ecliptic plane, 2 day step, 2026-11-01 to 2035-12-31 | https://ssd.jpl.nasa.gov/api/horizons.api | Earth-Mars range, one-way delay, Sun-Earth-Mars angle, Mars lead angle, conjunction blackouts (`data/earth_mars_range.json`, script `scripts/fetch_horizons.py`) | used |
| SOA2026 | NASA/TP-20260003140, State-of-the-Art Small Spacecraft Technology, May 2026 | https://nasa.gov/wp-content/uploads/2026/05/soa-2026.pdf | Propulsion (Tables 4-1, 4-3, 4-9), solar cells (Table 3-1), deep-space transponders (Table 5-11), propulsion maturity classes C/D/E/F | used |
| MARSHALL-SSN | NASA Marshall Solar Cycle Forecast, 13-month smoothed sunspot number, November 2026 issue | https://www.nasa.gov/wp-content/uploads/2026/11/nov2026ssn-prd.txt | Solar activity by year (`data/solar_activity.json`, script `scripts/build_solar_table.py`, raw copy in `data/raw/`) | used |
| JPL-MARCO | JPL mission page, Mars Cube One (MarCO) | https://www.jpl.nasa.gov/missions/mars-cube-one-marco | Reference mission facts: launch 2018-05-05, twin relay CubeSats, real-time link during InSight landing | used |
| ARIANE6-MUA | Arianespace and ArianeGroup, Ariane 6 User's Manual, Issue 2 Revision 0, March 2021, section 2.4.5 Earth escape missions: at V-infinity 2.5 km/s, Ariane 62 carries 2,600 kg and Ariane 64 carries 6,900 kg | https://ariane.group/app/uploads/sites/4/2024/10/Mua-6_Issue-2_Revision-0_March-2021.pdf | European launcher capacity for the launch vehicle choice (non-NASA, European vendor document) | used (2021 edition, may be superseded) |
| ROCKETLAB-2020 | Rocket Lab press release of 4 August 2020: Electron lifts up to 300 kg to low orbits; Photon bus offers up to 180 kg of payload mass for LEO and beyond | https://rocketlabcorp.com/updates/rocket-lab-increases-electron-payload-capacity-enabling-interplanetary-missions-and-reusability/ | US small launcher option (vendor document, no C3 figure) | used (weak) |
| FALCON-UG | SpaceX Falcon User's Guide, 9 May 2025: Earth-escape launches offered, mass-to-orbit figures available upon request | https://www.spacex.com/assets/media/falcon-users-guide-2025-05-09.pdf | Checked and not used: no numeric figure | read |
| ASCEND-2022 | McBrayer, Chai and Judd (NASA Langley Research Center), Communication Delays, Disruptions, and Blackouts for Crewed Mars Missions, ASCEND 2022 paper, NASA NTRS 20220013418 | https://ntrs.nasa.gov/api/citations/20220013418/downloads/ASCEND-Communication%20Delays%2C%20Disruptions%2C%20and%20Blackouts%20for%20Crewed%20Mars%20Missions.pdf | Conjunction angle definition (Sun-Earth-Mars angle theta, Earth at the vertex). Guideline thresholds by band: S-band unreliable below 4 degrees, X-band below 2.3 degrees, Ka-band below 1 degree. Mars Reconnaissance Orbiter commanding moratorium below 3 degrees, restrictions below 5 degrees. Analysis default 2 degrees. Table 1: days below the angle, 2034 row is 0, 9, 16 and 60 days for 1, 2, 3 and 10 degrees; averages 2.9, 11.8, 19.6 and 66.9 days. Solar disk 0.52 degrees from Earth. Used for `blackout_thresholds_deg` in `data/earth_mars_range.json` | used |
| NASA-TRL | NASA Space Communications and Navigation program, Technology Readiness Levels page, descriptions of TRL 1 to 9 | https://www.nasa.gov/directorates/somd/space-communications-navigation-program/technology-readiness-levels/ | TRL wording for the game: TRL 1 basic research; 2 speculative applications; 3 active research, proof-of-concept model; 4 components tested together; 5 breadboard tested in realistic environments; 6 functional prototype or representational model; 7 prototype demonstrated in space; 8 tested and flight qualified; 9 flight proven on a successful mission | used |
| NSSDC-MARS | NASA NSSDCA Mars Fact Sheet: Mars GM 0.042828 x 10^6 km^3/s^2, volumetric mean radius 3389.5 km, semimajor axis 227.956 x 10^6 km, sidereal period 686.980 days, synodic period 779.94 days, mean orbital velocity 24.08 km/s, solar irradiance 586.2 W/m^2 (Earth 1361.0 W/m^2, ratio 0.431), surface gravity 3.73 m/s^2 | https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html | Gravitational parameters and orbit sizes for transfer and capture formulas; solar flux ratio for the power model | used |
| NSSDC-EARTH | NASA NSSDCA Earth Fact Sheet: Earth GM 0.39860 x 10^6 km^3/s^2 | https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html | Earth gravitational parameter | used |
| NSSDC-SUN | NASA NSSDCA Sun Fact Sheet: Sun GM 132,712 x 10^6 km^3/s^2 | https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html | Sun gravitational parameter for the Hohmann transfer | used |
| JPL-PHYS | NASA JPL Solar System Dynamics, planetary physical parameters | https://ssd.jpl.nasa.gov/planets/phys_par.html | Cross-check of masses and radii (Mars mean radius 3389.50 km, mass 0.641691 x 10^24 kg) | read |
| CHALLENGE-RES | Space Apps challenge resources page for the Space Mission Design Game | https://www.spaceappschallenge.org/2026/challenges/space-mission-design-game/?tab=resources | Four mission segments, CML levels, MDL disciplines, telescope game pattern | read |

## Referenced but not used for any value

These pages came up during searching. They are listed so they are not lost, and none of their numbers are in the data files.

| Topic | Source | URL | Why not used |
|---|---|---|---|
| MarCO mass, power, data rate (conflicting values) | Wikipedia, Mars Cube One | https://en.wikipedia.org/wiki/Mars_Cube_One | Secondary source; values disagree with others |
| MarCO flight review | ISSFD 2019 paper | https://www.issfd.org/ISSFD_2019/ISSFD_2019_AIAC18_Martin-mur-Tomas.pdf | Not read in full |
| MarCO overview | The Space Review | https://thespacereview.com/article/2814/1 | Secondary source |
| Technology Readiness Assessment Best Practices Guide | NASA NTRS | https://ntrs.nasa.gov/api/citations/20205003605/downloads/%20SP-20205003605%20TRA%20BP%20Guide%20FINAL.pdf | Downloaded (41 pages), formal TRL table not yet extracted; NASA-TRL page used instead |
| Solar Cycle 25 prediction (panel consensus) | NASA | https://www.nasa.gov/missions/sdo/what-will-solar-cycle-25-look-like/ | Superseded by the Marshall monthly forecast |
| Marshall solar cycle forecast page | NASA | https://www.nasa.gov/solar-cycle-progression-and-forecast/ | Landing page for MARSHALL-SSN data |
| CAPSTONE press kit (Electron and Photon, about 300 kg lift mass, 25 kg spacecraft) | Rocket Lab | https://www.rocketlabusa.com/assets/Uploads/CAPSTONE-Press-Kit3.pdf | Downloaded, not read in detail |
| Ariane 6 multi-launch service manual (small-satellite rideshare) | Arianespace | https://www.arianespace.com/app/uploads/sites/4/2026/07/a6-mls_users_manual_1-0_june2026.pdf | Possible source for rideshare options; not read |
| NASA State-of-the-Art Small Spacecraft Technology, online edition | NASA Ames | https://sst-soa.arc.nasa.gov/04-propulsion | Host did not resolve from this machine; the PDF (SOA2026) is used instead |

## Method notes

- The solar activity level (low below 30, high from 70) is a game assumption applied to the median of the Marshall forecast, not a NASA classification.
- Conjunction blackout thresholds now come from the NASA paper ASCEND-2022: Ka-band 1 degree, analysis default 2 degrees, X-band 2.3 degrees, MRO moratorium 3 degrees, S-band 4 degrees. The table gives, for the four conjunctions in 2028, 2030, 2032 and 2034, blackout lengths of 17, 15, 11 and 9 days at 2 degrees; 19, 17, 13 and 11 days at 2.3 degrees; 25, 23, 19 and 17 days at 3 degrees; 35, 31, 25 and 21 days at 4 degrees. Ka-band at 1 degree gives two events of 5 and 7 days.
- Cross-check against NASA: ASCEND-2022 Table 1 lists 9 days at 2 degrees and 16 days at 3 degrees for 2034. The Horizons-based table gives 9 days and 17 days; the one-day difference is consistent with the two-day sampling step.
- Horizons output checked: range 56.9 to 400.2 million km, one-way delay 3.2 to 22.2 minutes, matching the 3 to 22 minute range in the project handbook.

## Weak or unresolved

| Topic | Problem | Next step |
|---|---|---|
| MarCO mass and power | Secondary sources disagree (about 13.5 to 14 kg; power quoted as 35 W at launch and 17 W at Mars) | Find the NASA or JPL primary document before entering |
| Launch vehicles (3 options) | No NASA figures reachable: the NASA Launch Vehicle Performance website is interactive and was not retrievable, and the SOA report has no launch-capacity table. Vendor documents were used instead (Ariane 62, Ariane 64, Electron with Photon). Ariane figures are at C3 6.25, below typical Mars-transfer energy; Rocket Lab gives no C3 figure; launch prices are not published | Treat capacity as an upper bound in the game and say so on screen; use relative cost units |
| Instruments (3 options) | No source collected | Select from NASA small-spacecraft payload examples |
| Cost per component and launch | No NASA source collected | Use SOA or NASA small-mission cost statements, otherwise mark as game units |
| Margin policy by CML | Not collected | Cubesat 101 and the Mission Design Lab material |
| Ground contact (DSN) | Not collected | NASA DSN pages |
| Conjunction threshold | Resolved by ASCEND-2022 | none |

## Glossary sources (checked)

Candidates were collected by a search agent and then re-checked by direct requests on 2026-11-14: every link below returned HTTP 200, and its title and the key words of the term were found on the page. The page text itself has not been read in full yet; it must be read before any glossary text is written from it. A note of ok means no known problem.

| Term | Page title | URL | Institution | Level | Note |
|---|---|---|---|---|---|
| Mars and Earth orbits | How Long is a Year on Other Planets? - NASA Space Place – NASA Science for Kids | https://spaceplace.nasa.gov/years-on-other-planets/en/ | NASA | kids | ok |
| Mars and Earth orbits | Let's Go to Mars! Calculating Launch Windows – Math Lesson - NASA JPL Education | https://www.jpl.nasa.gov/edu/resources/lesson-plan/lets-go-to-mars-calculating-launch-windows/ | NASA | general | ok |
| Spacecraft and payload | Anatomy of a spacecraft | https://www.esa.int/articles/about-us/directorates/science/anatomy-of-a-spacecraft | ESA | general | ok |
| Spacecraft and payload | Science Payload - NASA Science | https://science.nasa.gov/mission/dawn/technology/science-payload/ | NASA | general | weak: mission-specific page |
| Propellant (fuel) | How Do We Launch Things Into Space? - NASA Space Place – NASA Science for Kids | https://spaceplace.nasa.gov/launching-into-space/en/ | NASA | kids | ok |
| Propellant (fuel) | Chapter 3: Gravity & Mechanics - NASA Science | https://science.nasa.gov/learn/basics-of-space-flight/chapter3-2/ | NASA | technical | ok |
| Delta-v | Chapter 3: Gravity & Mechanics - NASA Science | https://science.nasa.gov/learn/basics-of-space-flight/chapter3-2/ | NASA | technical | weak: delta-v wording appears only twice |
| Delta-v | Ideal Rocket Equation - Glenn Research Center - NASA | https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/ideal-rocket-equation/ | NASA | technical | ok |
| Thrust and specific impulse | How Do We Launch Things Into Space? - NASA Space Place – NASA Science for Kids | https://spaceplace.nasa.gov/launching-into-space/en/ | NASA | kids | weak: specific impulse not mentioned |
| Thrust and specific impulse | Chapter 3: Gravity & Mechanics - NASA Science | https://science.nasa.gov/learn/basics-of-space-flight/chapter3-2/ | NASA | technical | ok |
| Chemical and electric engine | Ion Propulsion - NASA Science | https://science.nasa.gov/mission/dawn/technology/ion-propulsion/ | NASA | general | ok |
| Light-time delay | Space Communications: 7 Things You Need to Know - NASA | https://www.nasa.gov/centers-and-facilities/goddard/space-communications-7-things-you-need-to-know/ | NASA | general | ok |
| Launch window | Launch a rocket from a spinning planet - NASA Space Place – NASA Science for Kids | https://spaceplace.nasa.gov/launch-windows/en/ | NASA | kids | dated: the page reports its last update as over 15 years ago (per the search agent) |
| Launch window | Let's Go to Mars! Calculating Launch Windows – Math Lesson - NASA JPL Education | https://www.jpl.nasa.gov/edu/resources/lesson-plan/lets-go-to-mars-calculating-launch-windows/ | NASA | general | ok |
| Hohmann transfer | Let's Go to Mars! Calculating Launch Windows – Math Lesson - NASA JPL Education | https://www.jpl.nasa.gov/edu/resources/lesson-plan/lets-go-to-mars-calculating-launch-windows/ | NASA | general | ok |
| Solar conjunction | What's Mars Solar Conjunction, and Why Does It Matter? - NASA Jet Propulsion Laboratory (JPL) | https://www.jpl.nasa.gov/news/whats-mars-solar-conjunction-and-why-does-it-matter/ | NASA | general | ok |
| Solar conjunction | Mars Solar Conjunction - NASA Science | https://science.nasa.gov/resource/mars-solar-conjunction/ | NASA | general | ok |
| Sun-Earth-Mars blackout angle | What's Mars Solar Conjunction, and Why Does It Matter? - NASA Jet Propulsion Laboratory (JPL) | https://www.jpl.nasa.gov/news/whats-mars-solar-conjunction-and-why-does-it-matter/ | NASA | general | context only: no angle definition; ASCEND-2022 gives the angle |
| Sun-Earth-Mars blackout angle | Mars Solar Conjunction - NASA Science | https://science.nasa.gov/resource/mars-solar-conjunction/ | NASA | general | context only: no angle definition; ASCEND-2022 gives the angle |
| Radio bands S, X, Ka | 9.0 Communications - NASA | https://www.nasa.gov/smallsat-institute/sst-soa/soa-communications/ | NASA | technical | ok |
| Radio bands S, X, Ka | Ka-Band Represents the Future of Space Communications - NASA | https://www.nasa.gov/general/ka-band-represents-the-future-of-space-communications/ | NASA | general | ok |
| Antenna and link margin | 9.0 Communications - NASA | https://www.nasa.gov/smallsat-institute/sst-soa/soa-communications/ | NASA | technical | ok |
| Antenna and link margin | Chapter 10: Telecom - NASA Science | https://science.nasa.gov/learn/basics-of-space-flight/chapter10-1/ | NASA | technical | ok |
| Data rate and downlink | 9.0 Communications - NASA | https://www.nasa.gov/smallsat-institute/sst-soa/soa-communications/ | NASA | technical | ok |
| Data rate and downlink | Ka-Band Represents the Future of Space Communications - NASA | https://www.nasa.gov/general/ka-band-represents-the-future-of-space-communications/ | NASA | general | ok |
| Solar array and sunlight at Mars | What Powers a Spacecraft? - NASA Space Place – NASA Science for Kids | https://spaceplace.nasa.gov/what-powers-a-spacecraft/en/ | NASA | kids | ok |
| Solar array and sunlight at Mars | Going solar for interplanetary missions | https://www.esa.int/Enabling_Support/Space_Engineering_Technology/Going_solar_for_interplanetary_missions | ESA | general | ok |
| Battery | What Powers a Spacecraft? - NASA Space Place – NASA Science for Kids | https://spaceplace.nasa.gov/what-powers-a-spacecraft/en/ | NASA | kids | ok |
| CubeSat | What are SmallSats and CubeSats? - NASA | https://www.nasa.gov/what-are-smallsats-and-cubesats/ | NASA | general | ok |
| Relay spacecraft | Mars Relay Network - NASA Science | https://science.nasa.gov/mars/mars-relay-network/ | NASA | general | ok |
| Deep Space Network | What is the Deep Space Network? - NASA | https://www.nasa.gov/directorates/somd/space-communications-navigation-program/what-is-the-deep-space-network/ | NASA | general | ok |
| Deep Space Network | Deep Space Network - NASA | https://www.nasa.gov/communicating-with-missions/dsn/ | NASA | general | ok |
| Space weather and solar activity | What Is Space Weather? - NASA Space Place – NASA Science for Kids | https://spaceplace.nasa.gov/spaceweather/en/ | NASA | kids | ok |
| Space weather and solar activity | What Is the Solar Cycle? - NASA Space Place – NASA Science for Kids | https://spaceplace.nasa.gov/solar-cycles/en/ | NASA | kids | ok |
| Solar flare | Sunspots and Solar Flares - NASA Space Place – NASA Science for Kids | https://spaceplace.nasa.gov/solar-activity/en/ | NASA | kids | ok |
| Solar flare | Glossary - NASA Space Place – NASA Science for Kids | https://spaceplace.nasa.gov/glossary/en/ | NASA | kids | ok |

Terms with no usable source yet: where the blackout thresholds come from (ASCEND-2022 is the only source), mass margin, cost and risk, and a kids-level explanation of delta-v, link margin and the blackout angle.

Excluded after checking: https://mars.nasa.gov/embed/6042/ (no readable text) and https://spaceplace.nasa.gov/ion-balloons/en/ (relevance to engines not confirmed).

## Glossary pages read in full (2026-11-14)

Texts in `src/js/glossary.js` were checked against these pages.

| Page | Used for |
|---|---|
| https://science.nasa.gov/learn/basics-of-space-flight/chapter3-2/ | delta-v as the most a vehicle can change velocity by expelling mass; specific impulse as efficiency, compared to miles per gallon |
| https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/ideal-rocket-equation/ | rocket equation with changing mass |
| https://spaceplace.nasa.gov/years-on-other-planets/en/ | Mars year 687 Earth days, Mars about 228 million km and Earth about 150 million km from the Sun |
| https://www.jpl.nasa.gov/edu/resources/lesson-plan/lets-go-to-mars-calculating-launch-windows/ | spacecraft is aimed at where Mars will be (football analogy), coasting with engines off, Hohmann path |
| https://www.jpl.nasa.gov/news/whats-mars-solar-conjunction-and-why-does-it-matter/ | solar conjunction every two years, corona gas corrupts radio, command moratorium of a few weeks |
| https://www.nasa.gov/centers-and-facilities/goddard/space-communications-7-things-you-need-to-know/ | one-way delay about 4 to 24 minutes between closest and farthest Mars |
| https://spaceplace.nasa.gov/what-powers-a-spacecraft/en/ | solar panels charge a battery; solar power used on Mars |
| https://www.esa.int/Enabling_Support/Space_Engineering_Technology/Going_solar_for_interplanetary_missions | inverse square law for sunlight |
| https://www.esa.int/articles/about-us/directorates/science/anatomy-of-a-spacecraft | service module and payload module |

The 43 percent sunlight ratio comes from the NSSDC fact sheets listed above. The delay range 3.2 to 22.2 minutes for 2026 to 2035 comes from our Horizons table. The figures 1 mN and 22 N come from SOA2026. Not yet checked by reading: the vendor limits in the mass-limit entry (Ariane 6 manual, Rocket Lab), and the ASCEND-2022 thresholds in the conjunction entry (already recorded above).

## Cost sources checked (2026-11-14)

| Source | URL | What it gives | Status |
|---|---|---|---|
| NASA, Small Spacecraft Institute: NASA and SmallSat cost estimation overview and model tools | https://www.nasa.gov/smallsat-institute/nasa-and-smallsat-cost-estimation-overview-and-model-tools | Describes methods (analogy, parametric, grassroots) and the JPL COMPACT tool for CubeSats. No prices or per-kilogram figures | read, no usable numbers |
| JPL, Mars Cube One (MarCO) mission page | https://www.jpl.nasa.gov/missions/mars-cube-one-marco | Mission description. No cost figure | read, no usable numbers |
| The Planetary Society, MarCO article | https://www.planetary.org/articles/0501-marco-cubesats-to-mars | Sentence "MarCO costs $18.5 million" (pre-launch, 2018) | read, non-NASA open source |
| SpaceNews, MarCO shows interplanetary cubesats possible but not easy (13 July 2020) | https://spacenews.com/marco-shows-interplanetary-cubesats-possible-but-not-easy/ | "$18.5 million MarCO mission", InSight about "$1 billion", ESA deep-space cubesats each budgeted $10 million to $20 million, NASA Discovery cap $500 million excluding launch and operations | read, non-NASA open source |

Not found in any NASA source: prices of components, launch vehicles or instruments. Launch prices were also not found (searches returned only NASA's VADR contract ceiling of $300 million across all awardees, which is not a per-launch price). The game therefore uses its own budget units; the only real anchors are the mission totals above.

## Dust storm facts used in game briefs (2026-11-14)

| Source | URL | What it supports |
|---|---|---|
| NASA JPL, Martian Dust Storm Grows Global; Curiosity Captures Photos of Thickening Haze (2018) | https://www.jpl.nasa.gov/news/martian-dust-storm-grows-global-curiosity-captures-photos-of-thickening-haze/ | A storm of tiny dust particles engulfed much of Mars and prompted Opportunity to suspend science; it became a "planet-encircling" event |
| NASA Scientific Visualization Studio, Mars 2018 Global Dust Storm | https://svs.gsfc.nasa.gov/30983 | Dust blocks the sunlight the solar panels need; such storms never truly cover the whole globe |

The briefs themselves (scientists' letters, questions, credit costs) are game design and are not NASA data. The sentence about MarCO relaying for InSight in 2018 is supported by the JPL MarCO page listed above.


## Glossary sources for orbit shape and V-infinity (2026-11-14)

| Source | URL | What it supports |
|---|---|---|
| NASA JPL, Basics of Space Flight, Chapter 3 (Gravity and Mechanics), page four | https://science.nasa.gov/learn/basics-of-space-flight/chapter3-4/ | Definitions of periapsis, apoapsis and orbit period; the period depends on altitude (read in full, 2026-11-14) |
| NASA Science, Orbits and Kepler's Laws | https://science.nasa.gov/solar-system/orbits-and-keplers-laws/ | Kepler's three laws including the period-semi-major-axis relation (read, 2026-11-14) |

Not read from a source and therefore described as standard physics in the game: the definition of C3 as V-infinity squared, the idea of requirements and margins, and one-at-a-time sensitivity analysis. Statements in the glossary entries "V-infinity and C3", "Requirements and margin", "Sensitivity" and "Science time" carry a Real data and Game design line saying so.

## Real Mars missions used for comparison (2026-11-14)

| ID | Source | URL | What it supports |
|---|---|---|---|
| NSSDCA-MRO | NASA NSSDCA, Mars Reconnaissance Orbiter, spacecraft details | https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=2005-029A | Launch 2005-08-12; reached Mars and entered orbit on 2006-03-10 (210 days); maximum spacecraft mass 2180 kg including 1149 kg of propellants; the orbit insertion burn requires about 70 percent of the fuel (read in full, 2026-11-14) |
| NSSDCA-MAVEN | NASA NSSDCA, MAVEN, spacecraft details | https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=2013-063A | Launch 2013-11-18; orbit insertion burn completed 2014-09-22 (308 days); science orbit of 4.5 hours with a periapsis of 150 km (read in full, 2026-11-14) |
| NSSDCA-INSIGHT | NASA NSSDCA, InSight, spacecraft details | https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=2018-042A | Launch 2018-05-05; landed mass 360 kg, entry mass about 608 kg (read, not used in the table because the arrival date is not on that page) |

The game table "Compared with real NASA missions" shows only these figures. Flight days are computed from the two dates. The propellant share of MRO (1149 of 2180 kg) is our arithmetic from the page figures.

## DSN radio link inputs (read 2026-11-14)

| ID | Source | URL | What it supports |
|---|---|---|---|
| DSN-810-005-104Q | NASA/JPL DSN Telecommunications Link Design Handbook (810-005), Module 104 Rev. Q, "34-m BWG Stations Telecommunications Interfaces" (106 pages, read tables 5, 7 and 9) | https://deepspace.jpl.nasa.gov/dsndocs/810-005/104/104Q.pdf | Receive antenna gain at the peak of the elevation curve, no atmosphere: S-band (2295 MHz) 56.74 dBi (Table 5); X-band (8425 MHz) 68.29 dBi and Ka-band (32050 MHz) 79.0 dBi (Table 7, X/Ka operation). System noise Top at zenith, 25 percent weather, clear, for DSS-34: S-band non-diplexed 27.79 K; X-band X/Ka HEMT-1 diplexed 21.25 K; Ka-band X/Ka HEMT-1 non-diplexed 33.93 K (Table 9). Stored in `data/mission_params.json` under `dsn` |
| DSN-HANDBOOK-INDEX | DSN handbook index page | https://deepspace.jpl.nasa.gov/dsndocs/810-005/ | Module list used to find module 104 |

Game design values (not NASA data): spacecraft antenna efficiency 0.55, other losses 2 dB, required Eb/N0 2 dB, transmitter amplifier efficiency 0.3, 8 hours of contact per day, dish sizes with their masses and credits, transmitter power options, and the data produced per month by each instrument. The handbook values apply to zenith clear-weather conditions; elevation, weather and pointing losses are covered only by the 2 dB game loss. Some entries in the handbook tables are marked TBD for stations not used here.

## Launch window spacing (derived, 2026-11-14)

The statement in the "Best window" mission that good launch dates return about every 26 months, with dips in December 2028, January 2031 and March 2033, comes from our own optimiser run on the NASA JPL Horizons table (source HORIZONS): the best transfer dates found were 2028-12-06, 2031-01-16 and 2033-03-28, about 771 and 802 days apart. The 26-month figure is the synodic period of Earth and Mars; it is consistent with those intervals.
