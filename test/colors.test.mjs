/* Csillagszínek a B−V színindexből.
 *
 * A d3 v3-as quantize skálája kezelte a csökkenő tartományt, a v4+ nem: a
 * küszöbökre bisect-et használ, ami csak növekvő sorrendben helyes. A migráció
 * urlPathán emiatt minden csillag pirosra váltott — a térképen azonnal látszott,
 * de számban is mérhető, és mérni jobb.
 *
 * A B−V fizikai jelentése: minél kisebb, annál forróbb és kékebb a csillag.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { bvcolor } from "../src/config.js";



const rgb = bv => {
  const c = bvcolor(bv);
  assert.ok(/^#[0-9a-f]{6}$/.test(c), `nem szín: ${c} (B−V ${bv})`);
  return { r: parseInt(c.slice(1, 3), 16), g: parseInt(c.slice(3, 5), 16), b: parseInt(c.slice(5, 7), 16) };
};

test("forró csillag kékes, hideg csillag vöröses", () => {
  const rigel = rgb(-0.03);   // Rigel, B1 — kék szuperóriás
  const day = rgb(0.65);      // a Nap, G2
  const betelgeuse = rgb(1.85); // Betelgeuse, M1 — vörös szuperóriás

  assert.ok(rigel.b > rigel.r, `Rigel nem kékes: ${JSON.stringify(rigel)}`);
  assert.ok(betelgeuse.r > betelgeuse.b, `Betelgeuse nem vöröses: ${JSON.stringify(betelgeuse)}`);
  assert.ok(day.r >= day.b && day.b > 0.7 * day.r, `a Nap nem sárgásfehér: ${JSON.stringify(day)}`);
});

test("a kék-vörös arány monoton a B−V mentén", () => {
  let prev = Infinity;
  for (let bv = -0.3; bv <= 3.3; bv += 0.1) {
    const c = rgb(bv), arany = c.b / c.r;
    assert.ok(arany <= prev + 1e-9, `B−V ${bv.toFixed(1)}: az arány nőtt (${arany} > ${prev})`);
    prev = arany;
  }
});

test("a fehér pont a Nap környékén van, nem a B−V nullánál", () => {
  // A B−V nullpontja az A0 színképosztály (Vega), ami kékesfehér; a szemnek
  // fehér csillag a napszerű, B−V ≈ 0,65 körüli. A skálának ezt kell tükröznie.
  let whitest = null, smallest = Infinity;
  for (let bv = -0.3; bv <= 2.0; bv += 0.05) {
    const c = rgb(bv), delta = Math.abs(c.r - c.b);
    if (delta < smallest) { smallest = delta; whitest = bv; }
  }
  assert.ok(whitest > 0.4 && whitest < 0.9,
    `a legfehérebb szín B−V ${whitest.toFixed(2)}-nél van, nem a napszerű tartományban`);
  assert.ok(rgb(0.0).b > rgb(0.0).r, "a B−V = 0 (Vega) nem kékesfehér");
});

test("a tartomány növekvő — enélkül az svg.js színciklusa le sem running", () => {
  const d = bvcolor.domain();
  assert.ok(d[0] < d[1], `csökkenő tartomány: ${JSON.stringify(d)}`);
  let n = 0;
  for (let i = d[0]; i <= d[1]; i += 0.1) n++;
  assert.ok(n > 30, `a ciklus csak ${n}-szer futna le`);
});

test("a tartományon kívüli értékek a szélső színt kapják", () => {
  assert.equal(bvcolor(-5), bvcolor(-0.335));
  assert.equal(bvcolor(10), bvcolor(3.347));
});
