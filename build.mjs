/* Build: a forrás ES-modulokból három output.
 *
 * Az első fázisban a szerkezet szándékosan maradt a régi (globális d3, egyetlen
 * összefűzött fájl), hogy a reference-háló ugyanazon a felületen mérje az új
 * kódot, mint a régit. Innentől viszont a modulhatárok explicitek, a csomagoló
 * pedig csak azt húzza be, amire tényleg szükség van — és a D3 benne van a
 * csomagban, tehát nem kell globális `d3` (upstream #134, #141, #115, #81, #86).
 */
import fs from "node:fs";
import * as esbuild from "esbuild";

// A BSD-3-Clause 2. pontja szerint a bináris terjesztésnek reprodukálnia kell a
// szerzői jogi közlést. A full szöveg a LICENSE fájlban van (a pkg része),
// ide a közlés és a hivatkozás kerül.
const BANNER =
  "// celestial-chart — BSD-3-Clause. Teljes licenseText: LICENSE, közlemények: NOTICE.md\n" +
  "// Copyright (c) 2015 Olaf Frohn (d3-celestial), (c) 2026 Fekete László\n" +
  "// Tartalmazza: d3-* és versor modulok, (c) Mike Bostock, ISC\n";

const KOZOS = {
  bundle: true,
  target: ["es2018"],
  banner: { js: BANNER },
  logLevel: "warning"
};

fs.mkdirSync("build", { recursive: true });

const outputs = [
  { entryPoints: ["src/globalis.js"], outfile: "build/celestial.js",     format: "iife" },
  { entryPoints: ["src/globalis.js"], outfile: "build/celestial.min.js", format: "iife", minify: true },
  { entryPoints: ["src/index.js"],    outfile: "build/celestial.mjs",    format: "esm" },
  { entryPoints: ["src/index.js"],    outfile: "build/celestial.cjs",    format: "cjs", platform: "node" }
];

for (const k of outputs) {
  await esbuild.build(Object.assign({}, KOZOS, k));
  const size_ = fs.statSync(k.outfile).size / 1024;
  console.log(`${k.outfile.padEnd(24)} ${size_.toFixed(0).padStart(4)} KB  (${k.format})`);
}
