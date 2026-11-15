import { createContext, defaultState, evaluate, runMission, stars, vehicleOptions, bandOptions, engineOptions, missionProgress, missionsFor, allMissions, launchEnergyCurve, minPropellantKg, riskChances, rollRisk, seededRng, monteCarlo } from "./model.js";
import { texts } from "./texts.js";
import { glossary, renderTerm, qmark } from "./glossary.js";
import { renderDiagram, flightTrack } from "./diagram.js";
import { renderCraft } from "./craft.js";

const $ = (id) => document.getElementById(id);
const L = texts.labels;
const K = texts.cadet;
const isEng = () => state.profile === "engineer" || state.profile === "analyst";
const BADGE = { pass: "✓", warn: "!", fail: "✕" };
const TANK_KG = 10;
const MAX_TANKS = 15;

let ctx;
let state;
let showNumbers = false;
let showHints = true;

async function load() {
  const [params, assumptions, table] = await Promise.all(
    ["../data/mission_params.json", "../data/game_assumptions.json", "../data/earth_mars_range.json"].map((u) => fetch(u).then((r) => r.json())),
  );
  ctx = createContext(params, assumptions, table);
  $("title").textContent = texts.title;
  $("tagline").textContent = texts.tagline;
  $("note").textContent = texts.note;
  initHowto();
  $("dataBadge").textContent = texts.data.badge;
  $("dataBadge").addEventListener("click", showData);
  setProfile("cadet");
}

function currentMission() {
  return allMissions(ctx.assumptions).find((m) => m.id === state.missionId);
}

function selectMission(id, profile = state.profile) {
  const m = allMissions(ctx.assumptions).find((x) => x.id === id);
  const base = defaultState(profile);
  state = { ...base, missionId: id, goal: m.goal, duration: m.duration, ...(m.start ?? {}), ...((profile === "engineer" || profile === "analyst") && m.default_date ? { launchDate: m.default_date } : {}) };
}

function loadProgress() {
  try {
    return JSON.parse(window.localStorage.getItem("progress") || "{}");
  } catch (e) {
    return {};
  }
}

function saveProgress(id, stars, score, bonus, massKg, credits) {
  const all = loadProgress();
  const old = all[id] ?? {};
  const next = { ...old };
  if (old.score === undefined || score > old.score) Object.assign(next, { stars, score, bonus });
  if (stars === 3) {
    if (!old.lightKg || massKg < old.lightKg) next.lightKg = massKg;
    if (!old.cheapCr || credits < old.cheapCr) next.cheapCr = credits;
  }
  all[id] = next;
  try {
    window.localStorage.setItem("progress", JSON.stringify(all));
  } catch (e) {
    return;
  }
}

function progressMark(id) {
  const p = loadProgress()[id];
  if (!p) return "";
  const m = allMissions(ctx.assumptions).find((x) => x.id === id);
  if (m && m.analyst) return `<span class="done" title="Best score ${p.score}">${p.stars}/${m.stars.length} requirements</span>`;
  return `<span class="done" title="Best score ${p.score}">${"★".repeat(p.stars)}${"☆".repeat(3 - p.stars)}${p.bonus ? " 🪙" : ""}</span>`;
}

function missionButtons() {
  return missionsFor(ctx.assumptions, state.profile)
    .map((m) => `<button class="mission" data-level="${m.level}" data-mission="${m.id}" aria-pressed="${state.missionId === m.id}"><b>${m.title}</b><small class="level-tag">${state.profile === "cadet" ? m.level : `${texts.profiles[state.profile].name} · ${m.level}`}</small><small>${m.short}</small>${progressMark(m.id)}</button>`)
    .join("");
}

function briefHtml(mission, preview) {
  const a = ctx.assumptions;
  const answered = preview.values.answered ?? [];
  const asked = mission.hide_questions
    ? `<li class="muted">${K.hiddenQuestions}</li>`
    : mission.questions
        .map((q) => `<li class="${answered.includes(q.id) ? "met" : ""}"><span class="goal-star">${answered.includes(q.id) ? "✓" : "○"}</span> ${a.questions[q.id].text}${q.required ? "" : ' <span class="tag">bonus</span>'}${state.profile === "cadet" ? ` <span class="need">${K.needs}: ${a.instruments.find((i) => i.id === a.questions[q.id].instrument).label}</span>` : ""}</li>`)
        .join("");
  const credits = preview.values.creditsSpent;
  return `<div class="letter"><b>${K.letter}</b><p>${mission.letter}</p>${state.profile !== "cadet" && mission.lesson ? `<p class="lesson"><b>You will learn:</b> ${mission.lesson}</p>` : ""}${mission.fixed_payload_kg ? `<p><b>Carried cargo:</b> ${mission.fixed_payload_kg} kg lander (adds to the launch mass).</p>` : ""}<div class="asks"><b>${K.asks}</b> ${qmark("payload")}<ul class="asked">${asked}</ul></div></div><p class="budget"><b>${K.budget}:</b> ${credits.toFixed(0)} / ${mission.budget_credits} ${qmark("budget")} <span class="muted">${K.creditsNote}</span></p>`;
}

function bindMissionButtons(after) {
  $("setup").querySelectorAll("[data-mission]").forEach((b) =>
    b.addEventListener("click", () => {
      selectMission(b.dataset.mission);
      $("result").hidden = true;
      after();
    }),
  );
}

function initHowto() {
  const box = $("howto");
  try {
    if (window.localStorage.getItem("howtoClosed") === "1") box.open = false;
  } catch (e) {
    box.open = true;
  }
  box.addEventListener("toggle", () => {
    try {
      window.localStorage.setItem("howtoClosed", box.open ? "0" : "1");
    } catch (e) {
      return;
    }
  });
}

function showData() {
  const D = texts.data;
  const d = $("term-dialog");
  d.innerHTML = `<h3>${D.title}</h3><h4>${D.realHead}</h4><ul>${D.real.map((x) => `<li>${x}</li>`).join("")}</ul><h4>${D.gameHead}</h4><ul>${D.game.map((x) => `<li>${x}</li>`).join("")}</ul><p class="muted">${D.full}</p><form method="dialog"><button class="launch">Close</button></form>`;
  d.showModal();
}

function renderHowto(id) {
  $("howtoBody").innerHTML = `<ol class="steps">${texts.howtoByProfile[id].map((t) => `<li>${t}</li>`).join("")}</ol>`;
  $("howto").querySelector("summary").textContent = `How to play: ${texts.profiles[id].name}`;
}

function setProfile(id) {
  renderHowto(id);
  state = defaultState(id);
  selectMission(missionsFor(ctx.assumptions, id)[0].id, id);
  showNumbers = id !== "cadet";
  document.body.classList.toggle("analyst", id === "analyst");
  $("result").hidden = true;
  renderProfiles();
  render();
}

function renderProfiles() {
  $("profiles").innerHTML = Object.entries(texts.profiles)
    .map(([id, p]) => `<button data-profile="${id}" aria-pressed="${state.profile === id}">${p.name}<small>${p.blurb}</small></button>`)
    .join("");
  $("profiles").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => setProfile(b.dataset.profile)));
}

function opt(value, label, current) {
  return `<option value="${value}"${value === current ? " selected" : ""}>${label}</option>`;
}

function launchBar() {
  const reset = state.profile === "cadet" ? "" : `<button type="button" class="secondary" id="resetDesign">Reset design</button>`;
  return `<div class="launchbar"><div id="launchStatus" class="launch-status"></div>${reset}<button class="launch" id="launch">${texts.launch}</button></div>`;
}

function toggled(list, id) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function renderCadetSetup() {
  const tanks = Math.round(state.propellantKg / TANK_KG);
  const a = ctx.assumptions;
  const mission = currentMission();
  const questionOf = (instrumentId) => Object.entries(a.questions).find(([, q]) => q.instrument === instrumentId)?.[1].text;
  const cards = a.instruments
    .map((i) => {
      const k = K.instruments[i.id];
      return `<button class="card" data-instrument="${i.id}" aria-pressed="${state.instruments.includes(i.id)}"><span class="icon">${k.icon}</span><b>${i.label}</b><small>${k.line}</small><small class="cost">${i.cost_credits} credits</small></button>`;
    })
    .join("");
  const preview = evaluate(state, ctx);
  const answered = preview.values.answered ?? [];
  const asked = mission.hide_questions
    ? `<li class="muted">${K.hiddenQuestions}</li>`
    : mission.questions
    .map((q) => `<li class="${answered.includes(q.id) ? "met" : ""}"><span class="goal-star">${answered.includes(q.id) ? "✓" : "○"}</span> ${a.questions[q.id].text}${q.required ? "" : ' <span class="tag">bonus</span>'} <span class="need">${K.needs}: ${a.instruments.find((i) => i.id === a.questions[q.id].instrument).label}</span></li>`)
    .join("");
  const credits = preview.values.creditsSpent;
  const blocks = Array.from({ length: MAX_TANKS }, (_, n) => `<span class="tank${n < tanks ? " full" : ""}"></span>`).join("");
  $("setup").innerHTML = `
    <h2>${K.pick}: <span class="picked">${currentMission().title}</span></h2>
    <div class="missions">${missionButtons()}</div>
    <div class="letter"><b>${K.letter}</b><p>${mission.letter}</p><div class="asks"><b>${K.asks}</b> ${qmark("payload")}<ul class="asked">${asked}</ul></div></div>
    <h3>${K.step1} ${qmark("payload")}</h3><div class="cards">${cards}</div>
    <h3>${K.step2} ${qmark("delta-v")}</h3>
    <div class="stepper"><button id="tankMinus" aria-label="Remove a tank">−</button><div class="tanks" aria-hidden="true">${blocks}</div><button id="tankPlus" aria-label="Add a tank">+</button></div>
    <p class="count"><b>${tanks}</b> ${K.tanks} <span class="muted">(${a.spacecraft.tank_cost_credits} credits each)</span></p>
    <p class="muted">${state.goal === "flyby" ? K.tankHintFlyby : K.tankHint}</p>
    <p class="budget"><b>${K.budget}:</b> ${credits} / ${mission.budget_credits} ${qmark("budget")} <span class="muted">${K.creditsNote}</span></p>
    <h3>${K.step3}</h3>
    ${launchBar()}`;
  bindMissionButtons(() => {
    renderCadetSetup();
    update();
  });
  $("setup").querySelectorAll("[data-instrument]").forEach((b) =>
    b.addEventListener("click", () => {
      state = { ...state, instruments: toggled(state.instruments, b.dataset.instrument) };
      renderCadetSetup();
      update();
    }),
  );
  const setTanks = (n) => {
    state = { ...state, propellantKg: Math.max(0, Math.min(MAX_TANKS, n)) * TANK_KG };
    renderCadetSetup();
    update();
  };
  $("tankMinus").addEventListener("click", () => setTanks(tanks - 1));
  $("tankPlus").addEventListener("click", () => setTanks(tanks + 1));
  $("launch").addEventListener("click", launch);
}

