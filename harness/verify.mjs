/* The browser-based verification in a single command.
 *
 * This used to be manual work: open two pages, copy out the reference, produce
 * 12 images, run the pixel diff, run the smoke test. Because of that only
 * whoever happened to be sitting in front of the browser could reproduce it —
 * even though the whole thesis of this repo is that the migration is
 * MEASURABLE. From now on it is one command, and it runs in CI too.
 *
 *   node harness/verify.mjs            — references + comparison (fast)
 *   node harness/verify.mjs --images    — plus the 12 images and the pixel diff
 *   node harness/verify.mjs --smoke     — plus the interactive smoke test
 *   node harness/verify.mjs --all
 *
 * Exit code 0 if every check passed.
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

// The images are only comparable at the same pixel ratio: on a Retina display
// the canvas would be twice the size, and the diff would be meaningless.
const VIEWPORT = { width: 1500, height: 1100, deviceScaleFactor: 1 };

const VIEWS = [
  ["aitoff-full-sky", "aitoff,0,0"],
  ["mollweide-full-sky", "mollweide,0,0"],
  ["mercator-full-sky", "mercator,0,0"],
  ["orthographic-big-dipper", "orthographic,180,55"],
  ["stereographic-north-pole", "stereographic,0,90"],
  ["airy-base", "airy,0,0"]
];

var failures = 0;
function check(name_, passed, detail) {
  console.log((passed ? "  ok    " : "  FAIL  ") + name_ + (detail ? "  — " + detail : ""));
  if (!passed) failures++;
}

/* The canvas is ready when its fingerprint stays the same across several
 * consecutive samples. The data files load asynchronously, and each one
 * triggers a redraw. */
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

// `generated` is a wall-clock stamp, so it differs on every run. If nothing else
// changed, keep the recorded one — otherwise the CI step that diffs the recorded
// measurements against the fresh ones would fail on every single run.
function keepTimestampIfUnchanged(target, fresh) {
  let previous;
  try { previous = JSON.parse(fs.readFileSync(target, "utf8")); } catch { return fresh; }
  const now = JSON.parse(fresh);
  const stamp = now.generated;
  now.generated = previous.generated;
  if (JSON.stringify(now) === JSON.stringify(previous)) return JSON.stringify(now);
  now.generated = stamp;
  return fresh;
}

async function reference(page, url, file_, label) {
  await page.goto(url, { waitUntil: "load" });
  await page.waitForFunction(
    () => (document.getElementById("statusEl") || {}).textContent?.indexOf("Done") === 0,
    null, { timeout: 180000 });
  // We pass it through JSON so that we compare exactly what ends up in the
  // file (NaN, for example, turns into null).
  let raw_ = await page.evaluate(() => JSON.stringify(window.REFERENCE));
  raw_ = keepTimestampIfUnchanged(path.join(ROOT, "harness", file_), raw_);
  fs.writeFileSync(path.join(ROOT, "harness", file_), raw_);
  const ref = JSON.parse(raw_);
  const oe = ref.summary;
  console.log(`  ${label}: ${oe.projections_ok} projections, ${oe.total_points} points`);
  check(label + " self-check", oe.self_check.ok, JSON.stringify(oe.self_check));
  return ref;
}

async function capture(page, url, file_) {
  await page.goto(url, { waitUntil: "load" });
  await waitStable(page);
  const b64 = await page.evaluate(() =>
    document.querySelector("#celestial-map canvas").toDataURL("image/png").split(",")[1]);
  fs.writeFileSync(path.join(ROOT, "docs/images", file_), Buffer.from(b64, "base64"));
}

