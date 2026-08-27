/* The type definition measured against reality.
 *
 * A .d.ts file is the quietest kind of lie: it compiles, nobody runs it, and it
 * slowly drifts away from the code. So the same principle as with the reference
 * net — we measure it, we do not believe it.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { settings, projections } from "../src/config.js";

const dts = fs.readFileSync(new URL("../types/celestial.d.ts", import.meta.url), "utf8");

/* The setting names are the protected set: every runtime key has to appear in
 * the type, and every name in the type has to exist at runtime. */
// These are not setting names but DATA KEYS: dsos.symbols keeps one descriptor
// per deep-sky type (gg, s0, oc, …). In the type it is therefore a Record, not
// an enumeration — and the walker does not descend into them either.
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

// The body of the Config interface
const configBody = dts.slice(dts.indexOf("export interface Config {"),
                              dts.indexOf("/** The map's current dimensions. */"));
const typeNames = new Set(
  [...configBody.matchAll(/^\s*(?:"([^"]+)"|([A-Za-z_$][\w$]*))\??:/gm)]
    .map(m => m[1] || m[2]));

test("every setting appears in the type", () => {
  const missing_ = [...settingNames(settings)].filter(n => !typeNames.has(n));
  assert.deepEqual(missing_, [], `${missing_.length} settings are missing from types/celestial.d.ts`);
});

test("the type does not invent settings that do not exist", () => {
  const actual = settingNames(settings);
  actual.add("date");   // it has no default, but the code does use it
  const extra = [...typeNames].filter(n => !actual.has(n));
  assert.deepEqual(extra, [], `${extra.length} names in the type do not exist at runtime`);
});

test("the projection union lists exactly the supported projections", () => {
  const union = dts.slice(dts.indexOf("export type Projection ="), dts.indexOf("export type Transform"));
  const inTypes = new Set([...union.matchAll(/\|\s*"([^"]+)"/g)].map(m => m[1]));
  const actual = new Set(Object.keys(projections));
  assert.deepEqual([...actual].filter(v => !inTypes.has(v)), [], "projection missing from the type");
  assert.deepEqual([...inTypes].filter(v => !actual.has(v)), [], "non-existent projection in the type");
});

test("the transform union matches the keys of the Euler angles", () => {
  const union = dts.match(/export type Transform = ([^;]+);/)[1];
  const inTypes = new Set([...union.matchAll(/"([^"]+)"/g)].map(m => m[1]));
  // eulerAngles contains the equatorial one as well, euler does not — the union needs all of them
  assert.ok(inTypes.has("equatorial") && inTypes.has("ecliptic") &&
            inTypes.has("galactic") && inTypes.has("supergalactic"),
    "missing coordinate system: " + [...inTypes].join(", "));
});