function renderSetup() {
  if (state.profile === "cadet") {
    renderCadetSetup();
    return;
  }
  const a = ctx.assumptions;
  const engineer = isEng();
  const mission = currentMission();
  let html;
  const a2 = ctx.assumptions;
  const eng = engineOptions(ctx);
  const cards = `<h3>${renderTerm("payload", L.instrument)}</h3><div class="cards">${a.instruments
    .map((i) => `<button class="card" data-instrument-box="${i.id}" aria-pressed="${state.instruments.includes(i.id)}"><span class="icon">${K.instruments[i.id].icon}</span><b>${i.label}</b><small>${K.instruments[i.id].line}</small><small class="muted">${i.mass_kg} kg · ${i.power_w} W</small><small class="cost">${i.cost_credits} credits</small></button>`)
    .join("")}</div>`;
  const fuel = `<label for="propellantKg">${renderTerm("delta-v", L.fuel)}<span class="value" id="fuelValue">${state.propellantKg}</span></label><input type="range" id="propellantKg" data-key="propellantKg" min="0" max="${engineer ? 300 : 200}" step="1" value="${state.propellantKg}"><p class="muted" id="fuelNeed"></p>`;
  const duration = state.goal === "orbit" ? `<label for="duration">${renderTerm("science-time", L.duration)}</label><select id="duration" data-key="duration">${opt("short", L.durationShort, state.duration)}${opt("medium", L.durationMedium, state.duration)}${opt("long", L.durationLong, state.duration)}</select>` : "";
  let dateField;
  let panels;
  if (!engineer) {
    const [d0, d1] = a2.explorer_date_range.map((x) => Date.parse(`${x}T00:00:00Z`));
    const dayOf = (s) => Math.round((Date.parse(`${s}T00:00:00Z`) - d0) / 86400000);
    dateField = `<label for="launchDay">${renderTerm("launch-window", L.launchDate)} <span class="value" id="launchDateText">${state.launchDate}</span></label><input type="range" id="launchDay" min="0" max="${Math.round((d1 - d0) / 86400000)}" step="1" value="${dayOf(state.launchDate)}"><p class="muted">Slide the date and watch the green line on the launch-window chart. Low points of the line are the cheap times to leave.</p>`;
    panels = `<label for="arrayAreaM2">${renderTerm("solar-array", L.array)}</label><select id="arrayAreaM2" data-key="arrayAreaM2" data-number="1">${a2.panel_options.map((x) => opt(String(x.area), `${x.label} (${x.area} m²)`, String(state.arrayAreaM2))).join("")}</select>`;
    html = `<h2>${K.pick}: <span class="picked">${currentMission().title}</span></h2><div class="missions">${missionButtons()}</div>${briefHtml(mission, evaluate(state, ctx))}<h2>Design</h2>${cards}${fuel}${duration}${dateField}${panels}`;
  } else {
    dateField = `<label for="launchDate">${renderTerm("launch-window", L.launchDate)}</label><input type="date" id="launchDate" data-key="launchDate" value="${state.launchDate}" min="2026-11-01" max="2034-01-01"><p class="muted">Low points on the launch-window chart are the cheap dates (small C3 ${qmark("vinf-c3")}).</p>`;
    const vehicle = `<label for="vehicle">${renderTerm("spacecraft", L.vehicle)}</label><select id="vehicle" data-key="vehicle">${vehicleOptions(ctx).map((v) => opt(v.id, `${v.label} (${v.capacityKg} kg)`, state.vehicle)).join("")}</select><p class="muted">Bigger rockets lift more but cost more credits.</p>`;
    const engine = `<label for="engine">${renderTerm("thrust-isp", L.engine)}</label><select id="engine" data-key="engine">${opt("chemical", L.engineChemical, state.engine)}${opt("electric", L.engineElectric, state.engine)}</select><p class="muted">Chemical: thrust ${eng.chemical.thrustN} N, Isp ${eng.chemical.ispS} s. Electric: thrust ${eng.electric.thrustN} N, Isp ${eng.electric.ispS} s, needs ${eng.electric.powerW} W of power and carries at most ${eng.electric.maxPropellantKg} kg of propellant.</p>`;
    panels = `<label for="arrayAreaM2">${renderTerm("solar-array", L.array)}<span class="value" id="arrayValue">${state.arrayAreaM2}</span></label><input type="range" id="arrayAreaM2" data-key="arrayAreaM2" min="0.2" max="6" step="0.1" value="${state.arrayAreaM2}">`;
    const band = `<label for="band">${renderTerm("solar-conjunction", L.band)}</label><select id="band" data-key="band">${bandOptions(ctx).map((b) => opt(b.id, b.label, state.band)).join("")}</select><p class="muted">Higher bands keep working closer to the Sun, so fewer days without contact, but they cost more credits.</p>`;
    const radio = state.profile === "analyst"
      ? `<label for="dishM">${renderTerm("link-budget", "Radio antenna diameter (m)")}</label><select id="dishM" data-key="dishM" data-number="1">${a2.link.dishes.map((x) => opt(String(x.diameter_m), `${x.diameter_m} m (${x.mass_kg} kg, ${x.cost_credits} credits)`, String(state.dishM))).join("")}</select><label for="txPowerW">Transmitter power (W)</label><select id="txPowerW" data-key="txPowerW" data-number="1">${a2.link.tx_powers.map((x) => opt(String(x.watts), `${x.watts} W radio (needs ${(x.watts / a2.link.amp_efficiency).toFixed(0)} W of electricity, ${x.cost_credits} credits)`, String(state.txPowerW))).join("")}</select><p class="muted">Bigger antennas and stronger transmitters return more data but weigh more and need power.</p>`
      : "";
    const seedField = `<label for="seed">Random seed (optional)</label><input type="number" id="seed" data-key="seed" min="0" step="1" placeholder="random" value="${state.seed ?? ""}"><p class="muted">Leave empty for new dice each flight. Enter a number to repeat exactly the same random events.</p>`;
    const orbit = state.profile === "analyst" && state.goal === "orbit"
      ? `<label for="periapsisKm">${renderTerm("orbit-shape", "Closest point above surface (km)")}</label><input type="number" id="periapsisKm" data-key="periapsisKm" min="150" max="2000" step="10" value="${state.periapsisKm}"><label for="apoapsisKm">${renderTerm("orbit-shape", "Farthest point above surface (km)")}</label><input type="number" id="apoapsisKm" data-key="apoapsisKm" min="150" max="30000" step="100" value="${state.apoapsisKm}"><p class="muted">A larger farthest point makes the braking cheaper but lengthens the orbit period.</p>`
      : "";
    html = `<h2>${K.pick}: <span class="picked">${currentMission().title}</span></h2><div class="missions">${missionButtons()}</div>${briefHtml(mission, evaluate(state, ctx))}<h2>Design</h2><div class="group"><h3>1. Launch and trajectory</h3>${dateField}${vehicle}</div><div class="group"><h3>2. Spacecraft</h3>${cards}${engine}${panels}${radio}${fuel}</div><div class="group"><h3>3. Mission</h3>${duration}${band}${orbit}${state.profile === "analyst" ? seedField : ""}</div>`;
  }
  html += launchBar();
  $("setup").innerHTML = html;
  bindMissionButtons(render);
  $("setup").querySelectorAll("[data-instrument-box]").forEach((el) =>
    el.addEventListener("click", () => {
      state = { ...state, instruments: toggled(state.instruments, el.dataset.instrumentBox) };
      renderSetup();
      update();
    }),
  );
  addSteppers($("setup"));
  const day = $("launchDay");
  if (day) {
    const base = Date.parse(`${ctx.assumptions.explorer_date_range[0]}T00:00:00Z`);
    day.addEventListener("input", () => {
      const s = new Date(base + Number(day.value) * 86400000).toISOString().slice(0, 10);
      state = { ...state, launchDate: s };
      $("launchDateText").textContent = s;
      update();
    });
  }
  $("setup").querySelectorAll("[data-key]").forEach((el) => {
    el.addEventListener("input", () => {
      const key = el.dataset.key;
      let value = el.value;
      if (key === "seed") value = el.value.trim();
      else if (el.type === "range" || el.type === "number" || el.dataset.number) value = Number(value);
      state = { ...state, [key]: value };
      update();
      const b = $("setup").querySelector(".budget");
      if (b) b.outerHTML = briefHtml(currentMission(), evaluate(state, ctx)).match(/<p class="budget">.*<\/p>/s)[0];
      bindTerms();
    });
  });
  $("launch").addEventListener("click", launch);
  const reset = $("resetDesign");
  if (reset)
    reset.addEventListener("click", () => {
      const keepSeed = state.seed;
      selectMission(state.missionId);
      if (keepSeed !== undefined) state = { ...state, seed: keepSeed };
      $("result").hidden = true;
      render();
    });
}

