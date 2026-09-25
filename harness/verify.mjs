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

  // The settings form's own "SVG File" button. It passed the file name where
  // exportSVG expects the map, and threw before exporting anything.
  const download = page.waitForEvent("download", { timeout: 40000 }).catch(() => null);
  await page.evaluate(() => document.querySelector("#celestial-form #download-svg").click());
  const file_ = await download;
  const leftover = await page.evaluate(() => document.querySelectorAll("#d3-celestial-svg").length);
  check("the form's SVG button downloads the map",
    !!file_ && /\.svg$/.test(file_.suggestedFilename()) && leftover === 0,
    file_ ? file_.suggestedFilename() + ", " + leftover + " working divs left" : "no download");

  // Picking a constellation in the form highlights its boundary. The module
  // pointer behind Celestial.constellation(s) was shadowed by the animation
  // counter, so both were always undefined and nothing was highlighted.
  await page.evaluate(() => {
    const s = document.querySelector("#celestial-form #constellation");
    s.value = "Ori"; s.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForTimeout(3000);
  const con = await page.evaluate(() => ({ list: typeof Celestial.constellations, selected: Celestial.constellation }));
  check("a constellation picked in the form reaches Celestial.constellation(s)",
    con.list === "object" && con.selected === "Ori", JSON.stringify(con));

  // A layer added with Celestial.add() draws through the global Celestial
  // object, exactly as upstream's examples do. The zoom behaviour triggers a
  // redraw while the constructor is still running, so without the deferral
  // those layers would meet a global whose container is still null — and the
  // exception would abort display() itself.
  const layer = await page.evaluate(([a]) => new Promise(ok => {
    const state = { drawn: 0, containerMissing: false, error: null };
    Celestial.clear();
    Celestial.add({
      type: "raw",
      callback: function () { Celestial.redraw(); },
      redraw: function () {
        state.drawn++;
        if (!Celestial.container || !Celestial.context) state.containerMissing = true;
      }
    });
    try { Celestial.display(Object.assign({}, a, { projection: "airy" })); }
    catch (e) { state.error = String(e.message); }
    setTimeout(() => { Celestial.clear(); ok(state); }, 4000);
  }), [ALAP]);
  check("Celestial.add() layers draw through the global interface",
    layer.drawn > 0 && !layer.containerMissing && !layer.error, JSON.stringify(layer));

  const svg = await page.evaluate(() => new Promise(ok => {
    const t = setTimeout(() => ok(null), 40000);
    try { Celestial.exportSVG(s => { clearTimeout(t); ok(s); }); }
    catch (e) { clearTimeout(t); ok("EXCEPTION: " + e.message); }
  }));
  check("SVG export runs", typeof svg === "string" && svg.indexOf("<svg") >= 0,
    svg ? (svg.indexOf("EXCEPTION") === 0 ? svg : Math.round(svg.length / 1024) + " KB") : "did not run");

  // The ESM entry point, loaded by the browser as a module — the readme points
  // people at this page, so it has to keep working.
  await page.goto(`http://127.0.0.1:${PORT}/demo/module.html`, { waitUntil: "load" });
  await page.waitForTimeout(9000);
  const mod = await page.evaluate(() => ({
    stars: document.querySelectorAll("container .star").length,
    canvas: document.querySelectorAll("#celestial-map canvas").length
  }));
  check("ES module entry point draws", mod.stars > 1000 && mod.canvas === 1,
    mod.stars + " stars, " + mod.canvas + " canvas");

  // Two independent maps on one page (#96, #131)
  await page.goto(`http://127.0.0.1:${PORT}/demo/two-maps.html`, { waitUntil: "load" });
  await page.waitForTimeout(9000);
  const two = await page.evaluate(() => ({
    separateCfg: window.__a && window.__b ? window.__a.cfg !== window.__b.cfg : false,
    separateProjection: window.__a && window.__b ? window.__a.mapProjection !== window.__b.mapProjection : false,
    starsA: document.querySelectorAll("#map-a container .star").length,
    starsB: document.querySelectorAll("#map-b container .star").length,
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
    fieldsA: document.querySelectorAll("#map-a ~ #celestial-form input, #map-a ~ #celestial-form select").length,
    fieldsB: document.querySelectorAll("#map-b ~ #celestial-form input, #map-b ~ #celestial-form select").length
  }));
  check("two maps, two separate settings forms", separate.separateForm && separate.formElements === 2,
    separate.formElements + " form elements");
  check("both settings forms are complete", separate.fieldsA > 50 && separate.fieldsB > 50,
    separate.fieldsA + " / " + separate.fieldsB + " fields");

  const before = await page.evaluate(() => [window.__a.cfg.projection, window.__b.cfg.projection]);
  await page.evaluate(() => {
    const s = document.querySelector("#map-a ~ #celestial-form #projection");
    s.value = "hammer"; s.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForTimeout(6000);
  const after = await page.evaluate(() => [window.__a.cfg.projection, window.__b.cfg.projection]);
  check("one map's settings form only affects its own map",
    after[0] === "hammer" && after[1] === before[1],
    `A: ${before[0]} → ${after[0]}, B: ${before[1]} → ${after[1]}`);

  // Every other form change, and rotate(), went through the shared
  // globalConfig: A took over B's container and projection. And a colour set
  // on A reached B through a style object the two configurations shared.
  await page.evaluate(() => {
    const f = document.querySelector("#map-a ~ #celestial-form #constellations-lines");
    f.checked = !f.checked; f.dispatchEvent(new Event("change", { bubbles: true }));
    const c = document.querySelector("#map-a ~ #celestial-form #stars-style-fill");
    c.value = "#ff0000"; c.dispatchEvent(new Event("change", { bubbles: true }));
    window.__a.rotate({ center: [150, 40, 0] });
  });
  await page.waitForTimeout(1500);
  const own = await page.evaluate(() => [window.__a, window.__b].map(m =>
    [m.cfg.container, m.cfg.projection, m.cfg.stars.style.fill]));
  check("form changes and rotate() keep each map's own settings",
    own[0][0] === "map-a" && own[0][1] === "hammer" && own[0][2] === "#ff0000" &&
      own[1][0] === "map-b" && own[1][1] === before[1] && own[1][2] !== "#ff0000",
    JSON.stringify(own));

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

  await moduleChecks(page);

  check("no console errors", errors.length === 0, errors.slice(0, 3).join(" | "));
}

/* The ES module build on an empty page, one map at a time: the independent
 * SkyMap interface, and the SVG export measured against the canvas. */
async function moduleChecks(page) {
  const blank = `http://127.0.0.1:${PORT}/harness/blank.html`;
  const DATA = "../harness/data/";

  // A SkyMap with a location, and nothing global behind it: the drawing and
  // the export read Celestial.date(), .zenith() and .metrics(), which only
  // Celestial.display() provides. The daylight sky threw on the first
  // display() as well.
  await page.goto(blank, { waitUntil: "load" });
  const alone = await page.evaluate(async (DATA) => {
    document.body.innerHTML = '<div id="m1"></div>';
    const { SkyMap } = await import("/build/celestial.mjs");
    try {
      const m = new SkyMap({ container: "m1", width: 600, datapath: DATA, projection: "stereographic",
        location: true, geopos: [47.5, 19.04], planets: { show: true }, daylight: { show: true },
        form: false, disableAnimations: true }, { standalone: true });
      await new Promise(r => setTimeout(r, 4000));
      const svg = await new Promise(ok => { m.exportSVG(ok); setTimeout(() => ok(null), 30000); });
      return svg && svg.indexOf("<svg") === 0 ? "ok, " + Math.round(svg.length / 1024) + " KB" : "no SVG";
    } catch (e) { return "EXCEPTION: " + e.message; }
  }, DATA);
  check("a SkyMap with a location draws and exports on its own", /^ok/.test(alone), alone);

  // Grid value labels: getLine() read a `sky` that was not in its scope.
  // (A fresh page for every map: a location map's pending timers would
  // otherwise reach into a form that is no longer there.)
  await page.goto(blank, { waitUntil: "load" });
  const grid = await page.evaluate(async (DATA) => {
    document.body.innerHTML = '<div id="g1"></div>';
    const { SkyMap } = await import("/build/celestial.mjs");
    try {
      new SkyMap({ container: "g1", width: 400, datapath: DATA, form: false, location: false,
        lines: { graticule: { show: true, lon: { pos: ["center"] }, lat: { pos: ["outline"] } } } }, { standalone: true });
      return "ok";
    } catch (e) { return "EXCEPTION: " + e.message; }
  }, DATA);
  check("grid value labels render", grid === "ok", grid);

  // One map's projectionRatio was written into the shared projection table.
  await page.goto(blank, { waitUntil: "load" });
  const ratio = await page.evaluate(async (DATA) => {
    document.body.innerHTML = '<div id="x"></div><div id="y"></div>';
    const { SkyMap } = await import("/build/celestial.mjs");
    const opt = { width: 400, datapath: DATA, projection: "aitoff", interactive: false, form: false, location: false };
    new SkyMap(Object.assign({ container: "x", projectionRatio: 1 }, opt), { standalone: true });
    new SkyMap(Object.assign({ container: "y" }, opt), { standalone: true });
    return [document.querySelector("#x canvas").height, document.querySelector("#y canvas").height];
  }, DATA);
  check("a ratio override stays with its own map", ratio[0] === 402 && ratio[1] === 201, ratio.join(" / ") + " px");

  // Window resize: the listener had no name, so each map replaced the
  // previous one's and only the last map followed the window.
  await page.goto(blank, { waitUntil: "load" });
  await page.evaluate(async (DATA) => {
    document.body.innerHTML = '<div id="r1" style="width:40%"></div><div id="r2" style="width:40%"></div>';
    const { SkyMap } = await import("/build/celestial.mjs");
    const opt = { datapath: DATA, projection: "aitoff", form: false, controls: false, location: false };
    new SkyMap(Object.assign({ container: "r1" }, opt), { standalone: true });
    new SkyMap(Object.assign({ container: "r2" }, opt), { standalone: true });
  }, DATA);
  const wide = await page.evaluate(() => ["r1", "r2"].map(id => document.querySelector("#" + id + " canvas").width));
  await page.setViewportSize({ width: 800, height: VIEWPORT.height });
  await page.waitForTimeout(1000);
  const narrow = await page.evaluate(() => ["r1", "r2"].map(id => document.querySelector("#" + id + " canvas").width));
  await page.setViewportSize({ width: VIEWPORT.width, height: VIEWPORT.height });
  check("both maps follow a window resize", narrow[0] < wide[0] && narrow[1] < wide[1],
    wide.join("/") + " → " + narrow.join("/") + " px");

  // The export's Milky Way against the canvas. At [180,55] orthographic the
  // export used to fill the complement (the canvas had the correction, the
  // export not); in mercator the south pole's -Infinity inverted the
  // background as well.
  for (const [prj, center] of [["orthographic", [180, 55, 0]], ["mercator", [0, 0, 0]]]) {
    await page.goto(blank, { waitUntil: "load" });
    const lum = await page.evaluate(async ([DATA, prj, center]) => {
      document.body.innerHTML = '<div id="celestial-map"></div>';
      const C = (await import("/build/celestial.mjs")).default;
      C.display({ container: "celestial-map", width: 600, datapath: DATA, projection: prj, center,
        interactive: false, form: false, controls: false, location: false, follow: "center",
        disableAnimations: true, orientationfixed: false,
        stars: { show: false }, dsos: { show: false }, planets: { show: false },
        constellations: { names: false, lines: false, bounds: false },
        lines: { graticule: { show: false }, equatorial: { show: false }, ecliptic: { show: false },
                 galactic: { show: false }, supergalactic: { show: false } },
        mw: { show: true }, background: { fill: "#000000", stroke: "#000000", opacity: 1 } });
      await new Promise(r => setTimeout(r, 4000));
      const mean = (ctx, w, h) => { const d = ctx.getImageData(0, 0, w, h).data; let s = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i + 3]) { s += (d[i] + d[i + 1] + d[i + 2]) / 3; n++; }
        return s / Math.max(n, 1); };
      const cv = document.querySelector("#celestial-map canvas");
      const svg = await new Promise(ok => C.exportSVG(ok));
      const img = new Image();
      await new Promise((ok, ko) => { img.onload = ok; img.onerror = ko;
        img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); });
      const c2 = document.createElement("canvas"); c2.width = img.width; c2.height = img.height;
      c2.getContext("2d").drawImage(img, 0, 0);
      return [mean(cv.getContext("2d"), cv.width, cv.height), mean(c2.getContext("2d"), c2.width, c2.height)];
    }, [DATA, prj, center]);
    check(`SVG export: ${prj} Milky Way matches the canvas`, Math.abs(lum[0] - lum[1]) < 3,
      "mean brightness, canvas " + lum[0].toFixed(1) + ", SVG " + lum[1].toFixed(1));
  }

  // The date picker's hour field in the module build: in strict code a plain
  // pick() call has `this === undefined`, and `this.id` threw.
  await page.goto(blank, { waitUntil: "load" });
  const picked = await page.evaluate(async (DATA) => {
    document.body.innerHTML = '<div id="celestial-map"></div>';
    const C = (await import("/build/celestial.mjs")).default;
    C.display({ container: "celestial-map", width: 500, datapath: DATA, location: true, form: true,
      formFields: { location: true }, geopos: [47.5, 19.04], disableAnimations: true });
    await new Promise(r => setTimeout(r, 2500));
    const before = C.date().getHours();
    document.querySelector("#celestial-form #datetime").click();
    await new Promise(r => setTimeout(r, 700));
    const h = document.querySelector("#celestial-form #hr");
    h.value = String((before + 1) % 24); h.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise(r => setTimeout(r, 700));
    return [before, C.date().getHours()];
  }, DATA);
  check("the module build's date picker takes a new hour", picked[1] === (picked[0] + 1) % 24, picked.join(" → "));

  // A timezoneResolver that throws synchronously falls back to the estimate
  // from longitude, like one that rejects.
  await page.goto(blank, { waitUntil: "load" });
  const fallback = await page.evaluate(async (DATA) => {
    document.body.innerHTML = '<div id="celestial-map"></div>';
    const C = (await import("/build/celestial.mjs")).default;
    C.display({ container: "celestial-map", width: 500, datapath: DATA, location: true, form: true,
      formFields: { location: true }, geopos: [47.5, 19.04], disableAnimations: true,
      timezoneResolver: () => { throw new Error("offline"); } });
    await new Promise(r => setTimeout(r, 2000));
    try { C.location([35.68, 139.69]); } catch (e) { return "EXCEPTION: " + e.message; }
    await new Promise(r => setTimeout(r, 1000));
    return C.timezone();
  }, DATA);
  check("a resolver that throws falls back to the longitude estimate", fallback === 540,
    typeof fallback === "number" ? "offset " + fallback : fallback);

  // Daylight saving time: the browser's offset has to be the one of the
  // entered date, not of the day the page was loaded. Budapest, with a date
  // on the other side of the DST change from today, so the check bites in
  // any season.
  const ctx = await page.context().browser().newContext({ viewport: VIEWPORT, timezoneId: "Europe/Budapest" });
  const bp = await ctx.newPage();
  const bpErrors = [];
  bp.on("pageerror", e => bpErrors.push(String(e.message)));
  await bp.goto(blank, { waitUntil: "load" });
  const dst = await bp.evaluate(async (DATA) => {
    document.body.innerHTML = '<div id="celestial-map"></div>';
    const C = (await import("/build/celestial.mjs")).default;
    const summerNow = -new Date().getTimezoneOffset() === 120,
          when = new Date(Date.UTC(2026, summerNow ? 0 : 6, 15, 19, 0, 0)),
          zone = summerNow ? 60 : 120;
    C.display({ container: "celestial-map", width: 500, datapath: DATA, location: true, form: true,
      formFields: { location: true }, geopos: [47.5, 19.04], follow: "zenith", disableAnimations: true });
    await new Promise(r => setTimeout(r, 2000));
    C.skyview({ date: when, location: [47.5, 19.04], timezone: zone });
    await new Promise(r => setTimeout(r, 1000));
    const expected = C.horizontal.inverse(when, [90, 0], [47.5, 19.04]);
    return [C.zenith()[0], expected[0]];
  }, DATA);
  await ctx.close();
  check("the zenith is right across a daylight saving change",
    Math.abs(((dst[0] - dst[1]) % 360 + 540) % 360 - 180) < 0.05 && bpErrors.length === 0,
    "zenith RA " + dst[0].toFixed(2) + "°, expected " + dst[1].toFixed(2) + "°" + (bpErrors.length ? ", " + bpErrors[0] : ""));
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
