/* A böngészős ellenőrzés egy paranccsal.
 *
 * Eddig ez kézi munka volt: két oldal megnyitása, a referencia kimásolása, 12
 * kép elkészítése, pixeldiff, füstpróba. Emiatt csak az tudta reprodukálni, aki
 * épp a böngésző előtt ült — pedig a repó tézise pont az, hogy a migráció
 * MÉRHETŐ. Innentől egy parancs, és CI-ben is fut.
 *
 *   node harness/halo.mjs            — referenciák + összevetés (gyors)
 *   node harness/halo.mjs --kepek    — plusz a 12 kép és a pixeldiff
 *   node harness/halo.mjs --fust     — plusz az interaktív füstpróba
 *   node harness/halo.mjs --mind
 *
 * Kilépési kód 0, ha minden ellenőrzés átment.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { indit } from "./szerver.mjs";
import { osszehasonlit } from "./osszehasonlit.mjs";

const GYOKER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 8899;
const argv = process.argv.slice(2);
const mind = argv.includes("--mind");
const kellKepek = mind || argv.includes("--kepek");
const kellFust = mind || argv.includes("--fust");

// A képek csak azonos pixelarány mellett összemérhetők: Retina kijelzőn a canvas
// kétszeres méretű lenne, és a diff értelmezhetetlen.
const NEZET = { width: 1500, height: 1100, deviceScaleFactor: 1 };

const NEZETEK = [
  ["aitoff-teljes-eg", "aitoff,0,0"],
  ["mollweide-teljes-eg", "mollweide,0,0"],
  ["mercator-teljes-eg", "mercator,0,0"],
  ["orthographic-nagymedve", "orthographic,180,55"],
  ["stereographic-eszaki-sark", "stereographic,0,90"],
  ["airy-alap", "airy,0,0"]
];

var bukas = 0;
function allit(nev, rendben, reszlet) {
  console.log((rendben ? "  ok    " : "  BUKÁS ") + nev + (reszlet ? "  — " + reszlet : ""));
  if (!rendben) bukas++;
}

/* A canvas akkor kész, ha az ujjlenyomata több egymást követő mintán át azonos.
 * Az adatfájlok aszinkron töltődnek, mindegyik újrarajzol. */
async function varjStabilat(lap, kell = 5, lepes = 700, max = 40) {
  let elozo = null, azonos = 0;
  for (let i = 0; i < max; i++) {
    await lap.waitForTimeout(lepes);
    const u = await lap.evaluate(() => {
      const c = document.querySelector("#celestial-map canvas");
      if (!c) return null;
      const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let h = 2166136261;
      for (let i = 0; i < d.length; i += 4) { h ^= d[i]; h = Math.imul(h, 16777619); }
      return h >>> 0;
    });
    if (u !== null && u === elozo) { if (++azonos >= kell) return u; }
    else { azonos = 0; elozo = u; }
  }
  return elozo;
}

async function referencia(lap, url, fajl, cimke) {
  await lap.goto(url, { waitUntil: "load" });
  await lap.waitForFunction(
    () => (document.getElementById("allapot") || {}).textContent?.indexOf("Kész") === 0,
    null, { timeout: 180000 });
  // A JSON-on átvezetve adjuk tovább, hogy pontosan azt hasonlítsuk össze, ami a
  // fájlba kerül (a NaN például null-lá alakul).
  const nyers = await lap.evaluate(() => JSON.stringify(window.REFERENCIA));
  fs.writeFileSync(path.join(GYOKER, "harness", fajl), nyers);
  const ref = JSON.parse(nyers);
  const oe = ref.osszegzes;
  console.log(`  ${cimke}: ${oe.vetitesek_sikeres} vetítés, ${oe.ossz_pont} pont`);
  allit(cimke + " önellenőrzés", oe.self_check.rendben, JSON.stringify(oe.self_check));
  return ref;
}

async function kepet(lap, url, fajl) {
  await lap.goto(url, { waitUntil: "load" });
  await varjStabilat(lap);
  const b64 = await lap.evaluate(() =>
    document.querySelector("#celestial-map canvas").toDataURL("image/png").split(",")[1]);
  fs.writeFileSync(path.join(GYOKER, "docs/kepek", fajl), Buffer.from(b64, "base64"));
}