function unmetHtml(progress, result, risk) {
  const mission = currentMission();
  const rows = progress.goals
    .map((g, i) => ({ g, live: liveValue(mission.stars[i], result.values) }))
    .filter((x) => !x.g.met)
    .map((x) => `<li>✕ ${x.g.text}${x.live ? ` <span class="live">(${x.live})</span>` : ""}</li>`)
    .join("");
  const note = rows && risk && risk.early.length + risk.late.length > 0 ? `<p class="muted">Random events in this flight changed the numbers (see the dice rolls below). The forecast assumed no surprises.</p>` : "";
  return rows ? `<div class="unmet"><b>Not met:</b><ul>${rows}</ul>${note}</div>` : "";
}

function yourNumbers(result) {
  const v = result.values;
  if (!v.plan || v.wetKg === undefined) return "";
  const parts = [`launch mass ${v.wetKg.toFixed(0)} kg, of which fuel ${v.propellantKg} kg (${Math.round((v.propellantKg / v.wetKg) * 100)}%)`];
  if (v.dvRequiredMs !== undefined && v.dvAvailMs !== undefined) parts.push(`speed change available ${v.dvAvailMs.toFixed(0)} m/s against ${v.dvRequiredMs.toFixed(0)} m/s needed`);
  if (v.powerSupplyW !== undefined) parts.push(`electricity ${v.powerSupplyW.toFixed(0)} W supplied, ${v.powerDemandW.toFixed(0)} W used`);
  parts.push(`${v.creditsSpent.toFixed(0)} credits spent`);
  return `<p class="muted">In your design: ${parts.join("; ")}.</p>`;
}

function addSteppers(root) {
  root.querySelectorAll('input[type="range"]').forEach((range) => {
    const isDay = range.id === "launchDay";
    const step = Number(range.step) || 1;
    const decimals = (String(range.step).split(".")[1] ?? "").length;
    const wrap = document.createElement("div");
    wrap.className = "stepper";
    const minus = document.createElement("button");
    minus.type = "button";
    minus.textContent = "−";
    minus.setAttribute("aria-label", isDay ? "One day earlier" : "Decrease");
    const plus = document.createElement("button");
    plus.type = "button";
    plus.textContent = "+";
    plus.setAttribute("aria-label", isDay ? "One day later" : "Increase");
    let box = null;
    if (!isDay) {
      box = document.createElement("input");
      box.type = "number";
      box.min = range.min;
      box.max = range.max;
      box.step = range.step;
      box.value = range.value;
      box.setAttribute("aria-label", "Exact value");
    }
    const apply = (v) => {
      const lo = Number(range.min);
      const hi = Number(range.max);
      const clamped = Math.min(hi, Math.max(lo, v));
      range.value = clamped.toFixed(decimals);
      if (box) box.value = range.value;
      range.dispatchEvent(new Event("input", { bubbles: true }));
    };
    minus.addEventListener("click", () => apply(Number(range.value) - step));
    plus.addEventListener("click", () => apply(Number(range.value) + step));
    if (box) {
      box.addEventListener("change", () => {
        if (box.value !== "") apply(Number(box.value));
      });
      range.addEventListener("input", () => {
        if (document.activeElement !== box) box.value = range.value;
      });
    }
    range.after(wrap);
    wrap.append(minus, ...(box ? [box] : []), plus);
  });
}

function termify(text, termId) {
  return termId && glossary[termId] ? renderTerm(termId, text) : text;
}

function worst(ratio) {
  if (ratio === undefined) return "pass";
  if (ratio < 1) return "fail";
  if (ratio < 1.1) return "warn";
  return "pass";
}

function kidText(check) {
  if (isEng()) return { label: check.label, sentence: check.detail };
  const k = texts.kidChecks[check.id];
  if (!k) return { label: check.label, sentence: check.detail };
  if (check.id === "dv" && state.goal === "flyby") {
    return { label: k.label, sentence: check.status === "fail" ? k.flybyFail : k.flybyPass };
  }
  return { label: k.label, sentence: k[check.status] ?? k.pass ?? "" };
}

function fixHint(c, result) {
  const v = result.values;
  let text = "";
  if (c.id === "dv") {
    const need = minPropellantKg(state, ctx);
    text = need === null ? "No amount of fuel is enough for this design. Choose a better launch date or a lighter spacecraft." : `To fix: about ${need} kg of fuel is needed (you carry ${state.propellantKg} kg).`;
  } else if (c.id === "mass") {
    text = `To fix: remove about ${Math.max(0, v.wetKg - v.capKg).toFixed(0)} kg or choose a bigger rocket.`;
  } else if (c.id === "power") {
    text = `To fix: about ${(state.arrayAreaM2 * (v.powerDemandW / Math.max(v.powerSupplyW, 1)) * 1.15).toFixed(1)} m² of panels would cover the demand with some margin.`;
  } else if (c.id === "budget") {
    text = `To fix: you are over budget by ${(v.creditsSpent - v.mission.budget_credits).toFixed(0)} credits. Remove an instrument, a fuel tank or a large dish.`;
  } else if (c.id === "burn") {
    text = "To fix: use the chemical engine, or choose a flyby.";
  } else if (c.id === "data") {
    text = "To fix: use a higher radio band, a bigger antenna or more transmitter power, or fewer instruments.";
  } else if (c.id === "energy") {
    text = "To fix: move the launch date to a dip on the launch-window chart.";
  }
  return text ? `<small class="fix">${text}</small>` : "";
}

function advice(result) {
  const bad = result.checks.find((c) => c.status === "fail");
  if (bad) return { status: "fail", text: kidText(bad).sentence };
  const risky = result.checks.find((c) => c.status === "warn");
  if (risky) return { status: "warn", text: kidText(risky).sentence };
  return { status: "pass", text: K.ready };
}

function liveValue(g, v) {
  const pct = (x) => `${Math.round(x * 100)}%`;
  if (g.type === "all") return (g.of ?? []).filter((x) => x.type !== "answers_required").map((x) => liveValue(x, v)).filter(Boolean).join(", ");
  if (g.type === "max_mass_kg") return `now ${v.wetKg.toFixed(0)} kg`;
  if (g.type === "min_months") return `now ${v.months} months`;
  if (g.type === "contact_min") return `now ${pct(v.contactFraction)}`;
  if (g.type === "dv_margin_min" || g.type === "dv_margin_between") return `fuel reserve now ${pct(v.dvMargin)}`;
  if (g.type === "power_margin_min") return `power margin now ${pct(v.powerMargin)}`;
  if (g.type === "max_periapsis_km") return `now ${v.periapsisKm} km`;
  if (g.type === "period_hours_between") return `now ${v.periodH.toFixed(1)} h`;
  if (g.type === "chance_min") return v.smoothChance === null ? "" : `now ${pct(v.smoothChance)}`;
  if (g.type === "data_margin_min") return v.link ? `now ${pct(v.link.margin)}` : "";
  if (g.type === "credits_left_min") return `now ${v.creditsLeft.toFixed(0)} credits left`;
  if (g.type === "answers_required") {
    const req = v.mission.questions.filter((q) => q.required);
    return `now ${req.filter((q) => v.answered.includes(q.id)).length} of ${req.length} questions`;
  }
  return "";
}

const REQ_HINTS = {
  reach: "needs enough fuel for the braking burn and an engine strong enough to brake in 12 hours (see the Trajectory meters)",
  answers_required: "choose the instruments that answer the scientists' main questions",
  min_months: "set by Science time; every month costs credits",
  contact_min: "a higher radio band loses fewer days near solar conjunction; a different launch date moves the blackout",
  dv_margin_min: "add fuel, remove mass, or make braking cheaper with a higher farthest point",
  dv_margin_between: "add or remove fuel until the reserve is inside the range",
  power_margin_min: "more panel area, or less electricity use (instrument, engine, transmitter)",
  max_mass_kg: "less fuel, fewer or lighter instruments, smaller antenna and panels",
  chance_min: "rises with fuel reserve and power margin; see the risk box",
  data_margin_min: "use a higher radio band, a bigger antenna or a stronger transmitter, or collect less data",
  max_periapsis_km: "lower the closest point of the orbit",
  period_hours_between: "set by closest and farthest point (Kepler's third law)",
  credits_left_min: "spend fewer credits",
};

function reqHint(g) {
  if (g.type === "all") return [...new Set((g.of ?? []).map((x) => REQ_HINTS[x.type]).filter(Boolean))].join("; ");
  return REQ_HINTS[g.type] ?? "";
}

