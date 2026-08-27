/* Build: three outputs from the ES module sources.
 *
 * In the first phase the structure was deliberately left as it was (global d3,
 * a single concatenated file), so that the reference net would measure the new
 * code through the same interface as the old one. From here on, though, the
 * module boundaries are explicit and the bundler only pulls in what is really
 * needed — and D3 is inside the bundle, so no global `d3` is required
 * (upstream #134, #141, #115, #81, #86).
 */
import fs from "node:fs";
import * as esbuild from "esbuild";

// Clause 2 of BSD-3-Clause requires binary distributions to reproduce the
// copyright notice. The full text is in the LICENSE file (part of the package);
// what goes here is the notice and the reference to it.
const BANNER =
  "// celestial-chart — BSD-3-Clause. Full licence text: LICENSE, notices: NOTICE.md\n" +
  "// Copyright (c) 2015 Olaf Frohn (d3-celestial), (c) 2026 Fekete László\n" +
  "// Includes: d3-* and versor modules, (c) Mike Bostock, ISC\n";

const COMMON = {
  bundle: true,
  target: ["es2018"],
  banner: { js: BANNER },
  logLevel: "warning"
};

fs.mkdirSync("build", { recursive: true });

const outputs = [
  { entryPoints: ["src/global.js"], outfile: "build/celestial.js",     format: "iife" },
  { entryPoints: ["src/global.js"], outfile: "build/celestial.min.js", format: "iife", minify: true },
  { entryPoints: ["src/index.js"],    outfile: "build/celestial.mjs",    format: "esm" },
  { entryPoints: ["src/index.js"],    outfile: "build/celestial.cjs",    format: "cjs", platform: "node" }
];

for (const k of outputs) {
  await esbuild.build(Object.assign({}, COMMON, k));
  const size_ = fs.statSync(k.outfile).size / 1024;
  console.log(`${k.outfile.padEnd(24)} ${size_.toFixed(0).padStart(4)} KB  (${k.format})`);
}
