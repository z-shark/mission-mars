const TWO_PI = 2 * Math.PI;
const DAY_S = 86400;
const DAY_MS = 86400000;

function stumpffC(z) {
  if (z > 1e-8) {
    return (1 - Math.cos(Math.sqrt(z))) / z;
  }
  if (z < -1e-8) {
    return (Math.cosh(Math.sqrt(-z)) - 1) / -z;
  }
  return 0.5 - z / 24 + (z * z) / 720;
}

function stumpffS(z) {
  if (z > 1e-8) {
    const s = Math.sqrt(z);
    return (s - Math.sin(s)) / (s * s * s);
  }
  if (z < -1e-8) {
    const s = Math.sqrt(-z);
    return (Math.sinh(s) - s) / (s * s * s);
  }
  return 1 / 6 - z / 120 + (z * z) / 5040;
}

export function lambertPlanar(mu, r1, r2, transferAngleRad, flightSeconds) {
  let dTheta = transferAngleRad;
  if (Math.abs(Math.sin(dTheta)) < 1e-6) {
    dTheta += 1e-4;
  }
  const a = Math.sin(dTheta) * Math.sqrt((r1 * r2) / (1 - Math.cos(dTheta)));
  const yOf = (z) => r1 + r2 + (a * (z * stumpffS(z) - 1)) / Math.sqrt(stumpffC(z));
  const fOf = (z) => {
    const y = yOf(z);
    if (y < 0) {
      return -Infinity;
    }
    return Math.pow(y / stumpffC(z), 1.5) * stumpffS(z) + a * Math.sqrt(y) - Math.sqrt(mu) * flightSeconds;
  };
  let low = -4 * Math.PI * Math.PI * 4;
  let high = TWO_PI * TWO_PI - 1e-6;
  if (fOf(high) < 0) {
    return null;
  }
  for (let i = 0; i < 200; i += 1) {
    const mid = (low + high) / 2;
    if (fOf(mid) < 0) {
      low = mid;
    } else {
      high = mid;
    }
  }
  const z = (low + high) / 2;
  const y = yOf(z);
  const f = 1 - y / r1;
  const g = a * Math.sqrt(y / mu);
  const gDot = 1 - y / r2;
  const p1 = [r1, 0];
  const p2 = [r2 * Math.cos(dTheta), r2 * Math.sin(dTheta)];
  const v1 = [(p2[0] - f * p1[0]) / g, (p2[1] - f * p1[1]) / g];
  const v2 = [(gDot * p2[0] - p1[0]) / g, (gDot * p2[1] - p1[1]) / g];
  return { v1, v2, p1, p2 };
}

function speedKmS(v) {
  return Math.hypot(v[0], v[1]);
}

export function transferVInf(mu, r1, r2, transferAngleRad, flightSeconds) {
  const solution = lambertPlanar(mu, r1, r2, transferAngleRad, flightSeconds);
  if (solution === null) {
    return null;
  }
  const earthV = [0, Math.sqrt(mu / r1)];
  const sinT = Math.sin(transferAngleRad);
  const cosT = Math.cos(transferAngleRad);
  const marsSpeed = Math.sqrt(mu / r2);
  const marsV = [-sinT * marsSpeed, cosT * marsSpeed];
  const dep = speedKmS([solution.v1[0] - earthV[0], solution.v1[1] - earthV[1]]);
  const arr = speedKmS([solution.v2[0] - marsV[0], solution.v2[1] - marsV[1]]);
  return { vInfDepartureKmS: dep, vInfArrivalKmS: arr, c3Km2S2: dep * dep };
}

export function makeEphemeris(samples) {
  const times = samples.map((s) => Date.parse(`${s.date}T00:00:00Z`));
  const earthLon = [];
  const marsLon = [];
  let eAcc = 0;
  let mAcc = 0;
  samples.forEach((s, i) => {
    if (i === 0) {
      eAcc = s.earth_lon_deg;
      mAcc = s.mars_lon_deg;
    } else {
      let de = s.earth_lon_deg - samples[i - 1].earth_lon_deg;
      let dm = s.mars_lon_deg - samples[i - 1].mars_lon_deg;
      if (de < -180) de += 360;
      if (dm < -180) dm += 360;
      eAcc += de;
      mAcc += dm;
    }
    earthLon.push(eAcc);
    marsLon.push(mAcc);
  });

  function locate(ms) {
    if (!Number.isFinite(ms) || ms < times[0] || ms > times[times.length - 1]) {
      return null;
    }
    let lo = 0;
    let hi = times.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (times[mid] <= ms) lo = mid;
      else hi = mid;
    }
    const span = times[hi] - times[lo];
    const t = span === 0 ? 0 : (ms - times[lo]) / span;
    return { lo, hi, t };
  }

  function stateAt(ms) {
    const loc = locate(ms);
    if (loc === null) {
      return null;
    }
    const { lo, hi, t } = loc;
    const mix = (a, b) => a + (b - a) * t;
    return {
      earthRadiusKm: mix(samples[lo].earth_sun_km, samples[hi].earth_sun_km),
      marsRadiusKm: mix(samples[lo].mars_sun_km, samples[hi].mars_sun_km),
      earthLonDeg: mix(earthLon[lo], earthLon[hi]),
      marsLonDeg: mix(marsLon[lo], marsLon[hi]),
      rangeKm: mix(samples[lo].range_km, samples[hi].range_km),
      sunEarthMarsDeg: mix(samples[lo].sun_earth_mars_deg, samples[hi].sun_earth_mars_deg),
    };
  }

  return { stateAt, firstMs: times[0], lastMs: times[times.length - 1] };
}

