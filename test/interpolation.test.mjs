/* Interpolation of the animated centre change — issue #157
 * ("Changing center by 12 hours interpolates badly") turned into a numeric test.
 *
 * The report: setting the Center field from 0h to 12h makes the map jump and
 * flicker for a few seconds, while at 11h it moves smoothly.
 *
 * 12h = 180° of right ascension. With lat = 0 the centre is the EXACT antipode
 * of the starting point. rotate() interpolates longitude+latitude along a great
 * circle (d3.geoInterpolate) and the orientation separately (interpolateAngle).
 * The great circle is not uniquely defined for antipodal endpoints, and d3's
 * slerp formula falls apart numerically in that case.
 *
 * Line 341 of celestial.js holds a guard branch for exactly this case
 * ("180deg turn doesn't work well"), but its threshold is unreachable — that is
 * what the first block measures.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { geoInterpolate, geoDistance } from "d3-geo";
import { Round, interpolateAngle } from "../src/util.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const radToDeg = r => r * 180 / Math.PI;

// ---------------------------------------------------------------------------
// 1. The 180° guard branch is unreachable (celestial.js:327 and :341)
// ---------------------------------------------------------------------------

/* We read the threshold out of the source, so that the test turns green by
 * itself once the fix lands, and so the number need not be kept in two places. */
function readGuard() {
  const src_ = fs.readFileSync(path.join(ROOT, "src/celestial.js"), "utf8");
  const m = src_.match(/if\s*\(d\s*(>=?)\s*([\d.]+)\)[^\n]*180deg/);
  assert.ok(m, "the 180deg guard branch is not found in celestial.js");
  return { operator: m[1], threshold: parseFloat(m[2]) };
}

test("rotate() rounds the angular distance to 2 decimals (celestial.js:327)", () => {
  // var d = Round(d3.geoDistance(cFrom, cfg.center), 2);
  const d = Round(geoDistance([0, 0], [180, 0]), 2);
  assert.equal(d, 3.14, "the rounded angular distance of the 12h turn");
  // The spherical distance is never more than π, so the maximum of the rounded value is 3.14.
  let max = 0;
  for (let deg = 179; deg <= 180; deg += 0.001) {
    max = Math.max(max, Round(geoDistance([0, 0], [deg, 0]), 2));
  }
  assert.equal(max, 3.14, "the attainable maximum of Round(d,2)");
});

test("the 180deg guard branch fires in the exactly antipodal case", () => {
  const { operator, threshold } = readGuard();
  const d = Round(geoDistance([0, 0], [180, 0]), 2); // = 3.14
  const fires = operator === ">=" ? d >= threshold : d > threshold;
  assert.ok(fires,
    `the guard branch "d ${operator} ${threshold}" does not fire for d=${d} — ` +
    `Round(π,2)=3.14, so the condition "d > 3.14" can NEVER be satisfied`);
});

test("the guard branch does not fire for the 11h (165°) turn that works fine", () => {
  const { operator, threshold } = readGuard();
  const d = Round(geoDistance([0, 0], [165, 0]), 2);
  const fires = operator === ">=" ? d >= threshold : d > threshold;
  assert.equal(fires, false, `d=${d} (165°) is not antipodal, no nudge needed`);
});

// ---------------------------------------------------------------------------
// 2. interpolateAngle (the real source) — the orientation does NOT cause chaos
// ---------------------------------------------------------------------------

test("interpolateAngle takes the shorter arc across the 0/360 boundary", () => {
  // It rewrites 350° as -10°, so it travels the short 20° arc through 0,
  // not the 340° one.
  const f = interpolateAngle(350, 10);
  assert.equal(Round(f(0.5), 6), 0, "the midpoint of 350°→10° is 0°");
  assert.equal(Round(f(0), 6), -10, `t=0 → ${f(0)}`);
  assert.ok(f(0.25) > -10 && f(0.25) < 0, `t=0.25 → ${f(0.25)}`);
});

test("at 180° interpolateAngle picks an unambiguous direction and stays monotone", () => {
  // The direction of rotation is ambiguous here too, but the function
  // deterministically takes the positive direction and stays linear — no
  // jumping, no NaN.
  const f = interpolateAngle(0, 180);
  const values_ = [0, 0.25, 0.5, 0.75, 1].map(f);
  assert.deepEqual(values_.map(v => Round(v, 6)), [0, 45, 90, 135, 180]);
  for (let i = 1; i < values_.length; i++) {
    assert.ok(values_[i] > values_[i - 1], "monotonically increasing");
  }
});

test("beyond 180° interpolateAngle already turns the shorter, negative way", () => {
  const f = interpolateAngle(0, 181);
  assert.ok(f(0.5) < 0, `for 181° it should head towards -89.5°, got: ${f(0.5)}`);
});

// ---------------------------------------------------------------------------
// 3. The centre interpolator of rotate() — the actual bug
// ---------------------------------------------------------------------------

