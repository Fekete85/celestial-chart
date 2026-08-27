/* Szögnormálás és a rá épülő efemerisz-számítás.
 *
 * A Trig.normalize / normalize0 kis, tiszta függvények, amiket a moon.js és a
 * kepler.js hív — és amikre eddig nem volt teszt. Pont ez a hibaosztály adta a
 * #157-et és a Celestial.ha() elírását is: rövid függvény, hihető képlet,
 * senki nem méri.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { Trig } from "../src/util.js";
import { Kepler } from "../src/kepler.js";

// JPL: a Föld–Hold baricentrum pályaelemei, J2000 epocha, évszázados változással
const FOLD_ELEMEK = {
  a: 1.00000261, e: 0.01671123, i: -1.531e-5,
  L: 100.46457166, W: 102.93768193, N: 0,
  da: 5.62e-6, de: -4.392e-5, di: -0.01294668,
  dL: 35999.37244981, dW: 0.32327364, dN: 0,
  ep: "2000-01-01"
};

const TAU = Math.PI * 2;

test("normalize a [0, 2π) tartományba visz", () => {
  const rosszak = [];
  for (let v = -30; v <= 30; v += 0.37) {
    const n = Trig.normalize(v);
    if (!(n >= 0 && n < TAU)) rosszak.push(`${v.toFixed(2)} → ${n.toFixed(3)}`);
  }
  assert.deepEqual(rosszak.slice(0, 5), [], `${rosszak.length} érték esik a tartományon kívülre`);
});

test("normalize megtartja a szöget (mod 2π)", () => {
  for (const v of [-25.3, -7.1, -1, 0, 1, 7.1, 25.3]) {
    const n = Trig.normalize(v);
    const kulonbseg = Math.abs(((n - v) % TAU + TAU) % TAU);
    assert.ok(kulonbseg < 1e-9 || Math.abs(kulonbseg - TAU) < 1e-9,
      `${v} → ${n}: nem ugyanaz a szög`);
  }
});

test("normalize0 a [-π, π) tartományba visz", () => {
  const rosszak = [];
  for (let v = -30; v <= 30; v += 0.37) {
    const n = Trig.normalize0(v);
    if (!(n >= -Math.PI && n < Math.PI)) rosszak.push(`${v.toFixed(2)} → ${n.toFixed(3)}`);
  }
  assert.deepEqual(rosszak.slice(0, 5), [], `${rosszak.length} érték esik a tartományon kívülre`);
});

test("a hiperbolikus függvények megegyeznek a beépítettekkel", () => {
  for (let v = -3; v <= 3; v += 0.25) {
    assert.ok(Math.abs(Trig.sinh(v) - Math.sinh(v)) < 1e-9, "sinh " + v);
    assert.ok(Math.abs(Trig.cosh(v) - Math.cosh(v)) < 1e-9, "cosh " + v);
    assert.ok(Math.abs(Trig.tanh(v) - Math.tanh(v)) < 1e-9, "tanh " + v);
    assert.ok(Math.abs(Trig.asinh(v) - Math.asinh(v)) < 1e-9, "asinh " + v);
  }
  for (let v = 1; v <= 4; v += 0.25) {
    assert.ok(Math.abs(Trig.acosh(v) - Math.acosh(v)) < 1e-9, "acosh " + v);
  }
});

/* A Hold ekliptikai hosszúsága naponta ~13,2 fokot halad. Ha a szögnormálás
 * elromlik nagy negatív bemenetnél, az kilógó értékként vagy ugrásként
 * jelenik meg — J2000-től távolodva a közepes elemek egyre nagyobbak. */
test("a Hold pozíciója értelmes 1700 és 2300 között", () => {
  const rosszak = [];
  for (let ev = 1700; ev <= 2300; ev += 5) {
    const dt = new Date(Date.UTC(ev, 5, 15, 0, 0, 0));
    const fold = Kepler().id("ter").elements(FOLD_ELEMEK),
          lun = Kepler().id("lun").elements({});
    const d = lun(dt).equatorial(fold(dt).spherical()).ephemeris;
    if (!d || !Number.isFinite(d.pos[0]) || !Number.isFinite(d.pos[1])) {
      rosszak.push(`${ev}: nem szám`); continue;
    }
    const ra = d.pos[0], dec = d.pos[1];
    if (ra < -180 || ra > 360) rosszak.push(`${ev}: rektaszcenzió ${ra.toFixed(1)}°`);
    if (dec < -35 || dec > 35) rosszak.push(`${ev}: deklináció ${dec.toFixed(1)}° (a Hold ±28,6°-on belül marad)`);
    if (!Number.isFinite(d.age) || d.age < 0 || d.age > 2 * Math.PI) rosszak.push(`${ev}: kor ${d.age}`);
    if (!Number.isFinite(d.phase) || d.phase < 0 || d.phase > 1) rosszak.push(`${ev}: fázis ${d.phase}`);
  }
  assert.deepEqual(rosszak.slice(0, 6), [], `${rosszak.length} rendellenes érték`);
});