export function planTransfer(ephemeris, muSunKm3S2, launchMs, flightDays) {
  const start = ephemeris.stateAt(launchMs);
  const end = ephemeris.stateAt(launchMs + flightDays * DAY_MS);
  if (start === null || end === null) {
    return null;
  }
  let angleDeg = (end.marsLonDeg - start.earthLonDeg) % 360;
  if (angleDeg < 0) {
    angleDeg += 360;
  }
  const result = transferVInf(muSunKm3S2, start.earthRadiusKm, end.marsRadiusKm, (angleDeg * Math.PI) / 180, flightDays * DAY_S);
  if (result === null) {
    return null;
  }
  return { ...result, flightDays, transferAngleDeg: angleDeg, arrivalMs: launchMs + flightDays * DAY_MS, marsRangeAtArrivalKm: end.rangeKm };
}

export function bestTransfer(ephemeris, muSunKm3S2, launchMs, minDays = 120, maxDays = 420, stepDays = 4) {
  let best = null;
  for (let days = minDays; days <= maxDays; days += stepDays) {
    const plan = planTransfer(ephemeris, muSunKm3S2, launchMs, days);
    if (plan === null) {
      continue;
    }
    if (best === null || plan.vInfDepartureKmS + plan.vInfArrivalKmS < best.vInfDepartureKmS + best.vInfArrivalKmS) {
      best = plan;
    }
  }
  return best;
}

export function transferPath(ephemeris, muSunKm3S2, launchMs, flightDays, points = 80) {
  const start = ephemeris.stateAt(launchMs);
  const end = ephemeris.stateAt(launchMs + flightDays * DAY_MS);
  if (start === null || end === null) {
    return null;
  }
  let angleDeg = (end.marsLonDeg - start.earthLonDeg) % 360;
  if (angleDeg < 0) {
    angleDeg += 360;
  }
  const solution = lambertPlanar(muSunKm3S2, start.earthRadiusKm, end.marsRadiusKm, (angleDeg * Math.PI) / 180, flightDays * DAY_S);
  if (solution === null) {
    return null;
  }
  const steps = 4000;
  const dt = (flightDays * DAY_S) / steps;
  const every = steps / points;
  let [x, y] = solution.p1;
  let [vx, vy] = solution.v1;
  const accel = (px, py) => {
    const r = Math.hypot(px, py);
    const k = -muSunKm3S2 / (r * r * r);
    return [k * px, k * py];
  };
  const lon = (start.earthLonDeg * Math.PI) / 180;
  const cos = Math.cos(lon);
  const sin = Math.sin(lon);
  const out = [];
  for (let i = 0; i <= steps; i += 1) {
    if (i % every === 0) {
      out.push([x * cos - y * sin, x * sin + y * cos]);
    }
    const [a1x, a1y] = accel(x, y);
    const [a2x, a2y] = accel(x + 0.5 * dt * vx, y + 0.5 * dt * vy);
    const [a3x, a3y] = accel(x + 0.5 * dt * (vx + 0.5 * dt * a1x), y + 0.5 * dt * (vy + 0.5 * dt * a1y));
    const [a4x, a4y] = accel(x + dt * (vx + 0.5 * dt * a2x), y + dt * (vy + 0.5 * dt * a2y));
    x += dt * vx + (dt * dt * (a1x + a2x + a3x)) / 6;
    y += dt * vy + (dt * dt * (a1y + a2y + a3y)) / 6;
    vx += (dt * (a1x + 2 * a2x + 2 * a3x + a4x)) / 6;
    vy += (dt * (a1y + 2 * a2y + 2 * a3y + a4y)) / 6;
  }
  return out;
}
