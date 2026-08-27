/* Két reference-háló összehasonlítása.
 *
 * A háló önmagában nem véd semmitől — csak akkor, ha van mihez mérni. Ez a
 * szkript veszi a rögzített (D3 v3-as) referenciát és a migrált verzió
 * outputét, és vetítésenként megmondja, mennyit mozdultak a pixelek.
 *
 *   node compare.mjs reference-d3v3.json reference-newer.json [--tolerance 0.5]
 *
 * Kilépési kód: 0 ha minden vetítés a tűrésen belül van, 1 ha nem.
 *
 * Az önteszt (--selftest) bizonyítja, hogy az összehasonlító tényleg outüt:
 * önmagával 0 eltérés, szándékosan elrontott másolattal viszont hibát jelez.
 */
import fs from "node:fs";

const DEFAULT_TOLERANCE = 0.5; // pixel

function load(urlPath) {
  return JSON.parse(fs.readFileSync(urlPath, "utf8"));
}

/* Egy mért pont akkor érvényes, ha tényleges koordinátát tartalmaz. A generátor
 * NaN-t is rögzíthet — a JSON ilyenkor [null, null, jelző] alakot ad —, ez a
 * régi kód definiálatlan viselkedése, nem koordináta. */
function isValid(p) {
  // Number.isFinite, nem `typeof === "number"`: a NaN is szám. JSON-on át
  // null-lá alakul, a böngészőből közvetlenül viszont NaN-ként érkezik — így a
  // forrástól függetlenül ugyanaz a döntés.
  return Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]);
}

