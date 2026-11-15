import {
  rocketDeltaVMs,
  lightDelayMinutes,
  solarFluxWm2,
  arrayPowerW,
  captureDeltaVKmS,
  blackoutDays,
  freeSpaceLossDb,
  linkMarginDb,
  maxDataRateBps,
  toDb,
  G0_M_S2,
} from "./physics.js";
import { makeEphemeris, bestTransfer } from "./transfer.js";

const DAY_MS = 86400000;

export function createContext(params, assumptions, ephemerisTable) {
  const ephemeris = makeEphemeris(ephemerisTable.samples);
  const transferCache = new Map();
  const ctx = {
    params,
    assumptions,
    table: ephemerisTable,
    ephemeris,
    transfer(ms) {
      const key = Math.round(ms / DAY_MS);
      if (!transferCache.has(key)) {
        transferCache.set(key, bestTransfer(ephemeris, params.bodies.sun_gm_km3_s2, key * DAY_MS, 120, 420, 4));
      }
      return transferCache.get(key);
    },
  };
  ctx.explorerLaunchMs = findBestLaunchMs(ctx, assumptions.mission.explorer_window_search);
  return ctx;
}

export function findBestLaunchMs(ctx, range) {
  let best = null;
  for (let ms = Date.parse(range[0]); ms <= Date.parse(range[1]); ms += 3 * DAY_MS) {
    const plan = ctx.transfer(ms);
    if (plan === null) {
      continue;
    }
    const cost = plan.vInfDepartureKmS + plan.vInfArrivalKmS;
    if (best === null || cost < best.cost) {
      best = { ms, cost };
    }
  }
  return best === null ? null : best.ms;
}

