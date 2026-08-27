/* A böngészős ellenőrzés egy paranccsal.
 *
 * Eddig ez kézi munka volt: két oldal megnyitása, a reference kimásolása, 12
 * kép elkészítése, pixeldiff, füstpróba. Emiatt csak az tudta reprodukálni, aki
 * épp a böngésző előtt ült — pedig a repó tézise pont az, hogy a migráció
 * MÉRHETŐ. Innentől egy parancs, és CI-ben is running.
 *
 *   node harness/verify.mjs            — referenciák + összevetés (gyors)
 *   node harness/verify.mjs --images    — plusz a 12 kép és a pixeldiff
 *   node harness/verify.mjs --smoke     — plusz az interaktív füstpróba
 *   node harness/verify.mjs --all
 *
 * Kilépési kód 0, ha minden ellenőrzés átment.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { start } from "./server.mjs";
import { compare } from "./compare.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 8899;
const argv = process.argv.slice(2);
const all_ = argv.includes("--all");
const needImages = all_ || argv.includes("--images");
const needSmoke = all_ || argv.includes("--smoke");

// A képek csak same pixelarány mellett összemérhetők: Retina kijelzőn a canvas
// kétszeres méretű lenne, és a diff értelmezhetetlen.
const VIEWPORT = { width: 1500, height: 1100, deviceScaleFactor: 1 };

const VIEWS = [
  ["aitoff-full-eg", "aitoff,0,0"],
  ["mollweide-full-eg", "mollweide,0,0"],
  ["mercator-full-eg", "mercator,0,0"],
  ["orthographic-nagymedve", "orthographic,180,55"],
  ["stereographic-eszaki-sark", "stereographic,0,90"],
  ["airy-base", "airy,0,0"]
];

var failures = 0;
function check(name_, passed, detail) {
  console.log((passed ? "  ok    " : "  BUKÁS ") + name_ + (detail ? "  — " + detail : ""));
  if (!passed) failures++;
}

/* A canvas akkor kész, ha az ujjlenyomata több egymást követő mintán át same.
 * Az adatfájlok aszinkron töltődnek, mindegyik újrarajzol. */
async function waitStable(page, kell = 5, step = 700, max = 40) {
  let prev = null, same = 0;
  for (let i = 0; i < max; i++) {
    await page.waitForTimeout(step);
    const u = await page.evaluate(() => {
      const c = document.querySelector("#celestial-map canvas");
      if (!c) return null;
      const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let h = 2166136261;
      for (let i = 0; i < d.length; i += 4) { h ^= d[i]; h = Math.imul(h, 16777619); }
      return h >>> 0;
    });
    if (u !== null && u === prev) { if (++same >= kell) return u; }
    else { same = 0; prev = u; }
  }
  return prev;
}

async function reference(page, url, file_, label) {
  await page.goto(url, { waitUntil: "load" });
  await page.waitForFunction(
    () => (document.getElementById("statusEl") || {}).textContent?.indexOf("Kész") === 0,
    null, { timeout: 180000 });
  // A JSON-on átvezetve adjuk tovább, hogy pontosan azt hasonlítsuk össze, ami a
  // fájlba kerül (a NaN például null-lá alakul).
  const raw_ = await page.evaluate(() => JSON.stringify(window.REFERENCE));
  fs.writeFileSync(path.join(ROOT, "harness", file_), raw_);
  const ref = JSON.parse(raw_);
  const oe = ref.summary;
  console.log(`  ${label}: ${oe.projections_ok} vetítés, ${oe.total_points} pont`);
  check(label + " önellenőrzés", oe.self_check.ok, JSON.stringify(oe.self_check));
  return ref;
}

async function capture(page, url, file_) {
  await page.goto(url, { waitUntil: "load" });
  await waitStable(page);
  const b64 = await page.evaluate(() =>
    document.querySelector("#celestial-map canvas").toDataURL("image/png").split(",")[1]);
  fs.writeFileSync(path.join(ROOT, "docs/kepek", file_), Buffer.from(b64, "base64"));
}

