/* Két referencia-háló összehasonlítása.
 *
 * A háló önmagában nem véd semmitől — csak akkor, ha van mihez mérni. Ez a
 * szkript veszi a rögzített (D3 v3-as) referenciát és a migrált verzió
 * kimenetét, és vetítésenként megmondja, mennyit mozdultak a pixelek.
 *
 *   node osszehasonlit.mjs referencia-d3v3.json referencia-uj.json [--tures 0.5]
 *
 * Kilépési kód: 0 ha minden vetítés a tűrésen belül van, 1 ha nem.
 *
 * Az önteszt (--onteszt) bizonyítja, hogy az összehasonlító tényleg kiüt:
 * önmagával 0 eltérés, szándékosan elrontott másolattal viszont hibát jelez.
 */
import fs from "node:fs";

const TURES_ALAP = 0.5; // pixel

function betolt(ut) {
  return JSON.parse(fs.readFileSync(ut, "utf8"));
}

/* Egy mért pont akkor érvényes, ha tényleges koordinátát tartalmaz. A generátor
 * NaN-t is rögzíthet — a JSON ilyenkor [null, null, jelző] alakot ad —, ez a
 * régi kód definiálatlan viselkedése, nem koordináta. */
function ervenyes(p) {
  return Array.isArray(p) && typeof p[0] === "number" && typeof p[1] === "number";
}

/* Egy vetítés egy forgatásának összevetése. */
function forgatastOsszevet(a, b) {
  const e = {
    pontok: 0,
    szerkezeti: [],   // hiányzó vagy visszalépő pont — ez mindig súlyos
    clipping: 0,      // a láthatósági jelző eltér
    javult: 0,        // a régi NaN-t adott, az új definiált értéket
    tavolsagok: []
  };
  const pa = a.points || [], pb = b.points || [];
  if (pa.length !== pb.length) {
    e.szerkezeti.push(`ponthossz ${pa.length} vs ${pb.length}`);
    return e;
  }
  for (let i = 0; i < pa.length; i++) {
    const x = pa[i], y = pb[i];
    e.pontok++;
    const xe = ervenyes(x), ye = ervenyes(y);

    if (!xe && !ye) {
      // Mindkettő definiálatlan: csak akkor gond, ha másképp az.
      if (JSON.stringify(x) !== JSON.stringify(y)) {
        e.szerkezeti.push(`#${i}: ${JSON.stringify(x)} vs ${JSON.stringify(y)}`);
      }
      continue;
    }
    if (!xe && ye) {
      // A régi NaN-t vagy semmit adott, az új számot: nincs mihez képest romlani.
      e.javult++;
      continue;
    }
    if (xe && !ye) {
      // Volt koordináta, most nincs — ez viszont visszalépés.
      e.szerkezeti.push(`#${i}: ${JSON.stringify(x)} -> ${JSON.stringify(y)}`);
      continue;
    }
    if (x[2] !== y[2]) e.clipping++;
    e.tavolsagok.push(Math.hypot(x[0] - y[0], x[1] - y[1]));
  }
  return e;
}

function percentilis(rendezett, p) {
  if (!rendezett.length) return 0;
  const i = Math.min(rendezett.length - 1, Math.floor(p * rendezett.length));
  return rendezett[i];
}