function renderGoals(result) {
  const mission = currentMission();
  const progress = missionProgress(result, mission);
  const an = isEng();
  const rows = progress.goals
    .map((g, i) => `<li class="${g.met ? "met" : ""}"><span class="goal-star">${an ? (g.met ? "✓" : "✕") : g.met ? "★" : "☆"}</span> ${g.text}${an && result.values.plan && liveValue(mission.stars[i], result.values) ? ` <span class="live">(${liveValue(mission.stars[i], result.values)})</span>` : ""}${an && !g.met && reqHint(mission.stars[i]) ? `<small class="reqhint">What changes it: ${reqHint(mission.stars[i])}.</small>` : ""}</li>`)
    .join("");
  const bonus = `<li class="${progress.bonus.met ? "met" : ""}"><span class="goal-star">🪙</span> ${progress.bonus.text}</li>`;
  return `<div class="goals" id="sec-req"><h2>${an ? `Requirements: ${progress.stars} of ${progress.goals.length} met${state.profile === "analyst" ? ' <small class="muted">without surprises</small>' : ""}` : K.goals} ${qmark(an ? "requirements" : "stars")}</h2><ul>${rows}${bonus}</ul></div>`;
}

function renderForecast(result) {
  const adv = advice(result);
  const message = `<div class="advice ${adv.status}" role="status"><span class="badge ${adv.status}">${BADGE[adv.status]}</span><div><small>${isEng() ? "Design check" : K.controlRoom}</small><div>${adv.text}</div></div></div>`;
  const started = state.profile !== "cadet" || currentMission().level !== "Easy" || state.instruments.length > 0 || state.propellantKg > 0;
  const windowChart = state.profile !== "cadet" ? renderWindowChart() : "";
  const riskBox = renderRisk(result);
  const math = isEng() ? renderMath(result) : "";
  const sens = state.profile === "analyst" ? sensitivityHtml(result) : "";
  const mc = renderMonteCarlo(result);
  const linkBudget = renderLinkBudget(result);
  const assumptions = assumptionsHtml();
  const exportBtns = exportButtons();
  const anchorList = [["sec-req", "Requirements", true], ["sec-mc", "Monte Carlo", mc], ["sec-meters", "Checks", true], ["sec-link", "Link budget", linkBudget], ["sec-sens", "Sensitivity", sens], ["sec-assump", "Assumptions", assumptions]].filter((x) => x[2]);
  const anchors = state.profile === "analyst" ? `<nav class="anchors" aria-label="Jump to">${anchorList.map(([id, name]) => `<a href="#${id}">${name}</a>`).join("")}</nav>` : "";
  const meters = !started
    ? `<p class="muted waiting">${K.waiting}</p>`
    : (() => {
        const rowHtml = (c) => {
          const k = kidText(c);
          const pct = Math.round(c.fill * 100);
          const detail = showNumbers || isEng() ? `<small class="muted">${c.detail}</small>` : "";
          const fix = isEng() && c.status !== "pass" ? fixHint(c, result) : "";
          if (c.id === "required") {
            const mission = currentMission();
            const req = mission.questions.filter((q) => q.required);
            const have = req.filter((q) => (result.values.answered ?? []).includes(q.id)).length;
            const dots = req.map((q, i) => `<span class="dot${i < have ? " on" : ""}">${i < have ? "●" : "○"}</span>`).join(" ");
            return `<div class="meter-row"><div class="meter-head"><span>${k.label} ${c.term ? qmark(c.term) : ""}</span><span class="badge ${c.status}">${BADGE[c.status]}</span></div><div class="dots">${dots} <small class="muted">${have} of ${req.length} main questions covered</small></div></div>`;
          }
          return `<div class="meter-row"><div class="meter-head"><span>${k.label} ${c.term ? qmark(c.term) : ""}</span><span class="badge ${c.status}">${BADGE[c.status]}</span></div><div class="meter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="${k.label}"><div class="meter-fill ${c.status}" style="width:${pct}%"></div></div>${detail}${fix}</div>`;
        };
        if (!isEng()) return result.checks.map(rowHtml).join("");
        const groups = [["Trajectory", ["dv", "burn", "energy"]], ["Spacecraft", ["payload", "required", "mass", "power", "duration"]], ["Radio link", ["contact", "data"]], ["Budget", ["budget"]]];
        return groups
          .map(([name, ids]) => {
            const rows = result.checks.filter((c) => ids.includes(c.id)).map(rowHtml).join("");
            return rows ? `<h3 class="mgroup">${name}</h3>${rows}` : "";
          })
          .join("");
      })();
  const ind = showNumbers
    ? `<div class="indicators">${result.indicators
        .map((i) => `<div class="indicator ${worst(i.ratio)}"><div>${termify(i.label, i.term)}</div><div class="v">${i.value}</div><div class="s">${i.sub}</div></div>`)
        .join("")}</div>`
    : "";
  const toggle = `<label class="toggle"><input type="checkbox" id="numbersToggle"${showNumbers ? " checked" : ""}> ${K.showNumbers}</label><label class="toggle"><input type="checkbox" id="hintsToggle"${showHints ? " checked" : ""}> ${K.showHints}</label>`;
  const goals = renderGoals(result);
  const diagram = started ? renderDiagram(ctx, result, texts.diagram) : "";
  $("forecast-panel").innerHTML = `<div class="fc-grid"><div class="fc-status"><h2>${texts.forecast}</h2>${anchors}${message}${riskBox}${goals}${mc}<div id="sec-meters">${meters}</div>${ind}${math}${toggle}</div><div class="fc-visual">${state.profile === "analyst" ? "" : renderCraft(state, ctx, texts.craft)}${state.profile === "analyst" ? "" : diagram}${windowChart}${linkBudget}${sens}${assumptions}${exportBtns}</div></div>`;
  $("forecast-panel").querySelectorAll(".anchors a").forEach((a) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const target = $("forecast-panel").querySelector(a.getAttribute("href"));
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    }),
  );
  $("hintsToggle").addEventListener("change", (e) => {
    showHints = e.target.checked;
    document.body.classList.toggle("no-hints", !showHints);
  });
  $("numbersToggle").addEventListener("change", (e) => {
    showNumbers = e.target.checked;
    update();
  });
}

function renderMonteCarlo(result) {
  if (state.profile !== "analyst" || !result.ok) return "";
  const mission = currentMission();
  const mc = monteCarlo(result, mission, ctx, 500, 1);
  const goals = missionProgress(result, mission).goals;
  const pct = (x) => `${Math.round(x * 100)}%`;
  const rows = goals.map((g, i) => `<tr><td>${g.text}</td><td>${pct(mc.perGoal[i])}</td></tr>`).join("");
  const vals = mc.reserves.map((x) => x * 100);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const bins = 12;
  const width = Math.max(hi - lo, 1e-6);
  const counts = new Array(bins).fill(0);
  vals.forEach((x) => {
    counts[Math.min(bins - 1, Math.floor(((x - lo) / width) * bins))] += 1;
  });
  const top = Math.max(...counts);
  const bars = counts.map((c, i) => `<rect x="${10 + i * 22}" y="${60 - (c / top) * 52}" width="19" height="${(c / top) * 52}" fill="currentColor" opacity=".55"/>`).join("");
  const hist = `<svg viewBox="0 0 284 90" class="hist" role="img" aria-label="Distribution of fuel reserve over 500 flights"><g>${bars}</g><line x1="10" y1="60" x2="274" y2="60" stroke="currentColor" opacity=".4"/><text x="10" y="76" font-size="9" fill="currentColor">${lo.toFixed(1)}%</text><text x="274" y="76" font-size="9" fill="currentColor" text-anchor="end">${hi.toFixed(1)}%</text><text x="142" y="87" font-size="9" fill="currentColor" text-anchor="middle">fuel reserve after surprises</text></svg>`;
  return `<div class="mc" id="sec-mc"><h3>Monte Carlo: ${mc.n} random flights ${qmark("monte-carlo")}</h3><p>All requirements are met in <b>${pct(mc.all)}</b> of flights. The mission is lost in ${pct(mc.lost)}.</p><table class="facts"><thead><tr><th>Requirement</th><th>Met in</th></tr></thead><tbody>${rows}</tbody></table>${hist}<p class="muted">Same design flown ${mc.n} times with a fixed seed (${mc.seed}), so the numbers repeat. Surprise probabilities are game design (see assumptions).</p></div>`;
}

