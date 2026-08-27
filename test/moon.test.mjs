/* Hold — fázis, megvilágítottság és pozíció numerikus tesztjei.
 *
 * Az upstream #130 issue („Wrong moon phase?", 2022-03-18-ra teliholdat vártak,
 * fogyó gibbuszt láttak) kivizsgálása. A referenceértékek független forrásból
 * származnak, nem a kód saját outputéből:
 *
 *  - Meeus: Astronomical Algorithms, 2. kiadás, 47.a és 13.a példa
 *    (1992-04-12 0h TD, geocentrikus Hold).
 *  - Nap- és holdfogyatkozásokhoz kötött újhold/telihold időpoints_
 *    (NASA Eclipse Web Site) — ezek az adott szizígia percre pontos horgonyai.
 *  - A szinodikus hóday közismert hossza: 29,5306 day.
 *
 * A Föld pályaelemei a JPL „Keplerian Elements for Approximate Positions"
 * táblázatából valók, ugyanazok, mint a könyvtár planets.json-jában.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { Kepler } from "../src/kepler.js";

const DEG = Math.PI / 180;

// JPL: a Föld–Hold baricentrum pályaelemei, J2000 epocha, évszázados változással
const EARTH_ELEMENTS = {
  a: 1.00000261, e: 0.01671123, i: -1.531e-5,
  L: 100.46457166, W: 102.93768193, N: 0,
  da: 5.62e-6, de: -4.392e-5, di: -0.01294668,
  dL: 35999.37244981, dW: 0.32327364, dN: 0,
  ep: "2000-01-01"
};

/* A Hold efemeriszét ugyanúgy állítjuk elő, ahogy a könyvtár teszi:
 * a Föld heliocentrikus helyzete adja a Nap irányát (getPlanet → equatorial). */
function moonAt(dt) {
  var earth = Kepler().id("ter").elements(EARTH_ELEMENTS),
      lun = Kepler().id("lun").elements({});
  return lun(dt).equatorial(earth(dt).spherical()).ephemeris;
}

const inDegrees = rad => rad / DEG;
// Két szög eltérése inDegrees, a 0/360 határon is helyesen
const angleDelta = (a, b) => Math.abs(((a - b) % 360 + 540) % 360 - 180);

test("fázis ismert újholdakkor nulla", () => {
  // Teljes napfogyatkozások — a konjunkció időpontja percre ismert
  const newMoons = [
    "2017-08-21T18:30Z",
    "2024-04-08T18:21Z",
    "2026-02-17T12:01Z",
    "2026-08-12T17:46Z"
  ];
  for (const s of newMoons) {
    const e = moonAt(new Date(s));
    assert.ok(angleDelta(inDegrees(e.age), 0) < 0.5,
      `${s}: age ${inDegrees(e.age).toFixed(2)}° nem 0° közeli`);
    assert.ok(e.phase < 0.0001, `${s}: phase ${e.phase} nem 0 közeli`);
  }
});

test("fázis ismert teliholdakkor egy", () => {
  // Holdfogyatkozások, illetve a #130 issue dátuma
  const fullMoons = [
    "2022-03-18T07:17Z",   // az #130 issue napja
    "2025-03-14T06:55Z",
    "2025-09-07T18:09Z",
    "2026-03-03T11:38Z"
  ];
  for (const s of fullMoons) {
    const e = moonAt(new Date(s));
    assert.ok(angleDelta(inDegrees(e.age), 180) < 0.5,
      `${s}: age ${inDegrees(e.age).toFixed(2)}° nem 180° közeli`);
    assert.ok(e.phase > 0.9999, `${s}: phase ${e.phase} nem 1 közeli`);
  }
});

test("#130: 2022-03-18-án a Hold végig gyakorlatilag telve van", () => {
  // A bejelentő szerint fogyó gibbuszt mutatott a térkép. A számított
  // megvilágítottság viszont egész day 99,5% fölött van.
  for (let hour = 0; hour < 24; hour++) {
    const e = moonAt(new Date(Date.UTC(2022, 2, 18, hour)));
    assert.ok(e.phase > 0.995,
      `2022-03-18 ${hour}:00 UTC: phase ${e.phase.toFixed(4)}`);
  }
});