export function osszehasonlit(refA, refB, tures = TURES_ALAP) {
  const aTerkep = new Map(refA.vetitesek.map(v => [v.projection, v]));
  const bTerkep = new Map(refB.vetitesek.map(v => [v.projection, v]));

  const sorok = [];
  const hianyzo = [...aTerkep.keys()].filter(k => !bTerkep.has(k));
  const uj = [...bTerkep.keys()].filter(k => !aTerkep.has(k));

  for (const [nev, va] of aTerkep) {
    const vb = bTerkep.get(nev);
    if (!vb) continue;
    const sor = { vetites: nev, pontok: 0, clipping: 0, javult: 0, szerkezeti: [], tavolsagok: [] };
    const n = Math.min(va.rotations.length, vb.rotations.length);
    if (va.rotations.length !== vb.rotations.length) {
      sor.szerkezeti.push(`forgatásszám ${va.rotations.length} vs ${vb.rotations.length}`);
    }
    for (let r = 0; r < n; r++) {
      const e = forgatastOsszevet(va.rotations[r], vb.rotations[r]);
      sor.pontok += e.pontok;
      sor.clipping += e.clipping;
      sor.javult += e.javult;
      for (const sz of e.szerkezeti) sor.szerkezeti.push(`fgt${r} ${sz}`);
      sor.tavolsagok.push(...e.tavolsagok);
    }
    sor.tavolsagok.sort((x, y) => x - y);
    sor.max = sor.tavolsagok.length ? sor.tavolsagok[sor.tavolsagok.length - 1] : 0;
    sor.atlag = sor.tavolsagok.length
      ? sor.tavolsagok.reduce((s, v) => s + v, 0) / sor.tavolsagok.length : 0;
    sor.p99 = percentilis(sor.tavolsagok, 0.99);
    sor.rendben = sor.max <= tures && sor.clipping === 0 && sor.szerkezeti.length === 0;
    delete sor.tavolsagok;
    sorok.push(sor);
  }

  return {
    tures,
    hianyzo_vetitesek: hianyzo,
    uj_vetitesek: uj,
    sorok,
    rendben: hianyzo.length === 0 && sorok.every(s => s.rendben)
  };
}

function kiir(er) {
  const sz = n => n.toFixed(3).padStart(9);
  console.log(`tűrés: ${er.tures} px\n`);
  console.log("vetítés                pont    max      átlag      p99   clip  javult  szerk");
  console.log("-".repeat(80));
  for (const s of er.sorok) {
    const jel = s.rendben ? " " : "✗";
    console.log(
      `${jel} ${s.vetites.padEnd(20)} ${String(s.pontok).padStart(5)} ` +
      `${sz(s.max)} ${sz(s.atlag)} ${sz(s.p99)} ${String(s.clipping).padStart(6)} ${String(s.javult).padStart(7)} ${String(s.szerkezeti.length).padStart(6)}`
    );
  }
  if (er.hianyzo_vetitesek.length) console.log("\nHIÁNYZÓ vetítés az újban:", er.hianyzo_vetitesek.join(", "));
  if (er.uj_vetitesek.length) console.log("\nCsak az újban:", er.uj_vetitesek.join(", "));
  for (const s of er.sorok) {
    if (s.szerkezeti.length) {
      console.log(`\n${s.vetites} szerkezeti eltérések (első 5):`);
      for (const x of s.szerkezeti.slice(0, 5)) console.log("  " + x);
    }
  }
  const rossz = er.sorok.filter(s => !s.rendben);
  const javult = er.sorok.reduce((n, s) => n + s.javult, 0);
  if (javult) console.log(`\n${javult} pontban a régi kód NaN-t adott, az új definiált értéket — ` +
                          `ez nem regresszió (lásd docs/04-migracio-naplo.md).`);
  console.log("\n" + (er.rendben
    ? `RENDBEN — mind a ${er.sorok.length} vetítés a tűrésen belül.`
    : `ELTÉRÉS — ${rossz.length}/${er.sorok.length} vetítés kilóg: ${rossz.map(s => s.vetites).join(", ")}`));
}

/* --- Önteszt ---
 * Egy összehasonlítót ugyanúgy validálni kell, mint a hálót magát: ha
 * mindenre azt mondaná, hogy „rendben", némán értéktelen lenne. */
