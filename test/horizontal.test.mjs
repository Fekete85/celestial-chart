/* horizontal() / horizontal.inverse() — round-trip tesztek.
 *
 * A helyesség itt ellenőrizhető: ha az oda- és a visszaszámítás is helyes,
 * a kettő egymás urlPathán alkalmazva visszaadja a kiindulási koordinátát.
 * Ez az #148 issue (2023-12-08, válasz nélkül) numerikus tesztté fordítása.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { horizontal } from "../src/horizontal.js";
import { Celestial } from "../src/core.js";



const DT = new Date(Date.UTC(2026, 7, 26, 20, 0, 0));
const BUDAPEST = [47.5196, 19.22];
const TOLERANCE = 0.01; // fok

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

test("round-trip a horizont fölött, Budapest", () => {
  const bad = [];
  for (let ra = 0; ra < 360; ra += 10) {
    for (let dec = -80; dec <= 80; dec += 10) {
      const r = roundTrip(DT, ra, dec, BUDAPEST);
      if (r.hor[0] < 0) continue;              // horizont alatt nem érdekes
      if (Math.max(r.dRa, r.dDec) > TOLERANCE) {
        bad.push(`RA ${ra}° Dec ${dec}° → az ${r.hor[1].toFixed(1)}°, eltérés ${r.dRa.toFixed(2)}°`);
      }
    }
  }
  assert.deepEqual(bad.slice(0, 5), [], `${bad.length} pont tér back rosszul`);
});

test("round-trip több szélességen, a pólusok között", () => {
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
  assert.deepEqual(bad.slice(0, 5), [], `${bad.length} pont tér back rosszul`);
});

test("a error_ a sin(azimut) > 0 felet érintette — regresszió", () => {
  // Az égbolt „elveszett" fele: ahol sin(azimut) > 0. Nem rögzített pontot
  // adunk meg, hanem megkeressük — így a teszt nem az időponttól függ.
  const affected = [];
  for (let ra = 0; ra < 360; ra += 5) {
    for (let dec = -60; dec <= 60; dec += 15) {
      const hor = horizontal(DT, [ra, dec], BUDAPEST);
      if (hor[0] > 5 && Math.sin(hor[1] * Math.PI / 180) > 0.3) affected.push([ra, dec, hor]);
    }
  }
  assert.ok(affected.length > 10, `csak ${affected.length} pont esik az érintett félre`);
  for (const [ra, dec, hor] of affected) {
    const back = horizontal.inverse(DT, [hor[0], hor[1]], BUDAPEST);
    assert.ok(angleDiff(ra, back[0]) < TOLERANCE,
      `RA ${ra}° Dec ${dec}° (az ${hor[1].toFixed(1)}°) → ${normalizeDeg(back[0]).toFixed(1)}°`);
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
  const cases = [
    [[90, 0], [47.5, 19.2]],      // zenit
    [[0, 0], [47.5, 19.2]],       // horizont, észak
    [[0, 180], [47.5, 19.2]],     // horizont, dél
    [[45, 90], [89.9, 0]],        // sarkközeli megfigyelő
    [[45, 270], [-89.9, 0]],
    [[89.999, 123], [0, 0]]       // egyenlítő, majdnem zenit
  ];
  for (const [hor, site] of cases) {
    const r = horizontal.inverse(DT, hor, site);
    assert.ok(Number.isFinite(r[0]) && Number.isFinite(r[1]),
      `NaN itt: hor=${JSON.stringify(hor)} site=${JSON.stringify(site)} → ${JSON.stringify(r)}`);
  }
});

test("horizontal() előre irány: ismert értékek", () => {
  // Az égi pólus a megfigyelő szélességével egyenlő magasságban, észak felé.
  const p = horizontal(DT, [0, 90], BUDAPEST);
  assert.ok(Math.abs(p[0] - BUDAPEST[0]) < 1e-6, `pólus magassága ${p[0]} != ${BUDAPEST[0]}`);
});

test("Celestial.horizontal out van adva", () => {
  assert.equal(Celestial.horizontal, horizontal);
});

/* Celestial.ha() — óraszög. A könyvtárban semmi nem hívja, de publikus felület.
 * A helyességet nem a képletből, hanem a jelentéséből ellenőrizzük: az óraszög
 * akkor nulla, amikor az objektum a délkörön áll (azimut 0° vagy 180°). */
test("Celestial.ha a [0,360) tartományban ad óraszöget", () => {
  const bad = [];
  for (let ra = 0; ra < 360; ra += 15) {
    const ha = Celestial.ha(DT, BUDAPEST[1], ra);
    if (!(ha >= 0 && ha < 360)) bad.push(`RA ${ra}° → ${ha.toFixed(1)}°`);
  }
  assert.deepEqual(bad.slice(0, 5), [], `${bad.length} érték esik a tartományon kívülre`);
});

test("az óraszög nulla, amikor az objektum a délkörön van", () => {
  // Megkeressük, melyik RA áll épp a délkörön: ott az azimut 0° vagy 180°.
  let meridianRa = null, best = 1e9;
  for (let ra = 0; ra < 360; ra += 0.05) {
    const az = horizontal(DT, [ra, 20], BUDAPEST)[1];
    const delta = Math.min(Math.abs(az), Math.abs(az - 180), Math.abs(az - 360));
    if (delta < best) { best = delta; meridianRa = ra; }
  }
  assert.ok(best < 0.1, "nem találtunk délkörön álló pontot");

  const ha = Celestial.ha(DT, BUDAPEST[1], meridianRa);
  const fromMeridian = Math.min(ha, Math.abs(ha - 180), Math.abs(ha - 360));
  assert.ok(fromMeridian < 0.5,
    `a délkörön (RA ${meridianRa.toFixed(2)}°) az óraszög ${ha.toFixed(2)}°, ` +
    `pedig 0°-nak vagy 180°-nak kellene lennie`);
});
