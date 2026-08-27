/* Star colours from the B−V colour index.
 *
 * The d3 v3 quantize scale coped with a decreasing domain, v4+ does not: it
 * uses bisect on the thresholds, which is only correct in increasing order.
 * Along the way of the migration every star therefore turned red — it was
 * immediately visible on the map, but it is measurable as a number too, and
 * measuring is better.
 *
 * The physical meaning of B−V: the smaller it is, the hotter and bluer the star.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { bvcolor } from "../src/config.js";



const rgb = bv => {
  const c = bvcolor(bv);
  assert.ok(/^#[0-9a-f]{6}$/.test(c), `not a colour: ${c} (B−V ${bv})`);
  return { r: parseInt(c.slice(1, 3), 16), g: parseInt(c.slice(3, 5), 16), b: parseInt(c.slice(5, 7), 16) };
};

test("a hot star is bluish, a cool star is reddish", () => {
  const rigel = rgb(-0.03);   // Rigel, B1 — blue supergiant
  const day = rgb(0.65);      // the Sun, G2
  const betelgeuse = rgb(1.85); // Betelgeuse, M1 — red supergiant

  assert.ok(rigel.b > rigel.r, `Rigel is not bluish: ${JSON.stringify(rigel)}`);
  assert.ok(betelgeuse.r > betelgeuse.b, `Betelgeuse is not reddish: ${JSON.stringify(betelgeuse)}`);
  assert.ok(day.r >= day.b && day.b > 0.7 * day.r, `the Sun is not yellowish-white: ${JSON.stringify(day)}`);
});

test("the blue-to-red ratio is monotone along B−V", () => {
  let prev = Infinity;
  for (let bv = -0.3; bv <= 3.3; bv += 0.1) {
    const c = rgb(bv), share = c.b / c.r;
    assert.ok(share <= prev + 1e-9, `B−V ${bv.toFixed(1)}: the ratio increased (${share} > ${prev})`);
    prev = share;
  }
});

test("the white point sits near the Sun, not at B−V zero", () => {
  // The zero point of B−V is spectral class A0 (Vega), which is bluish-white;
  // the star that looks white to the eye is the Sun-like one, around
  // B−V ≈ 0.65. The scale has to reflect that.
  let whitest = null, smallest = Infinity;
  for (let bv = -0.3; bv <= 2.0; bv += 0.05) {
    const c = rgb(bv), delta = Math.abs(c.r - c.b);
    if (delta < smallest) { smallest = delta; whitest = bv; }
  }
  assert.ok(whitest > 0.4 && whitest < 0.9,
    `the whitest colour is at B−V ${whitest.toFixed(2)}, not in the Sun-like range`);
  assert.ok(rgb(0.0).b > rgb(0.0).r, "B−V = 0 (Vega) is not bluish-white");
});

test("the domain is increasing — without it the colour loop in svg.js would not even run", () => {
  const d = bvcolor.domain();
  assert.ok(d[0] < d[1], `decreasing domain: ${JSON.stringify(d)}`);
  let n = 0;
  for (let i = d[0]; i <= d[1]; i += 0.1) n++;
  assert.ok(n > 30, `the loop would only run ${n} times`);
});

test("values outside the domain get the end colours", () => {
  assert.equal(bvcolor(-5), bvcolor(-0.335));
  assert.equal(bvcolor(10), bvcolor(3.347));
});
