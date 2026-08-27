/* A d3-geo-projection v4-ből kimaradt vetítések pótlása.
 *
 * A `hatano` és a `wagner7` a v3-as pluginban megvolt, a v4-ben nincs kiadott
 * raw függvényük. A pótlás a v3-as képletek szó szerinti átvétele — a teszt
 * ezt bizonyítja: a pinelt v3-as buildből kimért értékekhez mérünk.
 *
 * A referenceértékek a böngészőben, a `harness/vendor/` alatti pinelt
 * plugintól származnak (test/projection-reference-d3v3.json).
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

// A twoPointEquidistant kivétel: a v4-es raw első dolga `z0 *= 2`, ezért mi
// felezve adjuk át a config értékét. Az oda-back út ~1e-9 lebegőpontos zajt
// hagy — a reference-háló ugyanezen a vetítésen 0,000 pixel eltérést mér.
const SPECIAL_TOLERANCE = { twoPointEquidistant: 1e-8 };
const rad = f => f * Math.PI / 180;

/* A könyvtár saját feloldóját hívjuk — ugyanazt, amit a Celestial.projection().
 * Így a teszt a névfeloldást, a pótolt raw-okat és a paraméter-átváltást is
 * fedi, nem csak a képleteket. */
const ARG = { hatano: null, wagner7: null, mercator: null, wiechel: null,
              healpix: 1, twoPointEquidistant: Math.PI / 2 };

function raw(name_) {
  const r = rawProjection(name_, ARG[name_]);
  assert.ok(typeof r === "function", name_ + ": nincs raw");
  return r;
}

for (const name_ of Object.keys(ref.projections)) {
  test(`${name_}: a vetített koordináták megegyeznek a v3-as kimenettel`, () => {
    const p = raw(name_);
    const expected = ref.projections[name_].forward;
    const rad = f => f * Math.PI / 180;
    let maxDelta = 0, bad = null;
    ref.points.forEach(([lo, la], i) => {
      const got = p(rad(lo), rad(la));
      const d = Math.max(Math.abs(got[0] - expected[i][0]), Math.abs(got[1] - expected[i][1]));
      if (d > maxDelta) { maxDelta = d; bad = `[${lo},${la}] v3=${expected[i]} newer=${got}`; }
    });
    const tolerance = SPECIAL_TOLERANCE[name_] || TOLERANCE;
    assert.ok(maxDelta < tolerance, `max eltérés ${maxDelta} (tűrés ${tolerance}), pl. ${bad}`);
  });
}

test("a pótolt vetítések valóban felépülnek", () => {
  for (const name_ of ["hatano", "wagner7", "healpix"]) {
    const prj = Celestial.projection(name_);
    assert.equal(typeof prj, "function", name_ + " nem épült fel");
    assert.ok(Number.isFinite(prj([10, 20])[0]), name_ + " nem ad számot");
  }
});

test("az inverse_ visszaadja a kiindulási pontot", () => {
  for (const name_ of ["hatano", "wagner7", "healpix", "wiechel"]) {
    const prj = Celestial.projection(name_);
    for (const [lo, la] of [[0, 0], [45, 30], [-120, -60], [170, 10]]) {
      const back = prj.invert(prj([lo, la]));
      assert.ok(Math.abs(back[0] - lo) < 1e-6 && Math.abs(back[1] - la) < 1e-6,
        `${name_} [${lo},${la}] -> ${back}`);
    }
  }
});

test("a d3-geo-projection v4-ben tényleg nincs raw ezekhez", () => {
  // Ha egy jövőbeli verzió pótolja őtwo, ez a teszt szól, hogy a saját
  // másolatunk elhagyható.
  assert.equal(D3.geoHatanoRaw, undefined, "a geoHatanoRaw megjelent — a pótlás elhagyható");
  assert.equal(D3.geoWagner7Raw, undefined, "a geoWagner7Raw megjelent — a pótlás elhagyható");
});

test("a v4-es healpix tényleg más léptékű — ezért van saját másolatunk", () => {
  // Ha egy jövőbeli verzió backáll a v3-as normálásra, ez a teszt szól.
  const v4 = D3.geoHealpixRaw(1);
  const ours = Celestial.projection("healpix").scale(1).translate([0, 0]);
  const p4 = v4(0.5, 0.3);
  const pm = ours([0.5 * 180 / Math.PI, 0.3 * 180 / Math.PI]);
  assert.ok(Math.abs(Math.abs(pm[0]) - Math.abs(p4[0])) > 1e-6,
    "a v4-es healpix már ugyanazt adja — a saját másolat elhagyható");
});

test("a reflectX nem helyettesíti a raw-becsomagolást minden vetítésnél", () => {
  // Ez a döntés indoklása: a wiechelnél a λ előjele a képlet belsejében is
  // számít, ezért a v3-hű becsomagolást tartjuk meg. Ha ez a teszt elbukik,
  // a reflectX-re át lehet állni.
  const raw = D3.geoWiechelRaw;
  const wrapped = d3.geoProjection((l, f) => raw(-l, f)).scale(200).translate([400, 400]);
  const reflected = d3.geoProjection(raw).scale(200).translate([400, 400]).reflectX(true);
  let max = 0;
  for (let lo = -170; lo < 180; lo += 11) for (let la = -85; la <= 85; la += 7) {
    const a = wrapped([lo, la]), b = reflected([lo, la]);
    if (!a || !b) continue;
    max = Math.max(max, Math.hypot(a[0] - b[0], a[1] - b[1]));
  }
  assert.ok(max > 1, `a wiechelnél a kettő már megegyezik (max ${max}) — a reflectX egyszerűsítés lehetne`);
});
