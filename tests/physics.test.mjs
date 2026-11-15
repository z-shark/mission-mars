import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  rocketDeltaVMs,
  propellantForDeltaVKg,
  lightDelayMinutes,
  solarFluxWm2,
  hohmannTransfer,
  captureDeltaVKmS,
  windowQuality,
  freeSpaceLossDb,
  linkMarginDb,
  maxDataRateBps,
  blackoutDays,
  AU_KM,
} from "../src/js/physics.js";

const params = JSON.parse(readFileSync(new URL("../data/mission_params.json", import.meta.url), "utf8"));
const table = JSON.parse(readFileSync(new URL("../data/earth_mars_range.json", import.meta.url), "utf8"));
const bodies = params.bodies;

test("rocket equation round trip", () => {
  const dv = rocketDeltaVMs(220, 100, 70);
  const propellant = propellantForDeltaVKg(220, 70, dv);
  assert.ok(Math.abs(propellant - 30) < 1e-6);
});

test("rocket equation returns zero for invalid masses", () => {
  assert.equal(rocketDeltaVMs(220, 50, 70), 0);
  assert.equal(rocketDeltaVMs(220, 0, 0), 0);
});

test("light delay at one astronomical unit is about 8.3 minutes", () => {
  assert.ok(Math.abs(lightDelayMinutes(AU_KM) - 8.317) < 0.01);
});

test("Mars solar flux ratio matches the NASA fact sheet ratio", () => {
  const ratio = solarFluxWm2(bodies.mars_semimajor_axis_km, bodies.solar_irradiance_w_m2.earth) / bodies.solar_irradiance_w_m2.earth;
  assert.ok(Math.abs(ratio - 0.431) < 0.01);
});

test("Hohmann Earth to Mars from NASA fact sheet constants", () => {
  const h = hohmannTransfer(bodies.sun_gm_km3_s2, bodies.earth_semimajor_axis_km, bodies.mars_semimajor_axis_km);
  assert.ok(h.vInfDepartureKmS > 2.8 && h.vInfDepartureKmS < 3.1);
  assert.ok(h.vInfArrivalKmS > 2.5 && h.vInfArrivalKmS < 2.8);
  assert.ok(h.flightDays > 250 && h.flightDays < 270);
  assert.ok(h.idealLeadAngleDeg > 40 && h.idealLeadAngleDeg < 48);
});

test("capture burn grows with approach speed", () => {
  const rp = bodies.mars_mean_radius_km + 300;
  const slow = captureDeltaVKmS(2.0, bodies.mars_gm_km3_s2, rp, rp);
  const fast = captureDeltaVKmS(3.0, bodies.mars_gm_km3_s2, rp, rp);
  assert.ok(fast > slow && slow > 0);
});

test("window quality is perfect at the ideal angle and zero far away", () => {
  assert.equal(windowQuality(44, 44, 30).quality, 1);
  assert.equal(windowQuality(120, 44, 30).quality, 0);
  assert.ok(Math.abs(windowQuality(-179, 179, 30).errorDeg - 2) < 1e-9);
});

test("free space loss increases by 6 dB when the distance doubles", () => {
  const a = freeSpaceLossDb(1e8, 8.4);
  const b = freeSpaceLossDb(2e8, 8.4);
  assert.ok(Math.abs(b - a - 6.0206) < 1e-3);
});

test("link margin falls as data rate grows and maxDataRate gives zero margin", () => {
  const link = {
    txPowerW: 5,
    txGainDb: 30,
    txLossDb: 1,
    rxGainDb: 68,
    otherLossesDb: 2,
    distanceKm: 2e8,
    frequencyGHz: 8.4,
    systemNoiseTempK: 30,
    requiredEbN0Db: 2.5,
    dataRateBps: 1000,
  };
  const low = linkMarginDb(link);
  const high = linkMarginDb({ ...link, dataRateBps: 10000 });
  assert.ok(Math.abs(low.marginDb - high.marginDb - 10) < 1e-6);
  const maxRate = maxDataRateBps(link);
  const atMax = linkMarginDb({ ...link, dataRateBps: maxRate });
  assert.ok(Math.abs(atMax.marginDb) < 1e-6);
});

test("Horizons table spans the NASA delay range", () => {
  const delays = table.samples.map((s) => s.one_way_delay_min);
  assert.ok(Math.min(...delays) > 3 && Math.min(...delays) < 3.5);
  assert.ok(Math.max(...delays) > 22 && Math.max(...delays) < 22.5);
});

test("blackout length in 2034 at 2 degrees matches the NASA paper value of 9 days within sampling", () => {
  const days = blackoutDays(table.samples, 2.0, "2034-01-01", "2034-12-31");
  assert.ok(days >= 8 && days <= 12);
});
