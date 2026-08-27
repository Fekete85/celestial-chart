/* Reference generator for the d3-celestial projections.
 *
 * Why this is the crux: in 2021 the author himself wrote in an issue that
 * "the app has reached a state where it is difficult to add features without
 * breaking something". That is not about the D3 version, it is about there
 * being no regression net. In a projection library correctness means that the
 * pixels are in the right place — and if that cannot be checked automatically,
 * every change is roulette.
 *
 * A projection, however, is deterministic: for a given configuration and input
 * it always produces the same output. So it can be recorded, and the migrated
 * version has to produce the same thing — within a given tolerance.
 *
 * The generated JSON ends up in window.REFERENCE and is also shown on the page.
 */
(function () {
  "use strict";

  // The projections under test. d3-celestial builds these on the
  // d3.geo.projection (v3) API; in v7 that is d3.geoProjection +
  // d3-geo-projection, with different names and in places different behaviour —
  // which is exactly why it has to be measured.
  // EVERY configured projection, not a selection. The net only protects what it
  // measures: with 25 projections a broken formula in the remaining 44 would go
  // unnoticed. We take the list from config.js so that it cannot drift apart
  // from it.
  var PROJECTIONS = Object.keys(Celestial.projections());

  // Grid points on the sky: RA every 15 degrees, Dec every 10 degrees.
  // That is 24 x 17 = 408 points per projection — dense enough that a broken
  // projection is certain to stand out, and sparse enough that the file stays
  // manageable.
  function gridPoints() {
    var points_ = [];
    for (var ra = -180; ra < 180; ra += 15) {
      for (var dec = -80; dec <= 80; dec += 10) {
        points_.push([ra, dec]);
      }
    }
    // Poles and edge cases separately: these are where clipping tends to fall over.
    points_.push([0, 90], [0, -90], [179.99, 0], [-179.99, 0], [0, 0]);
    return points_;
  }

  // Rotation states — d3-celestial tracks the observer's location and the time
  // with these. [0,0,0] is the default orientation, the rest are real observing
  // situations.
  var ROTATIONS = [
    [0, 0, 0],
    [-80.9, -47.5, 0],    // the zenith over Budapest on an August evening
    [120, -30, 15],       // tilted view
    [-45, 60, 0]          // high northern latitude
  ];

  var POINTS = gridPoints();

  function oneProjection(name_, baseConfig) {
    var result = { projection: name_, rotations: [] };

    // IMPORTANT: Celestial.apply() can NOT switch the projection — according to
    // the readme, width, projection, transform and *.data require a reload.
    // If we only called apply(), every projection would produce the same output
    // and the reference would be silently worthless. (That is exactly what the
    // first version of the harness did — the self_check caught it.)
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
          // clip() tells us whether the point is on the visible hemisphere.
          // We record this too: the behaviour of clipping is one of the most
          // delicate points of the migration.
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
      // Without this, Celestial.rotate() only starts a d3 transition, and the
      // synchronous measurement records the state BEFORE the rotation — all
      // four rotations would give the same coordinates. (The first net was
      // wrong in exactly this way; the self-check below catches it if it comes
      // back.)
      disableAnimations: true,
      datapath: "./data/",         // display() loads even when every layer is hidden
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
      // The modularised build carries D3 inside it, so there is no global d3 —
      // in that case the library's own version identifies the measurement.
      d3: (typeof d3 !== "undefined" && d3.version) ? d3.version : "bundled (no global d3)",
      celestial: Celestial.version,
      config: { width: config.width, transform: config.transform },
      point_count: POINTS.length,
      rotations: ROTATIONS,
      projections: []
    };

    // Two projections (cassini, quincuncial) are missing from the shipped
    // upstream build as well — they throw there too. We keep track of them, but
    // we do not treat them as failures.
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

    // --- Self-check ---
    // A reference net is only worth something if it demonstrably measures
    // something. If two different projections produce the same output, then the
    // harness is broken (e.g. it did not switch projection), and the reference
    // is silently worthless.
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

    // The rotations have to move the pixels as well. If two rotations within a
    // projection give identical coordinates, then the rotation did not happen,
    // and despite appearances the net measures a single state.
    var rotationCollisions = [];
    for (var m = 0; m < reference.projections.length; m++) {
      var proj = reference.projections[m], seen = {};
      for (var f = 0; f < proj.rotations.length; f++) {
        var coord = JSON.stringify((proj.rotations[f].points || []).map(function (pp) {
          return Array.isArray(pp) ? [pp[0], pp[1]] : pp;   // without the clip flag
        }));
        if (seen[coord] !== undefined) {
          rotationCollisions.push(proj.projection + ": rot" + seen[coord] + " == rot" + f);
        } else {
          seen[coord] = f;
        }
      }
    }

    // The points really do have to differ from each other within a projection too.
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
    statusEl.innerHTML = '<span class="ok">Done.</span> ' + okCount + "/" +
      PROJECTIONS.length + " projections, " + reference.summary.total_points +
      " measured points. Celestial " + reference.celestial + ", D3: " + reference.d3;
    // Download: the reference file goes into the repo, and the migrated version
    // measures itself against it. We save it from the browser, because the
    // generation runs in the browser too — d3-celestial needs a DOM and a canvas.
    var button = document.getElementById("download");
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
      document.getElementById("download-info").textContent =
        " (" + Math.round(JSON.stringify(reference).length / 1024) + " KB)";
    }

    output.textContent = JSON.stringify(reference.summary, null, 2) +
      "\n\nSample (airy, default orientation, first 5 points):\n" +
      JSON.stringify(reference.projections[0].rotations[0].points.slice(0, 5));
  }

  if (document.readyState === "complete") { running(); }
  else { window.addEventListener("load", running); }
})();
