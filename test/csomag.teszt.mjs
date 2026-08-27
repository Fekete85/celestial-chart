/* A csomag metaadatai és a kód összemérése.
 *
 * Ugyanaz az elv, mint mindenhol: ne higgyük, mérjük. Egy elcsúszott
 * verziószám vagy egy hiányzó fájl a kiadás után derül ki, ha senki nem nézi.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Celestial } from "../src/mag.js";

const GYOKER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const csomag = JSON.parse(fs.readFileSync(path.join(GYOKER, "package.json"), "utf8"));

test("a Celestial.version megegyezik a csomag verziójával", () => {
  assert.equal(Celestial.version, csomag.version);
});

test("a csomagba sorolt fájlok léteznek", () => {
  const hianyzik = csomag.files.filter(f => !fs.existsSync(path.join(GYOKER, f)));
  assert.deepEqual(hianyzik, [], "a package.json files listája nem létező bejegyzést tartalmaz");
});

test("a belépési pontok a files listán belülre mutatnak", () => {
  const utak = [csomag.main, csomag.module, csomag.types,
                ...Object.values(csomag.exports["."])];
  for (const u of utak) {
    const rel = u.replace(/^\.\//, "");
    assert.ok(csomag.files.some(f => rel === f || rel.startsWith(f + "/")),
      `${u} nincs benne a files listában`);
    assert.ok(fs.existsSync(path.join(GYOKER, rel)), `${u} nem létezik`);
  }
});

test("a licencfájlok megvannak, és a fork szerzői joga is szerepel", () => {
  const licenc = fs.readFileSync(path.join(GYOKER, "LICENSE"), "utf8");
  assert.ok(/Olaf Frohn/.test(licenc), "az eredeti szerzői jogi közlés hiányzik");
  assert.ok(/Fekete/.test(licenc), "a fork szerzői jogi közlése hiányzik");
  assert.ok(/BSD|Redistribution and use/.test(licenc), "a licenc szövege hiányzik");
  assert.ok(fs.existsSync(path.join(GYOKER, "NOTICE.md")), "NOTICE.md hiányzik");
});

test("a build fejléce tartalmazza a szerzői jogi közlést", () => {
  // A BSD-3-Clause 2. pontja: a bináris terjesztésnek reprodukálnia kell.
  for (const f of ["build/celestial.js", "build/celestial.min.js",
                   "build/celestial.mjs", "build/celestial.cjs"]) {
    const ut = path.join(GYOKER, f);
    if (!fs.existsSync(ut)) continue;   // build nélkül nem bukik el
    const fej = fs.readFileSync(ut, "utf8").slice(0, 400);
    assert.ok(/Olaf Frohn/.test(fej), f + ": hiányzik az eredeti szerzői jogi közlés");
    assert.ok(/LICENSE/.test(fej), f + ": nincs hivatkozás a licencre");
  }
});

test("minden becsomagolt függőség licence ismert és megengedő", () => {
  const MEGENGEDO = new Set(["ISC", "MIT", "BSD-2-Clause", "BSD-3-Clause", "Apache-2.0"]);
  const rosszak = [];
  for (const nev of Object.keys(csomag.dependencies)) {
    const p = path.join(GYOKER, "node_modules", nev, "package.json");
    if (!fs.existsSync(p)) continue;
    const licenc = JSON.parse(fs.readFileSync(p, "utf8")).license;
    if (!MEGENGEDO.has(licenc)) rosszak.push(`${nev}: ${licenc}`);
  }
  assert.deepEqual(rosszak, [], "ismeretlen vagy korlátozó licencű függőség");
});
