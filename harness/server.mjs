/* Minimális statikus fájlkiszolgáló a harness és a demók alá.
 *
 * Miért nem `python3 -m http.server`: a böngészős ellenőrzésnek CI-ben is
 * futnia kell, ott pedig nem adott a python. Node-dal a repó egyetlen
 * futtatókörnyezetet igényel.
 *
 *   node harness/server.mjs [port]      — önállóan
 *   import { start } from "./server.mjs" — szkriptből
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".cjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".png": "image/png", ".svg": "image/svg+xml"
};

export function start(port = 8877) {
  const server = http.createServer(function (req, res) {
    const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const full = path.join(ROOT, urlPath);
    // A gyökéren kívülre mutató útvonalakat nem szolgáljuk out.
    if (!full.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    fs.readFile(full, function (error_, data_) {
      if (error_) { res.writeHead(404).end("nincs ilyen fájl: " + urlPath); return; }
      res.writeHead(200, {
        "Content-Type": MIME[path.extname(full)] || "application/octet-stream",
        "Cache-Control": "no-store"    // a mérésnek mindig a friss buildet kell látnia
      });
      res.end(data_);
    });
  });
  return new Promise(function (ok) {
    server.listen(port, "127.0.0.1", function () {
      ok({ port, stop: () => new Promise(v => server.close(v)) });
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = parseInt(process.argv[2] || "8877", 10);
  await start(port);
  console.log(`kiszolgálás: http://127.0.0.1:${port}/  (gyökér: ${ROOT})`);
}