function renderLinkBudget(result) {
  const l = result.values.link;
  if (state.profile !== "analyst" || !l) return "";
  const dsnTag = "DSN handbook";
  const gameTag = "game design";
  const physTag = "physics";
  const rows = [
    ["Transmitter power", `${state.txPowerW} W = ${l.txPowerDbw.toFixed(1)} dBW`, gameTag],
    ["Spacecraft antenna gain", `${l.txGainDb.toFixed(1)} dBi (${state.dishM} m dish, efficiency ${ctx.assumptions.link.antenna_efficiency})`, `${physTag}, efficiency ${gameTag}`],
    ["EIRP", `${l.eirpDbw.toFixed(1)} dBW`, physTag],
    ["Free-space path loss", `−${l.pathLossDb.toFixed(1)} dB at ${(l.maxRangeKm / 1e6).toFixed(0)} million km, ${l.dsn.frequency_ghz} GHz`, `${physTag}, distance from JPL Horizons`],
    ["Earth antenna gain (34 m)", `+${l.dsn.rx_gain_dbi} dBi`, dsnTag],
    ["Other losses (pointing, atmosphere, cables)", `−${ctx.assumptions.link.other_losses_db} dB`, gameTag],
    ["Received power", `${l.receivedDbw.toFixed(1)} dBW`, physTag],
    ["Noise density N0 = k·T", `${l.n0DbwHz.toFixed(1)} dBW/Hz (T = ${l.dsn.system_noise_k} K)`, `${dsnTag}, k from physics`],
    ["Pr/N0", `${l.prN0DbHz.toFixed(1)} dB-Hz`, physTag],
    ["Required Eb/N0", `${ctx.assumptions.link.required_ebn0_db} dB`, gameTag],
    ["Largest data rate", `${l.rateDbHz.toFixed(1)} dB-Hz = ${(l.rateBps / 1000).toFixed(1)} kbit/s`, physTag],
    ["Data returned / collected", `${l.capacityGbit.toFixed(2)} / ${l.generatedGbit.toFixed(2)} Gbit (margin ${Math.round(l.margin * 100)}%)`, `${physTag}, ${ctx.assumptions.link.contact_hours_per_day} h/day contact ${gameTag}`],
  ]
    .map(([k, val, src]) => `<tr><td>${k}</td><td>${val}</td><td class="muted">${src}</td></tr>`)
    .join("");
  return `<div class="linkbudget" id="sec-link"><h3>Link budget ${qmark("link-budget")}</h3><table class="facts"><thead><tr><th>Step</th><th>Value</th><th>Origin</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function assumptionsHtml() {
  if (state.profile !== "analyst") return "";
  const P = ctx.params;
  const A = ctx.assumptions;
  const real = (name, value, source) => [name, value, "NASA/JPL data", source];
  const game = (name, value, note = "game design") => [name, value, "Game design", note];
  const rows = [
    real("Positions of Earth and Mars", "daily table 2026–2035", "JPL Horizons"),
    real("Chemical engine specific impulse", `${P.engines.chemical.isp_s} s`, "NASA SOA 2026, Table 4-3"),
    real("Electric engine specific impulse", `${P.engines.electric.isp_s} s`, "NASA SOA 2026, Table 4-9"),
    real("Solar cell efficiency (beginning of life)", `${P.solar_cells.default.bol_efficiency_pct}%`, "NASA SOA 2026, Table 3-1"),
    real("Sunlight at Mars", `${P.bodies.solar_irradiance_w_m2.mars} W/m²`, "NASA NSSDCA Mars fact sheet"),
    real("Blackout angle S / X / Ka", `${P.conjunction.thresholds_deg.s_band}° / ${P.conjunction.thresholds_deg.x_band}° / ${P.conjunction.thresholds_deg.ka_band}°`, "NASA ASCEND 2022"),
    real("Earth antenna gain S / X / Ka", `${P.dsn.bands.s_band.rx_gain_dbi} / ${P.dsn.bands.x_band.rx_gain_dbi} / ${P.dsn.bands.ka_band.rx_gain_dbi} dBi`, "NASA DSN handbook 104"),
    real("Earth system noise S / X / Ka", `${P.dsn.bands.s_band.system_noise_k} / ${P.dsn.bands.x_band.system_noise_k} / ${P.dsn.bands.ka_band.system_noise_k} K`, "NASA DSN handbook 104"),
    game("Spacecraft body", `${A.spacecraft.bus_dry_kg} kg, ${A.spacecraft.bus_power_w} W`),
    game("Course corrections after launch", `${A.mission.tcm_delta_v_ms} m/s`, "order of magnitude only"),
    game("Navigation surprise", `${Math.round(A.risk.nav_probability * 100)}% chance, up to ${A.risk.nav_max_ms} m/s`),
    game("Dust storm", `${Math.round(A.risk.storm_probability * 100)}% chance, cuts power by ${Math.round(A.risk.storm_power_cut * 100)}%`),
    game("Spacecraft antenna efficiency", `${A.link.antenna_efficiency}`),
    game("Other link losses", `${A.link.other_losses_db} dB`),
    game("Required Eb/N0", `${A.link.required_ebn0_db} dB`),
    game("Transmitter amplifier efficiency", `${A.link.amp_efficiency}`),
    game("Contact time with Earth", `${A.link.contact_hours_per_day} h per day`),
    game("Instrument data volumes", A.instruments.map((i) => `${i.label} ${i.data_gbit_per_month} Gbit/month`).join(", ")),
    game("Costs, budgets and requirement thresholds", "credits are not money", "no NASA source exists for these"),
  ]
    .map(([n, v, kind, src]) => `<tr><td>${n}</td><td>${v}</td><td>${kind}</td><td class="muted">${src}</td></tr>`)
    .join("");
  return `<details class="math assumptions" id="sec-assump"><summary>Assumptions and sources</summary><table class="facts"><thead><tr><th>Quantity</th><th>Value</th><th>Kind</th><th>Source</th></tr></thead><tbody>${rows}</tbody></table><p class="muted">Full links are listed in docs/SOURCES.md of the project.</p></details>`;
}

let lastRun = null;

function exportButtons() {
  return state.profile === "analyst" ? `<p class="exports"><button type="button" class="secondary" data-export="json">Export JSON</button> <button type="button" class="secondary" data-export="csv">Export CSV</button></p>` : "";
}

function buildExport() {
  const result = evaluate(state, ctx);
  const mission = currentMission();
  const progress = missionProgress(result, mission);
  const mc = result.ok ? monteCarlo(result, mission, ctx, 500, 1) : null;
  const flat = {};
  for (const [k, val] of Object.entries(result.values)) if (["number", "string", "boolean"].includes(typeof val)) flat[k] = val;
  const link = result.values.link ? Object.fromEntries(Object.entries(result.values.link).filter(([, val]) => typeof val === "number")) : null;
  return {
    game: "Mission: Mars",
    exportedAt: new Date().toISOString(),
    level: texts.profiles[state.profile].name,
    mission: mission.title,
    inputs: state,
    values: flat,
    linkBudget: link,
    requirements: progress.goals.map((g, i) => ({ text: g.text, metWithoutSurprises: g.met, now: liveValue(mission.stars[i], result.values), probabilityMet: mc ? mc.perGoal[i] : null })),
    monteCarlo: mc ? { runs: mc.n, seed: mc.seed, allRequirementsProbability: mc.all, lossProbability: mc.lost } : null,
    lastFlight: lastRun,
    sources: "NASA data: JPL Horizons, SOA 2026, ASCEND 2022, NSSDCA, DSN handbook 810-005 module 104. See docs/SOURCES.md. Game-design values are listed in the Assumptions and sources table.",
  };
}

function download(name, type, text) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-export]");
  if (!b) return;
  const data = buildExport();
  const stamp = `${state.missionId}-${new Date().toISOString().slice(0, 10)}`;
  if (b.dataset.export === "json") download(`mission-mars-${stamp}.json`, "application/json", JSON.stringify(data, null, 2));
  else {
    const q = (s) => `"${String(s).replaceAll('"', '""')}"`;
    const lines = ["requirement,met_without_surprises,now,probability_met", ...data.requirements.map((r) => [q(r.text), r.metWithoutSurprises, q(r.now), r.probabilityMet ?? ""].join(","))];
    download(`mission-mars-${stamp}.csv`, "text/csv", lines.join("\n"));
  }
});

function renderWindowChart() {
  const pts = launchEnergyCurve(ctx, 10);
  if (!pts.length) return "";
  const t0 = pts[0].ms;
  const t1 = pts[pts.length - 1].ms;
  const maxV = Math.min(14, Math.max(...pts.map((p) => p.total)));
  const W = 560;
  const H = 150;
  const x = (ms) => 30 + ((ms - t0) / (t1 - t0)) * (W - 40);
  const y = (v) => H - 20 - (Math.min(v, maxV) / maxV) * (H - 40);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(p.ms).toFixed(1)} ${y(p.total).toFixed(1)}`).join(" ");
  const cur = Date.parse(`${state.launchDate}T00:00:00Z`);
  const years = [];
  for (let yr = new Date(t0).getUTCFullYear() + 1; yr <= new Date(t1).getUTCFullYear(); yr++) years.push(yr);
  const ticks = years.map((yr) => `<text x="${x(Date.UTC(yr, 0, 1)).toFixed(1)}" y="${H - 4}" class="ax" text-anchor="middle">${yr}</text>`).join("");
  return `<div class="chart"><h3>Launch windows ${qmark("launch-window")}</h3><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Speed change needed at each launch date. Low points are good launch windows."><path d="${line}" class="curve"/><line x1="${x(cur).toFixed(1)}" x2="${x(cur).toFixed(1)}" y1="6" y2="${H - 20}" class="cursor"/>${ticks}<text x="4" y="14" class="ax">harder</text><text x="4" y="${H - 22}" class="ax">easier</text></svg><p class="muted">Dips in the line are the good times to leave. The vertical line is your launch date.</p></div>`;
}

function bar(label, parts, max, unit, limit, word = "limit") {
  const W = 520;
  const sx = (v) => 10 + (v / max) * (W - 20);
  let x = 10;
  const colors = ["var(--accent)", "var(--pass)", "var(--warn)", "#7a8cff", "#c06"];
  const segs = parts.map(([name, v], i) => {
    const w = Math.max(0, sx(v) - 10);
    const r = `<rect x="${x.toFixed(1)}" y="22" width="${w.toFixed(1)}" height="22" fill="${colors[i % colors.length]}"><title>${name}: ${v.toFixed(1)} ${unit}</title></rect>`;
    x += w;
    return r;
  });
  const lim = limit !== undefined ? `<line x1="${sx(limit).toFixed(1)}" x2="${sx(limit).toFixed(1)}" y1="14" y2="52" stroke="var(--fail)" stroke-width="2"/><text x="${Math.min(sx(limit) + 4, W - 70).toFixed(1)}" y="12" class="ax">${word} ${limit.toFixed(0)} ${unit}</text>` : "";
  const legend = parts.map(([name, v], i) => `<span class="lg"><i style="background:${colors[i % colors.length]}"></i>${name} ${v.toFixed(v < 10 ? 1 : 0)}</span>`).join("");
  return `<div class="bar"><b>${label}</b><svg viewBox="0 0 ${W} 56" role="img" aria-label="${label}">${segs.join("")}${lim}</svg><div class="legend">${legend}</div></div>`;
}

