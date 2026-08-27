/* Az #148 issue numerikus ellenőrzése: "horizontal.inverse function missing a
 * sign correction?"  (bejelentve 2023-12-08, azóta válasz nélkül)
 *
 * A könyvtár `horizontal()` függvénye égi -> horizontális koordinátát számol, a
 * `horizontal.inverse()` visszafelé. Ha mindkettő helyes, akkor a kettő
 * egymás urlPathán alkalmazva back kell adja a kiindulási pontot (round-trip).
 *
 * Futtatás:  node harness/issue-148-check.mjs
 */

const deg2rad = Math.PI / 180;

// --- A könyvtárból átemelt kód, változtatás nélkül ---------------------------

function getMST(dt, lng) {
  const yr0 = dt.getUTCFullYear(), mo0 = dt.getUTCMonth() + 1;
  const dy = dt.getUTCDate(), h = dt.getUTCHours();
  const m = dt.getUTCMinutes(), s = dt.getUTCSeconds();
  let yr = yr0, mo = mo0;
  if (mo === 1 || mo === 2) { yr = yr - 1; mo = mo + 12; }
  const a = Math.floor(yr / 100);
  const b = 2 - a + Math.floor(a / 4);
  const c = Math.floor(365.25 * yr);
  const d = Math.floor(30.6001 * (mo + 1));
  const jd = b + c + d - 730550.5 + dy + (h + m / 60.0 + s / 3600.0) / 24.0;
  const jt = jd / 36525.0;
  let mst = 280.46061837 + 360.98564736629 * jd + 0.000387933 * jt * jt
            - jt * jt * jt / 38710000 + lng;
  if (mst > 0.0) { while (mst > 360.0) mst -= 360.0; }
  else { while (mst < 0.0) mst += 360.0; }
  return mst;
}

// Égi -> horizontális. Ez a függvény HELYESEN kezeli a kvadráns-kétértelműséget.
function horizontal(dt, pos, loc) {
  let ha = getMST(dt, loc[1]) - pos[0];
  if (ha < 0) ha = ha + 360;
  ha = ha * deg2rad;
  const dec = pos[1] * deg2rad;
  const lat = loc[0] * deg2rad;
  const alt = Math.asin(Math.sin(dec) * Math.sin(lat)
                        + Math.cos(dec) * Math.cos(lat) * Math.cos(ha));
  let az = Math.acos((Math.sin(dec) - Math.sin(alt) * Math.sin(lat))
                     / (Math.cos(alt) * Math.cos(lat)));
  if (Math.sin(ha) > 0) az = Math.PI * 2 - az;   // <-- itt VAN előmark-korrekció
  return [alt / deg2rad, az / deg2rad, 0];
}

// Horizontális -> égi, EREDETI (hibás) változat.
function inverseOriginal(dt, hor, loc) {
  const alt = hor[0] * deg2rad, az = hor[1] * deg2rad, lat = loc[0] * deg2rad;
  const dec = Math.asin(Math.sin(alt) * Math.sin(lat)
                        + Math.cos(alt) * Math.cos(lat) * Math.cos(az));
  let ha = ((Math.sin(alt) - Math.sin(dec) * Math.sin(lat))
            / (Math.cos(dec) * Math.cos(lat))).toFixed(6);
  ha = Math.acos(ha);              // 0..PI — az előmark itt VESZIK EL
  ha = ha / deg2rad;
  const ra = getMST(dt, loc[1]) - ha;
  return [ra, dec / deg2rad, 0];
}

