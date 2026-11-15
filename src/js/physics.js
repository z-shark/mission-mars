export const G0_M_S2 = 9.80665;
export const SPEED_OF_LIGHT_KM_S = 299792.458;
export const AU_KM = 149597870.7;
export const BOLTZMANN_DBW_PER_K_HZ = -228.6;

export function rocketDeltaVMs(ispS, wetMassKg, dryMassKg) {
  if (!(wetMassKg > 0) || !(dryMassKg > 0) || dryMassKg > wetMassKg) {
    return 0;
  }
  return ispS * G0_M_S2 * Math.log(wetMassKg / dryMassKg);
}

export function propellantForDeltaVKg(ispS, dryMassKg, deltaVMs) {
  return dryMassKg * (Math.exp(deltaVMs / (ispS * G0_M_S2)) - 1);
}

export function lightDelayMinutes(rangeKm) {
  return rangeKm / SPEED_OF_LIGHT_KM_S / 60;
}

export function solarFluxWm2(distanceKm, fluxAtOneAuWm2) {
  return fluxAtOneAuWm2 * (AU_KM / distanceKm) ** 2;
}

export function arrayPowerW(fluxWm2, areaM2, efficiency) {
  return fluxWm2 * areaM2 * efficiency;
}

export function circularSpeedKmS(muKm3S2, radiusKm) {
  return Math.sqrt(muKm3S2 / radiusKm);
}

export function hohmannTransfer(muSunKm3S2, r1Km, r2Km) {
  const transferA = (r1Km + r2Km) / 2;
  const v1 = circularSpeedKmS(muSunKm3S2, r1Km);
  const v2 = circularSpeedKmS(muSunKm3S2, r2Km);
  const departureSpeed = Math.sqrt(muSunKm3S2 * (2 / r1Km - 1 / transferA));
  const arrivalSpeed = Math.sqrt(muSunKm3S2 * (2 / r2Km - 1 / transferA));
  const flightSeconds = Math.PI * Math.sqrt(transferA ** 3 / muSunKm3S2);
  const targetPeriodSeconds = 2 * Math.PI * Math.sqrt(r2Km ** 3 / muSunKm3S2);
  return {
    vInfDepartureKmS: departureSpeed - v1,
    vInfArrivalKmS: v2 - arrivalSpeed,
    flightDays: flightSeconds / 86400,
    idealLeadAngleDeg: 180 - (flightSeconds / targetPeriodSeconds) * 360,
  };
}

export function captureDeltaVKmS(vInfKmS, muPlanetKm3S2, periapsisRadiusKm, apoapsisRadiusKm) {
  const hyperbolicSpeed = Math.sqrt(vInfKmS ** 2 + (2 * muPlanetKm3S2) / periapsisRadiusKm);
  const ellipseSpeed = Math.sqrt(
    (2 * muPlanetKm3S2 * apoapsisRadiusKm) / (periapsisRadiusKm * (apoapsisRadiusKm + periapsisRadiusKm)),
  );
  return hyperbolicSpeed - ellipseSpeed;
}

export function wrapDegrees(value) {
  return ((((value + 180) % 360) + 360) % 360) - 180;
}

export function windowQuality(marsLeadDeg, idealLeadDeg, toleranceDeg) {
  const error = Math.abs(wrapDegrees(marsLeadDeg - idealLeadDeg));
  return { errorDeg: error, quality: Math.max(0, 1 - error / toleranceDeg) };
}

export function freeSpaceLossDb(distanceKm, frequencyGHz) {
  const wavelengthKm = SPEED_OF_LIGHT_KM_S / (frequencyGHz * 1e9);
  return 20 * Math.log10((4 * Math.PI * distanceKm) / wavelengthKm);
}

export function toDb(linear) {
  return 10 * Math.log10(linear);
}

export function linkMarginDb(link) {
  const eirpDbw = toDb(link.txPowerW) + link.txGainDb - link.txLossDb;
  const pathLossDb = freeSpaceLossDb(link.distanceKm, link.frequencyGHz);
  const receivedDbw = eirpDbw - pathLossDb + link.rxGainDb - link.otherLossesDb;
  const n0DbwHz = BOLTZMANN_DBW_PER_K_HZ + toDb(link.systemNoiseTempK);
  const ebN0Db = receivedDbw - n0DbwHz - toDb(link.dataRateBps);
  return { ebN0Db, marginDb: ebN0Db - link.requiredEbN0Db, pathLossDb, eirpDbw };
}

export function maxDataRateBps(link) {
  const probe = linkMarginDb({ ...link, dataRateBps: 1 });
  const headroomDb = probe.ebN0Db - link.requiredEbN0Db;
  return 10 ** (headroomDb / 10);
}

export function dataReturnedBits(dataRateBps, contactSeconds, efficiency) {
  return dataRateBps * contactSeconds * efficiency;
}

export function resourceMargin(capacity, required) {
  return capacity > 0 ? (capacity - required) / capacity : -1;
}

export function blackoutDays(samples, thresholdDeg, startDate, endDate) {
  let days = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const sample = samples[i];
    if (sample.date < startDate || sample.date > endDate) {
      continue;
    }
    if (sample.sun_earth_mars_deg < thresholdDeg) {
      const next = samples[i + 1];
      const spanDays = next ? (Date.parse(next.date) - Date.parse(sample.date)) / 86400000 : 2;
      days += spanDays;
    }
  }
  return days;
}
