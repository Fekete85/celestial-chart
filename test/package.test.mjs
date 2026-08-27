/* The package metadata measured against the code.
 *
 * The same principle as everywhere else: do not believe it, measure it. A
 * version number that has drifted, or a missing file, only comes to light at
 * release time if nobody is looking.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Celestial } from "../src/core.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

test("Celestial.version matches the version of the package", () => {
  assert.equal(Celestial.version, pkg.version);
});

test("the files listed for the package all exist", () => {
  const missing_ = pkg.files.filter(f => !fs.existsSync(path.join(ROOT, f)));
  assert.deepEqual(missing_, [], "the files list in package.json contains a non-existent entry");
});

test("the entry points stay inside the files list", () => {
  const entryPaths = [pkg.main, pkg.module, pkg.types,
                ...Object.values(pkg.exports["."])];
  for (const u of entryPaths) {
    const rel = u.replace(/^\.\//, "");
    assert.ok(pkg.files.some(f => rel === f || rel.startsWith(f + "/")),
      `${u} is not in the files list`);
    assert.ok(fs.existsSync(path.join(ROOT, rel)), `${u} does not exist`);
  }
});

test("the licence files are there, and the fork's copyright is included too", () => {
  const licenseText = fs.readFileSync(path.join(ROOT, "LICENSE"), "utf8");
  assert.ok(/Olaf Frohn/.test(licenseText), "the original copyright notice is missing");
  assert.ok(/Fekete/.test(licenseText), "the fork's copyright notice is missing");
  assert.ok(/BSD|Redistribution and use/.test(licenseText), "the licence text itself is missing");
  assert.ok(fs.existsSync(path.join(ROOT, "NOTICE.md")), "NOTICE.md is missing");
});

test("the header of the build carries the copyright notice", () => {
  // Clause 2 of BSD-3-Clause: a binary distribution has to reproduce it.
  for (const f of ["build/celestial.js", "build/celestial.min.js",
                   "build/celestial.mjs", "build/celestial.cjs"]) {
    const urlPath = path.join(ROOT, f);
    if (!fs.existsSync(urlPath)) continue;   // without a build it does not fail
    const head = fs.readFileSync(urlPath, "utf8").slice(0, 400);
    assert.ok(/Olaf Frohn/.test(head), f + ": the original copyright notice is missing");
    assert.ok(/LICENSE/.test(head), f + ": there is no reference to the licence");
  }
});

test("every bundled dependency has a known and permissive licence", () => {
  const PERMISSIVE = new Set(["ISC", "MIT", "BSD-2-Clause", "BSD-3-Clause", "Apache-2.0"]);
  const bad = [];
  for (const name_ of Object.keys(pkg.dependencies)) {
    const p = path.join(ROOT, "node_modules", name_, "package.json");
    if (!fs.existsSync(p)) continue;
    const licenseText = JSON.parse(fs.readFileSync(p, "utf8")).license;
    if (!PERMISSIVE.has(licenseText)) bad.push(`${name_}: ${licenseText}`);
  }
  assert.deepEqual(bad, [], "dependency with an unknown or restrictive licence");
});
