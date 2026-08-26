/* A D3-mentes modulok betöltése Node-ba.
 *
 * A forrásfájlok sima szkriptek: globális `var`-okat és függvényeket
 * deklarálnak, amiket a build egyetlen closure-be fűz össze. Node-ban ezt
 * ugyanígy tesszük — egy vm-kontextusban összefűzve —, így a teszt pontosan
 * azt a kódot futtatja, ami a buildbe kerül, nem egy másolatát.
 */
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const GYOKER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function betolt(fajlok, kiadott = []) {
  const kod = fajlok
    .map(f => fs.readFileSync(path.join(GYOKER, f), "utf8").replace(/\/\* global.*/g, ""))
    .join("\n");

  const ctx = vm.createContext({ console, Math, Date, JSON, Object, Array, String, Number, isNaN, parseInt, parseFloat });
  vm.runInContext(
    "var Celestial = { version: 'teszt', container: null, data: [] };\n" +
    kod + "\n" +
    "globalThis.__kiadott = { Celestial: Celestial" +
    kiadott.map(n => `, ${n}: typeof ${n} !== 'undefined' ? ${n} : undefined`).join("") +
    " };",
    ctx
  );
  return ctx.__kiadott;
}
