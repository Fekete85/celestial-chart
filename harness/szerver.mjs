/* Minimális statikus fájlkiszolgáló a harness és a demók alá.
 *
 * Miért nem `python3 -m http.server`: a böngészős ellenőrzésnek CI-ben is
 * futnia kell, ott pedig nem adott a python. Node-dal a repó egyetlen
 * futtatókörnyezetet igényel.
 *
 *   node harness/szerver.mjs [port]      — önállóan
 *   import { indit } from "./szerver.mjs" — szkriptből
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const GYOKER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TIPUS = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".cjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".png": "image/png", ".svg": "image/svg+xml"
};

export function indit(port = 8877) {
  const kiszolgalo = http.createServer(function (keres, valasz) {
    const ut = decodeURIComponent(new URL(keres.url, "http://x").pathname);
    const teljes = path.join(GYOKER, ut);
    // A gyökéren kívülre mutató útvonalakat nem szolgáljuk ki.
    if (!teljes.startsWith(GYOKER)) { valasz.writeHead(403).end(); return; }
    fs.readFile(teljes, function (hiba, adat) {
      if (hiba) { valasz.writeHead(404).end("nincs ilyen fájl: " + ut); return; }
      valasz.writeHead(200, {
        "Content-Type": TIPUS[path.extname(teljes)] || "application/octet-stream",
        "Cache-Control": "no-store"    // a mérésnek mindig a friss buildet kell látnia
      });
      valasz.end(adat);
    });
  });
  return new Promise(function (ok) {
    kiszolgalo.listen(port, "127.0.0.1", function () {
      ok({ port, leallit: () => new Promise(v => kiszolgalo.close(v)) });
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = parseInt(process.argv[2] || "8877", 10);
  await indit(port);
  console.log(`kiszolgálás: http://127.0.0.1:${port}/  (gyökér: ${GYOKER})`);
}