function onteszt(ut) {
  const ref = betolt(ut);
  let bukas = 0;
  const allit = (nev, felt) => {
    console.log((felt ? "  ok   " : "  BUKÁS") + "  " + nev);
    if (!felt) bukas++;
  };

  const azonos = osszehasonlit(ref, JSON.parse(JSON.stringify(ref)));
  allit("önmagával: rendben", azonos.rendben);
  allit("önmagával: max eltérés 0", azonos.sorok.every(s => s.max === 0));

  // 1 pixel elmozdítás egyetlen ponton, 0.5 px tűréssel → ki kell ütnie
  const elmozditott = JSON.parse(JSON.stringify(ref));
  const p = elmozditott.vetitesek[3].rotations[1].points.find(x => Array.isArray(x));
  p[0] += 1;
  const e1 = osszehasonlit(ref, elmozditott);
  allit("1 px elmozdulás: kiüt", !e1.rendben);
  allit("1 px elmozdulás: csak egy vetítésnél", e1.sorok.filter(s => !s.rendben).length === 1);

  // Ugyanaz 2 px tűréssel → át kell mennie
  allit("1 px elmozdulás 2 px tűréssel: rendben", osszehasonlit(ref, elmozditott, 2).rendben);

  // Clipping-jelző átbillentése → tűréstől függetlenül kiüt
  const clipped = JSON.parse(JSON.stringify(ref));
  const q = clipped.vetitesek[5].rotations[0].points.find(x => Array.isArray(x));
  q[2] = q[2] ? 0 : 1;
  allit("clipping-váltás: kiüt nagy tűréssel is", !osszehasonlit(ref, clipped, 1000).rendben);

  // Hiányzó vetítés → kiüt
  const csonka = JSON.parse(JSON.stringify(ref));
  csonka.vetitesek.pop();
  const e2 = osszehasonlit(ref, csonka);
  allit("hiányzó vetítés: kiüt", !e2.rendben && e2.hianyzo_vetitesek.length === 1);

  // Szerkezeti eltérés: érvényes pontból null → kiüt
  const nullazott = JSON.parse(JSON.stringify(ref));
  const rot = nullazott.vetitesek[7].rotations[0];
  rot.points[rot.points.findIndex(x => Array.isArray(x))] = null;
  allit("pont → null: kiüt nagy tűréssel is", !osszehasonlit(ref, nullazott, 1000).rendben);

  // A régi NaN-ja (JSON-ban [null, null, jelző]) helyén az új szám: javulás.
  const regiNaN = JSON.parse(JSON.stringify(ref));
  const ri = regiNaN.vetitesek[9].rotations[0];
  const idx = ri.points.findIndex(x => Array.isArray(x));
  const eredeti = ri.points[idx];
  ri.points[idx] = [null, null, eredeti[2]];
  const ej = osszehasonlit(regiNaN, ref);
  allit("régi NaN → új szám: nem bukik el", ej.rendben);
  allit("régi NaN → új szám: javultként számolva", ej.sorok.some(s => s.javult === 1));

  // Fordítva viszont igen: volt koordináta, most NaN.
  allit("régi szám → új NaN: kiüt", !osszehasonlit(ref, regiNaN, 1000).rendben);

  console.log(bukas === 0 ? "\nÖNTESZT RENDBEN" : `\nÖNTESZT BUKÁS: ${bukas}`);
  return bukas === 0;
}

const argv = process.argv.slice(2);
if (argv[0] === "--onteszt") {
  process.exit(onteszt(argv[1] || "referencia-d3v3.json") ? 0 : 1);
} else if (argv.length >= 2) {
  const ti = argv.indexOf("--tures");
  const tures = ti >= 0 ? parseFloat(argv[ti + 1]) : TURES_ALAP;
  const er = osszehasonlit(betolt(argv[0]), betolt(argv[1]), tures);
  kiir(er);
  process.exit(er.rendben ? 0 : 1);
} else {
  console.log("használat: node osszehasonlit.mjs <A.json> <B.json> [--tures px]\n" +
              "           node osszehasonlit.mjs --onteszt [referencia.json]");
  process.exit(2);
}
