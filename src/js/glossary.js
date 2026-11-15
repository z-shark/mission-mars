export const glossary = {
  "link-budget": {
    name: "Radio link and data rate",
    levels: [
      "The spacecraft sends its pictures and measurements to Earth by radio. A bigger antenna, a stronger transmitter and a higher radio band let more data through.",
      "The signal gets very weak over millions of kilometres. A big antenna on Earth, called the Deep Space Network dish, catches it. The game counts how much data per month your radio can return and compares it with how much your instruments collect.",
      "Link budget: Eb/N0 = EIRP − path loss + G(Earth) − losses − 10·log10(k·T) − 10·log10(R). The game solves it for the largest data rate R that still leaves the required Eb/N0, at the farthest distance during your science phase. Earth-side gain and system noise temperature come from the NASA DSN handbook for a 34-metre antenna.",
    ],
    basis: { real: "Earth antenna gain, radio frequencies and system noise temperatures: NASA/JPL DSN Telecommunications Link Design Handbook, module 104 (34-metre beam waveguide station).", game: "Spacecraft antenna efficiency, transmitter power options, losses, required Eb/N0, 8 hours of contact per day, and the data produced by each instrument are game design." },
    sources: ["https://deepspace.jpl.nasa.gov/dsndocs/810-005/104/104Q.pdf", "https://deepspace.jpl.nasa.gov/dsndocs/810-005/"],
  },
  "monte-carlo": {
    name: "Monte Carlo: many random flights",
    levels: [
      "The game flies the same spacecraft hundreds of times with different random surprises and counts how often it works.",
      "Each flight rolls the dice for a navigation surprise and a dust storm. The share of flights where a requirement is still met is its probability.",
      "A Monte Carlo analysis samples the uncertain inputs many times and reports the distribution of outcomes. Here 500 flights are run with a fixed seed so the numbers repeat. The probabilities of the surprises are game design, so the result shows how a design copes with them, not a real forecast.",
    ],
    basis: { real: "Monte Carlo analysis is standard practice for mission margins.", game: "The size and probability of the surprises are game design." },
    sources: [],
  },
  "orbit-shape": {
    name: "Orbit shape: closest and farthest point",
    levels: [
      "An orbit is the path of a spacecraft around a planet. It is usually an oval. The closest point to the planet is called the periapsis and the farthest point the apoapsis.",
      "A circle has both points at the same height. A stretched oval has a low closest point and a high farthest point. The higher the farthest point, the longer one lap takes. That time is the orbit period.",
      "Braking into a stretched orbit needs much less speed change than braking into a low circle, so it saves fuel, but the orbit period gets longer. The period follows Kepler's third law: T = 2π√(a³/μ), where a is half the sum of the two radii.",
    ],
    basis: { real: "The definitions and Kepler's laws come from NASA JPL Basics of Space Flight and NASA Science.", game: "The allowed heights and the requirements on them are game design." },
    sources: ["https://science.nasa.gov/learn/basics-of-space-flight/chapter3-4/", "https://science.nasa.gov/solar-system/orbits-and-keplers-laws/"],
  },
  "vinf-c3": {
    name: "V-infinity and C3",
    levels: [
      "To get to Mars a spacecraft must leave Earth fast enough. A number called C3 tells how much. A smaller C3 is easier for the rocket.",
      "V-infinity is the speed the spacecraft would still have far away from a planet. At departure it tells the rocket how much energy to add. At Mars it tells how fast you arrive and so how hard you must brake. C3 is the departure V-infinity squared.",
      "C3 = V∞² in km²/s². On the launch-window chart the low points are dates where both V-infinity values are small. They are found by solving Lambert's problem between the real positions of Earth and Mars.",
    ],
    basis: { real: "Positions of Earth and Mars come from NASA JPL Horizons; the method is standard orbital mechanics.", game: "How much mass a rocket can lift at a given C3 is only partly known, so rocket limits are upper bounds." },
    sources: ["https://ssd.jpl.nasa.gov/horizons/"],
  },
  requirements: {
    name: "Requirements and margin",
    levels: [
      "A requirement is a rule the mission must meet, like \"work for 12 months\". A margin is the safety room between what you have and what you need.",
      "Real teams write down requirements first and then check each one: met or not met. Margin protects against surprises, such as spare fuel, spare power and spare mass.",
      "Here each requirement is a pass or fail test on one number, for example fuel reserve = (fuel gives − trip needs) / trip needs, or power margin = (supply − demand) / supply. The thresholds are game choices; real projects set theirs from standards and experience.",
    ],
    basis: { real: "Working with requirements and margins is standard practice in space engineering.", game: "Every threshold in the game is design, not a NASA value." },
    sources: [],
  },
  sensitivity: {
    name: "Sensitivity",
    levels: [
      "Sensitivity shows how much the result changes if you nudge one thing a little.",
      "Each row of the table changes one choice and recalculates the whole mission, so you see which choices matter a lot and which hardly matter.",
      "This is a one-at-a-time sensitivity analysis. Choices that interact, such as fuel, mass and power, can behave differently when changed together, which this table does not show.",
    ],
    basis: { real: "The method is standard engineering analysis.", game: "The size of each nudge (10 percent, 14 days, 100 km) is a game choice." },
    sources: [],
  },
  "science-time": {
    name: "Science time",
    levels: [
      "How long the instruments work at Mars after the spacecraft arrives.",
      "Longer gives more data but costs one credit for every month the mission runs. Some missions ask for a minimum number of months.",
      "In orbit missions the radio blackout around solar conjunction eats part of this time, which is why the choice of radio band can matter.",
    ],
    basis: { real: "Blackout dates come from NASA JPL Horizons positions and band limits from the NASA ASCEND 2022 study.", game: "The cost per month and the minimum months of each mission are game design." },
    sources: [],
  },
  risk: {
    name: "Risk and surprises",
    levels: [
      "Space is full of surprises, so engineers always carry spare fuel and spare power. The more spare you carry, the safer the mission, but the heavier and dearer it is.",
      "In the game two things can happen: a navigation error that needs extra fuel, and a dust storm that cuts the power from your panels. The percentages show how likely trouble is for your design, and the game rolls dice at launch.",
      "Nav error: 30% chance of 0 to 120 m/s extra; trouble if your reserve is smaller. Storm: 25% chance of a 40% cut in sunlight; trouble if power margin is under 40%. These numbers are game design.",
    ],
    basis: { real: "Dust storms that dim sunlight at Mars are real: NASA JPL reported the 2018 storm that stopped the Opportunity rover.", game: "The probabilities and sizes are game choices." },
    sources: ["https://www.jpl.nasa.gov/news/martian-dust-storm-grows-global-curiosity-captures-photos-of-thickening-haze/"],
  },
  "delta-v": {
    name: "Delta-v (speed change)",
    levels: [
      "Delta-v is the most a spacecraft can change its speed by throwing part of its own mass out as exhaust. Every turn, push or brake in space costs some.",
      "In this game the fuel you carry gives a delta-v. The trip needs a delta-v for course corrections and, if you orbit Mars, for braking. Available must be at least the needed amount.",
      "The rocket equation links them: delta-v = Isp x g0 x ln(wet mass / dry mass), with g0 = 9.80665 m/s2. Carrying more fuel helps, but makes the spacecraft heavier.",
    ],
    basis: { real: 'The rocket equation and the engine figures come from NASA.', game: 'The 50 m/s allowance for course corrections is a rounded game estimate.' },
    sources: ["https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/ideal-rocket-equation/", "https://science.nasa.gov/learn/basics-of-space-flight/chapter3-2/"],
  },
  "thrust-isp": {
    name: "Thrust and specific impulse",
    levels: [
      "Thrust is how hard an engine pushes. Specific impulse (Isp) tells how efficiently it uses fuel, a bit like miles per gallon for a car: the higher it is, the less fuel you need.",
      "A chemical engine pushes hard, so it can brake the spacecraft at Mars in hours. An ion engine uses fuel very efficiently but pushes thousands of times weaker (1 mN against 22 N), so it cannot brake in time.",
      "The game uses a 22 N chemical thruster with Isp about 300 s and a 1 mN ion thruster with Isp 1960 s, both from NASA State-of-the-Art Small Spacecraft Technology.",
    ],
    basis: { real: 'Thrust and efficiency of both engines come from the NASA State-of-the-Art Small Spacecraft Technology report (2026).', game: '' },
    sources: ["https://science.nasa.gov/learn/basics-of-space-flight/chapter3-2/", "https://nasa.gov/wp-content/uploads/2026/05/soa-2026.pdf"],
  },
  "launch-window": {
    name: "Launch window",
    levels: [
      "Earth and Mars move around the Sun at different speeds. A spacecraft is aimed like a pass in football: not at where Mars is now but at where it will be. The cheap chance comes about every two years.",
      "Launch at the wrong time and the spacecraft needs much more energy. The game computes the cheapest route for your date from the real positions of the planets.",
      "The energy is shown as C3, the square of the speed the spacecraft needs after leaving Earth. Windows repeat every synodic period, 779.94 days.",
    ],
    basis: { real: 'Planet positions and the transfer path use NASA JPL Horizons data.', game: '' },
    sources: ["https://www.jpl.nasa.gov/edu/resources/lesson-plan/lets-go-to-mars-calculating-launch-windows/", "https://ssd.jpl.nasa.gov/api/horizons.api"],
  },
  "mars-earth-orbits": {
    name: "Mars and Earth orbits",
    levels: [
      "Mars takes 687 Earth days to go around the Sun, almost two Earth years, and it is about 228 million km from the Sun against Earth's 150 million km.",
      "The spacecraft does not fly straight. It follows a curved path around the Sun and meets Mars where Mars will be.",
      "Flight time here comes from the real planet positions on the chosen date, using data from NASA JPL Horizons.",
    ],
    basis: { real: 'Orbits and positions use NASA JPL Horizons data.', game: '' },
    sources: ["https://spaceplace.nasa.gov/years-on-other-planets/en/"],
  },
  "light-time-delay": {
    name: "Radio delay",
    levels: [
      "Radio travels at the speed of light, but Mars is far. A message takes minutes to arrive.",
      "The delay changes as the planets move. NASA quotes about 4 to 24 minutes one way between closest and farthest. For 2026 to 2035 the Horizons data gives 3.2 to 22.2 minutes.",
      "Delay = distance / 299,792.458 km/s. The value shown uses the real Earth to Mars distance on the arrival date.",
    ],
    basis: { real: 'Distances come from NASA JPL Horizons; the delay is distance divided by the speed of light.', game: '' },
    sources: ["https://www.nasa.gov/centers-and-facilities/goddard/space-communications-7-things-you-need-to-know/", "https://ssd.jpl.nasa.gov/api/horizons.api"],
  },
  "solar-conjunction": {
    name: "Solar conjunction (Sun in the way)",
    levels: [
      "Every two years Mars and Earth end up on opposite sides of the Sun. Hot gas from the Sun can corrupt radio signals, so engineers stop sending commands for a few weeks. In the game those days count as lost contact.",
      "A higher radio band, such as Ka-band, can keep working closer to the Sun than S-band. The game counts the days when your band is blocked.",
      "NASA analysis gives angle limits between Sun, Earth and Mars: Ka 1 degree, X 2.3 degrees, S 4 degrees. The blackout lasts days to weeks, depending on the year and band.",
    ],
    basis: { real: 'The angle limits for each radio band come from a NASA study (ASCEND 2022); the planet positions from NASA JPL Horizons.', game: 'Counting a blackout as lost contact is a simplification.' },
    sources: ["https://ntrs.nasa.gov/citations/20220013418", "https://www.jpl.nasa.gov/news/whats-mars-solar-conjunction-and-why-does-it-matter/"],
  },
  "solar-array": {
    name: "Solar panels at Mars",
    levels: [
      "Spacecraft make electricity from sunlight. At Mars the Sun is fainter, so the same panels give less power.",
      "Mars gets about 43 percent of the sunlight that Earth gets, because light falls with the square of the distance: twice as far, a quarter of the light. You need larger panels, which are heavier.",
      "Power = sunlight at that distance x panel area x cell efficiency. Sunlight falls with the square of the distance from the Sun. The game uses 29.5 percent efficient cells.",
    ],
    basis: { real: 'Sunlight at Mars (about 43 percent of Earth) comes from NASA planetary fact sheets; cell efficiency from NASA State-of-the-Art Small Spacecraft Technology report (2026).', game: 'Panel weight is a game estimate.' },
    sources: ["https://spaceplace.nasa.gov/what-powers-a-spacecraft/en/", "https://www.esa.int/Enabling_Support/Space_Engineering_Technology/Going_solar_for_interplanetary_missions"],
  },
  spacecraft: {
    name: "Spacecraft and mass limit",
    levels: [
      "A rocket can only lift so much. Your spacecraft, fuel included, must not be heavier than the limit. A spacecraft is a service module (engine, power, radio) plus a payload module with the science instruments.",
      "Every kilogram counts: instruments, panels, engine and fuel add up. If you add fuel you may have to give something up.",
      "The Electron with Photon limit comes from Rocket Lab and the Ariane 62 and 64 limits from the Ariane 6 user manual, all at specific launch energies.",
    ],
    basis: { real: 'Rocket lifting limits come from the Ariane 6 user manual (2021) and a Rocket Lab press release (2020), not NASA. They are upper bounds for the game.', game: 'The weight of the spacecraft body and of each instrument is a game estimate.' },
    sources: ["https://www.esa.int/articles/about-us/directorates/science/anatomy-of-a-spacecraft", "https://ariane.group/app/uploads/sites/4/2024/10/Mua-6_Issue-2_Revision-0_March-2021.pdf"],
  },
  budget: {
    name: "Budget (credits)",
    levels: [
      "Every part costs credits and you only have so many. You cannot take everything, so you choose what matters most.",
      "Real space missions work the same way: money, weight and power are all limited. Teams decide what to build and what to leave out.",
      "In this game credits are game units, not real money. For scale, the real MarCO mission cost about 18.5 million dollars and the InSight lander about 1 billion.",
    ],
    basis: { real: 'Real mission costs come from SpaceNews and The Planetary Society, not NASA.', game: 'Credits are a game unit.' },
    sources: ["https://spacenews.com/marco-shows-interplanetary-cubesats-possible-but-not-easy/", "https://www.planetary.org/articles/0501-marco-cubesats-to-mars"],
  },
  stars: {
    name: "Stars, bonus and score",
    levels: [
      "Stars show how well you did. One star for reaching Mars, more for answering the scientists and for smart choices.",
      "The coin bonus is for saving credits. The score adds stars, saved credits, the bonus and the number of questions you answered.",
      "All of this is game design to make you think about trade-offs. It is not a NASA scoring system.",
    ],
    basis: { real: 'The checks behind the stars (fuel, weight, radio, power) use real NASA data and physics.', game: 'The stars, bonus and score themselves are game design.' },
    sources: [],
  },
  payload: {
    name: "Instrument (payload)",
    levels: [
      "The payload is the part that does the science: a camera, a sensor, a radio.",
      "A better instrument gives more science each month, but weighs more and needs more power.",
      "Instrument masses, power and scores are illustrative game values.",
    ],
    basis: { real: 'The MarCO relay example is from NASA JPL.', game: "Instrument weights, costs and the scientists' questions are game design." },
    sources: ["https://www.esa.int/articles/about-us/directorates/science/anatomy-of-a-spacecraft"],
  },
};

export function qmark(id) {
  return `<button class="qmark" data-term="${id}" aria-label="What is this?">?</button>`;
}

export function renderTerm(id, text) {
  return `<button class="term" data-term="${id}">${text}</button>`;
}