function delayChart(result) {
  const track = flightTrack(ctx, result);
  if (!track) return "";
  const W = 520;
  const H = 120;
  const maxD = Math.max(...track.map((p) => p.delayMin), 1);
  const total = track[track.length - 1].day;
  const pts = track.map((p, i) => `${i ? "L" : "M"}${(30 + (p.day / total) * (W - 40)).toFixed(1)} ${(H - 20 - (p.delayMin / maxD) * (H - 40)).toFixed(1)}`).join(" ");
  return `<div class="bar"><b>Radio delay on the way (minutes, one way)</b><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Radio delay over the flight"><path d="${pts}" class="curve"/><text x="4" y="14" class="ax">${maxD.toFixed(1)} min</text><text x="4" y="${H - 22}" class="ax">0</text><text x="30" y="${H - 4}" class="ax">day 0</text><text x="${W - 60}" y="${H - 4}" class="ax">day ${total.toFixed(0)}</text></svg></div>`;
}

function workedMath(result) {
  const v = result.values;
  const g0 = 9.80665;
  const rows = [
    ["Speed change your fuel gives", "Δv = Isp · g₀ · ln(m₀ / m₁)", `${v.engine.ispS} s · ${g0} · ln(${v.wetKg.toFixed(1)} / ${v.dryKg.toFixed(1)})`, `${v.dvAvailMs.toFixed(0)} m/s`],
    ["Braking at Mars", "Δv = √(V∞² + 2μ/r) − √(μ/r)", `V∞ = ${v.vInfArrivalKmS.toFixed(2)} km/s, orbit ${v.periapsisKm}${v.apoapsisKm !== v.periapsisKm ? ` × ${v.apoapsisKm}` : ""} km`, `${v.captureMs.toFixed(0)} m/s`],
    ["Total speed change needed", "Δv = braking + corrections", `${v.captureMs.toFixed(0)} + ${ctx.assumptions.mission.tcm_delta_v_ms}`, `${v.dvRequiredMs.toFixed(0)} m/s`],
    ["Braking time", "t = m₀ · Δv / F", `${v.wetKg.toFixed(1)} kg · ${v.captureMs.toFixed(0)} m/s / ${v.engine.thrustN} N`, `${v.burnHours.toFixed(1)} h`],
    ["Electric power at Mars", "P = S · A · η", `${state.arrayAreaM2} m² of panels at Mars`, `${v.powerSupplyW.toFixed(0)} W (need ${v.powerDemandW.toFixed(0)} W)`],
    ...(v.link
      ? [
          ["Antenna gain on the spacecraft", "G = η · (π · D / λ)²", `η 0.55 · D ${state.dishM} m · ${v.link.dsn.frequency_ghz} GHz`, `${v.link.txGainDb.toFixed(1)} dBi`],
          ["Path loss at the farthest distance", "L = 20 · log10(4π · d / λ)", `d = ${(v.link.maxRangeKm / 1e6).toFixed(0)} million km`, `${v.link.pathLossDb.toFixed(1)} dB`],
          ["Largest data rate", "R = EIRP · G(Earth) / (k · T · Eb/N0 · L)", `Earth gain ${v.link.dsn.rx_gain_dbi} dBi, T ${v.link.dsn.system_noise_k} K, ${state.txPowerW} W`, `${(v.link.rateBps / 1000).toFixed(1)} kbit/s`],
          ["Data returned vs collected", "rate · 8 h/day · days · contact", `${v.link.capacityGbit.toFixed(2)} Gbit returned`, `${v.link.generatedGbit.toFixed(2)} Gbit collected`],
        ]
      : []),
    ["Radio delay", "t = d / c", `distance at arrival / 299 792 km/s`, `${v.delayMin.toFixed(1)} min`],
  ]
    .map(([n, f, num, out]) => `<tr><td>${n}</td><td><code>${f}</code></td><td>${num}</td><td><b>${out}</b></td></tr>`)
    .join("");
  return `<div class="worked"><b>Worked calculations</b> ${qmark("delta-v")}<table class="facts"><thead><tr><th>Quantity</th><th>Formula</th><th>Your numbers</th><th>Result</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function benchmarkHtml(result) {
  const v = result.values;
  const day = 86400000;
  const real = ctx.params.real_missions ?? [];
  const ve = v.engine.ispS * 9.80665;
  const brakeFuel = v.propellantKg > 0 && v.captureMs > 0 ? (v.wetKg - v.wetKg * Math.exp(-v.captureMs / ve)) / v.propellantKg : null;
  const pct = (x) => (x === null || x === undefined ? "n/a" : `${Math.round(x * 100)}%`);
  const rows = [
    ["Your spacecraft", `${v.flightDays.toFixed(0)}`, `${v.wetKg.toFixed(0)}`, pct(v.propellantKg / v.wetKg), pct(brakeFuel), `${v.periapsisKm} km, ${v.periodH.toFixed(1)} h`],
    ...real.map((m) => [`<a href="${m.source_url}" target="_blank" rel="noopener">${m.name}</a>`, `${Math.round((Date.parse(m.arrival) - Date.parse(m.launch)) / day)}`, m.max_mass_kg ?? "n/a", pct(m.propellant_kg && m.max_mass_kg ? m.propellant_kg / m.max_mass_kg : null), pct(m.braking_fuel_share), m.orbit ? `${m.orbit.periapsis_km} km, ${m.orbit.period_h} h` : "n/a"]),
  ]
    .map((r) => `<tr>${r.map((c, i) => (i ? `<td>${c}</td>` : `<td>${c}</td>`)).join("")}</tr>`)
    .join("");
  return `<div class="bench"><b>Compared with real NASA missions</b><table class="facts"><thead><tr><th>Mission</th><th>Flight days</th><th>Max mass kg</th><th>Propellant share</th><th>Braking share of fuel</th><th>Science orbit</th></tr></thead><tbody>${rows}</tbody></table><p class="muted">Real figures: NASA NSSDCA pages (links). Orbit insertion for MRO took about 70 percent of its fuel; yours took ${pct(brakeFuel)}. Mass for your spacecraft is the launch mass.</p></div>`;
}

function reportHtml(result, lost) {
  const v = result.values;
  const bad = result.checks.filter((c) => c.status === "fail" || c.status === "warn");
  const diagnosis = bad.length
    ? `<div class="diagnosis"><b>What held you back</b><ul>${bad.map((c) => `<li class="${c.status}">${c.detail}</li>`).join("")}</ul></div>`
    : `<div class="diagnosis ok"><b>All checks passed.</b></div>`;
  const engine = v.dryKg - ctx.assumptions.spacecraft.bus_dry_kg - v.instrument.mass_kg - v.arrayMassKg - v.carriedKg - v.dishKg;
  const mass = bar("Launch mass (kg)", [["Body", ctx.assumptions.spacecraft.bus_dry_kg], ["Instruments", v.instrument.mass_kg], ["Engine system", engine], ["Panels", v.arrayMassKg], ["Carried lander", v.carriedKg], ["Radio antenna", v.dishKg], ["Fuel", v.propellantKg]].filter(([, x]) => x > 0), Math.max(v.capKg * 1.15, v.wetKg * 1.05), "kg", v.capKg);
  const dv = bar("Speed change (m/s)", [["Fuel gives", Math.max(0, v.dvAvailMs ?? 0)]], Math.max(v.dvRequiredMs, v.dvAvailMs ?? 0) * 1.15, "m/s", v.dvRequiredMs, "needed");
  const cr = bar("Credits", v.creditParts, Math.max(v.mission?.budget_credits ?? 0, v.creditsSpent) * 1.1, "credits", v.mission?.budget_credits, "budget");
  const power = isEng() ? bar("Electric power at Mars (W)", [["Supply", v.powerSupplyW]], Math.max(v.powerSupplyW, v.powerDemandW) * 1.2, "W", v.powerDemandW, "needed") : "";
  const rows = [
    ["Launch date", new Date(v.launchMs).toISOString().slice(0, 10)],
    ["Flight time", `${v.flightDays.toFixed(0)} days`],
    ["Arrival speed relative to Mars (V∞)", `${v.vInfArrivalKmS.toFixed(2)} km/s`],
    ["Speed change for braking and corrections", `${v.dvRequiredMs.toFixed(0)} m/s`],
    ["Speed change your fuel gives", `${(v.dvAvailMs ?? 0).toFixed(0)} m/s`],
    ["Radio delay at arrival", `${v.delayMin.toFixed(1)} min one way`],
    ["Science", `${v.scienceScore.toFixed(1)} points`],
  ]
    .map(([k, x]) => `<tr><td>${k}</td><td>${x}</td></tr>`)
    .join("");
  const label = lost ? "Numbers behind the failure" : "Numbers behind your result";
  return `<details class="report" ${state.profile === "cadet" ? "" : "open"}><summary>${label}</summary>${diagnosis}${mass}${dv}${power}${cr}${delayChart(result)}${isEng() ? workedMath(result) : ""}${state.profile !== "cadet" ? benchmarkHtml(result) : ""}<table class="facts">${rows}</table><p class="muted">Real data: NASA JPL Horizons (positions, distances), rocket equation and engine figures (NASA). Credits and masses of instruments are game design.</p></details>`;
}

function neighbours(list, isCurrent) {
  const i = list.findIndex(isCurrent);
  return [list[i - 1], list[i + 1]].filter(Boolean);
}

function sensitivityHtml(result) {
  if (!result.ok) return "";
  const mission = currentMission();
  const addDays = (s, n) => new Date(Date.parse(`${s}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
  const s = state;
  const variants = [
    ["Fuel +10%", { propellantKg: s.propellantKg * 1.1 }],
    ["Fuel −10%", { propellantKg: s.propellantKg * 0.9 }],
    ["Panels +10%", { arrayAreaM2: s.arrayAreaM2 * 1.1 }],
    ["Panels −10%", { arrayAreaM2: s.arrayAreaM2 * 0.9 }],
    ["Launch +14 days", { launchDate: addDays(s.launchDate, 14) }],
    ["Launch −14 days", { launchDate: addDays(s.launchDate, -14) }],
    ["Closest point +100 km", { periapsisKm: s.periapsisKm + 100 }],
    ["Closest point −100 km", { periapsisKm: Math.max(150, s.periapsisKm - 100) }],
    ...["s_band", "x_band", "ka_band"].filter((b) => b !== s.band).map((b) => [`Radio band ${b.replace("_band", "").toUpperCase()}`, { band: b }]),
    ...neighbours(ctx.assumptions.link.dishes, (d) => d.diameter_m === s.dishM).map((d) => [`Antenna ${d.diameter_m} m`, { dishM: d.diameter_m }]),
    ...neighbours(ctx.assumptions.link.tx_powers, (d) => d.watts === s.txPowerW).map((d) => [`Transmitter ${d.watts} W`, { txPowerW: d.watts }]),
    ["Farthest point ×2", { apoapsisKm: Math.max(s.apoapsisKm, s.periapsisKm) * 2 }],
    ["Farthest point ÷2", { apoapsisKm: Math.max(s.periapsisKm, s.apoapsisKm / 2) }],
  ];
  const row = (name, ev) => {
    if (!ev.ok) return `<tr><td>${name}</td><td colspan="6" class="muted">design fails: ${ev.checks.find((c) => c.status === "fail")?.label ?? ""}</td></tr>`;
    const v = ev.values;
    const pr = missionProgress(ev, mission);
    return `<tr><td>${name}</td><td>${(v.dvMargin * 100).toFixed(1)}%</td><td>${(v.powerMargin * 100).toFixed(0)}%</td><td>${v.wetKg.toFixed(1)}</td><td>${v.creditsLeft.toFixed(1)}</td><td>${v.smoothChance === null ? "-" : Math.round(v.smoothChance * 100) + "%"}</td><td>${v.link ? Math.round(v.link.margin * 100) + "%" : "-"}</td><td>${pr.stars}/${pr.goals.length}</td></tr>`;
  };
  const rows = [row("Current design", result), ...variants.map(([n, ch]) => row(n, evaluate({ ...s, ...ch }, ctx)))].join("");
  return `<div class="sens" id="sec-sens"><h3>Sensitivity ${qmark("sensitivity")}</h3><table class="facts"><thead><tr><th>Change</th><th>Fuel reserve</th><th>Power margin</th><th>Mass kg</th><th>Credits left</th><th>Smooth chance</th><th>Data margin</th><th>Requirements met</th></tr></thead><tbody>${rows}</tbody></table><p class="muted">Each row changes one thing and recomputes the whole mission.</p></div>`;
}

