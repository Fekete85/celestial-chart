/* Moon — numeric tests for phase, illuminated fraction and position.
 *
 * An investigation of the upstream issue #130 ("Wrong moon phase?", a full moon
 * was expected for 2022-03-18, a waning gibbous was seen). The reference values
 * come from independent sources, not from the code's own output:
 *
 *  - Meeus: Astronomical Algorithms, 2nd edition, examples 47.a and 13.a
 *    (1992-04-12 0h TD, geocentric Moon).
 *  - New moon / full moon times tied to solar and lunar eclipses
 *    (NASA Eclipse Web Site) — these are minute-accurate anchors of the given syzygy.
 *  - The well-known length of the synodic month: 29.5306 days.
 *
 * The Earth's orbital elements come from the JPL "Keplerian Elements for
 * Approximate Positions" table, the same ones as in the library's planets.json.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { Kepler } from "../src/kepler.js";

const DEG = Math.PI / 180;

// JPL: orbital elements of the Earth–Moon barycentre, J2000 epoch, with centennial rates
const EARTH_ELEMENTS = {
  a: 1.00000261, e: 0.01671123, i: -1.531e-5,
  L: 100.46457166, W: 102.93768193, N: 0,
  da: 5.62e-6, de: -4.392e-5, di: -0.01294668,
  dL: 35999.37244981, dW: 0.32327364, dN: 0,
  ep: "2000-01-01"
};

/* We produce the Moon's ephemeris exactly the way the library does:
 * the heliocentric position of the Earth gives the direction of the Sun (getPlanet → equatorial). */
function moonAt(dt) {
  var earth = Kepler().id("ter").elements(EARTH_ELEMENTS),
      lun = Kepler().id("lun").elements({});
  return lun(dt).equatorial(earth(dt).spherical()).ephemeris;
}

const inDegrees = rad => rad / DEG;
// The difference of two angles in degrees, correct across the 0/360 boundary as well
const angleDelta = (a, b) => Math.abs(((a - b) % 360 + 540) % 360 - 180);

test("the phase is zero at known new moons", () => {
  // Total solar eclipses — the moment of conjunction is known to the minute
  const newMoons = [
    "2017-08-21T18:30Z",
    "2024-04-08T18:21Z",
    "2026-02-17T12:01Z",
    "2026-08-12T17:46Z"
  ];
  for (const s of newMoons) {
    const e = moonAt(new Date(s));
    assert.ok(angleDelta(inDegrees(e.age), 0) < 0.5,
      `${s}: age ${inDegrees(e.age).toFixed(2)}° is not close to 0°`);
    assert.ok(e.phase < 0.0001, `${s}: phase ${e.phase} is not close to 0`);
  }
});

test("the phase is one at known full moons", () => {
  // Lunar eclipses, plus the date of issue #130
  const fullMoons = [
    "2022-03-18T07:17Z",   // the day of issue #130
    "2025-03-14T06:55Z",
    "2025-09-07T18:09Z",
    "2026-03-03T11:38Z"
  ];
  for (const s of fullMoons) {
    const e = moonAt(new Date(s));
    assert.ok(angleDelta(inDegrees(e.age), 180) < 0.5,
      `${s}: age ${inDegrees(e.age).toFixed(2)}° is not close to 180°`);
    assert.ok(e.phase > 0.9999, `${s}: phase ${e.phase} is not close to 1`);
  }
});

test("#130: on 2022-03-18 the Moon is practically full all day long", () => {
  // According to the reporter the map showed a waning gibbous. The computed
  // illuminated fraction, however, stays above 99.5% for the whole day.
  for (let hour = 0; hour < 24; hour++) {
    const e = moonAt(new Date(Date.UTC(2022, 2, 18, hour)));
    assert.ok(e.phase > 0.995,
      `2022-03-18 ${hour}:00 UTC: phase ${e.phase.toFixed(4)}`);
  }
});

test("phase follows from age, and falls between 0 and 1", () => {
  for (let n = 0; n < 400; n++) {
    const e = moonAt(new Date(Date.UTC(2024, 0, 1) + n * 86400000 * 0.7));
    assert.ok(e.age >= 0 && e.age < 2 * Math.PI, `age ${e.age} falls outside 0..2π`);
    assert.ok(e.phase >= 0 && e.phase <= 1, `phase ${e.phase} falls outside 0..1`);
    assert.ok(Math.abs(e.phase - 0.5 * (1 - Math.cos(e.age))) < 1e-12);
  }
});

