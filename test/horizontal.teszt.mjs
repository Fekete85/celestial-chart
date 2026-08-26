/* horizontal() / horizontal.inverse() — round-trip tesztek.
 *
 * A helyesség itt ellenőrizhető: ha az oda- és a visszaszámítás is helyes,
 * a kettő egymás után alkalmazva visszaadja a kiindulási koordinátát.
 * Ez az #148 issue (2023-12-08, válasz nélkül) numerikus tesztté fordítása.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { betolt } from "./betolt.mjs";

const { horizontal, Celestial } = betolt(
  ["src/transform.js", "src/horizontal.js"], ["horizontal"]);

const DT = new Date(Date.UTC(2026, 7, 26, 20, 0, 0));
const BUDAPEST = [47.5196, 19.22];
const TURES = 0.01; // fok

const normalizal = f => ((f % 360) + 360) % 360;
const szogKulonbseg = (a, b) => {
  const d = Math.abs(normalizal(a) - normalizal(b));
  return Math.min(d, 360 - d);
};

function roundTrip(dt, ra, dec, hely) {
  const hor = horizontal(dt, [ra, dec], hely);
  const vissza = horizontal.inverse(dt, [hor[0], hor[1]], hely);
  return {
    hor,
    dRa: szogKulonbseg(ra, vissza[0]),
    dDec: Math.abs(dec - vissza[1])
  };
}

test("round-trip a horizont fölött, Budapest", () => {
  const rosszak = [];
  for (let ra = 0; ra < 360; ra += 10) {
    for (let dec = -80; dec <= 80; dec += 10) {
      const r = roundTrip(DT, ra, dec, BUDAPEST);
      if (r.hor[0] < 0) continue;              // horizont alatt nem érdekes
      if (Math.max(r.dRa, r.dDec) > TURES) {
        rosszak.push(`RA ${ra}° Dec ${dec}° → az ${r.hor[1].toFixed(1)}°, eltérés ${r.dRa.toFixed(2)}°`);
      }
    }
  }
  assert.deepEqual(rosszak.slice(0, 5), [], `${rosszak.length} pont tér vissza rosszul`);
});

test("round-trip több szélességen, a pólusok között", () => {
  const rosszak = [];
  for (const lat of [-70, -45, -10, 0, 10, 45, 70]) {
    for (let ra = 0; ra < 360; ra += 20) {
      for (let dec = -70; dec <= 70; dec += 20) {
        const r = roundTrip(DT, ra, dec, [lat, 19.22]);
        if (r.hor[0] < 0) continue;
        if (Math.max(r.dRa, r.dDec) > TURES) rosszak.push(`lat ${lat}° RA ${ra}° Dec ${dec}°`);
      }
    }
  }
  assert.deepEqual(rosszak.slice(0, 5), [], `${rosszak.length} pont tér vissza rosszul`);
});

test("a hiba a sin(azimut) > 0 felet érintette — regresszió", () => {
  // Az égbolt „elveszett" fele: ahol sin(azimut) > 0. Nem rögzített pontot
  // adunk meg, hanem megkeressük — így a teszt nem az időponttól függ.
  const erintett = [];
  for (let ra = 0; ra < 360; ra += 5) {
    for (let dec = -60; dec <= 60; dec += 15) {
      const hor = horizontal(DT, [ra, dec], BUDAPEST);
      if (hor[0] > 5 && Math.sin(hor[1] * Math.PI / 180) > 0.3) erintett.push([ra, dec, hor]);
    }
  }
  assert.ok(erintett.length > 10, `csak ${erintett.length} pont esik az érintett félre`);
  for (const [ra, dec, hor] of erintett) {
    const vissza = horizontal.inverse(DT, [hor[0], hor[1]], BUDAPEST);
    assert.ok(szogKulonbseg(ra, vissza[0]) < TURES,
      `RA ${ra}° Dec ${dec}° (az ${hor[1].toFixed(1)}°) → ${normalizal(vissza[0]).toFixed(1)}°`);
  }
});

test("zenit: alt 90° — a könyvtár egyetlen belső inverse-hívása", () => {
  for (const lat of [-89, -47.5, 0, 47.5, 89]) {
    const z = horizontal.inverse(DT, [90, 0], [lat, 19.22]);
    assert.ok(Number.isFinite(z[0]), `RA nem szám lat=${lat} esetén`);
    assert.ok(Number.isFinite(z[1]), `Dec nem szám lat=${lat} esetén`);
    // A zenit deklinációja a megfigyelő földrajzi szélessége.
    assert.ok(Math.abs(z[1] - lat) < 1e-6, `zenit Dec ${z[1]} != lat ${lat}`);
  }
});

test("peremesetek: nem ad NaN-t szélső helyzetekben", () => {
  const esetek = [
    [[90, 0], [47.5, 19.2]],      // zenit
    [[0, 0], [47.5, 19.2]],       // horizont, észak
    [[0, 180], [47.5, 19.2]],     // horizont, dél
    [[45, 90], [89.9, 0]],        // sarkközeli megfigyelő
    [[45, 270], [-89.9, 0]],
    [[89.999, 123], [0, 0]]       // egyenlítő, majdnem zenit
  ];
  for (const [hor, hely] of esetek) {
    const r = horizontal.inverse(DT, hor, hely);
    assert.ok(Number.isFinite(r[0]) && Number.isFinite(r[1]),
      `NaN itt: hor=${JSON.stringify(hor)} hely=${JSON.stringify(hely)} → ${JSON.stringify(r)}`);
  }
});

test("horizontal() előre irány: ismert értékek", () => {
  // Az égi pólus a megfigyelő szélességével egyenlő magasságban, észak felé.
  const p = horizontal(DT, [0, 90], BUDAPEST);
  assert.ok(Math.abs(p[0] - BUDAPEST[0]) < 1e-6, `pólus magassága ${p[0]} != ${BUDAPEST[0]}`);
});

test("Celestial.horizontal ki van adva", () => {
  assert.equal(Celestial.horizontal, horizontal);
});
