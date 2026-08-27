/* A numerical check of issue #148: "horizontal.inverse function missing a
 * sign correction?"  (reported on 2023-12-08, still unanswered)
 *
 * The library's `horizontal()` function converts celestial -> horizontal
 * coordinates, and `horizontal.inverse()` goes back the other way. If both are
 * correct, then applying them one after the other must give back the starting
 * point (round-trip).
 *
 * Run with:  node harness/issue-148-check.mjs
 */

const deg2rad = Math.PI / 180;

// --- Code lifted from the library, unchanged ---------------------------------

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

// Celestial -> horizontal. This function handles the quadrant ambiguity CORRECTLY.
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
  if (Math.sin(ha) > 0) az = Math.PI * 2 - az;   // <-- the sign correction IS here
  return [alt / deg2rad, az / deg2rad, 0];
}

// Horizontal -> celestial, the ORIGINAL (buggy) version.
function inverseOriginal(dt, hor, loc) {
  const alt = hor[0] * deg2rad, az = hor[1] * deg2rad, lat = loc[0] * deg2rad;
  const dec = Math.asin(Math.sin(alt) * Math.sin(lat)
                        + Math.cos(alt) * Math.cos(lat) * Math.cos(az));
  let ha = ((Math.sin(alt) - Math.sin(dec) * Math.sin(lat))
            / (Math.cos(dec) * Math.cos(lat))).toFixed(6);
  ha = Math.acos(ha);              // 0..PI — the sign is LOST here
  ha = ha / deg2rad;
  const ra = getMST(dt, loc[1]) - ha;
  return [ra, dec / deg2rad, 0];
}

// The reporter's suggestion: the missing sign correction.
function inverseFixed(dt, hor, loc) {
  const alt = hor[0] * deg2rad, az = hor[1] * deg2rad, lat = loc[0] * deg2rad;
  const dec = Math.asin(Math.sin(alt) * Math.sin(lat)
                        + Math.cos(alt) * Math.cos(lat) * Math.cos(az));
  let ha = ((Math.sin(alt) - Math.sin(dec) * Math.sin(lat))
            / (Math.cos(dec) * Math.cos(lat))).toFixed(6);
  ha = Math.acos(ha);
  if (Math.sin(az) > 0) { ha = -ha; }   // <-- the suggested correction
  ha = ha / deg2rad;
  const ra = getMST(dt, loc[1]) - ha;
  return [ra, dec / deg2rad, 0];
}

// --- Round-trip test ---------------------------------------------------------

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
const TOLERANCE = 0.01;              // degrees

function check_(inverse_) {
  let badCount = 0, total = 0, maxError = 0, examples = [];
  for (let ra = 0; ra < 360; ra += 10) {
    for (let dec = -80; dec <= 80; dec += 10) {
      total++;
      const hor = horizontal(DT, [ra, dec], SITE);
      // We only look at the ones above the horizon — the rest are not visible anyway.
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
                      + `(difference ${dRa.toFixed(1)}°)`);
        }
      }
    }
  }
  return { total, badCount, maxError, examples };
}

console.log("=== #148: horizontal.inverse round-trip test ===");
console.log(`  Location: Budapest (${SITE[0]}, ${SITE[1]}), time: ${DT.toISOString()}`);
console.log(`  Tolerance: ${TOLERANCE}°\n`);

const e = check_(inverseOriginal);
console.log("  ORIGINAL (the current code):");
console.log(`    ${e.badCount}/${e.total} points round-trip incorrectly  (${(e.badCount / e.total * 100).toFixed(0)}%)`);
console.log(`    largest difference: ${e.maxError.toFixed(1)}°`);
e.examples.forEach(p => console.log(`      ${p}`));

const j = check_(inverseFixed);
console.log("\n  FIXED (the reporter's suggestion):");
console.log(`    ${j.badCount}/${j.total} points round-trip incorrectly  (${(j.badCount / j.total * 100).toFixed(0)}%)`);
console.log(`    largest difference: ${j.maxError.toFixed(4)}°`);
j.examples.forEach(p => console.log(`      ${p}`));

console.log("\n=== VERDICT ===");
if (e.badCount > 0 && j.badCount === 0) {
  console.log("  The report is VALID, the suggested fix is CORRECT.");
  console.log("  The error affects half of the points above the horizon — exactly the");
  console.log("  half where sin(azimuth) > 0, just as the reporter wrote.");
} else if (e.badCount === 0) {
  console.log("  Could not reproduce: the original round-trips correctly too.");
} else {
  console.log(`  The fix reduces the error (${e.badCount} -> ${j.badCount}), but does not eliminate it.`);
}
