/* Build: a forrás ES-modulokból három kimenet.
 *
 * Az első fázisban a szerkezet szándékosan maradt a régi (globális d3, egyetlen
 * összefűzött fájl), hogy a referencia-háló ugyanazon a felületen mérje az új
 * kódot, mint a régit. Innentől viszont a modulhatárok explicitek, a csomagoló
 * pedig csak azt húzza be, amire tényleg szükség van — és a D3 benne van a
 * csomagban, tehát nem kell globális `d3` (upstream #134, #141, #115, #81, #86).
 */
import fs from "node:fs";
import * as esbuild from "esbuild";

const FEJLEC = "// d3-celestial modernizált fork — BSD-3-Clause, lásd LICENSE\n" +
               "// Eredeti: Copyright 2015-2020 Olaf Frohn https://github.com/ofrohn\n";

const KOZOS = {
  bundle: true,
  target: ["es2018"],
  banner: { js: FEJLEC },
  logLevel: "warning"
};

fs.mkdirSync("build", { recursive: true });

const kimenetek = [
  { entryPoints: ["src/globalis.js"], outfile: "build/celestial.js",     format: "iife" },
  { entryPoints: ["src/globalis.js"], outfile: "build/celestial.min.js", format: "iife", minify: true },
  { entryPoints: ["src/index.js"],    outfile: "build/celestial.mjs",    format: "esm" },
  { entryPoints: ["src/index.js"],    outfile: "build/celestial.cjs",    format: "cjs", platform: "node" }
];

for (const k of kimenetek) {
  await esbuild.build(Object.assign({}, KOZOS, k));
  const meret = fs.statSync(k.outfile).size / 1024;
  console.log(`${k.outfile.padEnd(24)} ${meret.toFixed(0).padStart(4)} KB  (${k.format})`);
}
