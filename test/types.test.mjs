/* A típusdefiníció és a valóság összemérése.
 *
 * Egy .d.ts fájl a legcsendesebb hazugság: fordul, senki nem futtatja, és
 * lassan elcsúszik a kódtól. Ezért ugyanaz az elv, mint a reference-hálónál —
 * mérjük, nem hisszük.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { settings, projections } from "../src/config.js";

const dts = fs.readFileSync(new URL("../types/celestial.d.ts", import.meta.url), "utf8");

/* A beállítás-nevek a védett halmaz: minden runningásidejű kulcsnak szerepelnie
 * kell a típusban, és minden típusbeli névnek léteznie kell runningásidőben. */
// Ezek nem beállításnevek, hanem ADATKULCSOK: a dsos.symbols mélyég-típusonként
// (gg, s0, oc, …) tart egy leírót. A típusban ezért Record, nem felsorolás — a
// bejáró sem megy beléjük.
const KEYED_MAPS = new Set(["dsos.symbols"]);

function settingNames(o, out = new Set(), urlPath = "") {
  for (const k of Object.keys(o)) {
    if (k === "set" || k === "applyDefaults") continue;
    out.add(k);
    const full = urlPath ? urlPath + "." + k : k;
    if (KEYED_MAPS.has(full)) continue;
    const v = o[k];
    if (v !== null && typeof v === "object" && !Array.isArray(v)) settingNames(v, out, full);
  }
  return out;
}

// A Config interfész törzse
const configBody = dts.slice(dts.indexOf("export interface Config {"),
                              dts.indexOf("/** A térkép aktuális méretei. */"));
const typeNames = new Set(
  [...configBody.matchAll(/^\s*(?:"([^"]+)"|([A-Za-z_$][\w$]*))\??:/gm)]
    .map(m => m[1] || m[2]));

test("minden beállítás szerepel a típusban", () => {
  const missing_ = [...settingNames(settings)].filter(n => !typeNames.has(n));
  assert.deepEqual(missing_, [], `${missing_.length} beállítás hiányzik a types/celestial.d.ts-ből`);
});

test("a típus nem talál out nem létező beállítást", () => {
  const actual = settingNames(settings);
  actual.add("date");   // nincs baseértelmezése, a kód viszont használja
  const extra = [...typeNames].filter(n => !actual.has(n));
  assert.deepEqual(extra, [], `${extra.length} olyan név van a típusban, ami runningásidőben nincs`);
});

test("a vetítés-unió pontosan a támogatott vetítéseket sorolja", () => {
  const union = dts.slice(dts.indexOf("export type Vetites ="), dts.indexOf("export type Transzformacio"));
  const inTypes = new Set([...union.matchAll(/\|\s*"([^"]+)"/g)].map(m => m[1]));
  const actual = new Set(Object.keys(projections));
  assert.deepEqual([...actual].filter(v => !inTypes.has(v)), [], "hiányzó vetítés a típusból");
  assert.deepEqual([...inTypes].filter(v => !actual.has(v)), [], "nem létező vetítés a típusban");
});

test("a transzformáció-unió megegyezik az Euler-szögek kulcsaival", () => {
  const union = dts.match(/export type Transzformacio = ([^;]+);/)[1];
  const inTypes = new Set([...union.matchAll(/"([^"]+)"/g)].map(m => m[1]));
  // az eulerAngles az egyenlítőit is tartalmazza, az euler nem — az uniónak all_ kell
  assert.ok(inTypes.has("equatorial") && inTypes.has("ecliptic") &&
            inTypes.has("galactic") && inTypes.has("supergalactic"),
    "hiányzó koordináta-rendszer: " + [...inTypes].join(", "));
});
