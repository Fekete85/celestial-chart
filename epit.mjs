/* Build: a forrásfájlokat egyetlen closure-be fűzi, ahogy az upstream make.js.
 *
 * A modernizálás első fázisában a szerkezet szándékosan marad a régi: globális
 * `d3`, egy összefűzött fájl. Így a referencia-háló ugyanazon a felületen méri
 * az új kódot, mint a régit — a D3-csere hatása elkülöníthető a
 * modulosítás hatásától.
 */
import fs from "node:fs";
import path from "node:path";
import * as esbuild from "esbuild";

const FAJLOK = [
  "src/celestial.js",
  "src/projection.js",
  "src/transform.js",
  "src/horizontal.js",
  "src/add.js",
  "src/get.js",
  "src/config.js",
  "src/canvas.js",
  "src/util.js",
  "src/form.js",
  "src/location.js",
  "src/kepler.js",
  "src/moon.js",
  "src/svg.js",
  "src/datetimepicker.js",
  "lib/geo-zoom.js"
];

const FEJLEC = "// d3-celestial modernizált fork — BSD-3-Clause, lásd LICENSE\n" +
               "// Eredeti: Copyright 2015-2020 Olaf Frohn https://github.com/ofrohn\n";

const test = FAJLOK
  .map(f => fs.readFileSync(f, "utf8").replace(/\/\* global.*/g, ""))
  .join("\n");

const kod = FEJLEC + "!(function() {\n" + test + "\nthis.Celestial = Celestial;\n})();\n";

fs.mkdirSync("build", { recursive: true });
fs.writeFileSync("build/celestial.js", kod);

const kicsi = await esbuild.transform(kod, { minify: true, target: "es2018" });
fs.writeFileSync("build/celestial.min.js", FEJLEC + kicsi.code);

console.log(`build/celestial.js      ${(kod.length / 1024).toFixed(0)} KB`);
console.log(`build/celestial.min.js  ${(kicsi.code.length / 1024).toFixed(0)} KB`);
