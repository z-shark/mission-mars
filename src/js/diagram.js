import { transferPath } from "./transfer.js";
import { lightDelayMinutes } from "./physics.js";

const SIZE = 400;
const CENTER = SIZE / 2;
const PX_PER_KM = 175 / 249000000;
const DAY_MS = 86400000;

function toXY(radiusKm, lonDeg) {
  const lon = (lonDeg * Math.PI) / 180;
  return [CENTER + radiusKm * Math.cos(lon) * PX_PER_KM, CENTER - radiusKm * Math.sin(lon) * PX_PER_KM];
}

function polyline(points) {
  return points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
}

function orbitLine(samples, fromMs, spanDays, radiusKey, lonKey) {
  const pts = [];
  for (const s of samples) {
    const t = Date.parse(`${s.date}T00:00:00Z`);
    if (t >= fromMs && t <= fromMs + spanDays * DAY_MS) {
      pts.push(toXY(s[radiusKey], s[lonKey]));
    }
  }
  if (pts.length > 1) {
    pts.push(pts[0]);
  }
  return pts;
}

export function renderDiagram(ctx, evaluation, text) {
  const v = evaluation.values;
  if (v.plan === null || v.plan === undefined) {
    return "";
  }
  const start = ctx.ephemeris.stateAt(v.launchMs);
  const end = ctx.ephemeris.stateAt(v.plan.arrivalMs);
  const path = transferPath(ctx.ephemeris, ctx.params.bodies.sun_gm_km3_s2, v.launchMs, v.plan.flightDays);
  if (start === null || end === null || path === null) {
    return "";
  }
  const samples = ctx.table.samples;
  const earthOrbit = orbitLine(samples, v.launchMs, 365, "earth_sun_km", "earth_lon_deg");
  const marsOrbit = orbitLine(samples, v.launchMs, 687, "mars_sun_km", "mars_lon_deg");
  const earth = toXY(start.earthRadiusKm, start.earthLonDeg);
  const marsNow = toXY(start.marsRadiusKm, start.marsLonDeg);
  const marsLater = toXY(end.marsRadiusKm, end.marsLonDeg);
  const route = path.map(([x, y]) => [CENTER + x * PX_PER_KM, CENTER - y * PX_PER_KM]);
  const launchDate = new Date(v.launchMs).toISOString().slice(0, 10);
  const arriveDate = new Date(v.plan.arrivalMs).toISOString().slice(0, 10);
  const shift = (p, dx, dy) => `x="${(p[0] + dx).toFixed(1)}" y="${(p[1] + dy).toFixed(1)}"`;
  const labelSide = (p) => (p[0] > CENTER ? ["start", 11] : ["end", -11]);
  const [ea, ed] = labelSide(earth);
  const [ma, md] = labelSide(marsNow);
  const [la, ld] = labelSide(marsLater);
  return `<figure class="diagram-box">
<svg class="diagram" viewBox="-90 0 580 ${SIZE}" role="img" aria-label="${text.alt}">
  <polyline class="orbit earth-orbit" points="${polyline(earthOrbit)}"/>
  <polyline class="orbit mars-orbit" points="${polyline(marsOrbit)}"/>
  <polyline id="route" class="route" points="${polyline(route)}"/>
  <circle id="ship" class="ship" r="5" cx="${route[0][0].toFixed(1)}" cy="${route[0][1].toFixed(1)}" opacity="0"/>
  <circle class="sun" cx="${CENTER}" cy="${CENTER}" r="12"/>
  <text class="lbl" x="${CENTER}" y="${CENTER + 26}" text-anchor="middle">${text.sun}</text>
  <circle class="planet earth" cx="${earth[0].toFixed(1)}" cy="${earth[1].toFixed(1)}" r="6"/>
  <text class="lbl" ${shift(earth, ed, 4)} text-anchor="${ea}">${text.earth}<tspan class="lbl-date" x="${(earth[0] + ed).toFixed(1)}" dy="13">${launchDate}</tspan></text>
  <circle class="planet mars" cx="${marsNow[0].toFixed(1)}" cy="${marsNow[1].toFixed(1)}" r="5"/>
  <text class="lbl" ${shift(marsNow, md, 4)} text-anchor="${ma}">${text.marsNow}</text>
  <circle class="planet mars ghost" cx="${marsLater[0].toFixed(1)}" cy="${marsLater[1].toFixed(1)}" r="5"/>
  <text class="lbl" ${shift(marsLater, ld, 4)} text-anchor="${la}">${text.marsLater}<tspan class="lbl-date" x="${(marsLater[0] + ld).toFixed(1)}" dy="13">${arriveDate}</tspan></text>
</svg>
<figcaption>${text.caption(v.plan.flightDays.toFixed(0))}</figcaption>
</figure>`;
}

export function flightTrack(ctx, evaluation) {
  const v = evaluation.values;
  const path = transferPath(ctx.ephemeris, ctx.params.bodies.sun_gm_km3_s2, v.launchMs, v.plan.flightDays);
  if (path === null) {
    return null;
  }
  const last = path.length - 1;
  return path.map(([x, y], i) => {
    const day = (i / last) * v.plan.flightDays;
    const earth = ctx.ephemeris.stateAt(v.launchMs + day * DAY_MS);
    const lon = (earth.earthLonDeg * Math.PI) / 180;
    const distKm = Math.hypot(x - earth.earthRadiusKm * Math.cos(lon), y - earth.earthRadiusKm * Math.sin(lon));
    return { px: [CENTER + x * PX_PER_KM, CENTER - y * PX_PER_KM], day, delayMin: lightDelayMinutes(distKm) };
  });
}