/* Egy vetítés egy forgatásának összevetése. */
function compareRotation(a, b) {
  const e = {
    points_: 0,
    structural: [],   // hiányzó vagy visszalépő pont — ez mindig súlyos
    clipping: 0,      // a láthatósági jelző eltér
    improved: 0,        // a régi NaN-t adott, az új definiált értétwo
    distances: []
  };
  const pa = a.points || [], pb = b.points || [];
  if (pa.length !== pb.length) {
    e.structural.push(`ponthossz ${pa.length} vs ${pb.length}`);
    return e;
  }
  for (let i = 0; i < pa.length; i++) {
    const x = pa[i], y = pb[i];
    e.points_++;
    const xe = isValid(x), ye = isValid(y);

    if (!xe && !ye) {
      // Mindkettő definiálatlan: csak akkor gond, ha másképp az.
      if (JSON.stringify(x) !== JSON.stringify(y)) {
        e.structural.push(`#${i}: ${JSON.stringify(x)} vs ${JSON.stringify(y)}`);
      }
      continue;
    }
    if (!xe && ye) {
      // A régi NaN-t vagy semmit adott, az új számot: nincs mihez képest romlani.
      e.improved++;
      continue;
    }
    if (xe && !ye) {
      // Volt koordináta, now_ nincs — ez viszont visszalépés.
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
    const row = { vetites: name_, points_: 0, clipping: 0, improved: 0, structural: [], distances: [] };
    const n = Math.min(va.rotations.length, vb.rotations.length);
    if (va.rotations.length !== vb.rotations.length) {
      row.structural.push(`forgatásszám ${va.rotations.length} vs ${vb.rotations.length}`);
    }
    for (let r = 0; r < n; r++) {
      const e = compareRotation(va.rotations[r], vb.rotations[r]);
      row.points_ += e.points_;
      row.clipping += e.clipping;
      row.improved += e.improved;
      for (const sz of e.structural) row.structural.push(`fgt${r} ${sz}`);
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
  console.log(`tűrés: ${er.tolerance} px\n`);
  console.log("vetítés                pont    max      átlag      p99   clip  improved  szerk");
  console.log("-".repeat(80));
  for (const s of er.rows) {
    const mark = s.ok ? " " : "✗";
    console.log(
      `${mark} ${s.vetites.padEnd(20)} ${String(s.points_).padStart(5)} ` +
      `${sz(s.max)} ${sz(s.mean)} ${sz(s.p99)} ${String(s.clipping).padStart(6)} ${String(s.improved).padStart(7)} ${String(s.structural.length).padStart(6)}`
    );
  }
  if (er.missing_projections.length) console.log("\nHIÁNYZÓ vetítés az újban:", er.missing_projections.join(", "));
  if (er.extra_projections.length) console.log("\nCsak az újban:", er.extra_projections.join(", "));
  for (const s of er.rows) {
    if (s.structural.length) {
      console.log(`\n${s.vetites} structural eltérések (első 5):`);
      for (const x of s.structural.slice(0, 5)) console.log("  " + x);
    }
  }
  const bad = er.rows.filter(s => !s.ok);
  const improved = er.rows.reduce((n, s) => n + s.improved, 0);
  if (improved) console.log(`\n${improved} pontban a régi kód NaN-t adott, az új definiált értétwo — ` +
                          `ez nem regresszió (lásd docs/04-migration-log.md).`);
  console.log("\n" + (er.ok
    ? `RENDBEN — all_ a ${er.rows.length} vetítés a tűrésen belül.`
    : `ELTÉRÉS — ${bad.length}/${er.rows.length} vetítés kilóg: ${bad.map(s => s.vetites).join(", ")}`));
}

/* --- Önteszt ---
 * Egy összehasonlítót ugyanúgy validálni kell, mint a hálót magát: ha
 * mindenre azt mondaná, hogy „ok", némán értéktelen lenne. */
function selfTest(urlPath) {
  const ref = load(urlPath);
  let failures = 0;
  const check = (name_, cond) => {
    console.log((cond ? "  ok   " : "  BUKÁS") + "  " + name_);
    if (!cond) failures++;
  };

  const same = compare(ref, JSON.parse(JSON.stringify(ref)));
  check("önmagával: ok", same.ok);
  check("önmagával: max eltérés 0", same.rows.every(s => s.max === 0));

  // 1 pixel elmozdítás egyetlen ponton, 0.5 px tűréssel → out kell ütnie
  const shifted = JSON.parse(JSON.stringify(ref));
  const p = shifted.projections[3].rotations[1].points.find(x => Array.isArray(x));
  p[0] += 1;
  const cmp1 = compare(ref, shifted);
  check("1 px elmozdulás: outüt", !cmp1.ok);
  check("1 px elmozdulás: csak egy vetítésnél", cmp1.rows.filter(s => !s.ok).length === 1);

  // Ugyanaz 2 px tűréssel → át kell mennie
  check("1 px elmozdulás 2 px tűréssel: ok", compare(ref, shifted, 2).ok);

  // Clipping-jelző átbillentése → tűréstől függetlenül outüt
  const clipped = JSON.parse(JSON.stringify(ref));
  const q = clipped.projections[5].rotations[0].points.find(x => Array.isArray(x));
  q[2] = q[2] ? 0 : 1;
  check("clipping-váltás: outüt nagy tűréssel is", !compare(ref, clipped, 1000).ok);

  // Hiányzó vetítés → outüt
  const truncated = JSON.parse(JSON.stringify(ref));
  truncated.projections.pop();
  const cmp2 = compare(ref, truncated);
  check("hiányzó vetítés: outüt", !cmp2.ok && cmp2.missing_projections.length === 1);

  // Szerkezeti eltérés: érvényes pontból null → outüt
  const nulled = JSON.parse(JSON.stringify(ref));
  const rot = nulled.projections[7].rotations[0];
  rot.points[rot.points.findIndex(x => Array.isArray(x))] = null;
  check("pont → null: outüt nagy tűréssel is", !compare(ref, nulled, 1000).ok);

  // A régi NaN-ja (JSON-ban [null, null, jelző]) siteén az új szám: javulás.
  const oldNaN = JSON.parse(JSON.stringify(ref));
  const ri = oldNaN.projections[9].rotations[0];
  const idx = ri.points.findIndex(x => Array.isArray(x));
  const original = ri.points[idx];
  ri.points[idx] = [null, null, original[2]];
  const cmpImproved = compare(oldNaN, ref);
  check("régi NaN → új szám: nem bukik el", cmpImproved.ok);
  check("régi NaN → új szám: javultként számolva", cmpImproved.rows.some(s => s.improved === 1));

  // Fordítva viszont igen: volt koordináta, now_ NaN.
  check("régi szám → új NaN: outüt", !compare(ref, oldNaN, 1000).ok);

  console.log(failures === 0 ? "\nÖNTESZT RENDBEN" : `\nÖNTESZT BUKÁS: ${failures}`);
  return failures === 0;
}

// Csak közvetlen futtatáskor lépünk a parancssori ágra: a halo.mjs importálja
// az compare() függvényt, és ott nem szabad kilépni a folyamatból.
const direct = import.meta.url === `file://${process.argv[1]}`;
const argv = direct ? process.argv.slice(2) : [];
if (!direct) {
  // importálva: nincs teendő
} else if (argv[0] === "--selftest") {
  process.exit(selfTest(argv[1] || "reference-d3v3.json") ? 0 : 1);
} else if (argv.length >= 2) {
  const ti = argv.indexOf("--tolerance");
  const tolerance = ti >= 0 ? parseFloat(argv[ti + 1]) : DEFAULT_TOLERANCE;
  const er = compare(load(argv[0]), load(argv[1]), tolerance);
  print(er);
  process.exit(er.ok ? 0 : 1);
} else {
  console.log("használat: node compare.mjs <A.json> <B.json> [--tolerance px]\n" +
              "           node compare.mjs --selftest [reference.json]");
  process.exit(2);
}
