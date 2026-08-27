/* Geometry of the Moon's terminator — the visible symptom of report #130.
 *
 * The phase computation (moon.js) is correct; the renderer, however, draws the
 * terminator ellipse too narrow. The geometry is known in closed form: the
 * semi-minor axis of the terminator projected onto the disc is |cos(phase
 * angle)| times the radius of the disc, which — expressed with the illuminated
 * fraction — is |2·ph − 1|. So this is measurable, not a matter of taste.
 *
 * We test both renderers against the real source: the SVG one through the path
 * it returns, the canvas one through a recording ctx stand-in.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { customSvgSymbols } from "../src/svg.js";
import { Canvas } from "../src/canvas.js";



const TOLERANCE = 0.02;   // because of the +0.01 degeneracy guard in the code

// The illuminated fraction as a function of the age (phase angle) — the same
// formula moon.js uses, and the one the renderers receive as their input.
const litFraction = ag => 0.5 * (1 - Math.cos(ag));
const expectedE = ag => Math.abs(2 * litFraction(ag) - 1);

const AGES = [0, 0.5, 1.0, Math.PI / 2, 2.0, 2.6, Math.PI, 3.7, 4.5, 3 * Math.PI / 2, 5.5, 6.0];

/* The SVG path contains two elliptical arcs: the first is the rim of the disc
 * (r,r), the second the terminator (r·e, r). Their ratio is e. */
function svgAxis(ag, size_) {
  const d = customSvgSymbols.get("crescent")(size_, ag);
  const arcs = [...d.matchAll(/a([\d.eE+-]+),([\d.eE+-]+)\s/g)].map(m => [+m[1], +m[2]]);
  assert.equal(arcs.length, 2, "two elliptical arcs expected: " + d);
  const r = arcs[0][0], rx = arcs[1][0];
  assert.ok(Math.abs(arcs[0][1] - r) < 1e-9, "the arc of the disc is not a circle: " + d);
  return rx / r;
}

/* The canvas renderer squeezes the terminator with the ctx.scale(e, 1) call. */
function canvasAxis(ag, size_) {
  let e = null;
  const ctx = {
    fillStyle: "#fff",
    save() {}, restore() {}, beginPath() {}, closePath() {}, fill() {}, stroke() {},
    moveTo() {}, lineTo() {}, arc() {},
    scale(x) { e = x; }
  };
  Canvas.symbol().type("crescent").size(size_).age(ag).position([0, 0])(ctx);
  assert.ok(e !== null, "the renderer did not call scale()");
  return e;
}

test("SVG: the terminator ellipse is as wide as the phase requires", () => {
  const bad = [];
  for (const ag of AGES) {
    const got = svgAxis(ag, 100), expected = expectedE(ag);
    if (Math.abs(got - expected) > TOLERANCE) {
      bad.push(`age ${ag.toFixed(2)} rad (illuminated fraction ${litFraction(ag).toFixed(2)}): ` +
                   `e=${got.toFixed(3)}, expected ${expected.toFixed(3)}`);
    }
  }
  assert.deepEqual(bad, []);
});

test("canvas: the same geometry as in the SVG", () => {
  const bad = [];
  for (const ag of AGES) {
    const got = canvasAxis(ag, 100), expected = expectedE(ag);
    if (Math.abs(got - expected) > TOLERANCE) {
      bad.push(`age ${ag.toFixed(2)} rad: e=${got.toFixed(3)}, expected ${expected.toFixed(3)}`);
    }
  }
  assert.deepEqual(bad, []);
});

test("full moon: the terminator sits on the rim of the disc, not further in (#130)", () => {
  // This is what the report is about: at full moon a gibbous shape shows up instead of a full moon.
  assert.ok(Math.abs(svgAxis(Math.PI, 100) - 1) < TOLERANCE, "the SVG full moon is not a full disc");
  assert.ok(Math.abs(canvasAxis(Math.PI, 100) - 1) < TOLERANCE, "the canvas full moon is not a full disc");
});

test("new moon: the illuminated part disappears", () => {
  assert.ok(Math.abs(svgAxis(0, 100) - 1) < TOLERANCE);
  assert.ok(Math.abs(canvasAxis(0, 100) - 1) < TOLERANCE);
});

test("quarter: the terminator is a straight line (degenerate ellipse)", () => {
  for (const ag of [Math.PI / 2, 3 * Math.PI / 2]) {
    assert.ok(svgAxis(ag, 100) < TOLERANCE, "SVG quarter e=" + svgAxis(ag, 100));
    assert.ok(canvasAxis(ag, 100) < TOLERANCE, "canvas quarter e=" + canvasAxis(ag, 100));
  }
});

test("the two renderers give the same e for every phase", () => {
  for (const ag of AGES) {
    assert.ok(Math.abs(svgAxis(ag, 100) - canvasAxis(ag, 100)) < 1e-9,
      `they differ at ${ag}: ${svgAxis(ag, 100)} vs ${canvasAxis(ag, 100)}`);
  }
});