function renderRisk(result) {
  const r = riskChances(result, ctx);
  if (!r) return "";
  const pct = (x) => `${Math.round(x * 100)}%`;
  const cls = r.ok >= 0.85 ? "pass" : r.ok >= 0.6 ? "warn" : "fail";
  return `<div class="risk ${cls}"><b>Chance everything goes to plan: ${pct(r.ok)}</b> ${qmark("risk")}<ul><li>Navigation surprise needing extra fuel: ${pct(r.nav)} chance of trouble</li><li>Dust storm that cuts your power: ${pct(r.storm)} chance of trouble</li></ul><small class="muted">The game rolls dice for surprises, like real missions. The same design can give different results each time.</small><details class="how"><summary>How is this chance calculated?</summary><p>Navigation: a surprise happens with chance ${Math.round(ctx.assumptions.risk.nav_probability * 100)}% and needs a random extra of 0 to ${ctx.assumptions.risk.nav_max_ms} m/s. Your reserve is ${r.marginMs.toFixed(0)} m/s (fuel gives minus trip needs), so trouble chance = ${Math.round(ctx.assumptions.risk.nav_probability * 100)}% × (1 − ${r.marginMs.toFixed(0)}/${ctx.assumptions.risk.nav_max_ms}), never below 0.</p><p>Storm: a storm happens with chance ${Math.round(ctx.assumptions.risk.storm_probability * 100)}% and cuts sunlight by ${Math.round(ctx.assumptions.risk.storm_power_cut * 100)}%. It hurts only if your power margin is below ${Math.round(ctx.assumptions.risk.storm_power_cut * 100)}%. Yours is ${Math.round(result.values.powerMargin * 100)}%.</p><p>Chance of a smooth mission = (1 − navigation trouble) × (1 − storm trouble). These probabilities are game design.</p></details></div>`;
}

function renderMath(result) {
  const v = result.values;
  const rows = [
    [`Departure and arrival speed (Lambert solver, JPL Horizons positions) ${qmark("vinf-c3")}`, `${v.vInfDepartureKmS?.toFixed(2) ?? "?"} / ${v.vInfArrivalKmS?.toFixed(2) ?? "?"} km/s`],
    ["Launch energy C3", `${v.c3?.toFixed(1) ?? "?"} km²/s²`],
    ["Flight time", `${v.flightDays?.toFixed(0) ?? "?"} days`],
    ["Speed change needed (delta-v)", `${v.dvRequiredMs?.toFixed(0) ?? "?"} m/s`],
    ["Fuel and total launch mass", `${v.propellantKg ?? "?"} kg / ${v.wetKg?.toFixed(0) ?? "?"} kg`],
  ]
    .map(([k, val]) => `<tr><td>${k}</td><td>${val}</td></tr>`)
    .join("");
  const worked = v.plan ? workedMath(result) : "";
  return `<details class="math"><summary>Show the math</summary><p>Rocket equation: Δv = Isp · g₀ · ln(m₀ / m₁). Speed at arrival comes from solving the transfer between Earth and Mars on the chosen date. Real data: NASA JPL Horizons; engine figures: NASA SOA 2026.</p><table>${rows}</table>${worked}</details>`;
}

function update() {
  if (sequenceRunning) {
    sequenceToken += 1;
    sequenceRunning = false;
    $("result").hidden = true;
  }
  const fuel = $("fuelValue");
  if (fuel) fuel.textContent = state.propellantKg;
  const need = $("fuelNeed");
  if (need) {
    const min = minPropellantKg(state, ctx);
    need.textContent = min === null ? "This design cannot get there with any amount of fuel." : `Fuel needed for this design: about ${min} kg (every extra kilogram of instruments or panels needs more fuel). You have ${state.propellantKg} kg.`;
  }
  const arr = $("arrayValue");
  if (arr) arr.textContent = state.arrayAreaM2;
  const result = evaluate(state, ctx);
  renderForecast(result);
  $("launch").disabled = !result.ok;
  const adv = advice(result);
  const status = $("launchStatus");
  status.className = `launch-status ${adv.status}`;
  status.textContent = adv.text;
  document.body.classList.toggle("no-hints", !showHints);
  bindTerms();
}

function render() {
  renderSetup();
  update();
}

