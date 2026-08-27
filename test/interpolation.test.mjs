/* A középpont animált átállításának interpolációja — az #157 issue
 * ("Changing center by 12 hours interpolates badly") numerikus tesztté fordítása.
 *
 * A bejelentés: a Center mezőt 0h-ról 12h-ra állítva a térkép néhány
 * másodpercig ugrál-villog, 11h-nál viszont simán mozog.
 *
 * 12h = 180° rektaszcenzió. A középpont lat = 0 mellett a kiindulási pont
 * PONTOS antipódusa. A rotate() a hosszúságot+szélességet nagykörön
 * (d3.geoInterpolate), az orientációt külön (interpolateAngle) interpolálja.
 * A nagykör antipodális végpontoknál nincs egyértelműen meghatározva, és a
 * d3 slerp képlete ilyenkor numerikusan szétesik.
 *
 * A celestial.js:341 rowában van egy védőág pontosan erre az esetre
 * ("180deg turn doesn't work well"), de a küszöbe elérhetetlen — ezt méri az
 * első blokk.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { geoInterpolate, geoDistance } from "d3-geo";
import { Round, interpolateAngle } from "../src/util.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const rad2fok = r => r * 180 / Math.PI;

// ---------------------------------------------------------------------------
// 1. A 180°-os védőág elérhetetlen (celestial.js:327 és :341)
// ---------------------------------------------------------------------------

/* A forrásból olvassuk out a küszöböt, hogy a teszt a javítás urlPathán magától
 * zöldre váltson, és ne kelljen a számot két helyen karbantartani. */
function readGuard() {
  const forras = fs.readFileSync(path.join(ROOT, "src/celestial.js"), "utf8");
  const m = forras.match(/if\s*\(d\s*(>=?)\s*([\d.]+)\)[^\n]*180deg/);
  assert.ok(m, "a 180deg-es védőág nem található a celestial.js-ben");
  return { operator: m[1], threshold: parseFloat(m[2]) };
}

test("a rotate() a szögtávolságot 2 tizedesre kerekíti (celestial.js:327)", () => {
  // var d = Round(d3.geoDistance(cFrom, cfg.center), 2);
  const d = Round(geoDistance([0, 0], [180, 0]), 2);
  assert.equal(d, 3.14, "a 12h-s fordulat kerekített szögtávolsága");
  // A gömbi távolság sose több π-nél, így a kerekített érték maximuma 3.14.
  let max = 0;
  for (let fok = 179; fok <= 180; fok += 0.001) {
    max = Math.max(max, Round(geoDistance([0, 0], [fok, 0]), 2));
  }
  assert.equal(max, 3.14, "Round(d,2) elérhető maximuma");
});

test("a 180deg-es védőág tüzel a pontosan antipodális esetben", () => {
  const { operator, threshold } = readGuard();
  const d = Round(geoDistance([0, 0], [180, 0]), 2); // = 3.14
  const fires = operator === ">=" ? d >= threshold : d > threshold;
  assert.ok(fires,
    `a védőág "d ${operator} ${threshold}" nem tüzel d=${d} mellett — ` +
    `Round(π,2)=3.14, ezért a "d > 3.14" condétel SOHA nem fullül`);
});

test("a védőág nem tüzel a jól működő 11h-s (165°) fordulatnál", () => {
  const { operator, threshold } = readGuard();
  const d = Round(geoDistance([0, 0], [165, 0]), 2);
  const fires = operator === ">=" ? d >= threshold : d > threshold;
  assert.equal(fires, false, `d=${d} (165°) nem antipodális, nem kell megbökni`);
});

// ---------------------------------------------------------------------------
// 2. interpolateAngle (valós forrás) — az orientáció NEM okoz káoszt
// ---------------------------------------------------------------------------

test("interpolateAngle a rövidebb ívet választja a 0/360 határon át", () => {
  // 350°-ot -10°-ra írja át, így a 0-n át a 20°-os rövid ívet járja be,
  // nem a 340°-osat.
  const f = interpolateAngle(350, 10);
  assert.equal(Round(f(0.5), 6), 0, "350°→10° felezőpontja 0°");
  assert.equal(Round(f(0), 6), -10, `t=0 → ${f(0)}`);
  assert.ok(f(0.25) > -10 && f(0.25) < 0, `t=0.25 → ${f(0.25)}`);
});

test("interpolateAngle 180°-nál egyértelmű irányt választ, monoton marad", () => {
  // Itt is kétértelmű a forgásirány, de a függvény determinisztikusan a
  // pozitív irányt veszi, és lineáris marad — se ugrálás, se NaN.
  const f = interpolateAngle(0, 180);
  const values_ = [0, 0.25, 0.5, 0.75, 1].map(f);
  assert.deepEqual(values_.map(v => Round(v, 6)), [0, 45, 90, 135, 180]);
  for (let i = 1; i < values_.length; i++) {
    assert.ok(values_[i] > values_[i - 1], "monoton növekvő");
  }
});

test("interpolateAngle 180°-on túl már a rövidebb, negatív irányba fordul", () => {
  const f = interpolateAngle(0, 181);
  assert.ok(f(0.5) < 0, `181°-hoz a -89.5° felé kellene menni, got: ${f(0.5)}`);
});

// ---------------------------------------------------------------------------
// 3. A rotate() középpont-interpolátora — a tényleges error_
// ---------------------------------------------------------------------------

