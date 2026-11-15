import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, defaultState, evaluate, runMission, stars, vehicleOptions, missionProgress, seededRng, monteCarlo, missionsFor } from "../src/js/model.js";

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const ctx = createContext(read("../data/mission_params.json"), read("../data/game_assumptions.json"), read("../data/earth_mars_range.json"));

test("explorer launch window is found in the 2028 window", () => {
  const date = new Date(ctx.explorerLaunchMs).toISOString().slice(0, 7);
  assert.ok(date === "2028-11" || date === "2028-12" || date === "2029-01");
});

test("explorer default evaluates without failures being undefined", () => {
  const result = evaluate(defaultState("explorer"), ctx);
  assert.ok(result.checks.length >= 3);
  assert.ok(result.indicators.length >= 4);
});

test("a flyby with little fuel passes and an orbit with little fuel fails", () => {
  const flyby = evaluate({ ...defaultState("explorer"), goal: "flyby", propellantKg: 5 }, ctx);
  const orbit = evaluate({ ...defaultState("explorer"), goal: "orbit", propellantKg: 5 }, ctx);
  assert.equal(flyby.checks.find((c) => c.id === "dv").status !== "fail", true);
  assert.equal(orbit.checks.find((c) => c.id === "dv").status, "fail");
});

test("enough fuel lets the explorer orbit succeed and gives stars", () => {
  let found = null;
  for (let kg = 10; kg <= 120 && found === null; kg += 5) {
    const r = evaluate({ ...defaultState("explorer"), goal: "orbit", propellantKg: kg }, ctx);
    if (r.ok) found = r;
  }
  assert.ok(found !== null);
  assert.ok(stars(found, ctx) >= 1);
  const events = runMission(found, ctx);
  assert.ok(events.every((e) => e.outcome !== "lost"));
});

test("too much fuel breaks the mass limit", () => {
  const r = evaluate({ ...defaultState("explorer"), propellantKg: 400 }, ctx);
  assert.equal(r.checks.find((c) => c.id === "mass").status, "fail");
  assert.equal(runMission(r, ctx)[0].outcome, "lost");
});

test("electric engine cannot brake at Mars", () => {
  const r = evaluate({ ...defaultState("engineer"), engine: "electric", propellantKg: 1.6 }, ctx);
  assert.equal(r.checks.find((c) => c.id === "dv").status, "fail");
  assert.equal(r.checks.find((c) => c.id === "burn").status, "fail");
});

test("electric engine works for a flyby", () => {
  const r = evaluate({ ...defaultState("engineer"), engine: "electric", goal: "flyby", propellantKg: 1.6, arrayAreaM2: 2 }, ctx);
  assert.equal(r.checks.find((c) => c.id === "dv").status !== "fail", true);
});

test("Ka band loses fewer days to the Sun than S band during a conjunction", () => {
  const base = { ...defaultState("engineer"), launchDate: "2027-05-01", duration: "long" };
  const s = evaluate({ ...base, band: "s_band" }, ctx);
  const ka = evaluate({ ...base, band: "ka_band" }, ctx);
  assert.ok(s.values.lostDays >= ka.values.lostDays);
});

test("cadet profile starts with little fuel and every check has a meter fill", () => {
  const r = evaluate(defaultState("cadet"), ctx);
  assert.equal(defaultState("cadet").propellantKg, 0);
  assert.deepEqual(defaultState("cadet").instruments, []);
  assert.equal(r.checks.find((c) => c.id === "dv").status, "fail");
  assert.equal(r.checks.find((c) => c.id === "payload").status, "fail");
  assert.equal(r.ok, false);
  assert.ok(r.checks.every((c) => c.fill >= 0 && c.fill <= 1 && (c.kind === "load" || c.kind === "enough")));
});

test("cadet can win with enough fuel tanks", () => {
  const wins = [20, 30, 40, 50, 60, 70, 80, 90, 100].filter((kg) => evaluate({ ...defaultState("cadet"), instruments: ["camera"], propellantKg: kg }, ctx).ok);
  assert.ok(wins.length >= 3);
});

test("two instruments weigh more and give more science than one", () => {
  const one = evaluate({ ...defaultState("explorer"), instruments: ["camera"] }, ctx);
  const two = evaluate({ ...defaultState("explorer"), instruments: ["camera", "relay_radio"] }, ctx);
  assert.ok(two.values.dryKg > one.values.dryKg);
  assert.ok(two.values.scienceScore > one.values.scienceScore);
});

