/* Hold — fázis, megvilágítottság és pozíció numerikus tesztjei.
 *
 * Az upstream #130 issue („Wrong moon phase?", 2022-03-18-ra teliholdat vártak,
 * fogyó gibbuszt láttak) kivizsgálása. A referenciaértékek független forrásból
 * származnak, nem a kód saját kimenetéből:
 *
 *  - Meeus: Astronomical Algorithms, 2. kiadás, 47.a és 13.a példa
 *    (1992-04-12 0h TD, geocentrikus Hold).
 *  - Nap- és holdfogyatkozásokhoz kötött újhold/telihold időpontok
 *    (NASA Eclipse Web Site) — ezek az adott szizígia percre pontos horgonyai.
 *  - A szinodikus hónap közismert hossza: 29,5306 nap.
 *
 * A Föld pályaelemei a JPL „Keplerian Elements for Approximate Positions"
 * táblázatából valók, ugyanazok, mint a könyvtár planets.json-jában.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { betolt } from "./betolt.mjs";

const { Kepler } = betolt(
  ["src/transform.js", "src/util.js", "src/moon.js", "src/kepler.js"], ["Kepler"]);

const FOK = Math.PI / 180;

// JPL: a Föld–Hold baricentrum pályaelemei, J2000 epocha, évszázados változással
const FOLD_ELEMEK = {
  a: 1.00000261, e: 0.01671123, i: -1.531e-5,
  L: 100.46457166, W: 102.93768193, N: 0,
  da: 5.62e-6, de: -4.392e-5, di: -0.01294668,
  dL: 35999.37244981, dW: 0.32327364, dN: 0,
  ep: "2000-01-01"
};

/* A Hold efemeriszét ugyanúgy állítjuk elő, ahogy a könyvtár teszi:
 * a Föld heliocentrikus helyzete adja a Nap irányát (getPlanet → equatorial). */
function hold(dt) {
  var fold = Kepler().id("ter").elements(FOLD_ELEMEK),
      lun = Kepler().id("lun").elements({});
  return lun(dt).equatorial(fold(dt).spherical()).ephemeris;
}

const fokban = rad => rad / FOK;
// Két szög eltérése fokban, a 0/360 határon is helyesen
const szogElteres = (a, b) => Math.abs(((a - b) % 360 + 540) % 360 - 180);

test("fázis ismert újholdakkor nulla", () => {
  // Teljes napfogyatkozások — a konjunkció időpontja percre ismert
  const ujholdak = [
    "2017-08-21T18:30Z",
    "2024-04-08T18:21Z",
    "2026-02-17T12:01Z",
    "2026-08-12T17:46Z"
  ];
  for (const s of ujholdak) {
    const e = hold(new Date(s));
    assert.ok(szogElteres(fokban(e.age), 0) < 0.5,
      `${s}: age ${fokban(e.age).toFixed(2)}° nem 0° közeli`);
    assert.ok(e.phase < 0.0001, `${s}: phase ${e.phase} nem 0 közeli`);
  }
});

test("fázis ismert teliholdakkor egy", () => {
  // Holdfogyatkozások, illetve a #130 issue dátuma
  const teliholdak = [
    "2022-03-18T07:17Z",   // az #130 issue napja
    "2025-03-14T06:55Z",
    "2025-09-07T18:09Z",
    "2026-03-03T11:38Z"
  ];
  for (const s of teliholdak) {
    const e = hold(new Date(s));
    assert.ok(szogElteres(fokban(e.age), 180) < 0.5,
      `${s}: age ${fokban(e.age).toFixed(2)}° nem 180° közeli`);
    assert.ok(e.phase > 0.9999, `${s}: phase ${e.phase} nem 1 közeli`);
  }
});

test("#130: 2022-03-18-án a Hold végig gyakorlatilag telve van", () => {
  // A bejelentő szerint fogyó gibbuszt mutatott a térkép. A számított
  // megvilágítottság viszont egész nap 99,5% fölött van.
  for (let ora = 0; ora < 24; ora++) {
    const e = hold(new Date(Date.UTC(2022, 2, 18, ora)));
    assert.ok(e.phase > 0.995,
      `2022-03-18 ${ora}:00 UTC: phase ${e.phase.toFixed(4)}`);
  }
});

test("phase a age-ből következik, és 0..1 közé esik", () => {
  for (let n = 0; n < 400; n++) {
    const e = hold(new Date(Date.UTC(2024, 0, 1) + n * 86400000 * 0.7));
    assert.ok(e.age >= 0 && e.age < 2 * Math.PI, `age ${e.age} kívül esik 0..2π-n`);
    assert.ok(e.phase >= 0 && e.phase <= 1, `phase ${e.phase} kívül esik 0..1-en`);
    assert.ok(Math.abs(e.phase - 0.5 * (1 - Math.cos(e.age))) < 1e-12);
  }
});