function starsText(n) {
  return [0, 1, 2].map((i) => `<span class="star ${i < n ? "on" : "off"}" style="--i:${i}">${i < n ? "★" : "☆"}</span>`).join("");
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const attempts = {};
let sequenceToken = 0;
let sequenceRunning = false;

function stageHtml() {
  return `<div id="stage" class="stage">
  <svg class="launchpad" viewBox="0 0 300 200" role="img" aria-label="${texts.stage.alt}">
    <rect x="0" y="180" width="300" height="20" class="ground"/>
    <g id="rocket" class="rocket">
      <path d="M150 60 Q162 90 162 130 L138 130 Q138 90 150 60 Z" class="r-body"/>
      <circle cx="150" cy="105" r="6" class="r-win"/>
      <path d="M138 130 L124 156 L138 148 Z M162 130 L176 156 L162 148 Z" class="r-fin"/>
      <path id="flame" class="flame" d="M142 132 L150 172 L158 132 Z"/>
    </g>
  </svg>
  <div id="hud" class="hud" role="status"></div>
  <button id="skip" class="skip">${texts.stage.skip}</button>
</div>`;
}

async function playSequence(result, events, stop) {
  const hud = $("hud");
  const S = texts.stage;
  for (const n of [3, 2, 1]) {
    hud.textContent = `T-${n}`;
    await wait(650);
    if (stop()) return;
  }
  if (events[0].outcome === "lost") {
    hud.textContent = S.cannotLift;
    $("rocket").classList.add("shake");
    await wait(1500);
    return;
  }
  hud.textContent = S.liftoff;
  $("flame").classList.add("on");
  $("rocket").classList.add("lift");
  await wait(1800);
  if (stop()) return;
  const track = flightTrack(ctx, result);
  const source = document.querySelector("#forecast-panel svg.diagram");
  let ship = null;
  if (track && source) {
    const clone = source.cloneNode(true);
    $("stage").querySelector(".launchpad").replaceWith(clone);
    ship = clone.querySelector("#ship");
  }
  if (track && ship) {
    const total = result.values.plan.flightDays;
    const cruiseLost = events.some((e) => e.id === "cruise" && e.outcome === "lost");
    const frac = cruiseLost ? 0.6 : 1;
    const duration = 4500;
    const start = Date.now();
    ship.setAttribute("opacity", "1");
    for (;;) {
      if (stop()) return;
      const progress = Math.min(1, (Date.now() - start) / duration);
      const point = track[Math.min(track.length - 1, Math.round(progress * frac * (track.length - 1)))];
      ship.setAttribute("cx", point.px[0].toFixed(1));
      ship.setAttribute("cy", point.px[1].toFixed(1));
      hud.textContent = `${S.day} ${Math.round(point.day)} / ${Math.round(total)} · ${S.message} ${point.delayMin.toFixed(1)} min`;
      if (progress >= 1) break;
      await wait(40);
    }
  }
  hud.textContent = events.some((e) => e.outcome === "lost") ? S.trouble : S.arrived;
  await wait(900);
}

async function launch() {
  const token = ++sequenceToken;
  const base = evaluate(state, ctx);
  const seedRaw = state.seed === undefined || state.seed === "" ? NaN : Number(state.seed);
  const seed = state.profile === "analyst" ? (Number.isFinite(seedRaw) ? seedRaw : Math.floor(Math.random() * 1000000)) : null;
  const risk = rollRisk(base, ctx, seed === null ? Math.random : seededRng(seed));
  const result = risk.evaluation;
  const events = runMission(result, ctx);
  if (events[0].outcome !== "lost") {
    events.splice(1, 0, ...risk.early);
    const at = events.findIndex((e) => e.id === "capture" || e.id === "science");
    if (at > 0 && !risk.early.some((e) => e.outcome === "lost")) events.splice(at, 0, ...risk.late);
  }
  const lost = events.some((e) => e.outcome === "lost");
  const progress = missionProgress(result, currentMission());
  lastRun = seed === null ? null : { seed, requirements: progress.goals.map((g) => ({ text: g.text, met: g.met })), events: events.map((e) => ({ title: e.title, outcome: e.outcome })) };
  const n = progress.stars;
  const previous = loadProgress()[state.missionId];
  if (!lost && result.ok) saveProgress(state.missionId, n, progress.score, progress.bonus.met, result.values.wetKg, result.values.creditsSpent);
  const log = (attempts[state.missionId] = attempts[state.missionId] ?? []);
  const chance = riskChances(base, ctx);
  log.push({ stars: lost ? 0 : n, score: lost ? 0 : progress.score, mass: result.values.wetKg, credits: result.values.creditsSpent, fuel: state.propellantKg, date: state.launchDate, panels: state.arrayAreaM2, tools: state.instruments.length, months: ctx.assumptions.mission.durations_months[state.duration], chance: chance ? Math.round(chance.ok * 100) : null, lost, total: state.profile === "analyst" ? progress.goals.length : 0 });
  const record = !lost && (!previous || progress.score > previous.score) ? `<p class="record">${previous ? "New personal record!" : "First result saved."} Best score: ${progress.score}</p>` : previous ? `<p class="muted">Your best score on this mission: ${previous.score}</p>` : "";
  const best = loadProgress()[state.missionId] ?? {};
  const analyst = state.profile === "analyst";
  const reqMode = isEng();
  const challenge = !lost && n === 3 && !reqMode ? `<p class="challenge">🏁 <b>Challenge:</b> lightest 3-star spacecraft so far ${Math.round(best.lightKg)} kg (this run ${Math.round(result.values.wetKg)} kg); cheapest ${Math.round(best.cheapCr)} credits (this run ${Math.round(result.values.creditsSpent)}). Can you beat both?</p>` : "";
  const full = state.profile !== "cadet";
  const history = log.length > 1 ? `<div class="attempts"><h3>Your attempts</h3><table class="facts"><thead><tr><th>#</th><th>Result</th><th>Score</th>${full ? "<th>Date</th><th>Panels m²</th><th>Months</th>" : ""}<th>Tools</th><th>Fuel kg</th><th>Mass kg</th><th>Credits</th>${full ? "<th>Smooth chance</th>" : ""}</tr></thead><tbody>${log.map((x, i) => `<tr><td>${i + 1}</td><td>${x.lost ? "lost" : x.total ? `${x.stars}/${x.total}` : "★".repeat(x.stars) + "☆".repeat(3 - x.stars)}</td><td>${Math.round(x.score)}</td>${full ? `<td>${x.date}</td><td>${x.panels}</td><td>${x.months}</td>` : ""}<td>${x.tools}</td><td>${x.fuel}</td><td>${Math.round(x.mass)}</td><td>${Math.round(x.credits)}</td>${full ? `<td>${x.chance === null ? "-" : x.chance + "%"}</td>` : ""}</tr>`).join("")}</tbody></table><p class="muted">Change one thing at a time to see what helps.</p></div>` : "";
  const items = events
    .map((e) => `<div class="event ${e.outcome}"><h3>${termify(e.title, e.term)}</h3><div>${e.text}</div>${e.hint ? `<div class="hint">${e.hint}</div>` : ""}${e.why ? `<div class="why"><b>${K.why}</b> ${e.why} ${e.term ? qmark(e.term) : ""}</div>` : ""}</div>`)
    .join("");
  const report = reportHtml(result, lost);
  const real = texts.realMissions
    .map((m) => `<p>${m.text} <a href="${m.source}" target="_blank" rel="noopener">NASA</a></p>`)
    .join("");
  const scoreLine = `<p class="score">${K.score}: <b>${progress.score}</b></p>`;
  const recap = `<div class="goals recap"><h3>${K.goals}</h3><ul>${progress.goals.map((g) => `<li class="${g.met ? "met" : ""}"><span class="goal-star">${reqMode ? (g.met ? "✓" : "✕") : g.met ? "★" : "☆"}</span> ${g.text}</li>`).join("")}<li class="${progress.bonus.met ? "met" : ""}"><span class="goal-star">🪙</span> ${progress.bonus.text}</li></ul></div>`;
  const headline = reqMode ? (lost ? texts.result.fail : n === progress.goals.length ? "All requirements met" : "Mission flown: not all requirements met") : lost ? texts.result.fail : !progress.requiredMet ? texts.result.partial : texts.result.win;
  const nextProfile = { cadet: "explorer", explorer: "engineer", engineer: "analyst" }[state.profile];
  const next = nextProfile && !lost ? `<button class="launch secondary" id="nextLevel">${K.nextLevel}</button>` : "";
  const list = missionsFor(ctx.assumptions, state.profile);
  const prog = loadProgress();
  const idx = list.findIndex((m) => m.id === state.missionId);
  const nextMission = !lost && list.length > 1 ? [...list.slice(idx + 1), ...list.slice(0, idx)].find((m) => !prog[m.id]) : null;
  const nextMissionBtn = nextMission ? `<button class="launch secondary" id="nextMission">Next mission: ${nextMission.title}</button>` : "";
  const body = `<h2>${headline}</h2>${reqMode ? `<p class="score">Requirements met: <b>${n} of ${progress.goals.length}</b></p>` : `<div class="stars" aria-label="${n} of 3">${starsText(n)}</div>`}${reqMode ? unmetHtml(progress, result, risk) : ""}${seed !== null ? `<p class="muted">Random seed of this flight: <b>${seed}</b>. Enter it under Random seed to repeat exactly the same events.</p>${exportButtons()}` : ""}${items}${currentMission().takeaway && !lost ? `<div class="takeaway"><b>Takeaway.</b> ${currentMission().takeaway}${yourNumbers(result)}</div>` : ""}${recap}${scoreLine}${record}${challenge}${history}${report}${real}<button class="launch" id="again">${texts.again}</button>${nextMissionBtn}${next}`;
  $("result").innerHTML = `${stageHtml()}<div id="resultBody" hidden>${body}</div>`;
  $("result").hidden = false;
  $("result").scrollIntoView({ behavior: "smooth" });
  const nm = $("nextMission");
  if (nm && nextMission) nm.addEventListener("click", () => { selectMission(nextMission.id); render(); $("result").hidden = true; window.scrollTo({ top: 0, behavior: "smooth" }); });
  const nextBtn = $("nextLevel");
  if (nextBtn) nextBtn.addEventListener("click", () => { setProfile(nextProfile); window.scrollTo({ top: 0, behavior: "smooth" }); });
  $("again").addEventListener("click", () => {
    selectMission(state.missionId);
    render();
    $("result").hidden = true;
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  bindTerms();
  let skipped = false;
  $("skip").addEventListener("click", () => { skipped = true; });
  const stop = () => skipped || token !== sequenceToken;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches || analyst;
  if (!reduce) {
    sequenceRunning = true;
    await playSequence(result, events, stop);
    if (token === sequenceToken) sequenceRunning = false;
  }
  if (token !== sequenceToken) return;
  $("stage").hidden = true;
  $("resultBody").hidden = false;
}

function showTerm(id) {
  const t = glossary[id];
  if (!t) return;
  const names = ["Simple", "More detail", "Student"];
  const basis = t.basis
    ? `<p class="basis"><b>Real data:</b> ${t.basis.real}${t.basis.game ? `<br><b>Game design:</b> ${t.basis.game}` : ""}</p>`
    : "";
  const sources = t.sources.length ? `<p class="small">Sources:</p><ul>${t.sources.map((s) => `<li><a href="${s}" target="_blank" rel="noopener">${s}</a></li>`).join("")}</ul>` : "";
  const d = $("term-dialog");
  d.innerHTML = `<h3>${t.name}</h3>${t.levels.map((x, i) => `<div class="level"><b>${names[i]}.</b> ${x}</div>`).join("")}${basis}${sources}<form method="dialog"><button class="launch">Close</button></form>`;
  d.showModal();
}

function bindTerms() {
  document.querySelectorAll(".term, .qmark").forEach((b) => {
    if (b.dataset.bound) return;
    b.dataset.bound = "1";
    b.addEventListener("click", (e) => {
      e.preventDefault();
      showTerm(b.dataset.term);
    });
  });
}

load();
