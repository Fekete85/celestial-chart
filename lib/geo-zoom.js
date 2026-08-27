import * as d3 from "../src/d3.js";

// A gömbi zoom/forgatás Jason Davies d3.geo.zoom pluginjából (2014,
// http://www.jasondavies.com, BSD). A kvaternió-matematika VÁLTOZATLAN — az
// nem függött a D3-tól. Csak a D3-ragasztó van újraírva: a v3-as
// d3.behavior.zoom + d3.event + d3.rebind helyett d3.zoom + eseményobjektum.
//
// A kifelé mutatott felület szándékosan a régi maradt (projection, center,
// scaleExtent, scale, on), hogy a celestial.js hívási helyei ne változzanak —
// így a D3-csere hatása elkülöníthető marad a szerkezeti átalakításétól.
function geoZoom() {
  var projection,
      valasztek = null,             // amire rá lett hívva: ide megy a transform
      esemenyek = d3.dispatch("zoomstart", "zoom", "zoomend"),
      view = { r: [0, 0, 0], k: 1 },
      // A d3.zoom k-ja itt maga a vetítés léptéke (pixel), nem 1 körüli
      // szorzó — így a scaleExtent ugyanazokat a számokat kapja, mint a v3-ban.
      viselkedes = d3.zoom().on("start", indul).on("zoom", zoomol).on("end", vege),
      mouse0, rotate0;

  function zoom(selection) {
    valasztek = selection;
    selection.call(viselkedes);
    viselkedes.transform(selection, d3.zoomIdentity.scale(view.k));
  }

  // A d3.pointer [NaN, NaN]-t ad, ha az eseményhez nem tartozik egérpozíció —
  // például programozott zoom.transform() hívásnál. A v3-as d3.mouse ilyet
  // nem kapott, mert ott a zoom mindig valódi UI-eseményből indult. Kezeletlenül
  // a NaN végigfut a kvaterniókon, és a vetítés forgatása NaN lesz.
  function mutato(esemeny, elem) {
    var p = d3.pointer(esemeny, elem);
    return (isFinite(p[0]) && isFinite(p[1])) ? p : null;
  }

  function indul(esemeny) {
    mouse0 = mutato(esemeny, this);
    rotate0 = quaternionFromEuler(projection.rotate());
    var pont = mouse0 && position(projection, mouse0);
    if (pont) zoom.zoomPoint = pont;
    esemenyek.call("zoomstart", zoom);
  }

  function zoomol(esemeny) {
    projection.scale(view.k = esemeny.transform.k);
    var mouse1 = mutato(esemeny, this);
    // Egérpozíció nélkül csak a lépték változik, forgatás nem értelmezhető.
    if (mouse1 && mouse0) {
      var between = rotateBetween(zoom.zoomPoint, position(projection, mouse1));
      projection.rotate(view.r = eulerFromQuaternion(rotate0 = between
          ? multiply(rotate0, between)
          : multiply(bank(projection, mouse0, mouse1), rotate0)));
    }
    if (mouse1) mouse0 = mouse1;
    esemenyek.call("zoom", zoom);
  }

  function vege() {
    esemenyek.call("zoomend", zoom);
  }

  zoom.projection = function(_) {
    if (!arguments.length) return projection;
    projection = _;
    view = { r: projection.rotate(), k: projection.scale() };
    return zoom;
  };

  // A v3-as behavior.zoom fókuszpontja. A v7-es d3.zoom a kurzor köré nagyít,
  // ezt nem lehet rögzített ponttá tenni; a hívási hely miatt marad a felület.
  zoom.center = function(_) {
    return arguments.length ? zoom : null;
  };

  zoom.scaleExtent = function(_) {
    if (!arguments.length) return viselkedes.scaleExtent();
    viselkedes.scaleExtent(_);
    return zoom;
  };

  zoom.scale = function(_) {
    if (!arguments.length) return view.k;
    view.k = _;
    if (valasztek) viselkedes.transform(valasztek, d3.zoomIdentity.scale(_));
    return zoom;
  };

  zoom.on = function(tipus, fn) {
    if (arguments.length < 2) return esemenyek.on(tipus);
    esemenyek.on(tipus, fn);
    return zoom;
  };

  return zoom;
}

// --- Innentől Jason Davies eredeti kódja, változatlanul ----------------------

function bank(projection, p0, p1) {
  var t = projection.translate(),
      angle = Math.atan2(p0[1] - t[1], p0[0] - t[0]) - Math.atan2(p1[1] - t[1], p1[0] - t[0]);
  return [Math.cos(angle / 2), 0, 0, Math.sin(angle / 2)];
}

function position(projection, point) {
  var spherical = projection.invert(point);
  return spherical && isFinite(spherical[0]) && isFinite(spherical[1]) && cartesian(spherical);
}

function quaternionFromEuler(euler) {
  var λ = .5 * euler[0] * Math.PI / 180,
      φ = .5 * euler[1] * Math.PI / 180,
      γ = .5 * euler[2] * Math.PI / 180,
      sinλ = Math.sin(λ), cosλ = Math.cos(λ),
      sinφ = Math.sin(φ), cosφ = Math.cos(φ),
      sinγ = Math.sin(γ), cosγ = Math.cos(γ);
  return [
    cosλ * cosφ * cosγ + sinλ * sinφ * sinγ,
    sinλ * cosφ * cosγ - cosλ * sinφ * sinγ,
    cosλ * sinφ * cosγ + sinλ * cosφ * sinγ,
    cosλ * cosφ * sinγ - sinλ * sinφ * cosγ
  ];
}

function multiply(a, b) {
  var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3],
      b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
  return [
    a0 * b0 - a1 * b1 - a2 * b2 - a3 * b3,
    a0 * b1 + a1 * b0 + a2 * b3 - a3 * b2,
    a0 * b2 - a1 * b3 + a2 * b0 + a3 * b1,
    a0 * b3 + a1 * b2 - a2 * b1 + a3 * b0
  ];
}

function rotateBetween(a, b) {
  if (!a || !b) return;
  var axis = cross(a, b),
      norm = Math.sqrt(dot(axis, axis)),
      halfγ = .5 * Math.acos(Math.max(-1, Math.min(1, dot(a, b)))),
      k = Math.sin(halfγ) / norm;
  return norm && [Math.cos(halfγ), axis[2] * k, -axis[1] * k, axis[0] * k];
}

function eulerFromQuaternion(q) {
  var degrees = 180 / Math.PI;
  return [
    Math.atan2(2 * (q[0] * q[1] + q[2] * q[3]), 1 - 2 * (q[1] * q[1] + q[2] * q[2])) * degrees,
    Math.asin(Math.max(-1, Math.min(1, 2 * (q[0] * q[2] - q[3] * q[1])))) * degrees,
    Math.atan2(2 * (q[0] * q[3] + q[1] * q[2]), 1 - 2 * (q[2] * q[2] + q[3] * q[3])) * degrees
  ];
}

function cartesian(spherical) {
  var λ = spherical[0] * Math.PI / 180,
      φ = spherical[1] * Math.PI / 180,
      cosφ = Math.cos(φ);
  return [cosφ * Math.cos(λ), cosφ * Math.sin(λ), Math.sin(φ)];
}

function dot(a, b) {
  for (var i = 0, n = a.length, s = 0; i < n; ++i) s += a[i] * b[i];
  return s;
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

export { geoZoom };