test("no instrument fails the payload check", () => {
  const r = evaluate({ ...defaultState("explorer"), instruments: [] }, ctx);
  assert.equal(r.checks.find((c) => c.id === "payload").status, "fail");
  assert.equal(r.ok, false);
});

test("vehicle list has three options", () => {
  assert.equal(vehicleOptions(ctx).length, 3);
});

const cadetState = (mission, extra) => ({ ...defaultState("cadet"), missionId: mission.id, goal: mission.goal, duration: mission.duration, ...extra });

test("every brief can reach three stars", () => {
  const ids = ctx.assumptions.instruments.map((i) => i.id);
  const sets = [];
  for (let m = 1; m < 1 << ids.length; m += 1) sets.push(ids.filter((_, k) => m & (1 << k)));
  for (const mission of ctx.assumptions.missions) {
    let best = 0;
    for (const instruments of sets) {
      for (let kg = 0; kg <= 150; kg += 10) {
        const e = evaluate(cadetState(mission, { instruments, propellantKg: kg }), ctx);
        best = Math.max(best, missionProgress(e, mission).stars);
      }
    }
    assert.equal(best, 3, mission.id);
  }
});

test("briefs force a choice: scouts cannot take everything and still brake with spare fuel", () => {
  const mission = ctx.assumptions.missions.find((m) => m.id === "scouts");
  const all = evaluate(cadetState(mission, { instruments: ["dust_sensor", "camera", "relay_radio"], propellantKg: 50 }), ctx);
  assert.equal(all.checks.find((c) => c.id === "budget").status, "fail");
  assert.equal(all.ok, false);
});

test("an unanswered required question loses the second star and shows in the debrief", () => {
  const mission = ctx.assumptions.missions.find((m) => m.id === "scouts");
  const e = evaluate(cadetState(mission, { instruments: ["camera"], propellantKg: 50 }), ctx);
  assert.ok(e.ok);
  assert.equal(missionProgress(e, mission).stars, 1);
  const events = runMission(e, ctx);
  const debrief = events.find((x) => x.id === "questions");
  assert.ok(debrief.text.includes("Unanswered"));
  assert.ok(events.find((x) => x.id === "brief-event").outcome === "degraded");
});

test("first orbit: spending too much loses the third star", () => {
  const mission = ctx.assumptions.missions.find((m) => m.id === "tiny");
  const lean = evaluate(cadetState(mission, { instruments: ["camera"], propellantKg: 40 }), ctx);
  const rich = evaluate(cadetState(mission, { instruments: ["camera", "dust_sensor"], propellantKg: 50 }), ctx);
  assert.equal(missionProgress(lean, mission).stars, 3);
  assert.ok(missionProgress(rich, mission).stars < 3);
});

test("a bare default launch cannot succeed in any brief", () => {
  for (const mission of ctx.assumptions.missions) {
    const e = evaluate(cadetState(mission, {}), ctx);
    assert.equal(e.ok, false, mission.id);
  }
});

test("dust sensor alone with a tank launches but the required camera question stays open in landing site", () => {
  const mission = ctx.assumptions.missions.find((m) => m.id === "site");
  const e = evaluate(cadetState(mission, { instruments: ["dust_sensor"], propellantKg: 10 }), ctx);
  assert.ok(e.ok);
  const progress = missionProgress(e, mission);
  assert.equal(progress.requiredMet, false);
  assert.equal(progress.stars, 1);
  assert.equal(e.checks.find((c) => c.id === "required").status, "warn");
});

test("thrifty bonus needs saved credits and is separate from stars", () => {
  const mission = ctx.assumptions.missions.find((m) => m.id === "tiny");
  const lean = evaluate(cadetState(mission, { instruments: ["camera"], propellantKg: 40 }), ctx);
  const rich = evaluate(cadetState(mission, { instruments: ["camera"], propellantKg: 50 }), ctx);
  assert.equal(missionProgress(lean, mission).bonus.met, true);
  assert.equal(missionProgress(rich, mission).bonus.met, false);
});

