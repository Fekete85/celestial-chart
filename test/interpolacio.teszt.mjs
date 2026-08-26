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
 * A celestial.js:341 sorában van egy védőág pontosan erre az esetre
 * ("180deg turn doesn't work well"), de a küszöbe elérhetetlen — ezt méri az
 * első blokk.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { geoInterpolate, geoDistance } from "d3";
import { betolt } from "./betolt.mjs";

const GYOKER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* Valós forrás. A transform.js a τ / deg2rad konstansok miatt kell. */
const { Round, interpolateAngle } = betolt(
  ["src/transform.js", "src/util.js"], ["Round", "interpolateAngle"]);

/* Az interpolateAngle a d3.interpolateNumber-t hívja. A betolt() vm-kontextusa
 * nem ismer d3-at, ezért a vm SAJÁT Function konstruktorán keresztül teszünk be
 * egy minimális pótlékot — így a tesztelt függvénytörzs a valódi forrás marad. */
new interpolateAngle.constructor("v", "d3 = v;")({
  interpolateNumber: (a, b) => t => a * (1 - t) + b * t
});

const rad2fok = r => r * 180 / Math.PI;

// ---------------------------------------------------------------------------
// 1. A 180°-os védőág elérhetetlen (celestial.js:327 és :341)
// ---------------------------------------------------------------------------

/* A forrásból olvassuk ki a küszöböt, hogy a teszt a javítás után magától
 * zöldre váltson, és ne kelljen a számot két helyen karbantartani. */
function vedoagKiolvasasa() {
  const forras = fs.readFileSync(path.join(GYOKER, "src/celestial.js"), "utf8");
  const m = forras.match(/if\s*\(d\s*(>=?)\s*([\d.]+)\)[^\n]*180deg/);
  assert.ok(m, "a 180deg-es védőág nem található a celestial.js-ben");
  return { operator: m[1], kuszob: parseFloat(m[2]) };
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
  const { operator, kuszob } = vedoagKiolvasasa();
  const d = Round(geoDistance([0, 0], [180, 0]), 2); // = 3.14
  const tuzel = operator === ">=" ? d >= kuszob : d > kuszob;
  assert.ok(tuzel,
    `a védőág "d ${operator} ${kuszob}" nem tüzel d=${d} mellett — ` +
    `Round(π,2)=3.14, ezért a "d > 3.14" feltétel SOHA nem teljesül`);
});

test("a védőág nem tüzel a jól működő 11h-s (165°) fordulatnál", () => {
  const { operator, kuszob } = vedoagKiolvasasa();
  const d = Round(geoDistance([0, 0], [165, 0]), 2);
  const tuzel = operator === ">=" ? d >= kuszob : d > kuszob;
  assert.equal(tuzel, false, `d=${d} (165°) nem antipodális, nem kell megbökni`);
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
  const ertekek = [0, 0.25, 0.5, 0.75, 1].map(f);
  assert.deepEqual(ertekek.map(v => Round(v, 6)), [0, 45, 90, 135, 180]);
  for (let i = 1; i < ertekek.length; i++) {
    assert.ok(ertekek[i] > ertekek[i - 1], "monoton növekvő");
  }
});

test("interpolateAngle 180°-on túl már a rövidebb, negatív irányba fordul", () => {
  const f = interpolateAngle(0, 181);
  assert.ok(f(0.5) < 0, `181°-hoz a -89.5° felé kellene menni, kapott: ${f(0.5)}`);
});

// ---------------------------------------------------------------------------
// 3. A rotate() középpont-interpolátora — a tényleges hiba
// ---------------------------------------------------------------------------

/* FIGYELEM — MÁSOLAT: a rotate() a Celestial.display() closure-jében él
 * (celestial.js:316), így Node-ból nem tölthető be. Az alábbi függvény a
 * celestial.js:327–345 sorok középpont-interpolációra vonatkozó részének
 * szó szerinti újrajátszása. A benne használt Round a VALÓS forrásból jön,
 * a geoInterpolate/geoDistance pedig ugyanaz a d3-függvény, amit a forrás hív
 * (a d3 v3 d3.geo.interpolate és a d3 v7 geoInterpolate algoritmusa azonos:
 * upstream/lib/d3.js:4623 vs node_modules/d3-geo/src/interpolate.js).
 *
 * `mod`:
 *   "jelenlegi" – a mai kód: if (d > 3.14) cfg.center[0] -= 0.01;
 *   "javitott"  – if (d >= 3.14) cFrom = [cFrom[0] + 0.01, ...];
 */
