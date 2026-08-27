/* A Hold terminátorának geometriája — a #130 bejelentés látható tünete.
 *
 * A fázisszámítás (moon.js) helyes; a rajzoló viszont a terminátor-ellipszist
 * túl keskenyre veszi. A geometria zárt alakban ismert: a korongra vetített
 * terminátor fél-kistengelye a korong sugarának |cos(fázisszög)|-szerese, ami
 * a megvilágított hányaddal kifejezve |2·ph − 1|. Ez tehát mérhető, nem
 * ízlés kérdése.
 *
 * Mindkét rajzolót a valódi forrásból teszteljük: az SVG a visszaadott
 * útvonalból, a canvas egy rögzítő ctx-pótlékon keresztül.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { customSvgSymbols } from "../src/svg.js";
import { Canvas } from "../src/canvas.js";



const TOLERANCE = 0.02;   // a kódban lévő +0.01 elfajulás-védelem miatt

// A megvilágított hányad a kor (fázisszög) függvényében — ugyanaz a képlet,
// amit a moon.js is használ, és amit a rajzolók bemenetként kapnak.
const litFraction = ag => 0.5 * (1 - Math.cos(ag));
const expectedE = ag => Math.abs(2 * litFraction(ag) - 1);

const AGES = [0, 0.5, 1.0, Math.PI / 2, 2.0, 2.6, Math.PI, 3.7, 4.5, 3 * Math.PI / 2, 5.5, 6.0];

/* Az SVG-útvonal két ellipszisívet tartalmaz: az elsőt a korong pereme
 * (r,r), a másodikat a terminátor (r·e, r). A kettő hányadosa az e. */
function svgAxis(ag, size_) {
  const d = customSvgSymbols.get("crescent")(size_, ag);
  const arcs = [...d.matchAll(/a([\d.eE+-]+),([\d.eE+-]+)\s/g)].map(m => [+m[1], +m[2]]);
  assert.equal(arcs.length, 2, "két ellipszisívet vártunk: " + d);
  const r = arcs[0][0], rx = arcs[1][0];
  assert.ok(Math.abs(arcs[0][1] - r) < 1e-9, "a korong íve nem kör: " + d);
  return rx / r;
}

/* A canvas-rajzoló a ctx.scale(e, 1) hívással nyomja össze a terminátort. */
function canvasAxis(ag, size_) {
  let e = null;
  const ctx = {
    fillStyle: "#fff",
    save() {}, restore() {}, beginPath() {}, closePath() {}, fill() {}, stroke() {},
    moveTo() {}, lineTo() {}, arc() {},
    scale(x) { e = x; }
  };
  Canvas.symbol().type("crescent").size(size_).age(ag).position([0, 0])(ctx);
  assert.ok(e !== null, "a rajzoló nem hívott scale()-t");
  return e;
}

test("SVG: a terminátor-ellipszis a fázisnak megfelelő szélességű", () => {
  const bad = [];
  for (const ag of AGES) {
    const got = svgAxis(ag, 100), expected = expectedE(ag);
    if (Math.abs(got - expected) > TOLERANCE) {
      bad.push(`kor ${ag.toFixed(2)} rad (megvilágítottság ${litFraction(ag).toFixed(2)}): ` +
                   `e=${got.toFixed(3)}, várt ${expected.toFixed(3)}`);
    }
  }
  assert.deepEqual(bad, []);
});

test("canvas: ugyanaz a geometria, mint az SVG-ben", () => {
  const bad = [];
  for (const ag of AGES) {
    const got = canvasAxis(ag, 100), expected = expectedE(ag);
    if (Math.abs(got - expected) > TOLERANCE) {
      bad.push(`kor ${ag.toFixed(2)} rad: e=${got.toFixed(3)}, várt ${expected.toFixed(3)}`);
    }
  }
  assert.deepEqual(bad, []);
});

test("telihold: a terminátor a korong peremén van, nem beljebb (#130)", () => {
  // Ez a bejelentés lényege: teliholdkor gibbusz látszik telihold helyett.
  assert.ok(Math.abs(svgAxis(Math.PI, 100) - 1) < TOLERANCE, "SVG telihold nem full korong");
  assert.ok(Math.abs(canvasAxis(Math.PI, 100) - 1) < TOLERANCE, "canvas telihold nem full korong");
});

test("újhold: a megvilágított rész eltűnik", () => {
  assert.ok(Math.abs(svgAxis(0, 100) - 1) < TOLERANCE);
  assert.ok(Math.abs(canvasAxis(0, 100) - 1) < TOLERANCE);
});

test("negyed: a terminátor egyenes (elfajuló ellipszis)", () => {
  for (const ag of [Math.PI / 2, 3 * Math.PI / 2]) {
    assert.ok(svgAxis(ag, 100) < TOLERANCE, "SVG negyed e=" + svgAxis(ag, 100));
    assert.ok(canvasAxis(ag, 100) < TOLERANCE, "canvas negyed e=" + canvasAxis(ag, 100));
  }
});

test("a két rajzoló ugyanazt az e-t adja minden fázisra", () => {
  for (const ag of AGES) {
    assert.ok(Math.abs(svgAxis(ag, 100) - canvasAxis(ag, 100)) < 1e-9,
      `eltérnek ${ag}-nál: ${svgAxis(ag, 100)} vs ${canvasAxis(ag, 100)}`);
  }
});