test("a synodic month passes between two new moons", () => {
  // We look for the zero crossings of age by bisection, over the course of 2025.
  const newMoonTime = startState => {
    let a = startState, b = startState;
    // we step forward until age wraps around from 360° to 0°
    let prev = moonAt(new Date(a)).age;
    for (let i = 1; i <= 40 * 24; i++) {
      b = startState + i * 3600000;
      const now_ = moonAt(new Date(b)).age;
      if (now_ < prev) break;      // it wrapped around
      prev = now_; a = b;
    }
    for (let i = 0; i < 40; i++) {  // bisection down to minute accuracy
      const k = (a + b) / 2;
      if (moonAt(new Date(k)).age > Math.PI) a = k; else b = k;
    }
    return (a + b) / 2;
  };

  const times = [];
  let t = Date.UTC(2025, 0, 1);
  for (let i = 0; i < 13; i++) { t = newMoonTime(t); times.push(t); t += 86400000; }

  const lengths = [];
  for (let i = 1; i < times.length; i++) lengths.push((times[i] - times[i - 1]) / 86400000);

  const mean = lengths.reduce((s, x) => s + x, 0) / lengths.length;
  assert.ok(Math.abs(mean - 29.5306) < 0.05,
    `mean lunation ${mean.toFixed(4)} days, expected 29.5306`);
  for (const h of lengths) {
    assert.ok(h > 29.2 && h < 29.9, `one lunation is ${h.toFixed(3)} days, outside the real 29.27–29.83 band`);
  }
});

test("Meeus 47.a: ecliptic coordinates and distance", () => {
  // Astronomical Algorithms, example 47.a, 1992-04-12 0h TD
  const e = moonAt(new Date(Date.UTC(1992, 3, 12)));
  assert.equal(e.jd, 2448724.5);
  assert.ok(angleDelta(inDegrees(e.l), 133.162655) < 0.02,
    `λ ${inDegrees(e.l).toFixed(5)}°, expected 133.16266°`);
  assert.ok(Math.abs(inDegrees(e.b) - -3.229126) < 0.02,
    `β ${inDegrees(e.b).toFixed(5)}°, expected -3.22913°`);
  assert.ok(Math.abs(e.r - 368409.7) < 30,
    `Δ ${e.r.toFixed(1)} km, expected 368409.7 km`);
});

test("Meeus 13.a: right ascension and declination", () => {
  // The same moment in equatorial coordinates.
  const e = moonAt(new Date(Date.UTC(1992, 3, 12)));
  assert.ok(angleDelta(inDegrees(e.ra), 134.688470) < 0.02,
    `RA ${inDegrees(e.ra).toFixed(5)}°, expected 134.68847°`);
  assert.ok(Math.abs(inDegrees(e.dec) - 13.768368) < 0.02,
    `Dec ${inDegrees(e.dec).toFixed(5)}°, expected 13.76837°`);
});

test("ra/dec describes the same position as l/b", () => {
  // A purely geometric identity: ecliptic and equatorial coordinates are tied
  // together by the obliquity of the ecliptic. Independent of ephemeris accuracy.
  for (let n = 0; n < 60; n++) {
    const e = moonAt(new Date(Date.UTC(2024, 0, 1) + n * 86400000 * 6));
    const eps = (23.439292 - 0.0130042 * e.cy) * DEG;
    const cl = Math.cos(e.b) * Math.cos(e.l),
          sl = Math.cos(e.b) * Math.sin(e.l),
          sb = Math.sin(e.b);
    const expectedRa = Math.atan2(sl * Math.cos(eps) - sb * Math.sin(eps), cl),
          expectedDec = Math.asin(sb * Math.cos(eps) + Math.cos(e.b) * Math.sin(eps) * Math.sin(e.l));
    assert.ok(angleDelta(inDegrees(e.ra), inDegrees(expectedRa)) < 0.01,
      `RA ${inDegrees(e.ra).toFixed(4)}° ≠ ${inDegrees(expectedRa).toFixed(4)}° from l/b`);
    assert.ok(Math.abs(inDegrees(e.dec) - inDegrees(expectedDec)) < 0.01,
      `Dec ${inDegrees(e.dec).toFixed(4)}° ≠ ${inDegrees(expectedDec).toFixed(4)}° from l/b`);
  }
});