/* FIGYELEM — MÁSOLAT: a rotate() a Celestial.display() closure-jében él
 * (celestial.js:316), így Node-ból nem tölthető be. Az alábbi függvény a
 * celestial.js:327–345 rows középpont-interpolációra vonatkozó részének
 * szó szerinti újrajátszása. A benne használt Round a VALÓS forrásból jön,
 * a geoInterpolate/geoDistance pedig ugyanaz a d3-függvény, amit a forrás hív
 * (a d3 v3 d3.geo.interpolate és a d3 v7 geoInterpolate algoritmusa same:
 * upstream/lib/d3.js:4623 vs node_modules/d3-geo/src/interpolate.js).
 *
 * `mod`:
 *   "jelenlegi" – a mai kód: if (d > 3.14) cfg.center[0] -= 0.01;
 *   "javitott"  – if (d >= 3.14) cFrom = [cFrom[0] + 0.01, ...];
 */
function centerTween(cFrom, cTo, mod) {
  let f = cFrom.slice(), t = cTo.slice();
  const d = Round(geoDistance(cFrom, cTo), 2);
  if (mod === "jelenlegi") { if (d > 3.14) t[0] -= 0.01; }
  else { if (d >= 3.14) f = [f[0] + 0.01, f[1], f[2]]; }
  return { d, tween: d === 0 ? () => t : geoInterpolate(f, t), cel: cTo };
}

/* Mérőszámok egy animáció lefutására: a köztes lépések szöghossza ideálisan
 * egyenletes. Az egyenetlenség (max/min) a "ugrálás" mértéke. */
function animationMetrics(cFrom, cTo, mod, lepesek = 20) {
  const { tween, cel } = centerTween(cFrom, cTo, mod);
  const points_ = [];
  for (let i = 0; i <= lepesek; i++) points_.push(tween(i / lepesek));
  const stepLength = [];
  for (let i = 1; i < points_.length; i++) {
    stepLength.push(rad2fok(geoDistance(points_[i - 1], points_[i])));
  }
  const min = Math.min(...stepLength), max = Math.max(...stepLength);
  return {
    points_,
    minStep: min,
    maxSteps: max,
    unevenness: max / min,
    endpointError: rad2fok(geoDistance(points_[points_.length - 1], cel))
  };
}

test("11h-s fordulat (165°) today_ is sima — kontrollcsoport", () => {
  const m = animationMetrics([0, 0, 0], [165, 0, 0], "jelenlegi");
  assert.ok(m.unevenness < 1.001,
    `165°: a lépéshosszak egyenetlensége ${m.unevenness.toFixed(4)}`);
});

test("12h-s fordulat (pontosan 180°) MA szétesik — az #157 reprodukciója", () => {
  const m = animationMetrics([0, 0, 0], [180, 0, 0], "jelenlegi");
  // Ideálisan minden lépés 9° (180°/20). A valóságban 0°…54.7° között szórnak.
  assert.ok(m.unevenness > 5,
    `a error_ nem reprodukálható: egyenetlenség ${m.unevenness.toFixed(2)}, ` +
    `lépések ${m.minStep.toFixed(2)}°…${m.maxSteps.toFixed(2)}°`);

  // A hosszúság a jó esetben monoton nő 0°→180°; today_ oda-back ugrál.
  const lon = m.points_.map(p => p[0]);
  let regression = 0;
  for (let i = 1; i < lon.length; i++) if (lon[i] < lon[i - 1]) regression++;
  assert.ok(regression > 0,
    "a középpont hosszúsága nem monoton — az animáció visszaugrál");
});

test("12h-s fordulat a javított védőággal sima lesz", () => {
  const m = animationMetrics([0, 0, 0], [180, 0, 0], "javitott");
  assert.ok(m.unevenness < 1.001,
    `javítva: egyenetlenség ${m.unevenness.toFixed(4)}`);
  const lon = m.points_.map(p => p[0]);
  for (let i = 1; i < lon.length; i++) {
    assert.ok(lon[i] > lon[i - 1], `a hosszúság nem monoton a ${i}. lépésnél`);
  }
});

test("a javítás pontosan a kért középpontban áll meg", () => {
  // A meglévő hack a CÉLT bökte meg (cfg.center[0] -= 0.01), ami 0.01°-os
  // maradandó hibát hagy a konfigban; a start megbökése nem.
  const j = animationMetrics([0, 0, 0], [180, 0, 0], "javitott");
  assert.ok(j.endpointError < 1e-9,
    `a végpont ${j.endpointError.toFixed(5)}°-kal tér el a kért középponttól`);
});

test("szélességből adódó antipódus is javul (0°,30° → 180°,-30°)", () => {
  const today_ = animationMetrics([0, 30, 0], [180, -30, 0], "jelenlegi");
  const newer = animationMetrics([0, 30, 0], [180, -30, 0], "javitott");
  assert.ok(today_.unevenness > 5, `today_: ${today_.unevenness.toFixed(2)}`);
  assert.ok(newer.unevenness < 1.001, `javítva: ${newer.unevenness.toFixed(4)}`);
});

test("ISMERT KORLÁT: pólus-antipódus a hosszúság megbökésével nem javul", () => {
  // [0,90] és [180,-90] antipodális, de a hosszúság elforgatása a póluson
  // semmit nem változtat. A javítás ezt az esetet nem fedi le.
  const newer = animationMetrics([0, 90, 0], [180, -90, 0], "javitott");
  assert.ok(newer.unevenness > 5,
    "ha ez zöldre vált, a pólus-eset is megoldódott — a teszt frissíthető");
});
