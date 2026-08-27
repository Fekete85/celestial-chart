/* Replacing the projections that were dropped from d3-geo-projection v4.
 *
 * `hatano` and `wagner7` were there in the v3 plugin, in v4 they have no
 * exported raw function. The replacement is a verbatim carry-over of the v3
 * formulas — and this test is what proves it: we measure against values taken
 * from the pinned v3 build.
 *
 * The reference values come from the pinned plugin under `harness/vendor/`,
 * measured in the browser (test/projection-reference-d3v3.json).
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as d3 from "d3-geo";
import * as gp from "d3-geo-projection";
import { Celestial } from "../src/core.js";
import { rawProjection } from "../src/projection.js";

const ref = JSON.parse(fs.readFileSync(new URL("./projection-reference-d3v3.json", import.meta.url)));
const D3 = Object.assign({}, d3, gp);

const TOLERANCE = 1e-10;

// twoPointEquidistant is the exception: the first thing the v4 raw does is
// `z0 *= 2`, which is why we pass the config value halved. The round trip leaves
// ~1e-9 of floating-point noise — on this very projection the reference net
// measures a 0.000 pixel difference.
const SPECIAL_TOLERANCE = { twoPointEquidistant: 1e-8 };
const rad = f => f * Math.PI / 180;

/* We call the library's own resolver — the same one Celestial.projection() uses.
 * That way the test covers the name resolution, the replacement raws and the
 * parameter conversion as well, not just the formulas. */
const ARG = { hatano: null, wagner7: null, mercator: null, wiechel: null,
              healpix: 1, twoPointEquidistant: Math.PI / 2 };

function raw(name_) {
  const r = rawProjection(name_, ARG[name_]);
  assert.ok(typeof r === "function", name_ + ": no raw");
  return r;
}

for (const name_ of Object.keys(ref.projections)) {
  test(`${name_}: the projected coordinates match the v3 output`, () => {
    const p = raw(name_);
    const expected = ref.projections[name_].forward;
    const rad = f => f * Math.PI / 180;
    let maxDelta = 0, bad = null;
    ref.points.forEach(([lo, la], i) => {
      const got = p(rad(lo), rad(la));
      const d = Math.max(Math.abs(got[0] - expected[i][0]), Math.abs(got[1] - expected[i][1]));
      if (d > maxDelta) { maxDelta = d; bad = `[${lo},${la}] v3=${expected[i]} new=${got}`; }
    });
    const tolerance = SPECIAL_TOLERANCE[name_] || TOLERANCE;
    assert.ok(maxDelta < tolerance, `max difference ${maxDelta} (tolerance ${tolerance}), e.g. ${bad}`);
  });
}

test("the replaced projections really do build", () => {
  for (const name_ of ["hatano", "wagner7", "healpix"]) {
    const prj = Celestial.projection(name_);
    assert.equal(typeof prj, "function", name_ + " did not build");
    assert.ok(Number.isFinite(prj([10, 20])[0]), name_ + " does not return a number");
  }
});

test("the inverse gives back the starting point", () => {
  for (const name_ of ["hatano", "wagner7", "healpix", "wiechel"]) {
    const prj = Celestial.projection(name_);
    for (const [lo, la] of [[0, 0], [45, 30], [-120, -60], [170, 10]]) {
      const back = prj.invert(prj([lo, la]));
      assert.ok(Math.abs(back[0] - lo) < 1e-6 && Math.abs(back[1] - la) < 1e-6,
        `${name_} [${lo},${la}] -> ${back}`);
    }
  }
});

test("d3-geo-projection v4 really has no raw for these", () => {
  // If a future version supplies them, this test speaks up to say that our own
  // copy can be dropped.
  assert.equal(D3.geoHatanoRaw, undefined, "geoHatanoRaw has appeared — the replacement can be dropped");
  assert.equal(D3.geoWagner7Raw, undefined, "geoWagner7Raw has appeared — the replacement can be dropped");
});

test("the v4 healpix really is at a different scale — that is why we keep our own copy", () => {
  // If a future version reverts to the v3 normalisation, this test speaks up.
  const v4 = D3.geoHealpixRaw(1);
  const ours = Celestial.projection("healpix").scale(1).translate([0, 0]);
  const p4 = v4(0.5, 0.3);
  const pm = ours([0.5 * 180 / Math.PI, 0.3 * 180 / Math.PI]);
  assert.ok(Math.abs(Math.abs(pm[0]) - Math.abs(p4[0])) > 1e-6,
    "the v4 healpix now gives the same result — our own copy can be dropped");
});

test("reflectX does not replace the raw wrapping for every projection", () => {
  // This is the justification of the decision: for wiechel the sign of λ matters
  // inside the formula as well, so we keep the v3-faithful wrapping. If this
  // test fails, we can switch over to reflectX.
  const raw = D3.geoWiechelRaw;
  const wrapped = d3.geoProjection((l, f) => raw(-l, f)).scale(200).translate([400, 400]);
  const reflected = d3.geoProjection(raw).scale(200).translate([400, 400]).reflectX(true);
  let max = 0;
  for (let lo = -170; lo < 180; lo += 11) for (let la = -85; la <= 85; la += 7) {
    const a = wrapped([lo, la]), b = reflected([lo, la]);
    if (!a || !b) continue;
    max = Math.max(max, Math.hypot(a[0] - b[0], a[1] - b[1]));
  }
  assert.ok(max > 1, `for wiechel the two now agree (max ${max}) — reflectX could be the simplification`);
});
