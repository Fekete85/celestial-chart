/* Referencia-generátor a d3-celestial vetítéseihez.
 *
 * Miért ez a lényeg: a szerző 2021-ben maga írta egy issue-ban, hogy
 * "the app has reached a state where it is difficult to add features without
 * breaking something". Ez nem a D3 verziójáról szól, hanem arról, hogy nincs
 * regressziós háló. Egy vetítési könyvtárnál a helyesség azt jelenti, hogy a
 * pixelek a siteükön vannak — ha ezt nem lehet automatikusan ellenőrizni,
 * minden változtatás rulett.
 *
 * A vetítés viszont determinisztikus: adott konfiguráció és bemenet mellett
 * mindig ugyanaz a output. Tehát rögzíthető, és a migrált verziónak — adott
 * tűréssel — ugyanazt kell adnia.
 *
 * A generált JSON a window.REFERENCE-ba kerül, és az oldalon is megjelenik.
 */
(function () {
  "use strict";

  // A vizsgált vetítések. A d3-celestial ezeket a d3.geo.projection (v3) API-ra
  // építi; a v7-ben ez d3.geoProjection + d3-geo-projection, más névvel és
  // helyenként más viselkedéssel — pont ezért kell mérni.
  // MINDEN konfigurált vetítés, nem egy válogatás. A háló csak arra véd, amit
  // mér: 25 vetítéssel a maradék 44-ben egy elrontott képlet észrevétlen
  // maradna. A listát a config.js-ből vesszük, hogy ne csússzon el tőle.
  var PROJECTIONS = Object.keys(Celestial.projections());

  // Rácspontok az égen: 15 fokonként RA, 10 fokonként Dec.
  // Ez 24 x 17 = 408 pont vetítésenként — elég sűrű ahhoz, hogy egy elrontott
  // vetítés biztosan kilógjon, és elég ritka, hogy a fájl kezelhető maradjon.
  function gridPoints() {
    var points_ = [];
    for (var ra = -180; ra < 180; ra += 15) {
      for (var dec = -80; dec <= 80; dec += 10) {
        points_.push([ra, dec]);
      }
    }
    // Sarkok és peremesetek külön: ezeken szokott elhasalni a clipping.
    points_.push([0, 90], [0, -90], [179.99, 0], [-179.99, 0], [0, 0]);
    return points_;
  }

  // Forgatási állapotok — a d3-celestial ezekkel követi a megfigyelő siteét
  // és az időt. A [0,0,0] az alaphelyzet, a többi valós észlelési helyzet.
  var ROTATIONS = [
    [0, 0, 0],
    [-80.9, -47.5, 0],    // Budapest zenitje egy augusztusi este
    [120, -30, 15],       // döntött nézet
    [-45, 60, 0]          // magas északi szélesség
  ];

  var POINTS = gridPoints();

  function oneProjection(name_, baseConfig) {
    var result = { projection: name_, rotations: [] };

    // FONTOS: a Celestial.apply() a projekciót NEM tudja átállítani — a readme
    // szerint a width, projection, transform és *.data újratöltést igényel.
    // Ha csak apply()-t hívnánk, minden vetítés ugyanazt a kimenetet adná, és
    // a reference némán értéktelen lenne. (Ez a harness első verziójában
    // pontosan így is volt — a self_check fogta out.)
    var config = {};
    for (var k in baseConfig) { config[k] = baseConfig[k]; }
    config.projection = name_;
    Celestial.display(config);

    for (var i = 0; i < ROTATIONS.length; i++) {
      var rotation_ = ROTATIONS[i];
      try {
        Celestial.rotate({ center: rotation_ });
      } catch (e) {
        result.rotations.push({ rotate: rotation_, error: String(e) });
        continue;
      }
      var pointList = [];
      for (var j = 0; j < POINTS.length; j++) {
        var coord = POINTS[j];
        var pt = null;
        try {
          // A clip() mondja meg, hogy a pont a látható féltekén van-e.
          // Ezt is rögzítjük: a clipping viselkedése a migráció egyik
          // legkényesebb pontja.
          var visible = Celestial.clip(coord);
          var projected = Celestial.mapProjection(coord);
          pt = projected
            ? [Math.round(projected[0] * 100) / 100, Math.round(projected[1] * 100) / 100,
               visible ? 1 : 0]
            : null;
        } catch (e) {
          pt = "error_";
        }
        pointList.push(pt);
      }
      result.rotations.push({ rotate: rotation_, points: pointList });
    }
    return result;
  }

  function running() {
    var statusEl = document.getElementById("statusEl");
    var output = document.getElementById("output");

    var config = {
      container: "celestial-map",
      width: 800,
      projection: "airy",
      transform: "equatorial",
      interactive: false,
      form: false,
      controls: false,
      // Enélkül a Celestial.rotate() csak elindít egy d3-átmenetet, és a
      // szinkron mérés a forgatás ELŐTTI állapotot rögzíti — all_ a négy
      // forgatás ugyanazt a koordinátát adná. (Az első háló pontosan így
      // volt hibás; az alábbi önellenőrzés fogja out, ha visszatér.)
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

    var reference = {
      generated: new Date().toISOString(),
      source: "ofrohn/d3-celestial @ 7e720a3 (2022-07-05)",
      // A modulosított build magában hordozza a D3-at, tehát nincs globális d3 —
      // ilyenkor a könyvtár saját verziója sameítja a mérést.
      d3: (typeof d3 !== "undefined" && d3.version) ? d3.version : "beépítve (nincs globális d3)",
      celestial: Celestial.version,
      config: { width: config.width, transform: config.transform },
      point_count: POINTS.length,
      rotations: ROTATIONS,
      projections: []
    };

    // Két vetítés (cassini, quincuncial) a szállított upstream buildben sincs
    // benne — ott is hibát dob. Ezeket számon tartjuk, de nem tekintjük bukásnak.
    var okCount = 0, failed = [];
    for (var i = 0; i < PROJECTIONS.length; i++) {
      var name_ = PROJECTIONS[i];
      try {
        var r = oneProjection(name_, config);
        reference.projections.push(r);
        okCount++;
      } catch (e) {
        failed.push(name_ + ": " + e);
      }
    }

    // --- Önellenőrzés ---
    // Egy reference-háló akkor ér valamit, ha bizonyíthatóan mér is valamit.
    // Ha két különböző vetítés ugyanazt a kimenetet adja, akkor a harness
    // hibás (pl. nem váltott vetítést), és a reference némán értéktelen.
    var fingerprints = {};
    var collisions = [];
    for (var k = 0; k < reference.projections.length; k++) {
      var v = reference.projections[k];
      var first = v.rotations[0] && v.rotations[0].points;
      if (!first) { continue; }
      var fp = JSON.stringify(first);
      if (fingerprints[fp]) {
        collisions.push(fingerprints[fp] + " == " + v.projection);
      } else {
        fingerprints[fp] = v.projection;
      }
    }

    // A forgatásoknak is meg kell mozdítaniuk a pixeleket. Ha egy vetítésen
    // belül két forgatás same koordinátákat ad, akkor a forgatás nem történt
    // meg, és a háló a látszat ellenére egyetlen állapotot mér.
    var rotationCollisions = [];
    for (var m = 0; m < reference.projections.length; m++) {
      var proj = reference.projections[m], seen = {};
      for (var f = 0; f < proj.rotations.length; f++) {
        var coord = JSON.stringify((proj.rotations[f].points || []).map(function (pp) {
          return Array.isArray(pp) ? [pp[0], pp[1]] : pp;   // a clip-jelző nélkül
        }));
        if (seen[coord] !== undefined) {
          rotationCollisions.push(proj.projection + ": fgt" + seen[coord] + " == fgt" + f);
        } else {
          seen[coord] = f;
        }
      }
    }

    // A pontoknak valóban különbözniük kell egymástól egy vetítésen belül is.
    var firstProjection = reference.projections[0];
    var uniquePoints = new Set(
      (firstProjection.rotations[0].points || []).map(function (p) { return JSON.stringify(p); })
    ).size;

    reference.summary = {
      projections_ok: okCount,
      projections_failed: failed,
      total_points: okCount * ROTATIONS.length * POINTS.length,
      self_check: {
        identical_projections: collisions,
        identical_rotations: rotationCollisions,
        unique_points_first_projection: uniquePoints + "/" + POINTS.length,
        ok: collisions.length === 0 && rotationCollisions.length === 0 &&
                 uniquePoints > POINTS.length * 0.5
      }
    };

    window.REFERENCE = reference;
    statusEl.innerHTML = '<span class="ok">Kész.</span> ' + okCount + "/" +
      PROJECTIONS.length + " vetítés, " + reference.summary.total_points +
      " mért pont. Celestial " + reference.celestial + ", D3: " + reference.d3;
    // Letöltés: a reference-fájl a repóba kerül, és ehhez méri magát a
    // migrált verzió. Böngészőből mentjük, mert a generálás is böngészőben
    // running — a d3-celestial DOM-ot és canvas-t igényel.
    var button = document.getElementById("letolt");
    if (button) {
      button.disabled = false;
      button.addEventListener("click", function () {
        var blob = new Blob([JSON.stringify(reference)], { type: "application/json" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "reference-d3v3.json";
        a.click();
        URL.revokeObjectURL(a.href);
      });
      document.getElementById("letolt-info").textContent =
        " (" + Math.round(JSON.stringify(reference).length / 1024) + " KB)";
    }

    output.textContent = JSON.stringify(reference.summary, null, 2) +
      "\n\nMinta (airy, alaphelyzet, első 5 pont):\n" +
      JSON.stringify(reference.projections[0].rotations[0].points.slice(0, 5));
  }

  if (document.readyState === "complete") { running(); }
  else { window.addEventListener("load", running); }
})();
