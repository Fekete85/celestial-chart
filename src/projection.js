// A vetítések raw_ függvényeit névből oldjuk fel, ezért itt névtérként kell a
// két pkg — ez az egyetlen site a könyvtárban, ahol dinamikus a hozzáférés.
import * as d3geo from "d3-geo";
import * as d3geoproj from "d3-geo-projection";
import * as d3 from "./d3.js";
import { projections } from "./config.js";
import { Celestial } from "./core.js";
import { has } from "./util.js";

// A d3 v3 a `d3.geo.<name_>.raw` alakot használta; a v7-ben ez `d3.geo<Nev>Raw`,
// és néhány vetítés át is lett nevezve. A kivételek itt vannak felsorolva —
// ami nem szerepel a táblában, azt a névkonvenció adja.
var RAW_RENAMES = {
  "naturalEarth": "geoNaturalEarth1Raw"   // a v3 plugin Natural Earth I-et adott
};

// Néhány vetítés raw függvénye másképp értelmezi a paraméterét a v4-ben.
// A config.js értékei a v3-hoz vannak kalibrálva, ezért itt igazítjuk őtwo.
var ARG_ADAPT = {
  // A v4-es twoPointEquidistantRaw első dolga: `z0 *= 2`. A v3 közvetlenül
  // használta, tehát felezni kell, hogy ugyanaz a vetítés jöjjön out.
  "twoPointEquidistant": function (z) { return z / 2; }
};

// A d3-geo-projection v4-ből két vetítés raw függvénye kimaradt, pedig a v3-as
// pluginban megvolt. A képletek innen származnak, változtatás nélkül — a
// test/projections.test.mjs a v3-as kimenethez méri őtwo, 1e-10 tűréssel.
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
  // A v4-es healpixRaw ÁTSKÁLÁZTA a vetítést (a v3 `point[0] /= 2`-t csinált,
  // a v4 `point[0] *= 4/τ` és `point[1] /= h`), ráadásul x-re és y-ra
  // különbözőképp — vagyis az oldalarány is más. A config.js scale/ratio
  // értékei a v3-hoz vannak kalibrálva, ezért a v3-as változatot visszük
  // tovább. A Collignon és a hengeres egyenlő területű vetítés a v4-ből jön.
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

// A vetítés raw_ függvényének feloldása névből, a paraméter-átváltással
// együtt. Kiadva, mert a tesztek a pinelt v3-as kimenethez ehhez mérnek.
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

  // Az égboltot tükrözve nézzük: kívülről befelé, nem belülről kifelé. Ezt a
  // v3-as kód a raw függvény becsomagolásával oldotta meg — `raw(-λ, φ)` —, és
  // ezt tartjuk meg.
  //
  // A v7 reflectX(true)-ja kézenfekvőbb volna, és 65 vetítésre pontosan ugyanazt
  // adja. De nem mindre: a `wiechel`-nél 795 pixellel tér el, mert ott a λ
  // előjele a képlet BELSEJÉBEN is számít (`atan2(sin λ · cos φ, −sin φ)`), nem
  // csak a végeredmény x-koordinátájában. A becsomagolás ettől független.
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