/* CAUTION — COPY: rotate() lives in the closure of Celestial.display()
 * (celestial.js:316), so it cannot be loaded from Node. The function below is a
 * verbatim replay of the centre-interpolation part of lines 327–345 of
 * celestial.js. The Round it uses comes from the REAL source, and
 * geoInterpolate/geoDistance are the same d3 functions the source calls (the
 * algorithm of d3 v3's d3.geo.interpolate and d3 v7's geoInterpolate is
 * identical: upstream/lib/d3.js:4623 vs node_modules/d3-geo/src/interpolate.js).
 *
 * `mod`:
 *   "current" – today's code: if (d > 3.14) cfg.center[0] -= 0.01;
 *   "fixed"  – if (d >= 3.14) cFrom = [cFrom[0] + 0.01, ...];
 */
function centerTween(cFrom, cTo, mod) {
  let f = cFrom.slice(), t = cTo.slice();
  const d = Round(geoDistance(cFrom, cTo), 2);
  if (mod === "current") { if (d > 3.14) t[0] -= 0.01; }
  else { if (d >= 3.14) f = [f[0] + 0.01, f[1], f[2]]; }
  return { d, tween: d === 0 ? () => t : geoInterpolate(f, t), cel: cTo };
}

/* Metrics for one animation run: ideally the angular length of the intermediate
 * steps is uniform. The unevenness (max/min) is the measure of the "jumping". */
function animationMetrics(cFrom, cTo, mod, steps_ = 20) {
  const { tween, cel } = centerTween(cFrom, cTo, mod);
  const points_ = [];
  for (let i = 0; i <= steps_; i++) points_.push(tween(i / steps_));
  const stepLength = [];
  for (let i = 1; i < points_.length; i++) {
    stepLength.push(radToDeg(geoDistance(points_[i - 1], points_[i])));
  }
  const min = Math.min(...stepLength), max = Math.max(...stepLength);
  return {
    points_,
    minStep: min,
    maxSteps: max,
    unevenness: max / min,
    endpointError: radToDeg(geoDistance(points_[points_.length - 1], cel))
  };
}

test("the 11h turn (165°) is smooth even today — control group", () => {
  const m = animationMetrics([0, 0, 0], [165, 0, 0], "current");
  assert.ok(m.unevenness < 1.001,
    `165°: the unevenness of the step lengths is ${m.unevenness.toFixed(4)}`);
});

test("the 12h turn (exactly 180°) falls apart TODAY — reproducing #157", () => {
  const m = animationMetrics([0, 0, 0], [180, 0, 0], "current");
  // Ideally every step is 9° (180°/20). In reality they scatter between 0° and 54.7°.
  assert.ok(m.unevenness > 5,
    `the bug does not reproduce: unevenness ${m.unevenness.toFixed(2)}, ` +
    `steps ${m.minStep.toFixed(2)}°…${m.maxSteps.toFixed(2)}°`);

  // In the good case the longitude grows monotonically 0°→180°; today it jumps back and forth.
  const lon = m.points_.map(p => p[0]);
  let regression = 0;
  for (let i = 1; i < lon.length; i++) if (lon[i] < lon[i - 1]) regression++;
  assert.ok(regression > 0,
    "the longitude of the centre is not monotone — the animation jumps backwards");
});

test("the 12h turn becomes smooth with the fixed guard branch", () => {
  const m = animationMetrics([0, 0, 0], [180, 0, 0], "fixed");
  assert.ok(m.unevenness < 1.001,
    `fixed: unevenness ${m.unevenness.toFixed(4)}`);
  const lon = m.points_.map(p => p[0]);
  for (let i = 1; i < lon.length; i++) {
    assert.ok(lon[i] > lon[i - 1], `the longitude is not monotone at step ${i}`);
  }
});

test("the fix stops exactly at the requested centre", () => {
  // The existing hack nudged the TARGET (cfg.center[0] -= 0.01), which leaves a
  // permanent 0.01° error in the config; nudging the start does not.
  const j = animationMetrics([0, 0, 0], [180, 0, 0], "fixed");
  assert.ok(j.endpointError < 1e-9,
    `the endpoint is off from the requested centre by ${j.endpointError.toFixed(5)}°`);
});

test("an antipode arising from the latitude improves too (0°,30° → 180°,-30°)", () => {
  const today_ = animationMetrics([0, 30, 0], [180, -30, 0], "current");
  const newer = animationMetrics([0, 30, 0], [180, -30, 0], "fixed");
  assert.ok(today_.unevenness > 5, `today: ${today_.unevenness.toFixed(2)}`);
  assert.ok(newer.unevenness < 1.001, `fixed: ${newer.unevenness.toFixed(4)}`);
});

test("KNOWN LIMITATION: a pole antipode is not fixed by nudging the longitude", () => {
  // [0,90] and [180,-90] are antipodal, but rotating the longitude at the pole
  // changes nothing. The fix does not cover this case.
  const newer = animationMetrics([0, 90, 0], [180, -90, 0], "fixed");
  assert.ok(newer.unevenness > 5,
    "if this turns green, the pole case has been solved too — the test can be updated");
});