async function fustproba(lap) {
  const hibak = [];
  lap.on("pageerror", e => hibak.push(String(e.message)));
  lap.on("console", m => {
    // A favicon hiánya nem a könyvtár hibája — és a hálózati hibáknál a URL nem
    // az üzenetben, hanem a helyadatban van.
    if (m.type() !== "error") return;
    const hol = (m.location() || {}).url || "";
    if (/favicon\.ico/.test(hol) || /favicon\.ico/.test(m.text())) return;
    hibak.push(m.text() + (hol ? " @ " + hol : ""));
  });

  await lap.goto(`http://127.0.0.1:${PORT}/demo/teljes.html`, { waitUntil: "load" });
  await varjStabilat(lap);

  const allapot = () => lap.evaluate(() => {
    const p = Celestial.mapProjection;
    return {
      sc: Math.round(p.scale()),
      rot: p.rotate().map(x => Math.round(x * 10) / 10),
      csillagok: document.querySelectorAll("#celestial-map container .star").length,
      urlap: document.querySelectorAll("#celestial-form input, #celestial-form select").length,
      tarolok: document.querySelectorAll("#celestial-map container").length
    };
  });

  const kezdet = await allapot();
  allit("betöltés: csillagok megjelentek", kezdet.csillagok > 1000, kezdet.csillagok + " csillag");
  allit("betöltés: űrlap felépült", kezdet.urlap > 50, kezdet.urlap + " mező");

  await lap.click("#celestial-zoomin");
  await lap.waitForTimeout(2500);
  const nagyitva = await allapot();
  allit("zoom gomb változtat a léptéken", nagyitva.sc > kezdet.sc, kezdet.sc + " → " + nagyitva.sc);

  const doboz = await lap.locator("#celestial-map canvas").boundingBox();
  await lap.mouse.move(doboz.x + doboz.width / 2 - 100, doboz.y + doboz.height / 2);
  await lap.mouse.down();
  await lap.mouse.move(doboz.x + doboz.width / 2 + 100, doboz.y + doboz.height / 2 + 50, { steps: 12 });
  await lap.mouse.up();
  await lap.waitForTimeout(2500);
  const forgatva = await allapot();
  allit("húzás forgatja az égboltot",
    JSON.stringify(forgatva.rot) !== JSON.stringify(nagyitva.rot),
    JSON.stringify(nagyitva.rot) + " → " + JSON.stringify(forgatva.rot));

  await lap.evaluate(() => window.dispatchEvent(new Event("resize")));
  await lap.waitForTimeout(1500);
  allit("átméretezés megtartja a nagyítást", (await allapot()).sc === forgatva.sc);

  const ALAP = {
    container: "celestial-map", width: 700, datapath: "../harness/data/",
    interactive: true, form: true, controls: true, location: true, mw: { show: true },
    formFields: { location: true, general: true, stars: true, dsos: true,
                  constellations: true, lines: true, other: true, download: true }
  };
  const ujjak = new Set();
  for (const prj of ["mollweide", "orthographic", "hatano", "wagner7", "mercator"]) {
    await lap.evaluate(([a, p]) => Celestial.display(Object.assign({}, a, { projection: p })), [ALAP, prj]);
    ujjak.add(await varjStabilat(lap, 3));
  }
  allit("öt vetítésváltás öt különböző képet ad", ujjak.size === 5, ujjak.size + " egyedi");
  const vetitesUtan = await allapot();
  allit("az űrlap nem duplikálódik", vetitesUtan.urlap === kezdet.urlap,
    kezdet.urlap + " → " + vetitesUtan.urlap);
  allit("egy tároló elem marad", vetitesUtan.tarolok === 1, vetitesUtan.tarolok + " db");

  const svg = await lap.evaluate(() => new Promise(ok => {
    const t = setTimeout(() => ok(null), 40000);
    try { Celestial.exportSVG(s => { clearTimeout(t); ok(s); }); }
    catch (e) { clearTimeout(t); ok("KIVÉTEL: " + e.message); }
  }));
  allit("SVG-export lefut", typeof svg === "string" && svg.indexOf("<svg") >= 0,
    svg ? (svg.indexOf("KIVÉTEL") === 0 ? svg : Math.round(svg.length / 1024) + " KB") : "nem futott le");

  // Két független térkép egy oldalon (#96, #131)
  await lap.goto(`http://127.0.0.1:${PORT}/demo/ket-terkep.html`, { waitUntil: "load" });
  await lap.waitForTimeout(9000);
  const ket = await lap.evaluate(() => ({
    kulonCfg: window.__a && window.__b ? window.__a.cfg !== window.__b.cfg : false,
    kulonVetites: window.__a && window.__b ? window.__a.mapProjection !== window.__b.mapProjection : false,
    csillagA: document.querySelectorAll("#terkep-a container .star").length,
    csillagB: document.querySelectorAll("#terkep-b container .star").length,
    tarolok: document.querySelectorAll("container").length
  }));
  allit("két térkép külön állapottal", ket.kulonCfg && ket.kulonVetites);
  allit("mindkét térkép kirajzolódott", ket.csillagA > 1000 && ket.csillagB > 1000,
    ket.csillagA + " / " + ket.csillagB + " csillag");
  allit("térképenként egy tároló", ket.tarolok === 2, ket.tarolok + " db");

  // Konténer-elem és megadott szélesség nélkül: a térkép a body-ba kerül, és a
  // szélességet magának kell kitalálnia. Ez az ág korábban kivétellel elszállt.
  await lap.goto(`http://127.0.0.1:${PORT}/harness/nincs-container.html`, { waitUntil: "load" });
  await lap.waitForTimeout(7000);
  const alap = await lap.evaluate(() => {
    const c = document.querySelector("body canvas");
    return { hiba: window.__hiba, szeles: c ? c.width : 0,
             csillagok: document.querySelectorAll("body container .star").length };
  });
  allit("konténer és szélesség nélkül is megjelenik",
    !alap.hiba && alap.szeles > 200 && alap.csillagok > 1000,
    alap.hiba || alap.szeles + " px, " + alap.csillagok + " csillag");

  allit("nincs konzolhiba", hibak.length === 0, hibak.slice(0, 3).join(" | "));
}

