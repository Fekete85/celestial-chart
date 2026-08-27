/* Comparing two reference nets.
 *
 * The net on its own protects nothing — only if there is something to measure
 * against. This script takes the recorded (D3 v3) reference and the output of
 * the migrated version, and reports per projection how far the pixels moved.
 *
 *   node compare.mjs reference-d3v3.json reference-newer.json [--tolerance 0.5]
 *
 * Exit code: 0 if every projection is within tolerance, 1 if not.
 *
 * The self-test (--selftest) proves that the comparator really does catch
 * things: against itself the difference is 0, but against a deliberately
 * corrupted copy it reports a failure.
 */
import fs from "node:fs";

const DEFAULT_TOLERANCE = 0.5; // pixels

function load(urlPath) {
  return JSON.parse(fs.readFileSync(urlPath, "utf8"));
}

/* A measured point is valid if it actually contains a coordinate. The generator
 * may also record NaN — in JSON that comes out as [null, null, flag] — which is
 * the undefined behaviour of the old code, not a coordinate. */
function isValid(p) {
  // Number.isFinite, not `typeof === "number"`: NaN is a number too. Through
  // JSON it turns into null, but straight from the browser it arrives as NaN —
  // so the decision is the same regardless of the source.
  return Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]);
}

/* Comparing one rotation of one projection. */
function compareRotation(a, b) {
  const e = {
    points: 0,
    structural: [],   // missing or regressed point — this is always serious
    clipping: 0,      // the visibility flag differs
    improved: 0,      // the old code returned NaN, the new one a defined value
    distances: []
  };
  const pa = a.points || [], pb = b.points || [];
  if (pa.length !== pb.length) {
    e.structural.push(`point count ${pa.length} vs ${pb.length}`);
    return e;
  }
  for (let i = 0; i < pa.length; i++) {
    const x = pa[i], y = pb[i];
    e.points++;
    const xe = isValid(x), ye = isValid(y);

    if (!xe && !ye) {
      // Both undefined: only a problem if they are undefined in different ways.
      if (JSON.stringify(x) !== JSON.stringify(y)) {
        e.structural.push(`#${i}: ${JSON.stringify(x)} vs ${JSON.stringify(y)}`);
      }
      continue;
    }
    if (!xe && ye) {
      // The old code gave NaN or nothing, the new one gives a number: there is
      // nothing here that could have got worse.
      e.improved++;
      continue;
    }
    if (xe && !ye) {
      // There used to be a coordinate, now there is none — that is a regression.
      e.structural.push(`#${i}: ${JSON.stringify(x)} -> ${JSON.stringify(y)}`);
      continue;
    }
    if (x[2] !== y[2]) e.clipping++;
    e.distances.push(Math.hypot(x[0] - y[0], x[1] - y[1]));
  }
  return e;
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[i];
}

export function compare(refA, refB, tolerance = DEFAULT_TOLERANCE) {
  const mapA = new Map(refA.projections.map(v => [v.projection, v]));
  const mapB = new Map(refB.projections.map(v => [v.projection, v]));

  const rows = [];
  const missing = [...mapA.keys()].filter(k => !mapB.has(k));
  const newer = [...mapB.keys()].filter(k => !mapA.has(k));

  for (const [name_, va] of mapA) {
    const vb = mapB.get(name_);
    if (!vb) continue;
    const row = { projection: name_, points: 0, clipping: 0, improved: 0, structural: [], distances: [] };
    const n = Math.min(va.rotations.length, vb.rotations.length);
    if (va.rotations.length !== vb.rotations.length) {
      row.structural.push(`rotation count ${va.rotations.length} vs ${vb.rotations.length}`);
    }
    for (let r = 0; r < n; r++) {
      const e = compareRotation(va.rotations[r], vb.rotations[r]);
      row.points += e.points;
      row.clipping += e.clipping;
      row.improved += e.improved;
      for (const sz of e.structural) row.structural.push(`rot${r} ${sz}`);
      row.distances.push(...e.distances);
    }
    row.distances.sort((x, y) => x - y);
    row.max = row.distances.length ? row.distances[row.distances.length - 1] : 0;
    row.mean = row.distances.length
      ? row.distances.reduce((s, v) => s + v, 0) / row.distances.length : 0;
    row.p99 = percentile(row.distances, 0.99);
    row.ok = row.max <= tolerance && row.clipping === 0 && row.structural.length === 0;
    delete row.distances;
    rows.push(row);
  }

  return {
    tolerance,
    missing_projections: missing,
    extra_projections: newer,
    rows,
    ok: missing.length === 0 && rows.every(s => s.ok)
  };
}

