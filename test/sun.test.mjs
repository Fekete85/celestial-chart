/* The Sun's position — against a formula that shares nothing with the library.
 *
 * The library does not compute the Sun directly: it takes the Earth's
 * heliocentric position from JPL's approximate orbital elements and turns it
 * around. Those elements are referred to J2000.0 = 2000-01-01 12:00 TT, and
 * the catalogue writes that epoch as "2000-01-01". Read as midnight, every
 * planet — and through the Earth, the Sun — ran twelve hours ahead: about
 * half a degree for the Sun, one solar diameter. Nothing noticed, because no
 * test looked at the Sun.
 *
 * The reference is the low-precision solar formula of the Astronomical
 * Almanac (section C, "Low precision formulas for the Sun"; also Meeus, ch. 25):
 * apparent ecliptic longitude of date, good to 0.01° between 1950 and 2050.
 * To compare, the library's J2000 position is carried to the equinox of date
 * (general precession in longitude) and aberration is subtracted.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { Kepler } from "../src/kepler.js";

const DEG = Math.PI / 180;
const EPS_J2000 = 23.4392911 * DEG;

// JPL: orbital elements of the Earth–Moon barycentre, J2000 epoch, with centennial rates
const EARTH_ELEMENTS = {
  a: 1.00000261, e: 0.01671123, i: -1.531e-5,
  L: 100.46457166, W: 102.93768193, N: 0,
  da: 5.62e-6, de: -4.392e-5, di: -0.01294668,
  dL: 35999.37244981, dW: 0.32327364, dN: 0,
  ep: "2000-01-01"
};

const angleDelta = (a, b) => Math.abs(((a - b) % 360 + 540) % 360 - 180);

// Astronomical Almanac: apparent longitude of the Sun, equinox of date, degrees
function almanacSun(dt) {
  const n = dt.getTime() / 86400000 + 2440587.5 - 2451545.0,
        L = 280.460 + 0.9856474 * n,
        g = (357.528 + 0.9856003 * n) * DEG;
  return L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g);
}

// The library's Sun, as the map draws it, as apparent longitude of date
function librarySun(dt) {
  const earth = Kepler().id("ter").elements(EARTH_ELEMENTS),
        sol = Kepler().id("sol").elements({});
  const pos = sol(dt).equatorial(earth(dt).spherical()).ephemeris.pos;
  const ra = pos[0] * DEG, dec = pos[1] * DEG;
  // J2000 equatorial -> J2000 ecliptic longitude
  const lon = Math.atan2(Math.sin(ra) * Math.cos(EPS_J2000) + Math.tan(dec) * Math.sin(EPS_J2000),
                         Math.cos(ra)) / DEG;
  const T = (dt.getTime() / 86400000 + 2440587.5 - 2451545.0) / 36525,
        precession = (5028.796195 * T + 1.1054348 * T * T) / 3600,
        aberration = -20.4898 / 3600;
  return lon + precession + aberration;
}

test("the Sun is where the Astronomical Almanac puts it, 1950–2050", () => {
  const bad = [];
  for (let year = 1950; year <= 2050; year += 5) {
    for (const [month, hour] of [[0, 0], [3, 6], [6, 12], [9, 18]]) {
      const dt = new Date(Date.UTC(year, month, 15, hour));
      const d = angleDelta(librarySun(dt), almanacSun(dt));
      if (d > 0.03) bad.push(`${dt.toISOString()}: ${d.toFixed(3)}°`);
    }
  }
  assert.deepEqual(bad.slice(0, 5), [], `${bad.length} positions are off by more than 0.03°`);
});

test("the J2000 epoch is noon: the Sun is not twelve hours ahead", () => {
  // Twelve hours is 0.49° of solar motion; the formula above is good to 0.01°.
  // So the library must be much closer to the Sun of this moment than to the
  // Sun of twelve hours later.
  const dt = new Date(Date.UTC(2026, 8, 25, 0));
  const now = angleDelta(librarySun(dt), almanacSun(dt)),
        later = angleDelta(librarySun(dt), almanacSun(new Date(dt.getTime() + 43200000)));
  assert.ok(now < 0.03 && later > 0.4, `off by ${now.toFixed(3)}° now, ${later.toFixed(3)}° from 12 h later`);
});
