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



const TURES = 0.02;   // a kódban lévő +0.01 elfajulás-védelem miatt

// A megvilágított hányad a kor (fázisszög) függvényében — ugyanaz a képlet,
// amit a moon.js is használ, és amit a rajzolók bemenetként kapnak.
const hanyad = ag => 0.5 * (1 - Math.cos(ag));
const varhatoE = ag => Math.abs(2 * hanyad(ag) - 1);

const KOROK = [0, 0.5, 1.0, Math.PI / 2, 2.0, 2.6, Math.PI, 3.7, 4.5, 3 * Math.PI / 2, 5.5, 6.0];

/* Az SVG-útvonal két ellipszisívet tartalmaz: az elsőt a korong pereme
 * (r,r), a másodikat a terminátor (r·e, r). A kettő hányadosa az e. */
function svgE(ag, meret) {
  const d = customSvgSymbols.get("crescent")(meret, ag);
  const ivek = [...d.matchAll(/a([\d.eE+-]+),([\d.eE+-]+)\s/g)].map(m => [+m[1], +m[2]]);
  assert.equal(ivek.length, 2, "két ellipszisívet vártunk: " + d);
  const r = ivek[0][0], rx = ivek[1][0];
  assert.ok(Math.abs(ivek[0][1] - r) < 1e-9, "a korong íve nem kör: " + d);
  return rx / r;
}

/* A canvas-rajzoló a ctx.scale(e, 1) hívással nyomja össze a terminátort. */
function canvasE(ag, meret) {
  let e = null;
  const ctx = {
    fillStyle: "#fff",
    save() {}, restore() {}, beginPath() {}, closePath() {}, fill() {}, stroke() {},
    moveTo() {}, lineTo() {}, arc() {},
    scale(x) { e = x; }
  };
  Canvas.symbol().type("crescent").size(meret).age(ag).position([0, 0])(ctx);
  assert.ok(e !== null, "a rajzoló nem hívott scale()-t");
  return e;
}

test("SVG: a terminátor-ellipszis a fázisnak megfelelő szélességű", () => {
  const rosszak = [];
  for (const ag of KOROK) {
    const kapott = svgE(ag, 100), vart = varhatoE(ag);
    if (Math.abs(kapott - vart) > TURES) {
      rosszak.push(`kor ${ag.toFixed(2)} rad (megvilágítottság ${hanyad(ag).toFixed(2)}): ` +
                   `e=${kapott.toFixed(3)}, várt ${vart.toFixed(3)}`);
    }
  }
  assert.deepEqual(rosszak, []);
});

test("canvas: ugyanaz a geometria, mint az SVG-ben", () => {
  const rosszak = [];
  for (const ag of KOROK) {
    const kapott = canvasE(ag, 100), vart = varhatoE(ag);
    if (Math.abs(kapott - vart) > TURES) {
      rosszak.push(`kor ${ag.toFixed(2)} rad: e=${kapott.toFixed(3)}, várt ${vart.toFixed(3)}`);
    }
  }
  assert.deepEqual(rosszak, []);
});

test("telihold: a terminátor a korong peremén van, nem beljebb (#130)", () => {
  // Ez a bejelentés lényege: teliholdkor gibbusz látszik telihold helyett.
  assert.ok(Math.abs(svgE(Math.PI, 100) - 1) < TURES, "SVG telihold nem teljes korong");
  assert.ok(Math.abs(canvasE(Math.PI, 100) - 1) < TURES, "canvas telihold nem teljes korong");
});

test("újhold: a megvilágított rész eltűnik", () => {
  assert.ok(Math.abs(svgE(0, 100) - 1) < TURES);
  assert.ok(Math.abs(canvasE(0, 100) - 1) < TURES);
});

test("negyed: a terminátor egyenes (elfajuló ellipszis)", () => {
  for (const ag of [Math.PI / 2, 3 * Math.PI / 2]) {
    assert.ok(svgE(ag, 100) < TURES, "SVG negyed e=" + svgE(ag, 100));
    assert.ok(canvasE(ag, 100) < TURES, "canvas negyed e=" + canvasE(ag, 100));
  }
});

test("a két rajzoló ugyanazt az e-t adja minden fázisra", () => {
  for (const ag of KOROK) {
    assert.ok(Math.abs(svgE(ag, 100) - canvasE(ag, 100)) < 1e-9,
      `eltérnek ${ag}-nál: ${svgE(ag, 100)} vs ${canvasE(ag, 100)}`);
  }
});