// A bejelentő javaslata: a hiányzó előmark-korrekció.
function inverseFixed(dt, hor, loc) {
  const alt = hor[0] * deg2rad, az = hor[1] * deg2rad, lat = loc[0] * deg2rad;
  const dec = Math.asin(Math.sin(alt) * Math.sin(lat)
                        + Math.cos(alt) * Math.cos(lat) * Math.cos(az));
  let ha = ((Math.sin(alt) - Math.sin(dec) * Math.sin(lat))
            / (Math.cos(dec) * Math.cos(lat))).toFixed(6);
  ha = Math.acos(ha);
  if (Math.sin(az) > 0) { ha = -ha; }   // <-- a javasolt korrekció
  ha = ha / deg2rad;
  const ra = getMST(dt, loc[1]) - ha;
  return [ra, dec / deg2rad, 0];
}

// --- Round-trip teszt --------------------------------------------------------

function normalizeDeg(fok) {
  let f = fok % 360;
  if (f < 0) f += 360;
  return f;
}

function angleDiff(a, b) {
  const d = Math.abs(normalizeDeg(a) - normalizeDeg(b));
  return Math.min(d, 360 - d);
}

const DT = new Date(Date.UTC(2026, 7, 26, 20, 0, 0));
const SITE = [47.5196, 19.22];   // Budapest
const TOLERANCE = 0.01;              // fok

function check_(inverse_) {
  let badCount = 0, total = 0, maxError = 0, examples = [];
  for (let ra = 0; ra < 360; ra += 10) {
    for (let dec = -80; dec <= 80; dec += 10) {
      total++;
      const hor = horizontal(DT, [ra, dec], SITE);
      // Csak a horizont felettieket nézzük — a többi úgysem látszik.
      if (hor[0] < 0) { total--; continue; }
      const back = inverse_(DT, [hor[0], hor[1]], SITE);
      const dRa = angleDiff(ra, back[0]);
      const dDec = Math.abs(dec - back[1]);
      const error_ = Math.max(dRa, dDec);
      maxError = Math.max(maxError, error_);
      if (error_ > TOLERANCE) {
        badCount++;
        if (examples.length < 3) {
          examples.push(`RA ${ra}° Dec ${dec}° -> alt ${hor[0].toFixed(1)}° az `
                      + `${hor[1].toFixed(1)}° -> back RA ${normalizeDeg(back[0]).toFixed(1)}° `
                      + `(eltérés ${dRa.toFixed(1)}°)`);
        }
      }
    }
  }
  return { total, badCount, maxError, examples };
}

console.log("=== #148: horizontal.inverse round-trip teszt ===");
console.log(`  Hely: Budapest (${SITE[0]}, ${SITE[1]}), idő: ${DT.toISOString()}`);
console.log(`  Tűrés: ${TOLERANCE}°\n`);

const e = check_(inverseOriginal);
console.log("  EREDETI (a jelenlegi kód):");
console.log(`    ${e.badCount}/${e.total} pont tér back rosszul  (${(e.badCount / e.total * 100).toFixed(0)}%)`);
console.log(`    legnagyobb eltérés: ${e.maxError.toFixed(1)}°`);
e.examples.forEach(p => console.log(`      ${p}`));

const j = check_(inverseFixed);
console.log("\n  JAVÍTOTT (a bejelentő javaslata):");
console.log(`    ${j.badCount}/${j.total} pont tér back rosszul  (${(j.badCount / j.total * 100).toFixed(0)}%)`);
console.log(`    legnagyobb eltérés: ${j.maxError.toFixed(4)}°`);
j.examples.forEach(p => console.log(`      ${p}`));

console.log("\n=== ÍTÉLET ===");
if (e.badCount > 0 && j.badCount === 0) {
  console.log("  A bejelentés JOGOS, a javasolt javítás HELYES.");
  console.log("  A error_ a horizont fölötti points_ felét érinti — pontosan azt a");
  console.log("  felét, ahol sin(azimut) > 0, ahogy a bejelentő írta.");
} else if (e.badCount === 0) {
  console.log("  Nem sikerült reprodukálni: az original is helyesen tér back.");
} else {
  console.log(`  A javítás csökkent a hibát (${e.badCount} -> ${j.badCount}), de nem szünteti meg.`);
}
