/* Referencia-generátor a d3-celestial vetítéseihez.
 *
 * Miért ez a lényeg: a szerző 2021-ben maga írta egy issue-ban, hogy
 * "the app has reached a state where it is difficult to add features without
 * breaking something". Ez nem a D3 verziójáról szól, hanem arról, hogy nincs
 * regressziós háló. Egy vetítési könyvtárnál a helyesség azt jelenti, hogy a
 * pixelek a helyükön vannak — ha ezt nem lehet automatikusan ellenőrizni,
 * minden változtatás rulett.
 *
 * A vetítés viszont determinisztikus: adott konfiguráció és bemenet mellett
 * mindig ugyanaz a kimenet. Tehát rögzíthető, és a migrált verziónak — adott
 * tűréssel — ugyanazt kell adnia.
 *
 * A generált JSON a window.REFERENCIA-ba kerül, és az oldalon is megjelenik.
 */
(function () {
  "use strict";

  // A vizsgált vetítések. A d3-celestial ezeket a d3.geo.projection (v3) API-ra
  // építi; a v7-ben ez d3.geoProjection + d3-geo-projection, más névvel és
  // helyenként más viselkedéssel — pont ezért kell mérni.
  // MINDEN konfigurált vetítés, nem egy válogatás. A háló csak arra véd, amit
  // mér: 25 vetítéssel a maradék 44-ben egy elrontott képlet észrevétlen
  // maradna. A listát a config.js-ből vesszük, hogy ne csússzon el tőle.
  var VETITESEK = Object.keys(Celestial.projections());

  // Rácspontok az égen: 15 fokonként RA, 10 fokonként Dec.
  // Ez 24 x 17 = 408 pont vetítésenként — elég sűrű ahhoz, hogy egy elrontott
  // vetítés biztosan kilógjon, és elég ritka, hogy a fájl kezelhető maradjon.
  function racspontok() {
    var pontok = [];
    for (var ra = -180; ra < 180; ra += 15) {
      for (var dec = -80; dec <= 80; dec += 10) {
        pontok.push([ra, dec]);
      }
    }
    // Sarkok és peremesetek külön: ezeken szokott elhasalni a clipping.
    pontok.push([0, 90], [0, -90], [179.99, 0], [-179.99, 0], [0, 0]);
    return pontok;
  }

  // Forgatási állapotok — a d3-celestial ezekkel követi a megfigyelő helyét
  // és az időt. A [0,0,0] az alaphelyzet, a többi valós észlelési helyzet.
  var FORGATASOK = [
    [0, 0, 0],
    [-80.9, -47.5, 0],    // Budapest zenitje egy augusztusi este
    [120, -30, 15],       // döntött nézet
    [-45, 60, 0]          // magas északi szélesség
  ];

  var PONTOK = racspontok();

  function egyVetites(nev, alapConfig) {
    var eredmeny = { projection: nev, rotations: [] };

    // FONTOS: a Celestial.apply() a projekciót NEM tudja átállítani — a readme
    // szerint a width, projection, transform és *.data újratöltést igényel.
    // Ha csak apply()-t hívnánk, minden vetítés ugyanazt a kimenetet adná, és
    // a referencia némán értéktelen lenne. (Ez a harness első verziójában
    // pontosan így is volt — a self_check fogta ki.)
    var config = {};
    for (var k in alapConfig) { config[k] = alapConfig[k]; }
    config.projection = nev;
    Celestial.display(config);

    for (var i = 0; i < FORGATASOK.length; i++) {
      var forgatas = FORGATASOK[i];
      try {
        Celestial.rotate({ center: forgatas });
      } catch (e) {
        eredmeny.rotations.push({ rotate: forgatas, error: String(e) });
        continue;
      }
      var pontLista = [];
      for (var j = 0; j < PONTOK.length; j++) {
        var koord = PONTOK[j];
        var pt = null;
        try {
          // A clip() mondja meg, hogy a pont a látható féltekén van-e.
          // Ezt is rögzítjük: a clipping viselkedése a migráció egyik
          // legkényesebb pontja.
          var lathato = Celestial.clip(koord);
          var vetitett = Celestial.mapProjection(koord);
          pt = vetitett
            ? [Math.round(vetitett[0] * 100) / 100, Math.round(vetitett[1] * 100) / 100,
               lathato ? 1 : 0]
            : null;
        } catch (e) {
          pt = "hiba";
        }
        pontLista.push(pt);
      }
      eredmeny.rotations.push({ rotate: forgatas, points: pontLista });
    }
    return eredmeny;
  }

  function fut() {
    var allapot = document.getElementById("allapot");
    var kimenet = document.getElementById("kimenet");

    var config = {
      container: "celestial-map",
      width: 800,
      projection: "airy",
      transform: "equatorial",
      interactive: false,
      form: false,
      controls: false,
      // Enélkül a Celestial.rotate() csak elindít egy d3-átmenetet, és a
      // szinkron mérés a forgatás ELŐTTI állapotot rögzíti — mind a négy
      // forgatás ugyanazt a koordinátát adná. (Az első háló pontosan így
      // volt hibás; az alábbi önellenőrzés fogja ki, ha visszatér.)
      disableAnimations: true,
      datapath: "./data/",         // a display() akkor is betölt, ha minden réteg rejtett
      stars: { show: false, data: "stars.6.json" },
      dsos: { show: false },
      planets: { show: false },
      constellations: { names: false, lines: false, bounds: false },
      mw: { show: false },
      lines: { graticule: { show: false } },
      horizon: { show: false },
      daylight: { show: false }
    };

    var referencia = {
      generalva: new Date().toISOString(),
      forras: "ofrohn/d3-celestial @ 7e720a3 (2022-07-05)",
      // A modulosított build magában hordozza a D3-at, tehát nincs globális d3 —
      // ilyenkor a könyvtár saját verziója azonosítja a mérést.
      d3: (typeof d3 !== "undefined" && d3.version) ? d3.version : "beépítve (nincs globális d3)",
      celestial: Celestial.version,
      config: { width: config.width, transform: config.transform },
      pontok_szama: PONTOK.length,
      forgatasok: FORGATASOK,
      vetitesek: []
    };

    // Két vetítés (cassini, quincuncial) a szállított upstream buildben sincs
    // benne — ott is hibát dob. Ezeket számon tartjuk, de nem tekintjük bukásnak.
    var sikeres = 0, sikertelen = [];
    for (var i = 0; i < VETITESEK.length; i++) {
      var nev = VETITESEK[i];
      try {
        var r = egyVetites(nev, config);
        referencia.vetitesek.push(r);
        sikeres++;
      } catch (e) {
        sikertelen.push(nev + ": " + e);
      }
    }

    // --- Önellenőrzés ---
    // Egy referencia-háló akkor ér valamit, ha bizonyíthatóan mér is valamit.
    // Ha két különböző vetítés ugyanazt a kimenetet adja, akkor a harness
    // hibás (pl. nem váltott vetítést), és a referencia némán értéktelen.
    var ujjlenyomatok = {};
    var utkozesek = [];
    for (var k = 0; k < referencia.vetitesek.length; k++) {
      var v = referencia.vetitesek[k];
      var elso = v.rotations[0] && v.rotations[0].points;
      if (!elso) { continue; }
      var ujj = JSON.stringify(elso);
      if (ujjlenyomatok[ujj]) {
        utkozesek.push(ujjlenyomatok[ujj] + " == " + v.projection);
      } else {
        ujjlenyomatok[ujj] = v.projection;
      }
    }

    // A forgatásoknak is meg kell mozdítaniuk a pixeleket. Ha egy vetítésen
    // belül két forgatás azonos koordinátákat ad, akkor a forgatás nem történt
    // meg, és a háló a látszat ellenére egyetlen állapotot mér.
    var forgatasUtkozesek = [];
    for (var m = 0; m < referencia.vetitesek.length; m++) {
      var vv = referencia.vetitesek[m], latott = {};
      for (var f = 0; f < vv.rotations.length; f++) {
        var koord = JSON.stringify((vv.rotations[f].points || []).map(function (pp) {
          return Array.isArray(pp) ? [pp[0], pp[1]] : pp;   // a clip-jelző nélkül
        }));
        if (latott[koord] !== undefined) {
          forgatasUtkozesek.push(vv.projection + ": fgt" + latott[koord] + " == fgt" + f);
        } else {
          latott[koord] = f;
        }
      }
    }

    // A pontoknak valóban különbözniük kell egymástól egy vetítésen belül is.
    var elsoVetites = referencia.vetitesek[0];
    var egyediPontok = new Set(
      (elsoVetites.rotations[0].points || []).map(function (p) { return JSON.stringify(p); })
    ).size;

    referencia.osszegzes = {
      vetitesek_sikeres: sikeres,
      vetitesek_sikertelen: sikertelen,
      ossz_pont: sikeres * FORGATASOK.length * PONTOK.length,
      self_check: {
        azonos_kimenetu_vetitesek: utkozesek,
        azonos_kimenetu_forgatasok: forgatasUtkozesek,
        egyedi_pont_az_elso_vetitesben: egyediPontok + "/" + PONTOK.length,
        rendben: utkozesek.length === 0 && forgatasUtkozesek.length === 0 &&
                 egyediPontok > PONTOK.length * 0.5
      }
    };

    window.REFERENCIA = referencia;
    allapot.innerHTML = '<span class="ok">Kész.</span> ' + sikeres + "/" +
      VETITESEK.length + " vetítés, " + referencia.osszegzes.ossz_pont +
      " mért pont. Celestial " + referencia.celestial + ", D3: " + referencia.d3;
    // Letöltés: a referencia-fájl a repóba kerül, és ehhez méri magát a
    // migrált verzió. Böngészőből mentjük, mert a generálás is böngészőben
    // fut — a d3-celestial DOM-ot és canvas-t igényel.
    var gomb = document.getElementById("letolt");
    if (gomb) {
      gomb.disabled = false;
      gomb.addEventListener("click", function () {
        var blob = new Blob([JSON.stringify(referencia)], { type: "application/json" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "referencia-d3v3.json";
        a.click();
        URL.revokeObjectURL(a.href);
      });
      document.getElementById("letolt-info").textContent =
        " (" + Math.round(JSON.stringify(referencia).length / 1024) + " KB)";
    }

    kimenet.textContent = JSON.stringify(referencia.osszegzes, null, 2) +
      "\n\nMinta (airy, alaphelyzet, első 5 pont):\n" +
      JSON.stringify(referencia.vetitesek[0].rotations[0].points.slice(0, 5));
  }

  if (document.readyState === "complete") { fut(); }
  else { window.addEventListener("load", fut); }
})();