// --- futtatás ---
const kiszolgalo = await indit(PORT);
const bongeszo = await chromium.launch(
  process.env.CI ? {} : { channel: "chrome" });
const lap = await bongeszo.newPage({ viewport: NEZET, deviceScaleFactor: 1 });

try {
  console.log("\n=== referencia-háló ===");
  const v3 = await referencia(lap, `http://127.0.0.1:${PORT}/harness/referencia.html`,
    "referencia-d3v3.json", "pinelt v3");
  const v7 = await referencia(lap, `http://127.0.0.1:${PORT}/harness/referencia-uj.html`,
    "referencia-d3v7.json", "migrált build");

  const er = osszehasonlit(v3, v7);
  const rossz = er.sorok.filter(s => !s.rendben);
  allit(`${er.sorok.length} vetítés a tűrésen belül`, er.rendben,
    rossz.length ? rossz.map(s => s.vetites + " max " + s.max.toFixed(2) + "px").join(", ") : "max eltérés 0,000 px");
  const javult = er.sorok.reduce((n, s) => n + s.javult, 0);
  if (javult) console.log(`  (${javult} pontban a régi NaN-t adott, az új definiált értéket)`);

  if (kellKepek) {
    console.log("\n=== vizuális összevetés ===");
    for (const [nev, hash] of NEZETEK) {
      await kepet(lap, `http://127.0.0.1:${PORT}/harness/vizualis.html#${hash}`, `d3v3-${nev}.png`);
      await kepet(lap, `http://127.0.0.1:${PORT}/harness/vizualis-uj.html#${hash}`, `d3v7-${nev}.png`);
    }
    await lap.goto(`http://127.0.0.1:${PORT}/harness/kepdiff.html`, { waitUntil: "load" });
    for (const [nev] of NEZETEK) {
      const d = await lap.evaluate(n => window.diff(`/docs/kepek/d3v3-${n}.png`, `/docs/kepek/d3v7-${n}.png`), nev);
      allit(nev.padEnd(26) + " élsimítási szinten", !d.hiba && d.arany < 2,
        d.hiba || d.arany + "% eltérő pixel, átlag " + d.atlagEltres);
    }
  }

  if (kellFust) {
    console.log("\n=== füstpróba ===");
    await fustproba(lap);
  }
} finally {
  await bongeszo.close();
  await kiszolgalo.leallit();
}

console.log("\n" + (bukas === 0 ? "MINDEN ELLENŐRZÉS RENDBEN" : `${bukas} ELLENŐRZÉS BUKOTT`));
process.exit(bukas === 0 ? 0 : 1);