test("két újhold között a szinodikus hónap telik el", () => {
  // Az age 0-átmeneteit keressük meg felezéssel, 2025 folyamán.
  const ujholdIdo = kezdet => {
    let a = kezdet, b = kezdet;
    // előrelépünk, amíg az age át nem fordul 360° → 0°
    let elozo = hold(new Date(a)).age;
    for (let i = 1; i <= 40 * 24; i++) {
      b = kezdet + i * 3600000;
      const most = hold(new Date(b)).age;
      if (most < elozo) break;      // átfordult
      elozo = most; a = b;
    }
    for (let i = 0; i < 40; i++) {  // felezés percnyi pontosságig
      const k = (a + b) / 2;
      if (hold(new Date(k)).age > Math.PI) a = k; else b = k;
    }
    return (a + b) / 2;
  };

  const idok = [];
  let t = Date.UTC(2025, 0, 1);
  for (let i = 0; i < 13; i++) { t = ujholdIdo(t); idok.push(t); t += 86400000; }

  const hosszak = [];
  for (let i = 1; i < idok.length; i++) hosszak.push((idok[i] - idok[i - 1]) / 86400000);

  const atlag = hosszak.reduce((s, x) => s + x, 0) / hosszak.length;
  assert.ok(Math.abs(atlag - 29.5306) < 0.05,
    `átlagos lunáció ${atlag.toFixed(4)} nap, várt 29,5306`);
  for (const h of hosszak) {
    assert.ok(h > 29.2 && h < 29.9, `egy lunáció ${h.toFixed(3)} nap, kívül a valós 29,27–29,83 sávon`);
  }
});

test("Meeus 47.a: ekliptikai koordináták és távolság", () => {
  // Astronomical Algorithms, 47.a példa, 1992-04-12 0h TD
  const e = hold(new Date(Date.UTC(1992, 3, 12)));
  assert.equal(e.jd, 2448724.5);
  assert.ok(szogElteres(fokban(e.l), 133.162655) < 0.02,
    `λ ${fokban(e.l).toFixed(5)}°, várt 133.16266°`);
  assert.ok(Math.abs(fokban(e.b) - -3.229126) < 0.02,
    `β ${fokban(e.b).toFixed(5)}°, várt -3.22913°`);
  assert.ok(Math.abs(e.r - 368409.7) < 30,
    `Δ ${e.r.toFixed(1)} km, várt 368409.7 km`);
});

test("Meeus 13.a: rektaszcenzió és deklináció", () => {
  // Ugyanaz az időpont egyenlítői koordinátákban.
  const e = hold(new Date(Date.UTC(1992, 3, 12)));
  assert.ok(szogElteres(fokban(e.ra), 134.688470) < 0.02,
    `RA ${fokban(e.ra).toFixed(5)}°, várt 134.68847°`);
  assert.ok(Math.abs(fokban(e.dec) - 13.768368) < 0.02,
    `Dec ${fokban(e.dec).toFixed(5)}°, várt 13.76837°`);
});

test("ra/dec ugyanazt a pozíciót írja le, mint l/b", () => {
  // Tisztán geometriai azonosság: az ekliptikai és az egyenlítői koordinátákat
  // az ekliptika hajlása köti össze. Ephemerisz-pontosságtól független.
  for (let n = 0; n < 60; n++) {
    const e = hold(new Date(Date.UTC(2024, 0, 1) + n * 86400000 * 6));
    const eps = (23.439292 - 0.0130042 * e.cy) * FOK;
    const cl = Math.cos(e.b) * Math.cos(e.l),
          sl = Math.cos(e.b) * Math.sin(e.l),
          sb = Math.sin(e.b);
    const vartRa = Math.atan2(sl * Math.cos(eps) - sb * Math.sin(eps), cl),
          vartDec = Math.asin(sb * Math.cos(eps) + Math.cos(e.b) * Math.sin(eps) * Math.sin(e.l));
    assert.ok(szogElteres(fokban(e.ra), fokban(vartRa)) < 0.01,
      `RA ${fokban(e.ra).toFixed(4)}° ≠ l/b-ből ${fokban(vartRa).toFixed(4)}°`);
    assert.ok(Math.abs(fokban(e.dec) - fokban(vartDec)) < 0.01,
      `Dec ${fokban(e.dec).toFixed(4)}° ≠ l/b-ből ${fokban(vartDec).toFixed(4)}°`);
  }
});