test("phase a age-ből következik, és 0..1 közé esik", () => {
  for (let n = 0; n < 400; n++) {
    const e = moonAt(new Date(Date.UTC(2024, 0, 1) + n * 86400000 * 0.7));
    assert.ok(e.age >= 0 && e.age < 2 * Math.PI, `age ${e.age} kívül esik 0..2π-n`);
    assert.ok(e.phase >= 0 && e.phase <= 1, `phase ${e.phase} kívül esik 0..1-en`);
    assert.ok(Math.abs(e.phase - 0.5 * (1 - Math.cos(e.age))) < 1e-12);
  }
});

test("két újhold között a szinodikus hóday telik el", () => {
  // Az age 0-átmeneteit keressük meg felezéssel, 2025 folyamán.
  const newMoonTime = startState => {
    let a = startState, b = startState;
    // előrelépünk, amíg az age át nem fordul 360° → 0°
    let prev = moonAt(new Date(a)).age;
    for (let i = 1; i <= 40 * 24; i++) {
      b = startState + i * 3600000;
      const now_ = moonAt(new Date(b)).age;
      if (now_ < prev) break;      // átfordult
      prev = now_; a = b;
    }
    for (let i = 0; i < 40; i++) {  // felezés percnyi pontosságig
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
    `átlagos lunáció ${mean.toFixed(4)} day, várt 29,5306`);
  for (const h of lengths) {
    assert.ok(h > 29.2 && h < 29.9, `egy lunáció ${h.toFixed(3)} day, kívül a valós 29,27–29,83 sávon`);
  }
});

test("Meeus 47.a: ekliptikai koordináták és távolság", () => {
  // Astronomical Algorithms, 47.a példa, 1992-04-12 0h TD
  const e = moonAt(new Date(Date.UTC(1992, 3, 12)));
  assert.equal(e.jd, 2448724.5);
  assert.ok(angleDelta(inDegrees(e.l), 133.162655) < 0.02,
    `λ ${inDegrees(e.l).toFixed(5)}°, várt 133.16266°`);
  assert.ok(Math.abs(inDegrees(e.b) - -3.229126) < 0.02,
    `β ${inDegrees(e.b).toFixed(5)}°, várt -3.22913°`);
  assert.ok(Math.abs(e.r - 368409.7) < 30,
    `Δ ${e.r.toFixed(1)} km, várt 368409.7 km`);
});

test("Meeus 13.a: rektaszcenzió és deklináció", () => {
  // Ugyanaz az időpont egyenlítői koordinátákban.
  const e = moonAt(new Date(Date.UTC(1992, 3, 12)));
  assert.ok(angleDelta(inDegrees(e.ra), 134.688470) < 0.02,
    `RA ${inDegrees(e.ra).toFixed(5)}°, várt 134.68847°`);
  assert.ok(Math.abs(inDegrees(e.dec) - 13.768368) < 0.02,
    `Dec ${inDegrees(e.dec).toFixed(5)}°, várt 13.76837°`);
});

test("ra/dec ugyanazt a pozíciót írja le, mint l/b", () => {
  // Tisztán geometriai azonosság: az ekliptikai és az egyenlítői koordinátákat
  // az ekliptika hajlása köti össze. Ephemerisz-pontosságtól független.
  for (let n = 0; n < 60; n++) {
    const e = moonAt(new Date(Date.UTC(2024, 0, 1) + n * 86400000 * 6));
    const eps = (23.439292 - 0.0130042 * e.cy) * DEG;
    const cl = Math.cos(e.b) * Math.cos(e.l),
          sl = Math.cos(e.b) * Math.sin(e.l),
          sb = Math.sin(e.b);
    const expectedRa = Math.atan2(sl * Math.cos(eps) - sb * Math.sin(eps), cl),
          expectedDec = Math.asin(sb * Math.cos(eps) + Math.cos(e.b) * Math.sin(eps) * Math.sin(e.l));
    assert.ok(angleDelta(inDegrees(e.ra), inDegrees(expectedRa)) < 0.01,
      `RA ${inDegrees(e.ra).toFixed(4)}° ≠ l/b-ből ${inDegrees(expectedRa).toFixed(4)}°`);
    assert.ok(Math.abs(inDegrees(e.dec) - inDegrees(expectedDec)) < 0.01,
      `Dec ${inDegrees(e.dec).toFixed(4)}° ≠ l/b-ből ${inDegrees(expectedDec).toFixed(4)}°`);
  }
});
