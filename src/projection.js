/* global Celestial, projections, has */

// A d3 v3 a `d3.geo.<nev>.raw` alakot használta; a v7-ben ez `d3.geo<Nev>Raw`,
// és néhány vetítés át is lett nevezve. A kivételek itt vannak felsorolva —
// ami nem szerepel a táblában, azt a névkonvenció adja.
var RAW_ATNEVEZES = {
  "naturalEarth": "geoNaturalEarth1Raw"   // a v3 plugin Natural Earth I-et adott
};

// A d3-geo-projection v4-ből két vetítés raw függvénye kimaradt, pedig a v3-as
// pluginban megvolt. A képletek innen származnak, változtatás nélkül — a
// test/vetitesek.teszt.mjs a v3-as kimenethez méri őket, 1e-10 tűréssel.
var POTOLT_RAW = {
  "hatano": (function () {
    var eps = 1e-6, halfPi = Math.PI / 2;
    function hatano(l, f) {
      var c = Math.sin(f) * (f < 0 ? 2.43763 : 2.67595);
      for (var i = 0, d; i < 20; i++) {
        f -= d = (f + Math.sin(f) - c) / (1 + Math.cos(f));
        if (Math.abs(d) < eps) break;
      }
      return [0.85 * l * Math.cos(f *= 0.5), Math.sin(f) * (f < 0 ? 1.93052 : 1.75859)];
    }
    hatano.invert = function (x, y) {
      var t = Math.abs(t = y * (y < 0 ? 0.5179951515653813 : 0.5686373742600607)) > 1 - eps
              ? (t > 0 ? halfPi : -halfPi) : Math.asin(t);
      return [1.1764705882352942 * x / Math.cos(t),
              Math.abs(t = ((t += t) + Math.sin(t)) * (y < 0 ? 0.4102345310814193 : 0.3736990601468637)) > 1 - eps
              ? (t > 0 ? halfPi : -halfPi) : Math.asin(t)];
    };
    return hatano;
  })(),
  "wagner7": (function () {
    function wagner7(l, f) {
      var s = 0.90631 * Math.sin(f),
          c0 = Math.sqrt(1 - s * s),
          c1 = Math.sqrt(2 / (1 + c0 * Math.cos(l /= 3)));
      return [2.66723 * c0 * c1 * Math.sin(l), 1.24104 * s * c1];
    }
    wagner7.invert = function (x, y) {
      var t1 = x / 2.66723, t2 = y / 1.24104,
          p = Math.sqrt(t1 * t1 + t2 * t2),
          c = 2 * Math.asin(Math.max(-1, Math.min(1, p / 2)));
      return [3 * Math.atan2(x * Math.tan(c), 2.66723 * p),
              p && Math.asin(Math.max(-1, Math.min(1, y * Math.sin(c) / (1.24104 * 0.90631 * p))))];
    };
    return wagner7;
  })()
};

function rawVetites(nev) {
  if (has(POTOLT_RAW, nev)) { return POTOLT_RAW[nev]; }
  var kulcs = RAW_ATNEVEZES[nev] || ("geo" + nev.charAt(0).toUpperCase() + nev.slice(1) + "Raw");
  return d3[kulcs];
}

//Flipped projection generated on the fly
Celestial.projection = function(projection) {
  var p, raw;

  if (!has(projections, projection)) { throw new Error("Projection not supported: " + projection); }
  p = projections[projection];

  raw = rawVetites(projection);
  if (!raw) { throw new Error("Projection not supported: " + projection); }

  if (p.arg !== null) raw = raw(p.arg);

  // Az égboltot tükrözve nézzük: kívülről befelé, nem belülről kifelé. A v3-as
  // kód ezt a raw függvény becsomagolásával oldotta meg — `raw(-λ, φ)` —, a
  // v7-ben erre való a reflectX. A kettő számszerűen azonos (a harness minden
  // vetítésen 1e-9 alatti eltérést mért), de a reflectX az invert irányt is
  // magától kezeli, nem kell kézzel visszatükrözni.
  return d3.geoProjection(raw).reflectX(true);
};


function projectionTween(a, b) {
  var prj = d3.geoProjection(raw).scale(1),
      center = prj.center,
      translate = prj.translate,
      α;

  function raw(λ, φ) {
    var pa = a([λ *= 180 / Math.PI, φ *= 180 / Math.PI]), pb = b([λ, φ]);
    return [(1 - α) * pa[0] + α * pb[0], (α - 1) * pa[1] - α * pb[1]];
  }

  prj.alpha = function(_) {
    if (!arguments.length) return α;
    α = +_;
    var ca = a.center(), cb = b.center(),
        ta = a.translate(), tb = b.translate();
    
    center([(1 - α) * ca[0] + α * cb[0], (1 - α) * ca[1] + α * cb[1]]);
    translate([(1 - α) * ta[0] + α * tb[0], (1 - α) * ta[1] + α * tb[1]]);
    return prj;
  };

  delete prj.translate;
  delete prj.center;
  return prj.alpha(0);
}

var eulerAngles = {
  "equatorial": [0.0, 0.0, 0.0],
  "ecliptic": [0.0, 0.0, 23.4393],
  "galactic": [93.5949, 28.9362, -58.5988],
  "supergalactic": [137.3100, 59.5283, 57.7303]
//  "mars": [97.5,23.5,29]
};

var poles = {
  "equatorial": [0.0, 90.0],
  "ecliptic": [-90.0, 66.5607],
  "galactic": [-167.1405, 27.1283],
  "supergalactic": [-76.2458, 15.7089]
//  "mars": [-42.3186, 52.8865]
};

Celestial.eulerAngles = function () { return eulerAngles; };
Celestial.poles = function () { return poles; };
