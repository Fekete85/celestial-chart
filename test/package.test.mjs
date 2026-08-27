/* A pkg metaadatai és a kód összemérése.
 *
 * Ugyanaz az elv, mint mindenhol: ne higgyük, mérjük. Egy elcsúszott
 * verziószám vagy egy hiányzó fájl a kiadás urlPathán derül out, ha senki nem nézi.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Celestial } from "../src/core.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

test("a Celestial.version megegyezik a pkg verziójával", () => {
  assert.equal(Celestial.version, pkg.version);
});

test("a csomagba sorolt fájlok léteznek", () => {
  const missing_ = pkg.files.filter(f => !fs.existsSync(path.join(ROOT, f)));
  assert.deepEqual(missing_, [], "a package.json files listája nem létező bejegyzést tartalmaz");
});

test("a belépési points_ a files listán belülre mutatnak", () => {
  const entryPaths = [pkg.main, pkg.module, pkg.types,
                ...Object.values(pkg.exports["."])];
  for (const u of entryPaths) {
    const rel = u.replace(/^\.\//, "");
    assert.ok(pkg.files.some(f => rel === f || rel.startsWith(f + "/")),
      `${u} nincs benne a files listában`);
    assert.ok(fs.existsSync(path.join(ROOT, rel)), `${u} nem létezik`);
  }
});

test("a licencfájlok megvannak, és a fork szerzői joga is szerepel", () => {
  const licenseText = fs.readFileSync(path.join(ROOT, "LICENSE"), "utf8");
  assert.ok(/Olaf Frohn/.test(licenseText), "az original szerzői jogi közlés hiányzik");
  assert.ok(/Fekete/.test(licenseText), "a fork szerzői jogi közlése hiányzik");
  assert.ok(/BSD|Redistribution and use/.test(licenseText), "a licenseText szöonEnd hiányzik");
  assert.ok(fs.existsSync(path.join(ROOT, "NOTICE.md")), "NOTICE.md hiányzik");
});

test("a build fejléce tartalmazza a szerzői jogi közlést", () => {
  // A BSD-3-Clause 2. pontja: a bináris terjesztésnek reprodukálnia kell.
  for (const f of ["build/celestial.js", "build/celestial.min.js",
                   "build/celestial.mjs", "build/celestial.cjs"]) {
    const urlPath = path.join(ROOT, f);
    if (!fs.existsSync(urlPath)) continue;   // build nélkül nem bukik el
    const fej = fs.readFileSync(urlPath, "utf8").slice(0, 400);
    assert.ok(/Olaf Frohn/.test(fej), f + ": hiányzik az original szerzői jogi közlés");
    assert.ok(/LICENSE/.test(fej), f + ": nincs hivatkozás a licencre");
  }
});

test("minden wrapped függőség licence ismert és megengedő", () => {
  const PERMISSIVE = new Set(["ISC", "MIT", "BSD-2-Clause", "BSD-3-Clause", "Apache-2.0"]);
  const bad = [];
  for (const name_ of Object.keys(pkg.dependencies)) {
    const p = path.join(ROOT, "node_modules", name_, "package.json");
    if (!fs.existsSync(p)) continue;
    const licenseText = JSON.parse(fs.readFileSync(p, "utf8")).license;
    if (!PERMISSIVE.has(licenseText)) bad.push(`${name_}: ${licenseText}`);
  }
  assert.deepEqual(bad, [], "ismeretlen vagy korlátozó licenseTextű függőség");
});