export function minPropellantKg(state, ctx) {
  const enough = (kg) => {
    const dv = evaluate({ ...state, propellantKg: kg }, ctx).checks.find((c) => c.id === "dv");
    return Boolean(dv) && dv.status !== "fail";
  };
  let hi = state.profile === "engineer" || state.profile === "analyst" ? 300 : 200;
  if (!enough(hi)) return null;
  let lo = 0;
  if (enough(lo)) return 0;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (enough(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

export function launchEnergyCurve(ctx, stepDays = 10) {
  const points = [];
  for (let ms = ctx.ephemeris.firstMs; ms <= ctx.ephemeris.lastMs - 470 * DAY_MS; ms += stepDays * DAY_MS) {
    const plan = ctx.transfer(ms);
    if (plan !== null) {
      points.push({ ms, c3: plan.c3Km2S2, total: plan.vInfDepartureKmS + plan.vInfArrivalKmS });
    }
  }
  return points;
}

export function engineOptions(ctx) {
  const e = ctx.params.engines;
  const a = ctx.assumptions.spacecraft;
  return {
    chemical: {
      id: "chemical",
      label: e.chemical.label,
      ispS: e.chemical.isp_s,
      thrustN: e.chemical.thrust_n,
      systemDryKg: a.chemical_system_dry_kg,
      powerW: 0,
      maxPropellantKg: Infinity,
    },
    electric: {
      id: "electric",
      label: e.electric.label,
      ispS: e.electric.isp_s,
      thrustN: e.electric.thrust_n,
      systemDryKg: e.electric.wet_mass_kg - e.electric.max_propellant_kg_from_total_impulse,
      powerW: e.electric.power_w,
      maxPropellantKg: e.electric.max_propellant_kg_from_total_impulse,
    },
  };
}

export function vehicleOptions(ctx) {
  const vehicles = ctx.params.launch_vehicles;
  return vehicles.map((v) => ({
    id: v.id,
    label: v.label,
    capacityKg: v.max_spacecraft_payload_kg ?? v.mass_to_escape_kg,
    publishedC3: v.escape_c3_km2_s2 ?? null,
    reliability: v.reliability,
  }));
}

export function bandOptions(ctx) {
  const t = ctx.params.conjunction.thresholds_deg;
  return [
    { id: "s_band", label: "S-band", thresholdDeg: t.s_band },
    { id: "x_band", label: "X-band", thresholdDeg: t.x_band },
    { id: "ka_band", label: "Ka-band", thresholdDeg: t.ka_band },
  ];
}

export function missionsFor(a, profile) {
  if (profile === "explorer") return a.explorer_missions ?? [];
  if (profile === "engineer") return a.engineer_missions ?? [];
  if (profile === "analyst") return a.analyst_missions ?? [];
  return a.missions ?? [];
}

export function allMissions(a) {
  return [...(a.missions ?? []), ...(a.explorer_missions ?? []), ...(a.engineer_missions ?? []), ...(a.analyst_missions ?? [])];
}

export function defaultState(profile) {
  const base = {
    profile,
    goal: "orbit",
    instruments: profile === "cadet" ? [] : ["camera"],
    propellantKg: profile === "cadet" ? 0 : 40,
    duration: "medium",
  };
  if (profile === "explorer") {
    return { ...base, launchDate: "2028-12-06", engine: "chemical", arrayAreaM2: 1.0 };
  }
  if (profile === "engineer" || profile === "analyst") {
    return {
      ...base,
      ...(profile === "analyst" ? { periapsisKm: 300, apoapsisKm: 300, dishM: 0.6, txPowerW: 4, seed: "" } : {}),
      launchDate: "2028-12-06",
      vehicle: "electron_photon",
      engine: "chemical",
      arrayAreaM2: 1.0,
      band: "x_band",
    };
  }
  return base;
}

function status(ok, warn) {
  if (!ok) return "fail";
  return warn ? "warn" : "pass";
}

export function evaluate(state, ctx) {
  const a = ctx.assumptions;
  const p = ctx.params;
  const engines = engineOptions(ctx);
  const vehicles = vehicleOptions(ctx);
  const isEngineer = state.profile === "engineer" || state.profile === "analyst";
  const custom = state.profile !== "cadet";

  const engine = custom ? engines[state.engine] : engines.chemical;
  const vehicle = isEngineer ? vehicles.find((v) => v.id === state.vehicle) : vehicles.find((v) => v.id === "electron_photon");
  const chosen = a.instruments.filter((i) => state.instruments.includes(i.id));
  const instrument = {
    label: chosen.length === 0 ? "no instrument" : chosen.length === 1 ? chosen[0].label : `${chosen.slice(0, -1).map((i) => i.label).join(", ")} and ${chosen[chosen.length - 1].label}`,
    mass_kg: chosen.reduce((s, i) => s + i.mass_kg, 0),
    power_w: chosen.reduce((s, i) => s + i.power_w, 0),
    science_per_month: chosen.reduce((s, i) => s + i.science_per_month, 0),
    count: chosen.length,
  };
  const launchMs = custom ? Date.parse(`${state.launchDate}T00:00:00Z`) : ctx.explorerLaunchMs;
  const plan = ctx.transfer(launchMs);

  const propellantKg = Math.min(state.propellantKg, engine.maxPropellantKg);
  const arrayAreaM2 = custom ? state.arrayAreaM2 : 1.0;
  const carriedKg = allMissions(a).find((m) => m.id === state.missionId)?.fixed_payload_kg ?? 0;
  const dishKg = state.profile === "analyst" ? (a.link.dishes.find((x) => x.diameter_m === state.dishM)?.mass_kg ?? 0) : 0;
  const dryKg =
    carriedKg + dishKg + a.spacecraft.bus_dry_kg + instrument.mass_kg + engine.systemDryKg + (custom ? arrayAreaM2 * a.spacecraft.array_mass_kg_per_m2 : 0);
  const wetKg = dryKg + propellantKg;
  const dvAvailMs = rocketDeltaVMs(engine.ispS, wetKg, dryKg);

  const values = {
    dryKg,
    carriedKg,
    dishKg,
    wetKg,
    propellantKg,
    dvAvailMs,
    engine,
    vehicle,
    instrument,
    launchMs,
    plan,
  };

  const mission = allMissions(a).find((m) => m.id === state.missionId) ?? null;
  const answered = Object.entries(a.questions)
    .filter(([, q]) => chosen.some((i) => i.id === q.instrument))
    .map(([id]) => id);
  const monthsForCost = a.mission.durations_months[state.duration];
  const ec = a.engineer_costs;
  const engineerExtra = custom && ec ? (isEngineer ? (ec.vehicle[state.vehicle] ?? 0) + (ec.band[state.band] ?? 0) : 0) + (ec.engine[state.engine] ?? 0) + ec.array_per_m2 * arrayAreaM2 : 0;
  const opsCost = mission && mission.ops_cost ? monthsForCost * a.spacecraft.ops_credit_per_month : 0;
  const creditsSpent = a.spacecraft.base_cost_credits + (propellantKg / 10) * a.spacecraft.tank_cost_credits + chosen.reduce((s, i) => s + i.cost_credits, 0) + opsCost + engineerExtra + (state.profile === "analyst" ? (a.link.dishes.find((x) => x.diameter_m === state.dishM)?.cost_credits ?? 0) + (a.link.tx_powers.find((x) => x.watts === state.txPowerW)?.cost_credits ?? 0) : 0);
  Object.assign(values, { mission, answered, creditsSpent, creditsLeft: mission ? mission.budget_credits - creditsSpent : null });

  const checks = [];

  if (plan === null) {
    checks.push({ id: "window", label: "Launch date", status: "fail", detail: "No transfer to Mars can be computed for this date.", term: "launch-window" });
    return { state, values, checks, ok: false, indicators: [] };
  }

  const mars = ctx.params.bodies;
  const analyst = state.profile === "analyst";
  const periapsisKm = analyst ? state.periapsisKm : a.mission.orbit_altitude_km;
  const apoapsisKm = analyst ? Math.max(state.apoapsisKm, state.periapsisKm) : a.mission.orbit_altitude_km;
  const rpKm = mars.mars_mean_radius_km + periapsisKm;
  const raKm = mars.mars_mean_radius_km + apoapsisKm;
  const semiMajor = (rpKm + raKm) / 2;
  const periodH = (2 * Math.PI * Math.sqrt((semiMajor ** 3) / mars.mars_gm_km3_s2)) / 3600;
  const captureMs =
    state.goal === "orbit" ? captureDeltaVKmS(plan.vInfArrivalKmS, mars.mars_gm_km3_s2, rpKm, raKm) * 1000 : 0;
  const dvRequiredMs = captureMs + a.mission.tcm_delta_v_ms;
  const dvMargin = dvRequiredMs > 0 ? (dvAvailMs - dvRequiredMs) / dvRequiredMs : 1;
  const burnHours = captureMs > 0 ? (wetKg * captureMs) / engine.thrustN / 3600 : 0;
  const capKg = mission && mission.mass_cap_kg ? Math.min(vehicle.capacityKg, mission.mass_cap_kg) : vehicle.capacityKg;
  const massMargin = (capKg - wetKg) / capKg;
  const arrivalState = ctx.ephemeris.stateAt(plan.arrivalMs);
  const delayMin = lightDelayMinutes(plan.marsRangeAtArrivalKm);
  const fluxMars = solarFluxWm2(arrivalState.marsRadiusKm, mars.solar_irradiance_w_m2.earth);
  const cell = p.solar_cells.default;
  const powerSupplyW = arrayPowerW(fluxMars, arrayAreaM2, cell.bol_efficiency_pct / 100);
  const powerDemandW = a.spacecraft.bus_power_w + instrument.power_w + engine.powerW + (analyst ? state.txPowerW / a.link.amp_efficiency : 0);
  const powerMargin = powerSupplyW > 0 ? (powerSupplyW - powerDemandW) / powerSupplyW : -1;
  const months = a.mission.durations_months[state.duration];
  const scienceMs = Date.parse(new Date(plan.arrivalMs).toISOString().slice(0, 10));
  const scienceEnd = new Date(plan.arrivalMs + months * 30 * DAY_MS).toISOString().slice(0, 10);
  const scienceStart = new Date(scienceMs).toISOString().slice(0, 10);
  const band = bandOptions(ctx).find((b) => b.id === state.band) ?? bandOptions(ctx)[1];
  const lostDays = isEngineer ? blackoutDays(ctx.table.samples, band.thresholdDeg, scienceStart, scienceEnd) : 0;
  const contactFraction = state.goal === "orbit" ? 1 - lostDays / (months * 30) : 1;
  let link = null;
  if (analyst) {
    const dsn = p.dsn.bands[state.band] ?? p.dsn.bands.x_band;
    let maxRangeKm = 0;
    for (const s of ctx.table.samples) {
      if (s.date >= scienceStart && s.date <= scienceEnd && s.range_km > maxRangeKm) maxRangeKm = s.range_km;
    }
    if (maxRangeKm === 0) maxRangeKm = plan.marsRangeAtArrivalKm;
    const lambdaM = 299792458 / (dsn.frequency_ghz * 1e9);
    const txGainDb = toDb(a.link.antenna_efficiency * ((Math.PI * state.dishM) / lambdaM) ** 2);
    const linkInput = { txPowerW: state.txPowerW, txGainDb, txLossDb: 0, distanceKm: maxRangeKm, frequencyGHz: dsn.frequency_ghz, rxGainDb: dsn.rx_gain_dbi, otherLossesDb: a.link.other_losses_db, systemNoiseTempK: dsn.system_noise_k, requiredEbN0Db: a.link.required_ebn0_db };
    const rateBps = maxDataRateBps(linkInput);
    const probe = linkMarginDb({ ...linkInput, dataRateBps: 1 });
    const receivedDbw = probe.eirpDbw - probe.pathLossDb + dsn.rx_gain_dbi - a.link.other_losses_db;
    const n0DbwHz = receivedDbw - probe.ebN0Db;
    const capacityGbit = (rateBps * a.link.contact_hours_per_day * 3600 * months * 30 * contactFraction) / 1e9;
    const generatedGbit = chosen.reduce((s, i) => s + i.data_gbit_per_month, 0) * months;
    link = { dsn, maxRangeKm, txGainDb, txPowerDbw: toDb(state.txPowerW), eirpDbw: probe.eirpDbw, receivedDbw, n0DbwHz, prN0DbHz: receivedDbw - n0DbwHz, rateDbHz: toDb(rateBps), pathLossDb: freeSpaceLossDb(maxRangeKm, dsn.frequency_ghz), rateBps, capacityGbit, generatedGbit, margin: capacityGbit > 0 ? (capacityGbit - generatedGbit) / capacityGbit : -1 };
  }

  Object.assign(values, {
    captureMs,
    periapsisKm,
    apoapsisKm,
    periodH,
    dvRequiredMs,
    dvMargin,
    burnHours,
    massMargin,
    delayMin,
    powerSupplyW,
    powerDemandW,
    powerMargin,
    months,
    lostDays,
    contactFraction,
    link,
    band,
    arrivalMs: plan.arrivalMs,
    flightDays: plan.flightDays,
    c3: plan.c3Km2S2,
    vInfArrivalKmS: plan.vInfArrivalKmS,
    vInfDepartureKmS: plan.vInfDepartureKmS,
    capKg,
    dryKg,
    arrayMassKg: custom ? arrayAreaM2 * a.spacecraft.array_mass_kg_per_m2 : 0,
    creditParts: [
      ["Spacecraft body", a.spacecraft.base_cost_credits],
      ["Fuel tanks", (propellantKg / 10) * a.spacecraft.tank_cost_credits],
      ["Instruments", chosen.reduce((s, i) => s + i.cost_credits, 0)],
      ["Operations", opsCost],
      ["Rocket, engine, panels, radio", engineerExtra],
    ].filter(([, c]) => c > 0),
    scienceScore: state.goal === "orbit" ? instrument.science_per_month * months * contactFraction : instrument.science_per_month * 0.5,
  });

  checks.push({
    id: "payload",
    label: "Has an instrument",
    status: instrument.count > 0 ? "pass" : "fail",
    detail: instrument.count > 0 ? `${instrument.label}: ${instrument.mass_kg} kg, ${instrument.power_w} W.` : "No instrument is chosen.",
    term: "payload",
    kind: "enough",
    fill: instrument.count > 0 ? 1 : 0,
  });
  if (mission) {
    const requiredIds = mission.questions.filter((q) => q.required).map((q) => q.id);
    const requiredDone = requiredIds.filter((id) => answered.includes(id)).length;
    checks.push({
      id: "required",
      label: "Answers the scientists",
      status: requiredDone === requiredIds.length ? "pass" : "warn",
      detail: `${requiredDone} of ${requiredIds.length} main questions have an instrument.`,
      term: "payload",
      kind: "enough",
      fill: requiredIds.length > 0 ? requiredDone / requiredIds.length : 1,
    });
    if (mission.min_months) {
      checks.push({
        id: "duration",
        label: "Long enough observation",
        status: monthsForCost >= mission.min_months ? "pass" : "warn",
        detail: `${monthsForCost} months of observation; the scientists asked for at least ${mission.min_months}.`,
        term: "payload",
        kind: "enough",
        fill: Math.min(1, monthsForCost / mission.min_months),
      });
    }
    checks.push({
      id: "budget",
      label: "Inside the budget",
      status: status(creditsSpent <= mission.budget_credits, mission.budget_credits - creditsSpent < 3),
      detail: `Spent ${creditsSpent} of ${mission.budget_credits} credits (game units).`,
      term: "spacecraft",
      kind: "load",
      fill: Math.max(0, Math.min(1, creditsSpent / mission.budget_credits)),
    });
  }
  checks.push({
    id: "mass",
    label: "Fits the launch vehicle",
    status: status(massMargin >= 0, massMargin < 0.05),
    detail: `Spacecraft ${wetKg.toFixed(0)} kg, launch limit ${capKg} kg.`,
    term: "spacecraft",
  });
  checks.push({
    id: "dv",
    label: "Enough fuel for the trip",
    status: status(dvMargin >= 0, dvMargin < a.scoring.dv_margin_good_min),
    detail: `Your fuel gives ${dvAvailMs.toFixed(0)} m/s of speed change, the trip needs ${dvRequiredMs.toFixed(0)} m/s.`,
    term: "delta-v",
  });
  if (state.goal === "orbit") {
    checks.push({
      id: "burn",
      label: "Engine is strong enough to brake at Mars",
      status: status(burnHours <= a.mission.max_capture_burn_hours, false),
      detail: `Braking would take ${burnHours.toFixed(1)} hours; the limit is ${a.mission.max_capture_burn_hours} hours.`,
      term: "thrust-isp",
    });
  }
  if (custom) {
    checks.push({
      id: "power",
      label: "Enough electric power at Mars",
      status: status(powerMargin >= 0, powerMargin < 0.1),
      detail: `Panels give ${powerSupplyW.toFixed(0)} W at Mars, equipment needs ${powerDemandW.toFixed(0)} W.`,
      term: "solar-array",
    });
  }
  if (isEngineer) {
    if (ctx.bestC3 === undefined) {
      const curve = launchEnergyCurve(ctx, 10).map((x) => x.c3);
      ctx.bestC3 = curve.length ? Math.min(...curve) : plan.c3Km2S2;
      ctx.worstC3 = curve.length ? Math.max(...curve) : plan.c3Km2S2;
    }
    const c3Ratio = plan.c3Km2S2 / ctx.bestC3;
    const energyWarn = vehicle.publishedC3 !== null && plan.c3Km2S2 > vehicle.publishedC3;
    checks.push({
      id: "energy",
      label: "Launch energy",
      status: energyWarn ? "warn" : "pass",
      detail: `This date needs C3 of ${plan.c3Km2S2.toFixed(1)} km2/s2, ${c3Ratio.toFixed(1)} times the lowest value in 2026-2035 (range of the table: ${ctx.bestC3.toFixed(1)} to ${ctx.worstC3.toFixed(1)}).${vehicle.publishedC3 !== null ? ` The vehicle capacity is published for C3 ${vehicle.publishedC3}.` : " The vehicle maker does not publish capacity against launch energy, so the game treats the rocket limit as an upper bound."}`,
      term: "launch-window",
    });
    if (state.goal === "orbit") {
      checks.push({
        id: "contact",
        label: "Radio contact during the science phase",
        status: status(contactFraction >= a.mission.min_contact_fraction, contactFraction < 1),
        detail: `The Sun blocks the signal for ${lostDays.toFixed(0)} days (${band.label}, angle below ${band.thresholdDeg} degrees).`,
        term: "solar-conjunction",
      });
    }
  }

  if (analyst && state.goal === "orbit" && link) {
    checks.push({
      id: "data",
      label: "Enough data link capacity",
      status: link.capacityGbit >= link.generatedGbit && link.margin >= 0.2 ? "pass" : "warn",
      detail: `The radio link can return ${link.capacityGbit.toFixed(2)} Gbit; the instruments produce ${link.generatedGbit.toFixed(2)} Gbit.`,
      term: "link-budget",
    });
  }

  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const fills = {
    mass: { kind: "load", fill: clamp01(wetKg / capKg) },
    dv: { kind: "enough", fill: clamp01(dvRequiredMs > 0 ? dvAvailMs / dvRequiredMs : 1) },
    burn: { kind: "enough", fill: clamp01(burnHours > 0 ? a.mission.max_capture_burn_hours / burnHours : 1) },
    power: { kind: "enough", fill: clamp01(powerDemandW > 0 ? powerSupplyW / powerDemandW : 1) },
    energy: { kind: "enough", fill: 1 },
    contact: { kind: "enough", fill: clamp01(contactFraction) },
  };
  checks.forEach((c) => Object.assign(c, fills[c.id]));

  const ok = checks.every((c) => c.status !== "fail");
  const evaluation = { state, values, checks, ok, indicators: buildIndicators(values, state, isEngineer) };
  const chance = riskChances(evaluation, ctx);
  values.smoothChance = chance ? chance.ok : null;
  return evaluation;
}

function buildIndicators(v, state, isEngineer) {
  const list = [
    { id: "dv", label: "Speed change available", value: `${v.dvAvailMs.toFixed(0)} m/s`, sub: `needed ${v.dvRequiredMs.toFixed(0)} m/s`, term: "delta-v", ratio: v.dvRequiredMs > 0 ? v.dvAvailMs / v.dvRequiredMs : 2 },
    { id: "flight", label: "Flight time", value: `${v.flightDays.toFixed(0)} days`, sub: `arrive ${new Date(v.arrivalMs).toISOString().slice(0, 10)}`, term: "mars-earth-orbits" },
    { id: "delay", label: "Radio delay to Earth", value: `${v.delayMin.toFixed(1)} min`, sub: "one way, at arrival", term: "light-time-delay" },
    { id: "mass", label: "Spacecraft mass", value: `${v.wetKg.toFixed(0)} kg`, sub: `limit ${v.capKg} kg`, term: "spacecraft", ratio: v.capKg / v.wetKg },
  ];
  if (isEngineer) {
    list.push({ id: "power", label: "Power at Mars", value: `${v.powerSupplyW.toFixed(0)} W`, sub: `needed ${v.powerDemandW.toFixed(0)} W`, term: "solar-array", ratio: v.powerSupplyW / v.powerDemandW });
    list.push({ id: "c3", label: "Launch energy (C3)", value: `${v.c3.toFixed(1)} km2/s2`, sub: "lower is easier", term: "launch-window" });
    if (state.goal === "orbit") {
      list.push({ id: "blackout", label: "Days without radio", value: `${v.lostDays.toFixed(0)} days`, sub: v.band.label, term: "solar-conjunction", ratio: v.lostDays === 0 ? 2 : 1 / (1 + v.lostDays / 10) });
    }
  }
  return list;
}

export function stars(evaluation, ctx) {
  const v = evaluation.values;
  if (!evaluation.ok) {
    return 0;
  }
  const sc = ctx.assumptions.scoring;
  let count = 1;
  if (v.dvMargin >= sc.dv_margin_good_min && v.dvMargin <= sc.dv_margin_good_max) count += 1;
  if (v.scienceScore >= sc.stars_science_target) count += 1;
  return count;
}

export function riskChances(evaluation, ctx) {
  const r = ctx.assumptions.risk;
  const v = evaluation.values;
  if (!evaluation.ok || evaluation.state.profile === "cadet") return null;
  const marginMs = v.dvAvailMs - v.dvRequiredMs;
  const nav = r.nav_probability * Math.min(1, Math.max(0, 1 - marginMs / r.nav_max_ms));
  const storm = v.powerMargin >= r.storm_power_cut ? 0 : r.storm_probability;
  return { nav, storm, ok: (1 - nav) * (1 - storm), marginMs };
}

export function rollRisk(evaluation, ctx, rng = () => 1) {
  const r = ctx.assumptions.risk;
  if (evaluation.state.profile === "cadet") return { evaluation, early: [], late: [] };
  const v = { ...evaluation.values };
  const early = [];
  const late = [];
  let navLost = false;
  if (rng() < r.nav_probability) {
    const extra = rng() * r.nav_max_ms;
    const required = v.dvRequiredMs + extra;
    v.dvMargin = (v.dvAvailMs - required) / required;
    const covered = v.dvAvailMs >= required;
    navLost = !covered;
    early.push({
      id: "nav-error",
      title: "Dice roll: navigation surprise",
      outcome: covered ? "degraded" : "lost",
      text: covered
        ? `The spacecraft drifts a little and needs ${extra.toFixed(0)} m/s of extra fuel to correct. You had enough reserve.`
        : `The spacecraft drifts and needs ${extra.toFixed(0)} m/s of extra fuel to correct. Your reserve was too small.`,
      hint: covered ? "" : "Carry a bigger fuel reserve to survive surprises like this.",
      why: "Real navigation is never perfect. Engineers always carry spare fuel, because nobody knows in advance how big the error will be.",
      term: "delta-v",
    });
  }
  if (rng() < r.storm_probability) {
    const survives = v.powerSupplyW * (1 - r.storm_power_cut) >= v.powerDemandW;
    if (!survives) {
      v.months = Math.max(1, Math.floor(v.months / 2));
      v.scienceScore = v.scienceScore / 2;
    }
    late.push({
      id: "dust-storm",
      title: "Dice roll: dust storm on Mars",
      outcome: survives ? "ok" : "degraded",
      text: survives
        ? "A dust storm dims the sunlight, but your panels still give enough power."
        : `A dust storm dims the sunlight. The spacecraft switches to safe mode and science time is cut to ${v.months} months.`,
      hint: survives ? "" : "Larger panels or less equipment leave room for a storm.",
      why: "Dust in the Martian air blocks sunlight. In 2018 a storm made NASA's Opportunity rover stop working.",
      term: "solar-array",
    });
  }
  return { evaluation: { ...evaluation, values: v, ok: evaluation.ok && !navLost }, early, late };
}

export function seededRng(seed) {
  let a = (Number(seed) >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function monteCarlo(evaluation, mission, ctx, n = 500, seed = 1) {
  const rng = seededRng(seed);
  const met = new Array(mission.stars.length).fill(0);
  const reserves = [];
  let all = 0;
  let lost = 0;
  for (let i = 0; i < n; i += 1) {
    const r = rollRisk(evaluation, ctx, rng);
    const dead = r.early.some((e) => e.outcome === "lost");
    const p = missionProgress(r.evaluation, mission);
    if (dead) lost += 1;
    else {
      p.goals.forEach((g, j) => {
        if (g.met) met[j] += 1;
      });
      if (p.goals.every((g) => g.met)) all += 1;
    }
    reserves.push(r.evaluation.values.dvMargin);
  }
  return { n, seed, perGoal: met.map((m) => m / n), all: all / n, lost: lost / n, reserves };
}

export function runMission(evaluation, ctx) {
  const v = evaluation.values;
  const events = [];
  const goal = evaluation.state.goal;
  const isEngineer = evaluation.state.profile === "engineer" || evaluation.state.profile === "analyst";

  const launchOk = v.massMargin >= 0;
  events.push({
    id: "launch",
    title: "Launch",
    outcome: launchOk ? "ok" : "lost",
    text: launchOk
      ? `The ${v.vehicle.label} lifts your ${v.wetKg.toFixed(0)} kg spacecraft toward Mars.`
      : `The spacecraft is heavier than the ${v.capKg} kg limit the vehicle can carry. It cannot launch.`,
    hint: launchOk ? "" : "Use less fuel or a lighter instrument, or choose a stronger vehicle.",
    why: "A rocket can lift only so much. The spacecraft body, the instruments and the fuel all add to the weight.",
    term: "spacecraft",
  });
  if (!launchOk) {
    return events;
  }

  const tcmOk = v.dvMargin >= 0;
  events.push({
    id: "cruise",
    title: `Cruise: ${v.flightDays.toFixed(0)} days`,
    outcome: v.dvMargin >= 0.05 ? "ok" : tcmOk ? "degraded" : "lost",
    text:
      v.dvMargin >= 0.05
        ? "Small course corrections work as planned and you still have fuel left."
        : tcmOk
          ? "The course corrections use almost all your fuel. Any surprise now would be a problem."
          : "You run out of fuel before the corrections are done. The spacecraft drifts off course and misses Mars.",
    hint: tcmOk ? "" : "Add fuel, or pick a launch date closer to the best window.",
    why: "On the way the spacecraft needs small pushes to stay on course. Every push uses fuel.",
    term: "delta-v",
  });
  if (!tcmOk) {
    return events;
  }

  if (evaluation.state.profile !== "cadet") {
    const powerOk = v.powerMargin >= 0;
    events.push({
      id: "power",
      title: "Sunlight at Mars",
      outcome: v.powerMargin >= 0.1 ? "ok" : powerOk ? "degraded" : "lost",
      text:
        v.powerMargin >= 0.1
          ? "The panels give enough power for all the equipment."
          : powerOk
            ? "Power is just enough. The spacecraft has to switch some equipment off now and then."
            : "Mars is far from the Sun and the panels are too small. The spacecraft cannot run all its equipment.",
      hint: powerOk ? "" : "Add panel area or choose a lower-power instrument or engine.",
      why: "Sunlight is weaker at Mars than at Earth, so the same panels give less electricity there.",
      term: "solar-array",
    });
    if (!powerOk) {
      return events;
    }
  }

  if (goal === "orbit") {
    const burnOk = v.burnHours <= ctx.assumptions.mission.max_capture_burn_hours;
    events.push({
      id: "capture",
      title: "Braking at Mars",
      outcome: burnOk ? "ok" : "lost",
      text: burnOk
        ? `The engine fires for ${v.burnHours.toFixed(1)} hours and the spacecraft is captured into orbit around Mars.`
        : `The engine is too weak. Braking would take ${v.burnHours.toFixed(0)} hours, and the spacecraft flies past Mars.`,
      hint: burnOk ? "" : "Choose a stronger engine, such as the chemical one.",
      why: "To circle Mars the spacecraft must slow down, and slowing down takes a lot of fuel. A flyby does not slow down, which is why it needs much less fuel.",
      term: "delta-v",
    });
    if (!burnOk) {
      return events;
    }
  }

  if (isEngineer && goal === "orbit" && v.lostDays > 0) {
    const mild = v.contactFraction >= ctx.assumptions.mission.min_contact_fraction;
    events.push({
      id: "conjunction",
      title: "The Sun is in the way",
      outcome: mild ? "degraded" : "lost",
      text: mild
        ? `For ${v.lostDays.toFixed(0)} days the Sun blocks the radio. Data waits on board and is sent later.`
        : `For ${v.lostDays.toFixed(0)} days the Sun blocks the radio, too much of your science time.`,
      hint: "A higher radio band such as Ka-band works closer to the Sun. Or choose a shorter science period.",
      why: "When the Sun is between Earth and Mars, its hot gas disturbs radio signals, so engineers stop sending commands for a few weeks.",
      term: "solar-conjunction",
    });
  }

  const finalScore = v.scienceScore;
  events.push({
    id: "science",
    title: goal === "orbit" ? "Science" : "Flyby",
    outcome: "ok",
    text:
      goal === "orbit"
        ? `Your ${v.instrument.label.toLowerCase()} works for ${v.months} months. Science score ${finalScore.toFixed(1)}.`
        : `Your spacecraft flies by Mars and your ${v.instrument.label.toLowerCase()} records what it can. Science score ${finalScore.toFixed(1)}.`,
    hint: "",
    why: "Each instrument answers one kind of question. If you do not take it, nobody gets that answer.",
    term: "payload",
  });
  const mission = v.mission;
  if (mission) {
    if (mission.event) {
      const has = evaluation.state.instruments.includes(mission.event.instrument);
      events.splice(events.length - 1, 0, {
        id: "brief-event",
        title: mission.event.title,
        outcome: has ? "ok" : "degraded",
        text: has ? mission.event.with : mission.event.without,
        hint: "",
        term: "payload",
      });
    }
    const q = ctx.assumptions.questions;
    const lines = mission.questions
      .map((m) => {
        const done = v.answered.includes(m.id);
        const tag = m.required ? "" : " (bonus)";
        const body = done ? q[m.id].answer : `Unanswered. You would have needed: ${ctx.assumptions.instruments.find((i) => i.id === q[m.id].instrument).label}.`;
        return `<li class="${done ? "ok" : "miss"}">${done ? "✓" : "✕"} <b>${q[m.id].text}</b>${tag}<br>${body}</li>`;
      })
      .join("");
    events.push({ id: "questions", title: "The scientists' questions", outcome: mission.questions.some((m) => m.required && !v.answered.includes(m.id)) ? "degraded" : "ok", text: `<ul class="qlist">${lines}</ul>`, hint: "", term: "payload" });
  }
  return events;
}

export const unitNote = G0_M_S2;

function criterionMet(g, evaluation) {
  const v = evaluation.values;
  const mission = v.mission;
  const required = mission.questions.filter((q) => q.required).map((q) => q.id);
  if (g.type === "reach") return evaluation.ok;
  if (!evaluation.ok) return false;
  if (g.type === "data_margin_min") return v.link !== null && v.link.margin >= g.value;
  if (g.type === "dv_margin_min") return v.dvMargin >= g.value;
  if (g.type === "power_margin_min") return v.powerMargin >= g.value;
  if (g.type === "max_periapsis_km") return v.periapsisKm <= g.km;
  if (g.type === "period_hours_between") return v.periodH >= g.min && v.periodH <= g.max;
  if (g.type === "chance_min") return v.smoothChance !== null && v.smoothChance >= g.value;
  if (g.type === "min_instruments") return v.instrument.count >= g.n;
  if (g.type === "max_mass_kg") return v.wetKg <= g.kg;
  if (g.type === "dv_margin_between") return v.dvMargin >= g.min && v.dvMargin <= g.max;
  if (g.type === "min_science") return v.scienceScore >= g.value;
  if (g.type === "answers_required") return required.every((id) => v.answered.includes(id));
  if (g.type === "answers_all") return mission.questions.every((q) => v.answered.includes(q.id));
  if (g.type === "credits_left_min") return v.creditsLeft >= g.n;
  if (g.type === "min_months") return v.months >= g.n;
  if (g.type === "contact_min") return v.contactFraction >= g.value;
  if (g.type === "all") return g.of.every((x) => criterionMet(x, evaluation));
  return false;
}

export function missionProgress(evaluation, mission) {
  const goals = mission.stars.map((g) => ({ text: g.text, met: criterionMet(g, evaluation) }));
  const bonus = { text: `Thrifty bonus: finish with ${mission.thrifty_credits} or more credits left`, met: false };
  const requiredMet = criterionMet({ type: "answers_required" }, evaluation);
  bonus.met = evaluation.ok && requiredMet && evaluation.values.creditsLeft >= mission.thrifty_credits;
  const stars = evaluation.ok ? goals.filter((g) => g.met).length : 0;
  const score = evaluation.ok ? stars * 100 + (bonus.met ? 50 : 0) + Math.max(0, evaluation.values.creditsLeft) * 5 + evaluation.values.answered.length * 25 : 0;
  return { goals, bonus, requiredMet, stars, score };
}