test("there are six instruments and every question is answered by exactly one of them", () => {
  assert.equal(ctx.assumptions.instruments.length, 6);
  for (const [id, q] of Object.entries(ctx.assumptions.questions)) {
    assert.ok(ctx.assumptions.instruments.some((i) => i.id === q.instrument), id);
  }
});

test("a flyby needs little fuel and an orbit needs a lot: the fuel maths is consistent", () => {
  const flyby = evaluate({ ...defaultState("cadet"), goal: "flyby", instruments: ["camera"], propellantKg: 10 }, ctx);
  const orbit = evaluate({ ...defaultState("cadet"), goal: "orbit", instruments: ["camera"], propellantKg: 10 }, ctx);
  assert.ok(flyby.values.dvRequiredMs < 100);
  assert.ok(orbit.values.dvRequiredMs > 1500);
  assert.ok(flyby.values.dvAvailMs > flyby.values.dvRequiredMs);
  assert.ok(orbit.values.dvAvailMs < orbit.values.dvRequiredMs);
});

test("score rises with stars and saved credits", () => {
  const mission = ctx.assumptions.missions.find((m) => m.id === "tiny");
  const lean = missionProgress(evaluate(cadetState(mission, { instruments: ["camera"], propellantKg: 40 }), ctx), mission);
  const rich = missionProgress(evaluate(cadetState(mission, { instruments: ["camera"], propellantKg: 50 }), ctx), mission);
  assert.ok(lean.score > rich.score);
});

test("missions are ordered from easy to hard and the first one is an orbit", () => {
  const order = { Easy: 0, Medium: 1, Hard: 2 };
  const levels = ctx.assumptions.missions.map((m) => order[m.level]);
  assert.deepEqual(levels, [...levels].sort((a, b) => a - b));
  assert.equal(ctx.assumptions.missions[0].goal, "orbit");
});

test("explorer and engineer briefs can reach three stars", async () => {
  const { missionsFor, missionProgress } = await import("../src/js/model.js");
  const a = ctx.assumptions;
  const ids = a.instruments.map((i) => i.id);
  const subsets = [];
  for (let m = 1; m < 1 << ids.length; m++) subsets.push(ids.filter((_, k) => m & (1 << k)));
  for (const profile of ["explorer", "engineer"]) {
    for (const mission of missionsFor(a, profile)) {
      let best = 0;
      const dates = profile === "engineer" ? ["2026-12-01", "2028-12-06", "2031-01-16"] : [undefined];
      const engines = profile === "engineer" ? ["chemical", "electric"] : ["chemical"];
      const bands = profile === "engineer" ? ["s_band", "x_band", "ka_band"] : ["x_band"];
      const explorerDates = a.explorer_dates.map((x) => x.date);
      for (const date of profile === "engineer" ? dates : explorerDates) for (const engine of engines) for (const band of bands) for (const duration of ["short", "medium", "long"]) for (const instruments of subsets) for (const vehicle of profile === "engineer" ? ["electron_photon", "ariane_62"] : ["electron_photon"]) for (let kg = 0; kg <= (mission.fixed_payload_kg ? 220 : 60); kg += mission.fixed_payload_kg ? 4 : 2) {
        if (mission.fixed_payload_kg && instruments.length > 1) continue;
        const s = { ...defaultState(profile), missionId: mission.id, goal: mission.goal, duration, instruments, propellantKg: kg, launchDate: date, ...(profile === "engineer" ? { engine, band, vehicle, arrayAreaM2: 0.6 } : { arrayAreaM2: 0.3 }) };
        best = Math.max(best, missionProgress(evaluate(s, ctx), mission).stars);
      }
      assert.equal(best, 3, `${profile}/${mission.id}`);
    }
  }
});

test("risk chances shrink with bigger reserves and dice can hurt a thin design", async () => {
  const { riskChances, seededRng, monteCarlo, rollRisk, runMission, missionsFor } = await import("../src/js/model.js");
  const mission = missionsFor(ctx.assumptions, "explorer")[0];
  const base = { ...defaultState("explorer"), missionId: mission.id, goal: "orbit", duration: "long", instruments: ["dust_sensor", "thermometer"], launchDate: "2028-12-06", arrayAreaM2: 0.3 };
  const thin = evaluate({ ...base, propellantKg: 38 }, ctx);
  const roomy = evaluate({ ...base, propellantKg: 52 }, ctx);
  assert.ok(riskChances(roomy, ctx).nav < riskChances(thin, ctx).nav);
  assert.ok(riskChances(thin, ctx).ok < 1);
  const calm = runMission(rollRisk(thin, ctx).evaluation, ctx);
  assert.ok(!calm.some((e) => e.outcome === "lost"));
  const unlucky = rollRisk(thin, ctx, () => 0);
  assert.ok(unlucky.early.length === 1 && unlucky.late.length === 1);
});