function print(er) {
  const sz = n => n.toFixed(3).padStart(9);
  console.log(`tolerance: ${er.tolerance} px\n`);
  console.log("projection               pts       max      mean       p99  clip improved struct");
  console.log("-".repeat(80));
  for (const s of er.rows) {
    const mark = s.ok ? " " : "✗";
    console.log(
      `${mark} ${s.projection.padEnd(20)} ${String(s.points).padStart(5)} ` +
      `${sz(s.max)} ${sz(s.mean)} ${sz(s.p99)} ${String(s.clipping).padStart(6)} ${String(s.improved).padStart(7)} ${String(s.structural.length).padStart(6)}`
    );
  }
  if (er.missing_projections.length) console.log("\nMISSING projections in the new one:", er.missing_projections.join(", "));
  if (er.extra_projections.length) console.log("\nOnly in the new one:", er.extra_projections.join(", "));
  for (const s of er.rows) {
    if (s.structural.length) {
      console.log(`\n${s.projection} structural differences (first 5):`);
      for (const x of s.structural.slice(0, 5)) console.log("  " + x);
    }
  }
  const bad = er.rows.filter(s => !s.ok);
  const improved = er.rows.reduce((n, s) => n + s.improved, 0);
  if (improved) console.log(`\nAt ${improved} points the old code returned NaN and the new one a defined value — ` +
                          `this is not a regression (see docs/04-migration-log.md).`);
  console.log("\n" + (er.ok
    ? `OK — all ${er.rows.length} projections are within tolerance.`
    : `DIFFERENCE — ${bad.length}/${er.rows.length} projections are out of range: ${bad.map(s => s.projection).join(", ")}`));
}

/* --- Self-test ---
 * A comparator has to be validated just like the net itself: if it said "ok" to
 * everything, it would be silently worthless. */
function selfTest(urlPath) {
  const ref = load(urlPath);
  let failures = 0;
  const check = (name_, cond) => {
    console.log((cond ? "  ok  " : "  FAIL") + "  " + name_);
    if (!cond) failures++;
  };

  const same = compare(ref, JSON.parse(JSON.stringify(ref)));
  check("against itself: ok", same.ok);
  check("against itself: max difference 0", same.rows.every(s => s.max === 0));

  // A 1 pixel shift on a single point, with a 0.5 px tolerance → must be caught
  const shifted = JSON.parse(JSON.stringify(ref));
  const p = shifted.projections[3].rotations[1].points.find(x => Array.isArray(x));
  p[0] += 1;
  const cmp1 = compare(ref, shifted);
  check("1 px shift: caught", !cmp1.ok);
  check("1 px shift: only for one projection", cmp1.rows.filter(s => !s.ok).length === 1);

  // The same with a 2 px tolerance → must pass
  check("1 px shift with a 2 px tolerance: ok", compare(ref, shifted, 2).ok);

  // Flipping the clipping flag → caught regardless of the tolerance
  const clipped = JSON.parse(JSON.stringify(ref));
  const q = clipped.projections[5].rotations[0].points.find(x => Array.isArray(x));
  q[2] = q[2] ? 0 : 1;
  check("clipping flip: caught even with a large tolerance", !compare(ref, clipped, 1000).ok);

  // A missing projection → caught
  const truncated = JSON.parse(JSON.stringify(ref));
  truncated.projections.pop();
  const cmp2 = compare(ref, truncated);
  check("missing projection: caught", !cmp2.ok && cmp2.missing_projections.length === 1);

  // Structural difference: a valid point turned into null → caught
  const nulled = JSON.parse(JSON.stringify(ref));
  const rot = nulled.projections[7].rotations[0];
  rot.points[rot.points.findIndex(x => Array.isArray(x))] = null;
  check("point → null: caught even with a large tolerance", !compare(ref, nulled, 1000).ok);

  // The old code's NaN (in JSON [null, null, flag]) against a number in the new
  // one: that is an improvement.
  const oldNaN = JSON.parse(JSON.stringify(ref));
  const ri = oldNaN.projections[9].rotations[0];
  const idx = ri.points.findIndex(x => Array.isArray(x));
  const original = ri.points[idx];
  ri.points[idx] = [null, null, original[2]];
  const cmpImproved = compare(oldNaN, ref);
  check("old NaN → new number: does not fail", cmpImproved.ok);
  check("old NaN → new number: counted as improved", cmpImproved.rows.some(s => s.improved === 1));

  // The other way round it does fail: there used to be a coordinate, now NaN.
  check("old number → new NaN: caught", !compare(ref, oldNaN, 1000).ok);

  console.log(failures === 0 ? "\nSELF-TEST PASSED" : `\nSELF-TEST FAILED: ${failures}`);
  return failures === 0;
}

// We only take the command-line branch when run directly: verify.mjs imports
// the compare() function, and there it must not exit the process.
const direct = import.meta.url === `file://${process.argv[1]}`;
const argv = direct ? process.argv.slice(2) : [];
if (!direct) {
  // imported: nothing to do
} else if (argv[0] === "--selftest") {
  process.exit(selfTest(argv[1] || "reference-d3v3.json") ? 0 : 1);
} else if (argv.length >= 2) {
  const ti = argv.indexOf("--tolerance");
  const tolerance = ti >= 0 ? parseFloat(argv[ti + 1]) : DEFAULT_TOLERANCE;
  const er = compare(load(argv[0]), load(argv[1]), tolerance);
  print(er);
  process.exit(er.ok ? 0 : 1);
} else {
  console.log("usage: node compare.mjs <A.json> <B.json> [--tolerance px]\n" +
              "       node compare.mjs --selftest [reference.json]");
  process.exit(2);
}