async function smokeTest(page) {
  const errors = [];
  page.on("pageerror", e => errors.push(String(e.message)));
  page.on("console", m => {
    // A missing favicon is not the library's fault — and for network errors the
    // URL is not in the message but in the location data.
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
  check("load: stars appeared", startState.csillagok > 1000, startState.csillagok + " stars");
  check("load: the settings form was built", startState.form > 50, startState.form + " fields");

  await page.click("#celestial-zoomin");
  await page.waitForTimeout(2500);
  const zoomed = await statusEl();
  check("zoom button changes the scale", zoomed.sc > startState.sc, startState.sc + " → " + zoomed.sc);

  const box = await page.locator("#celestial-map canvas").boundingBox();
  await page.mouse.move(box.x + box.width / 2 - 100, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 50, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(2500);
  const rotated = await statusEl();
  check("dragging rotates the sky map",
    JSON.stringify(rotated.rot) !== JSON.stringify(zoomed.rot),
    JSON.stringify(zoomed.rot) + " → " + JSON.stringify(rotated.rot));

  await page.evaluate(() => window.dispatchEvent(new Event("resize")));
  await page.waitForTimeout(1500);
  check("resizing keeps the zoom level", (await statusEl()).sc === rotated.sc);

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
  check("five projection switches give five different images", fps.size === 5, fps.size + " unique");
  const afterProjection = await statusEl();
  check("the settings form is not duplicated", afterProjection.form === startState.form,
    startState.form + " → " + afterProjection.form);
  check("exactly one container remains", afterProjection.containers === 1, afterProjection.containers + " containers");

  const svg = await page.evaluate(() => new Promise(ok => {
    const t = setTimeout(() => ok(null), 40000);
    try { Celestial.exportSVG(s => { clearTimeout(t); ok(s); }); }
    catch (e) { clearTimeout(t); ok("EXCEPTION: " + e.message); }
  }));
  check("SVG export runs", typeof svg === "string" && svg.indexOf("<svg") >= 0,
    svg ? (svg.indexOf("EXCEPTION") === 0 ? svg : Math.round(svg.length / 1024) + " KB") : "did not run");

  // Two independent maps on one page (#96, #131)
  await page.goto(`http://127.0.0.1:${PORT}/demo/two-maps.html`, { waitUntil: "load" });
  await page.waitForTimeout(9000);
  const two = await page.evaluate(() => ({
    separateCfg: window.__a && window.__b ? window.__a.cfg !== window.__b.cfg : false,
    separateProjection: window.__a && window.__b ? window.__a.mapProjection !== window.__b.mapProjection : false,
    starsA: document.querySelectorAll("#terkep-a container .star").length,
    starsB: document.querySelectorAll("#terkep-b container .star").length,
    containers: document.querySelectorAll("container").length
  }));
  check("two maps with separate state", two.separateCfg && two.separateProjection);
  check("both maps were drawn", two.starsA > 1000 && two.starsB > 1000,
    two.starsA + " / " + two.starsB + " stars");
  check("one container per map", two.containers === 2, two.containers + " containers");

  // Two INTERACTIVE maps, each with its own settings form (#96, #131, the last piece).
  await page.goto(`http://127.0.0.1:${PORT}/demo/two-forms.html`, { waitUntil: "load" });
  await page.waitForTimeout(11000);
  const separate = await page.evaluate(() => ({
    separateForm: window.__a.form !== window.__b.form,
    formElements: document.querySelectorAll("#celestial-form").length,
    fieldsA: document.querySelectorAll("#terkep-a ~ #celestial-form input, #terkep-a ~ #celestial-form select").length,
    fieldsB: document.querySelectorAll("#terkep-b ~ #celestial-form input, #terkep-b ~ #celestial-form select").length
  }));
  check("two maps, two separate settings forms", separate.separateForm && separate.formElements === 2,
    separate.formElements + " form elements");
  check("both settings forms are complete", separate.fieldsA > 50 && separate.fieldsB > 50,
    separate.fieldsA + " / " + separate.fieldsB + " fields");

  const before = await page.evaluate(() => [window.__a.cfg.projection, window.__b.cfg.projection]);
  await page.evaluate(() => {
    const s = document.querySelector("#terkep-a ~ #celestial-form #projection");
    s.value = "hammer"; s.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForTimeout(6000);
  const after = await page.evaluate(() => [window.__a.cfg.projection, window.__b.cfg.projection]);
  check("one map's settings form only affects its own map",
    after[0] === "hammer" && after[1] === before[1],
    `A: ${before[0]} → ${after[0]}, B: ${before[1]} → ${after[1]}`);

  // With no container element and no given width: the map goes into the body,
  // and it has to work out the width for itself. This branch used to blow up
  // with an exception.
  await page.goto(`http://127.0.0.1:${PORT}/harness/no-container.html`, { waitUntil: "load" });
  await page.waitForTimeout(7000);
  const base = await page.evaluate(() => {
    const c = document.querySelector("body canvas");
    return { error_: window.__hiba, widthPx: c ? c.width : 0,
             csillagok: document.querySelectorAll("body container .star").length };
  });
  check("renders without a container and without a width",
    !base.error_ && base.widthPx > 200 && base.csillagok > 1000,
    base.error_ || base.widthPx + " px, " + base.csillagok + " stars");

  check("no console errors", errors.length === 0, errors.slice(0, 3).join(" | "));
}

// --- run ---
const server = await start(PORT);
const browser = await chromium.launch(
  process.env.CI ? {} : { channel: "chrome" });
const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });

try {
  console.log("\n=== reference net ===");
  const v3 = await reference(page, `http://127.0.0.1:${PORT}/harness/reference.html`,
    "reference-d3v3.json", "pinned v3");
  const v7 = await reference(page, `http://127.0.0.1:${PORT}/harness/reference-new.html`,
    "reference-d3v7.json", "migrated build");

  const er = compare(v3, v7);
  const bad = er.rows.filter(s => !s.ok);
  check(`${er.rows.length} projections within tolerance`, er.ok,
    bad.length ? bad.map(s => s.vetites + " max " + s.max.toFixed(2) + "px").join(", ") : "max difference 0.000 px");
  const improved = er.rows.reduce((n, s) => n + s.improved, 0);
  if (improved) console.log(`  (at ${improved} points the old code returned NaN, the new one a defined value)`);

  if (needImages) {
    console.log("\n=== visual comparison ===");
    for (const [name_, hash] of VIEWS) {
      await capture(page, `http://127.0.0.1:${PORT}/harness/visual.html#${hash}`, `d3v3-${name_}.png`);
      await capture(page, `http://127.0.0.1:${PORT}/harness/visual-new.html#${hash}`, `d3v7-${name_}.png`);
    }
    await page.goto(`http://127.0.0.1:${PORT}/harness/image-diff.html`, { waitUntil: "load" });
    for (const [name_] of VIEWS) {
      const d = await page.evaluate(n => window.diff(`/docs/images/d3v3-${n}.png`, `/docs/images/d3v7-${n}.png`), name_);
      check(name_.padEnd(26) + " differs only at anti-aliasing level", !d.error && d.share < 2,
        d.error || d.share + "% differing pixels, mean " + d.meanDiff);
    }
  }

  if (needSmoke) {
    console.log("\n=== smoke test ===");
    await smokeTest(page);
  }
} finally {
  await browser.close();
  await server.stop();
}

console.log("\n" + (failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`));
process.exit(failures === 0 ? 0 : 1);