function kozeppontTween(cFrom, cTo, mod) {
  let f = cFrom.slice(), t = cTo.slice();
  const d = Round(geoDistance(cFrom, cTo), 2);
  if (mod === "jelenlegi") { if (d > 3.14) t[0] -= 0.01; }
  else { if (d >= 3.14) f = [f[0] + 0.01, f[1], f[2]]; }
  return { d, tween: d === 0 ? () => t : geoInterpolate(f, t), cel: cTo };
}

/* Mérőszámok egy animáció lefutására: a köztes lépések szöghossza ideálisan
 * egyenletes. Az egyenetlenség (max/min) a "ugrálás" mértéke. */
function animacioMeroszamai(cFrom, cTo, mod, lepesek = 20) {
  const { tween, cel } = kozeppontTween(cFrom, cTo, mod);
  const pontok = [];
  for (let i = 0; i <= lepesek; i++) pontok.push(tween(i / lepesek));
  const lepeshossz = [];
  for (let i = 1; i < pontok.length; i++) {
    lepeshossz.push(rad2fok(geoDistance(pontok[i - 1], pontok[i])));
  }
  const min = Math.min(...lepeshossz), max = Math.max(...lepeshossz);
  return {
    pontok,
    minLepes: min,
    maxLepes: max,
    egyenetlenseg: max / min,
    vegpontHiba: rad2fok(geoDistance(pontok[pontok.length - 1], cel))
  };
}

test("11h-s fordulat (165°) ma is sima — kontrollcsoport", () => {
  const m = animacioMeroszamai([0, 0, 0], [165, 0, 0], "jelenlegi");
  assert.ok(m.egyenetlenseg < 1.001,
    `165°: a lépéshosszak egyenetlensége ${m.egyenetlenseg.toFixed(4)}`);
});

test("12h-s fordulat (pontosan 180°) MA szétesik — az #157 reprodukciója", () => {
  const m = animacioMeroszamai([0, 0, 0], [180, 0, 0], "jelenlegi");
  // Ideálisan minden lépés 9° (180°/20). A valóságban 0°…54.7° között szórnak.
  assert.ok(m.egyenetlenseg > 5,
    `a hiba nem reprodukálható: egyenetlenség ${m.egyenetlenseg.toFixed(2)}, ` +
    `lépések ${m.minLepes.toFixed(2)}°…${m.maxLepes.toFixed(2)}°`);

  // A hosszúság a jó esetben monoton nő 0°→180°; ma oda-vissza ugrál.
  const lon = m.pontok.map(p => p[0]);
  let visszalepes = 0;
  for (let i = 1; i < lon.length; i++) if (lon[i] < lon[i - 1]) visszalepes++;
  assert.ok(visszalepes > 0,
    "a középpont hosszúsága nem monoton — az animáció visszaugrál");
});

test("12h-s fordulat a javított védőággal sima lesz", () => {
  const m = animacioMeroszamai([0, 0, 0], [180, 0, 0], "javitott");
  assert.ok(m.egyenetlenseg < 1.001,
    `javítva: egyenetlenség ${m.egyenetlenseg.toFixed(4)}`);
  const lon = m.pontok.map(p => p[0]);
  for (let i = 1; i < lon.length; i++) {
    assert.ok(lon[i] > lon[i - 1], `a hosszúság nem monoton a ${i}. lépésnél`);
  }
});

test("a javítás pontosan a kért középpontban áll meg", () => {
  // A meglévő hack a CÉLT bökte meg (cfg.center[0] -= 0.01), ami 0.01°-os
  // maradandó hibát hagy a konfigban; a start megbökése nem.
  const j = animacioMeroszamai([0, 0, 0], [180, 0, 0], "javitott");
  assert.ok(j.vegpontHiba < 1e-9,
    `a végpont ${j.vegpontHiba.toFixed(5)}°-kal tér el a kért középponttól`);
});

test("szélességből adódó antipódus is javul (0°,30° → 180°,-30°)", () => {
  const ma = animacioMeroszamai([0, 30, 0], [180, -30, 0], "jelenlegi");
  const uj = animacioMeroszamai([0, 30, 0], [180, -30, 0], "javitott");
  assert.ok(ma.egyenetlenseg > 5, `ma: ${ma.egyenetlenseg.toFixed(2)}`);
  assert.ok(uj.egyenetlenseg < 1.001, `javítva: ${uj.egyenetlenseg.toFixed(4)}`);
});

test("ISMERT KORLÁT: pólus-antipódus a hosszúság megbökésével nem javul", () => {
  // [0,90] és [180,-90] antipodális, de a hosszúság elforgatása a póluson
  // semmit nem változtat. A javítás ezt az esetet nem fedi le.
  const uj = animacioMeroszamai([0, 90, 0], [180, -90, 0], "javitott");
  assert.ok(uj.egyenetlenseg > 5,
    "ha ez zöldre vált, a pólus-eset is megoldódott — a teszt frissíthető");
});