test("analyst missions are satisfiable and elliptical orbits save fuel", async () => {
  const { missionsFor, missionProgress, minPropellantKg } = await import("../src/js/model.js");
  const m = missionsFor(ctx.assumptions, "mapper" === "x" ? "x" : "analyst").find((x) => x.id === "mapper");
  const s = { ...defaultState("analyst"), missionId: "mapper", duration: "medium", instruments: ["camera"], launchDate: "2028-10-15", band: "ka_band", arrayAreaM2: 0.5, periapsisKm: 150, apoapsisKm: 8000, propellantKg: 26, dishM: 0.3, txPowerW: 4 };
  const p = missionProgress(evaluate(s, ctx), m);
  assert.equal(p.stars, p.goals.length);
  const circular = minPropellantKg({ ...s, apoapsisKm: 150 }, ctx);
  const elliptical = minPropellantKg(s, ctx);
  assert.ok(elliptical < circular);
});

test("radio band decides how much data comes home", () => {
  const base = { ...defaultState("analyst"), missionId: "mapper", duration: "medium", instruments: ["camera"], launchDate: "2028-10-15", arrayAreaM2: 0.5, periapsisKm: 150, apoapsisKm: 8000, propellantKg: 26, dishM: 0.6, txPowerW: 4 };
  const s = evaluate({ ...base, band: "s_band" }, ctx).values.link;
  const x = evaluate({ ...base, band: "x_band" }, ctx).values.link;
  const ka = evaluate({ ...base, band: "ka_band" }, ctx).values.link;
  assert.ok(s.rateBps < x.rateBps && x.rateBps < ka.rateBps);
  assert.ok(s.capacityGbit < s.generatedGbit);
  const bigDish = evaluate({ ...base, band: "x_band", dishM: 1.5 }, ctx).values.link;
  assert.ok(bigDish.rateBps > x.rateBps);
});

test("seeded random numbers repeat for the same seed", () => {
  const a = seededRng(42);
  const b = seededRng(42);
  const c = seededRng(43);
  const xs = [a(), a(), a()];
  assert.deepEqual(xs, [b(), b(), b()]);
  assert.notEqual(xs[0], c());
  assert.ok(xs.every((x) => x >= 0 && x < 1));
});

test("Monte Carlo gives repeatable probabilities that follow the reserve", () => {
  const mission = missionsFor(ctx.assumptions, "analyst").find((m) => m.id === "mapper");
  const base = { ...defaultState("analyst"), missionId: "mapper", duration: "medium", instruments: ["camera"], launchDate: "2028-10-15", arrayAreaM2: 0.5, periapsisKm: 150, apoapsisKm: 8000, band: "x_band", dishM: 1, txPowerW: 4 };
  const lean = monteCarlo(evaluate({ ...base, propellantKg: 28 }, ctx), mission, ctx, 400, 7);
  const lean2 = monteCarlo(evaluate({ ...base, propellantKg: 28 }, ctx), mission, ctx, 400, 7);
  const rich = monteCarlo(evaluate({ ...base, propellantKg: 31 }, ctx), mission, ctx, 400, 7);
  assert.deepEqual(lean.perGoal, lean2.perGoal);
  assert.ok(lean.all < 1);
  assert.ok(rich.all >= lean.all);
  assert.equal(lean.reserves.length, 400);
});

test("link budget chain adds up", () => {
  const s = { ...defaultState("analyst"), missionId: "mapper", instruments: ["camera"], launchDate: "2028-10-15", arrayAreaM2: 0.5, periapsisKm: 150, apoapsisKm: 8000, band: "x_band", dishM: 1, propellantKg: 28 };
  const l = evaluate(s, ctx).values.link;
  assert.ok(Math.abs(l.prN0DbHz - l.rateDbHz - 2) < 1e-6);
  assert.ok(Math.abs(l.eirpDbw - (l.txPowerDbw + l.txGainDb)) < 1e-9);
});
