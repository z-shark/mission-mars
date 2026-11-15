import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transferVInf, makeEphemeris, bestTransfer, planTransfer } from "../src/js/transfer.js";
import { hohmannTransfer } from "../src/js/physics.js";

const params = JSON.parse(readFileSync(new URL("../data/mission_params.json", import.meta.url), "utf8"));
const table = JSON.parse(readFileSync(new URL("../data/earth_mars_range.json", import.meta.url), "utf8"));
const bodies = params.bodies;
const eph = makeEphemeris(table.samples);

test("Lambert reproduces the Hohmann transfer at 180 degrees", () => {
  const h = hohmannTransfer(bodies.sun_gm_km3_s2, bodies.earth_semimajor_axis_km, bodies.mars_semimajor_axis_km);
  const result = transferVInf(
    bodies.sun_gm_km3_s2,
    bodies.earth_semimajor_axis_km,
    bodies.mars_semimajor_axis_km,
    Math.PI,
    h.flightDays * 86400,
  );
  assert.ok(Math.abs(result.vInfDepartureKmS - h.vInfDepartureKmS) < 0.02);
  assert.ok(Math.abs(result.vInfArrivalKmS - h.vInfArrivalKmS) < 0.02);
});

test("best transfer in the 2026 to 2027 window has a plausible C3 and flight time", () => {
  const plan = bestTransfer(eph, bodies.sun_gm_km3_s2, Date.parse("2026-12-10T00:00:00Z"));
  assert.ok(plan !== null);
  assert.ok(plan.c3Km2S2 > 6 && plan.c3Km2S2 < 25);
  assert.ok(plan.flightDays > 150 && plan.flightDays < 400);
});

test("a launch far from the window needs much more energy than one inside it", () => {
  const good = bestTransfer(eph, bodies.sun_gm_km3_s2, Date.parse("2026-12-10T00:00:00Z"));
  const bad = bestTransfer(eph, bodies.sun_gm_km3_s2, Date.parse("2027-08-01T00:00:00Z"));
  assert.ok(bad.c3Km2S2 > good.c3Km2S2 * 1.5);
});

test("planTransfer returns null outside the ephemeris", () => {
  assert.equal(planTransfer(eph, bodies.sun_gm_km3_s2, Date.parse("2040-01-01T00:00:00Z"), 250), null);
});

test("windows repeat roughly every synodic period", () => {
  const scan = (from, to) => {
    let best = null;
    for (let ms = Date.parse(from); ms <= Date.parse(to); ms += 10 * 86400000) {
      const plan = bestTransfer(eph, bodies.sun_gm_km3_s2, ms, 120, 420, 10);
      if (plan && (best === null || plan.c3Km2S2 < best.plan.c3Km2S2)) {
        best = { ms, plan };
      }
    }
    return best;
  };
  const first = scan("2026-11-01", "2027-06-30");
  const second = scan("2029-01-01", "2029-08-31");
  const gapDays = (second.ms - first.ms) / 86400000;
  assert.ok(Math.abs(gapDays - 2 * bodies.mars_synodic_period_days) < 120 || Math.abs(gapDays - bodies.mars_synodic_period_days) < 120);
});

test("transfer path ends at Mars distance from the Sun and starts at Earth", async () => {
  const { transferPath } = await import("../src/js/transfer.js");
  const launch = Date.parse("2028-12-06T00:00:00Z");
  const plan = bestTransfer(eph, bodies.sun_gm_km3_s2, launch);
  const path = transferPath(eph, bodies.sun_gm_km3_s2, launch, plan.flightDays);
  const start = eph.stateAt(launch);
  const end = eph.stateAt(launch + plan.flightDays * 86400000);
  const first = Math.hypot(...path[0]);
  const last = Math.hypot(...path[path.length - 1]);
  assert.ok(Math.abs(first - start.earthRadiusKm) / start.earthRadiusKm < 0.001);
  assert.ok(Math.abs(last - end.marsRadiusKm) / end.marsRadiusKm < 0.01);
  const marsLon = (end.marsLonDeg * Math.PI) / 180;
  const endAngle = Math.atan2(path[path.length - 1][1], path[path.length - 1][0]);
  const diff = Math.abs(Math.atan2(Math.sin(endAngle - marsLon), Math.cos(endAngle - marsLon)));
  assert.ok(diff < 0.03);
});
