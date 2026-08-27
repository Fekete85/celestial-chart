// The projections' raw functions are resolved by name, so the two packages are
// imported as namespaces here — this is the only place in the library where the
// access is dynamic.
import * as d3geo from "d3-geo";
import * as d3geoproj from "d3-geo-projection";
import * as d3 from "./d3.js";
import { projections } from "./config.js";
import { Celestial } from "./core.js";
import { has } from "./util.js";

// d3 v3 used the form `d3.geo.<name>.raw`; in v7 that is `d3.geo<Name>Raw`, and
// a few projections were renamed as well. The exceptions are listed here —
// anything not in the table follows the naming convention.
var RAW_RENAMES = {
  "naturalEarth": "geoNaturalEarth1Raw"   // a v3 plugin Natural Earth I-et adott
};

// A few projections' raw functions interpret their argument differently in v4.
// The values in config.js are calibrated for v3, so they are adapted here.
var ARG_ADAPT = {
  // The first thing v4's twoPointEquidistantRaw does is `z0 *= 2`. v3 used the
  // argument directly, so it has to be halved to get the same projection.
  "twoPointEquidistant": function (z) { return z / 2; }
};

// Two projections lost their raw function in d3-geo-projection v4, although the
// v3 plugin had them. The formulas are taken from there unchanged — and
// test/projections.test.mjs measures them against the v3 output to 1e-10.
var LOCAL_RAW = {
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
  // v4's healpixRaw RESCALED the projection (v3 did `point[0] /= 2`, v4 does
  // `point[0] *= 4/tau` and `point[1] /= h`) — and differently for x and y, so
  // the aspect ratio changed too. The scale/ratio values in config.js are
  // calibrated for v3, so the v3 version is carried forward. Collignon and the
  // cylindrical equal-area projection come from v4.
  "healpix": function (h) {
    var lambert = d3geoproj.geoCylindricalEqualAreaRaw(0),
        collignon = d3geoproj.geoCollignonRaw,
        pi = Math.PI, halfPi = pi / 2,
        healpixParallel = 41 + 48 / 36 + 37 / 3600,
        f0 = healpixParallel * pi / 180,
        dx0 = 2 * pi,
        dx1 = collignon(pi, f0)[0] - collignon(-pi, f0)[0],
        y0 = lambert(0, f0)[1],
        y1 = collignon(0, f0)[1],
        dy1 = collignon(0, halfPi)[1] - y1,
        k = 2 * pi / h;

    function forward(l, f) {
      var point, f2 = Math.abs(f);
      if (f2 > f0) {
        var i = Math.min(h - 1, Math.max(0, Math.floor((l + pi) / k)));
        l += pi * (h - 1) / h - i * k;
        point = collignon(l, f2);
        point[0] = point[0] * dx0 / dx1 - dx0 * (h - 1) / (2 * h) + i * dx0 / h;
        point[1] = y0 + (point[1] - y1) * 4 * dy1 / dx0;
        if (f < 0) point[1] = -point[1];
      } else {
        point = lambert(l, f);
      }
      point[0] /= 2;
      return point;
    }

    forward.invert = function (x, y) {
      x *= 2;
      var y2 = Math.abs(y);
      if (y2 > y0) {
        var i = Math.min(h - 1, Math.max(0, Math.floor((x + pi) / k)));
        x = (x + pi * (h - 1) / h - i * k) * dx1 / dx0;
        var point = collignon.invert(x, 0.25 * (y2 - y0) * dx0 / dy1 + y1);
        point[0] -= pi * (h - 1) / h - i * k;
        if (y < 0) point[1] = -point[1];
        return point;
      }
      return lambert.invert(x, y);
    };

    return forward;
  },
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

// Resolves a projection's raw function from its name, including the argument
// adaptation. Exported because the tests measure this against the pinned v3
// output.
function rawProjection(name_, arg) {
  var raw = has(LOCAL_RAW, name_) ? LOCAL_RAW[name_]
          : (function () {
              var key_ = RAW_RENAMES[name_] || ("geo" + name_.charAt(0).toUpperCase() + name_.slice(1) + "Raw");
              return d3geoproj[key_] || d3geo[key_];
            })();
  if (!raw || arg === undefined || arg === null) return raw;
  return raw(has(ARG_ADAPT, name_) ? ARG_ADAPT[name_](arg) : arg);
}

//Flipped projection generated on the fly
Celestial.projection = function(projection) {
  var p, raw, forward;

  if (!has(projections, projection)) { throw new Error("Projection not supported: " + projection); }
  p = projections[projection];

  raw = rawProjection(projection, p.arg);
  if (!raw) { throw new Error("Projection not supported: " + projection); }

  // We look at the sky mirrored: from the outside in, not from the inside out.
  // The v3 code did this by wrapping the raw function — `raw(-lambda, phi)` — and
  // ezt tartjuk meg.
  //
  // v7's reflectX(true) would be the obvious choice, and for 65 projections it
  // gives exactly the same result. But not for all of them: for `wiechel` it
  // differs by 795 pixels, because there the sign of lambda matters INSIDE the
  // formula too (`atan2(sin lambda * cos phi, -sin phi)`), not only in the
  // x coordinate of the result. Wrapping is unaffected by this.
  forward = function (l, f) { return raw(-l, f); };
  forward.invert = function (x, y) {
    var coord = raw.invert && raw.invert(x, y);
    if (coord) coord[0] = -coord[0];
    return coord;
  };
  return d3.geoProjection(forward);
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

export { eulerAngles, poles, projectionTween, rawProjection };