async function smokeTest(page) {
  const errors = [];
  page.on("pageerror", e => errors.push(String(e.message)));
  page.on("console", m => {
    // A favicon hiánya nem a könyvtár hibája — és a hálózati hibáknál a URL nem
    // az üzenetben, hanem a helyadatban van.
    if (m.type() !== "error") return;
    const where = (m.location() || {}).url || "";
    if (/favicon\.ico/.test(where) || /favicon\.ico/.test(m.text())) return;
    errors.push(m.text() + (where ? " @ " + where : ""));
  });

  await page.goto(`http://127.0.0.1:${PORT}/demo/full.html`, { waitUntil: "load" });
  await waitStable(page);

  const statusEl = () => page.evaluate(() => {
    const p = Celestial.mapProjection;
    return {
      sc: Math.round(p.scale()),
      rot: p.rotate().map(x => Math.round(x * 10) / 10),
      csillagok: document.querySelectorAll("#celestial-map container .star").length,
      form: document.querySelectorAll("#celestial-form input, #celestial-form select").length,
      containers: document.querySelectorAll("#celestial-map container").length
    };
  });

  const startState = await statusEl();
  check("betöltés: csillagok megjelentek", startState.csillagok > 1000, startState.csillagok + " csillag");
  check("betöltés: űrlap felépült", startState.form > 50, startState.form + " mező");

  await page.click("#celestial-zoomin");
  await page.waitForTimeout(2500);
  const zoomed = await statusEl();
  check("zoom button változtat a léptéken", zoomed.sc > startState.sc, startState.sc + " → " + zoomed.sc);

  const box = await page.locator("#celestial-map canvas").boundingBox();
  await page.mouse.move(box.x + box.width / 2 - 100, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 50, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(2500);
  const rotated = await statusEl();
  check("húzás forgatja az égboltot",
    JSON.stringify(rotated.rot) !== JSON.stringify(zoomed.rot),
    JSON.stringify(zoomed.rot) + " → " + JSON.stringify(rotated.rot));

  await page.evaluate(() => window.dispatchEvent(new Event("resize")));
  await page.waitForTimeout(1500);
  check("átméretezés megtartja a nagyítást", (await statusEl()).sc === rotated.sc);

  const ALAP = {
    container: "celestial-map", width: 700, datapath: "../harness/data/",
    interactive: true, form: true, controls: true, location: true, mw: { show: true },
    formFields: { location: true, general: true, stars: true, dsos: true,
                  constellations: true, lines: true, other: true, download: true }
  };
  const fps = new Set();
  for (const prj of ["mollweide", "orthographic", "hatano", "wagner7", "mercator"]) {
    await page.evaluate(([a, p]) => Celestial.display(Object.assign({}, a, { projection: p })), [ALAP, prj]);
    fps.add(await waitStable(page, 3));
  }
  check("öt vetítésváltás öt különböző képet ad", fps.size === 5, fps.size + " egyedi");
  const afterProjection = await statusEl();
  check("az űrlap nem duplikálódik", afterProjection.form === startState.form,
    startState.form + " → " + afterProjection.form);
  check("egy tároló el marad", afterProjection.containers === 1, afterProjection.containers + " count");

  const svg = await page.evaluate(() => new Promise(ok => {
    const t = setTimeout(() => ok(null), 40000);
    try { Celestial.exportSVG(s => { clearTimeout(t); ok(s); }); }
    catch (e) { clearTimeout(t); ok("KIVÉTEL: " + e.message); }
  }));
  check("SVG-export lefut", typeof svg === "string" && svg.indexOf("<svg") >= 0,
    svg ? (svg.indexOf("KIVÉTEL") === 0 ? svg : Math.round(svg.length / 1024) + " KB") : "nem futott le");

  // Két független térkép egy oldalon (#96, #131)
  await page.goto(`http://127.0.0.1:${PORT}/demo/two-maps.html`, { waitUntil: "load" });
  await page.waitForTimeout(9000);
  const two = await page.evaluate(() => ({
    separateCfg: window.__a && window.__b ? window.__a.cfg !== window.__b.cfg : false,
    separateProjection: window.__a && window.__b ? window.__a.mapProjection !== window.__b.mapProjection : false,
    starsA: document.querySelectorAll("#terkep-a container .star").length,
    starsB: document.querySelectorAll("#terkep-b container .star").length,
    containers: document.querySelectorAll("container").length
  }));
  check("két térkép külön állapottal", two.separateCfg && two.separateProjection);
  check("mindkét térkép kirajzolódott", two.starsA > 1000 && two.starsB > 1000,
    two.starsA + " / " + two.starsB + " csillag");
  check("térképenként egy tároló", two.containers === 2, two.containers + " count");

  // Két INTERAKTÍV térkép, külön űrlappal (#96, #131 utolsó darabja).
  await page.goto(`http://127.0.0.1:${PORT}/demo/two-forms.html`, { waitUntil: "load" });
  await page.waitForTimeout(11000);
  const separate = await page.evaluate(() => ({
    separateForm: window.__a.form !== window.__b.form,
    formElements: document.querySelectorAll("#celestial-form").length,
    fieldsA: document.querySelectorAll("#terkep-a ~ #celestial-form input, #terkep-a ~ #celestial-form select").length,
    fieldsB: document.querySelectorAll("#terkep-b ~ #celestial-form input, #terkep-b ~ #celestial-form select").length
  }));
  check("két térkép, két külön űrlap", separate.separateForm && separate.formElements === 2,
    separate.formElements + " űrlap-el");
  check("mindkét űrlap full", separate.fieldsA > 50 && separate.fieldsB > 50,
    separate.fieldsA + " / " + separate.fieldsB + " mező");

  const before = await page.evaluate(() => [window.__a.cfg.projection, window.__b.cfg.projection]);
  await page.evaluate(() => {
    const s = document.querySelector("#terkep-a ~ #celestial-form #projection");
    s.value = "hammer"; s.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForTimeout(6000);
  const after = await page.evaluate(() => [window.__a.cfg.projection, window.__b.cfg.projection]);
  check("az egyik űrlapja csak a saját térképét állítja",
    after[0] === "hammer" && after[1] === before[1],
    `A: ${before[0]} → ${after[0]}, B: ${before[1]} → ${after[1]}`);

  // Konténer-el és megadott szélesség nélkül: a térkép a body-ba kerül, és a
  // szélességet magának kell kitalálnia. Ez az ág korábban kivétellel elszállt.
  await page.goto(`http://127.0.0.1:${PORT}/harness/no-container.html`, { waitUntil: "load" });
  await page.waitForTimeout(7000);
  const base = await page.evaluate(() => {
    const c = document.querySelector("body canvas");
    return { error_: window.__hiba, widthPx: c ? c.width : 0,
             csillagok: document.querySelectorAll("body container .star").length };
  });
  check("konténer és szélesség nélkül is megjelenik",
    !base.error_ && base.widthPx > 200 && base.csillagok > 1000,
    base.error_ || base.widthPx + " px, " + base.csillagok + " csillag");

  check("nincs konzolhiba", errors.length === 0, errors.slice(0, 3).join(" | "));
}

// --- futtatás ---
const server = await start(PORT);
const browser = await chromium.launch(
  process.env.CI ? {} : { channel: "chrome" });
const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });

try {
  console.log("\n=== reference-háló ===");
  const v3 = await reference(page, `http://127.0.0.1:${PORT}/harness/reference.html`,
    "reference-d3v3.json", "pinelt v3");
  const v7 = await reference(page, `http://127.0.0.1:${PORT}/harness/reference-new.html`,
    "reference-d3v7.json", "migrált build");

  const er = compare(v3, v7);
  const bad = er.rows.filter(s => !s.ok);
  check(`${er.rows.length} vetítés a tűrésen belül`, er.ok,
    bad.length ? bad.map(s => s.vetites + " max " + s.max.toFixed(2) + "px").join(", ") : "max eltérés 0,000 px");
  const improved = er.rows.reduce((n, s) => n + s.improved, 0);
  if (improved) console.log(`  (${improved} pontban a régi NaN-t adott, az új definiált értétwo)`);

  if (needImages) {
    console.log("\n=== vizuális összevetés ===");
    for (const [name_, hash] of VIEWS) {
      await capture(page, `http://127.0.0.1:${PORT}/harness/visual.html#${hash}`, `d3v3-${name_}.png`);
      await capture(page, `http://127.0.0.1:${PORT}/harness/visual-new.html#${hash}`, `d3v7-${name_}.png`);
    }
    await page.goto(`http://127.0.0.1:${PORT}/harness/image-diff.html`, { waitUntil: "load" });
    for (const [name_] of VIEWS) {
      const d = await page.evaluate(n => window.diff(`/docs/kepek/d3v3-${n}.png`, `/docs/kepek/d3v7-${n}.png`), name_);
      check(name_.padEnd(26) + " élsimítási szinten", !d.error_ && d.arany < 2,
        d.error_ || d.arany + "% eltérő pixel, átlag " + d.atlagEltres);
    }
  }

  if (needSmoke) {
    console.log("\n=== füstpróba ===");
    await smokeTest(page);
  }
} finally {
  await browser.close();
  await server.stop();
}

console.log("\n" + (failures === 0 ? "MINDEN ELLENŐRZÉS RENDBEN" : `${failures} ELLENŐRZÉS BUKOTT`));
process.exit(failures === 0 ? 0 : 1);
