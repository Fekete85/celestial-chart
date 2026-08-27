/* horizontal() / horizontal.inverse() — round-trip tests.
 *
 * Correctness is checkable here: if both the forward and the inverse
 * computation are right, applying the two one after the other gives back the
 * coordinate we started from. This is issue #148 (2023-12-08, never answered)
 * turned into a numeric test.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { horizontal } from "../src/horizontal.js";
import { Celestial } from "../src/core.js";



const DT = new Date(Date.UTC(2026, 7, 26, 20, 0, 0));
const BUDAPEST = [47.5196, 19.22];
const TOLERANCE = 0.01; // degrees

const normalizeDeg = f => ((f % 360) + 360) % 360;
const angleDiff = (a, b) => {
  const d = Math.abs(normalizeDeg(a) - normalizeDeg(b));
  return Math.min(d, 360 - d);
};

function roundTrip(dt, ra, dec, site) {
  const hor = horizontal(dt, [ra, dec], site);
  const back = horizontal.inverse(dt, [hor[0], hor[1]], site);
  return {
    hor,
    dRa: angleDiff(ra, back[0]),
    dDec: Math.abs(dec - back[1])
  };
}

test("round-trip above the horizon, Budapest", () => {
  const bad = [];
  for (let ra = 0; ra < 360; ra += 10) {
    for (let dec = -80; dec <= 80; dec += 10) {
      const r = roundTrip(DT, ra, dec, BUDAPEST);
      if (r.hor[0] < 0) continue;              // below the horizon it does not matter
      if (Math.max(r.dRa, r.dDec) > TOLERANCE) {
        bad.push(`RA ${ra}° Dec ${dec}° → azimuth ${r.hor[1].toFixed(1)}°, delta ${r.dRa.toFixed(2)}°`);
      }
    }
  }
  assert.deepEqual(bad.slice(0, 5), [], `${bad.length} points come back wrong`);
});

test("round-trip at several latitudes, between the poles", () => {
  const bad = [];
  for (const lat of [-70, -45, -10, 0, 10, 45, 70]) {
    for (let ra = 0; ra < 360; ra += 20) {
      for (let dec = -70; dec <= 70; dec += 20) {
        const r = roundTrip(DT, ra, dec, [lat, 19.22]);
        if (r.hor[0] < 0) continue;
        if (Math.max(r.dRa, r.dDec) > TOLERANCE) bad.push(`lat ${lat}° RA ${ra}° Dec ${dec}°`);
      }
    }
  }
  assert.deepEqual(bad.slice(0, 5), [], `${bad.length} points come back wrong`);
});

test("the bug affected the half where sin(azimuth) > 0 — regression", () => {
  // The "lost" half of the sky: where sin(azimuth) > 0. Instead of hard-coding
  // a point we search for one — that way the test does not depend on the date.
  const affected = [];
  for (let ra = 0; ra < 360; ra += 5) {
    for (let dec = -60; dec <= 60; dec += 15) {
      const hor = horizontal(DT, [ra, dec], BUDAPEST);
      if (hor[0] > 5 && Math.sin(hor[1] * Math.PI / 180) > 0.3) affected.push([ra, dec, hor]);
    }
  }
  assert.ok(affected.length > 10, `only ${affected.length} points fall on the affected half`);
  for (const [ra, dec, hor] of affected) {
    const back = horizontal.inverse(DT, [hor[0], hor[1]], BUDAPEST);
    assert.ok(angleDiff(ra, back[0]) < TOLERANCE,
      `RA ${ra}° Dec ${dec}° (azimuth ${hor[1].toFixed(1)}°) → ${normalizeDeg(back[0]).toFixed(1)}°`);
  }
});

test("zenith: alt 90° — the library's single internal inverse call", () => {
  for (const lat of [-89, -47.5, 0, 47.5, 89]) {
    const z = horizontal.inverse(DT, [90, 0], [lat, 19.22]);
    assert.ok(Number.isFinite(z[0]), `RA is not a number for lat=${lat}`);
    assert.ok(Number.isFinite(z[1]), `Dec is not a number for lat=${lat}`);
    // The declination of the zenith is the observer's geographic latitude.
    assert.ok(Math.abs(z[1] - lat) < 1e-6, `zenith Dec ${z[1]} != lat ${lat}`);
  }
});

test("edge cases: no NaN in extreme configurations", () => {
  const cases = [
    [[90, 0], [47.5, 19.2]],      // zenith
    [[0, 0], [47.5, 19.2]],       // horizon, north
    [[0, 180], [47.5, 19.2]],     // horizon, south
    [[45, 90], [89.9, 0]],        // observer near the pole
    [[45, 270], [-89.9, 0]],
    [[89.999, 123], [0, 0]]       // equator, almost at the zenith
  ];
  for (const [hor, site] of cases) {
    const r = horizontal.inverse(DT, hor, site);
    assert.ok(Number.isFinite(r[0]) && Number.isFinite(r[1]),
      `NaN here: hor=${JSON.stringify(hor)} site=${JSON.stringify(site)} → ${JSON.stringify(r)}`);
  }
});

test("horizontal() forward direction: known values", () => {
  // The celestial pole stands at an altitude equal to the observer's latitude, towards the north.
  const p = horizontal(DT, [0, 90], BUDAPEST);
  assert.ok(Math.abs(p[0] - BUDAPEST[0]) < 1e-6, `pole altitude ${p[0]} != ${BUDAPEST[0]}`);
});

test("Celestial.horizontal is exposed", () => {
  assert.equal(Celestial.horizontal, horizontal);
});

/* Celestial.ha() — hour angle. Nothing in the library calls it, but it is
 * public surface. We check correctness not from the formula but from its
 * meaning: the hour angle is zero when the object stands on the meridian
 * (azimuth 0° or 180°). */
test("Celestial.ha returns an hour angle in the [0,360) range", () => {
  const bad = [];
  for (let ra = 0; ra < 360; ra += 15) {
    const ha = Celestial.ha(DT, BUDAPEST[1], ra);
    if (!(ha >= 0 && ha < 360)) bad.push(`RA ${ra}° → ${ha.toFixed(1)}°`);
  }
  assert.deepEqual(bad.slice(0, 5), [], `${bad.length} values fall outside the range`);
});

test("the hour angle is zero when the object is on the meridian", () => {
  // We look for the RA that is on the meridian right now: there the azimuth is 0° or 180°.
  let meridianRa = null, best = 1e9;
  for (let ra = 0; ra < 360; ra += 0.05) {
    const az = horizontal(DT, [ra, 20], BUDAPEST)[1];
    const delta = Math.min(Math.abs(az), Math.abs(az - 180), Math.abs(az - 360));
    if (delta < best) { best = delta; meridianRa = ra; }
  }
  assert.ok(best < 0.1, "no point found standing on the meridian");

  const ha = Celestial.ha(DT, BUDAPEST[1], meridianRa);
  const fromMeridian = Math.min(ha, Math.abs(ha - 180), Math.abs(ha - 360));
  assert.ok(fromMeridian < 0.5,
    `on the meridian (RA ${meridianRa.toFixed(2)}°) the hour angle is ${ha.toFixed(2)}°, ` +
    `but it should be 0° or 180°`);
});
