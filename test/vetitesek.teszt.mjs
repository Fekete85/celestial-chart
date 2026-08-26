/* A d3-geo-projection v4-ből kimaradt vetítések pótlása.
 *
 * A `hatano` és a `wagner7` a v3-as pluginban megvolt, a v4-ben nincs kiadott
 * raw függvényük. A pótlás a v3-as képletek szó szerinti átvétele — a teszt
 * ezt bizonyítja: a pinelt v3-as buildből kimért értékekhez mérünk.
 *
 * A referenciaértékek a böngészőben, a `harness/vendor/` alatti pinelt
 * plugintól származnak (test/vetites-referencia-d3v3.json).
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as d3 from "d3";
import * as gp from "d3-geo-projection";
import { betolt } from "./betolt.mjs";

const ref = JSON.parse(fs.readFileSync(new URL("./vetites-referencia-d3v3.json", import.meta.url)));
const D3 = Object.assign({}, d3, gp);

const { Celestial } = betolt(
  ["src/transform.js", "src/util.js", "src/config.js", "src/projection.js"], [], { d3: D3 });

const TURES = 1e-10;
const rad = f => f * Math.PI / 180;

/* A Celestial.projection() a raw köré épít vetítést; a raw magát a
 * belső feloldón keresztül érjük el, ugyanúgy, ahogy a könyvtár. */
function raw(nev) {
  // A vetítés léptéke és eltolása alapértelmezett, a reflectX viszont tükröz —
  // a nyers raw összevetéséhez ezért a vetítést használjuk, és visszatükrözünk.
  const prj = Celestial.projection(nev).scale(1).translate([0, 0]);
  return (l, f) => { const p = prj([l, f]); return [-p[0], -p[1]]; };
}

for (const nev of Object.keys(ref.vetitesek)) {
  test(`${nev}: a vetített koordináták megegyeznek a v3-as kimenettel`, () => {
    const p = raw(nev);
    const vart = ref.vetitesek[nev].elore;
    let maxElteres = 0, rossz = null;
    ref.pontok.forEach(([lo, la], i) => {
      const kapott = p(lo, la);
      const d = Math.max(Math.abs(kapott[0] - vart[i][0]), Math.abs(kapott[1] - vart[i][1]));
      if (d > maxElteres) { maxElteres = d; rossz = `[${lo},${la}] v3=${vart[i]} uj=${kapott}`; }
    });
    assert.ok(maxElteres < TURES, `max eltérés ${maxElteres}, pl. ${rossz}`);
  });
}

test("a pótolt vetítések valóban felépülnek", () => {
  for (const nev of ["hatano", "wagner7"]) {
    const prj = Celestial.projection(nev);
    assert.equal(typeof prj, "function", nev + " nem épült fel");
    assert.ok(Number.isFinite(prj([10, 20])[0]), nev + " nem ad számot");
  }
});

test("az inverz visszaadja a kiindulási pontot", () => {
  for (const nev of ["hatano", "wagner7"]) {
    const prj = Celestial.projection(nev);
    for (const [lo, la] of [[0, 0], [45, 30], [-120, -60], [170, 10]]) {
      const vissza = prj.invert(prj([lo, la]));
      assert.ok(Math.abs(vissza[0] - lo) < 1e-6 && Math.abs(vissza[1] - la) < 1e-6,
        `${nev} [${lo},${la}] -> ${vissza}`);
    }
  }
});

test("a d3-geo-projection v4-ben tényleg nincs raw ezekhez", () => {
  // Ha egy jövőbeli verzió pótolja őket, ez a teszt szól, hogy a saját
  // másolatunk elhagyható.
  assert.equal(D3.geoHatanoRaw, undefined, "a geoHatanoRaw megjelent — a pótlás elhagyható");
  assert.equal(D3.geoWagner7Raw, undefined, "a geoWagner7Raw megjelent — a pótlás elhagyható");
});
