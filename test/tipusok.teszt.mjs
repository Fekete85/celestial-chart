/* A típusdefiníció és a valóság összemérése.
 *
 * Egy .d.ts fájl a legcsendesebb hazugság: fordul, senki nem futtatja, és
 * lassan elcsúszik a kódtól. Ezért ugyanaz az elv, mint a referencia-hálónál —
 * mérjük, nem hisszük.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { settings, projections } from "../src/config.js";

const dts = fs.readFileSync(new URL("../types/celestial.d.ts", import.meta.url), "utf8");

/* A beállítás-nevek a védett halmaz: minden futásidejű kulcsnak szerepelnie
 * kell a típusban, és minden típusbeli névnek léteznie kell futásidőben. */
// Ezek nem beállításnevek, hanem ADATKULCSOK: a dsos.symbols mélyég-típusonként
// (gg, s0, oc, …) tart egy leírót. A típusban ezért Record, nem felsorolás — a
// bejáró sem megy beléjük.
const KULCSTAR = new Set(["dsos.symbols"]);

function beallitasNevek(o, ki = new Set(), ut = "") {
  for (const k of Object.keys(o)) {
    if (k === "set" || k === "applyDefaults") continue;
    ki.add(k);
    const teljes = ut ? ut + "." + k : k;
    if (KULCSTAR.has(teljes)) continue;
    const v = o[k];
    if (v !== null && typeof v === "object" && !Array.isArray(v)) beallitasNevek(v, ki, teljes);
  }
  return ki;
}

// A Config interfész törzse
const configTorzs = dts.slice(dts.indexOf("export interface Config {"),
                              dts.indexOf("/** A térkép aktuális méretei. */"));
const tipusNevek = new Set(
  [...configTorzs.matchAll(/^\s*(?:"([^"]+)"|([A-Za-z_$][\w$]*))\??:/gm)]
    .map(m => m[1] || m[2]));

test("minden beállítás szerepel a típusban", () => {
  const hianyzik = [...beallitasNevek(settings)].filter(n => !tipusNevek.has(n));
  assert.deepEqual(hianyzik, [], `${hianyzik.length} beállítás hiányzik a types/celestial.d.ts-ből`);
});

test("a típus nem talál ki nem létező beállítást", () => {
  const valos = beallitasNevek(settings);
  valos.add("date");   // nincs alapértelmezése, a kód viszont használja
  const tobblet = [...tipusNevek].filter(n => !valos.has(n));
  assert.deepEqual(tobblet, [], `${tobblet.length} olyan név van a típusban, ami futásidőben nincs`);
});

test("a vetítés-unió pontosan a támogatott vetítéseket sorolja", () => {
  const unio = dts.slice(dts.indexOf("export type Vetites ="), dts.indexOf("export type Transzformacio"));
  const tipusban = new Set([...unio.matchAll(/\|\s*"([^"]+)"/g)].map(m => m[1]));
  const valos = new Set(Object.keys(projections));
  assert.deepEqual([...valos].filter(v => !tipusban.has(v)), [], "hiányzó vetítés a típusból");
  assert.deepEqual([...tipusban].filter(v => !valos.has(v)), [], "nem létező vetítés a típusban");
});

test("a transzformáció-unió megegyezik az Euler-szögek kulcsaival", () => {
  const unio = dts.match(/export type Transzformacio = ([^;]+);/)[1];
  const tipusban = new Set([...unio.matchAll(/"([^"]+)"/g)].map(m => m[1]));
  // az eulerAngles az egyenlítőit is tartalmazza, az euler nem — az uniónak mind kell
  assert.ok(tipusban.has("equatorial") && tipusban.has("ecliptic") &&
            tipusban.has("galactic") && tipusban.has("supergalactic"),
    "hiányzó koordináta-rendszer: " + [...tipusban].join(", "));
});
