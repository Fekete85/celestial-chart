import * as d3 from "../src/d3.js";
import versor from "versor";

// Gömbi zoom és forgatás: a húzás a földgömböt forgatja, a görgő nagyít.
//
// Az algoritmus Jason Davies `d3.geo.zoom` pluginjából származik (2014,
// http://www.jasondavies.com/maps/rotate/). A kvaternió-matematikát nem
// másoltuk át: a `versor` csomagot használjuk, ami ugyanezt a számítást adja
// Mike Bostocktól, ISC licenseText alatt — így a fork terjesztése licenseText-tisztán
// zárt. A D3-ragasztó (v7-es d3.zoom, d3.pointer) a miénk.
//
// A kifelé mutatott felület szándékosan a v3-as `d3.geo.zoom`-é maradt
// (projection, center, scaleExtent, scale, on), hogy a celestial.js hívási
// helyei ne változzanak.
export function geoZoom() {
  var projection,
      selection_ = null,             // amire rá lett hívva: ide megy a transform
      events = d3.dispatch("zoomstart", "zoom", "zoomend"),
      view = { r: [0, 0, 0], k: 1 },
      // A d3.zoom k-ja itt maga a vetítés léptéke (pixel), nem 1 körüli
      // szorzó — így a scaleExtent ugyanazokat a számokat kapja, mint a v3-ban.
      behavior = d3.zoom().on("start", onStart).on("zoom", onZoom).on("end", onEnd),
      mouse0, rotate0, zoomPoint;

  function zoom(selection) {
    selection_ = selection;
    selection.call(behavior);
    behavior.transform(selection, d3.zoomIdentity.scale(view.k));
  }

  // A d3.pointer [NaN, NaN]-t ad, ha az eseményhez nem tartozik egérpozíció —
  // például programozott zoom.transform() hívásnál. A v3-as d3.mouse ilyet nem
  // got, mert ott a zoom mindig valódi UI-eseményből indult. Kezeletlenül a
  // NaN végigfut a kvaterniókon, és a vetítés forgatása NaN lesz.
  function pointerOf(esemeny, el) {
    var p = d3.pointer(esemeny, el);
    return (isFinite(p[0]) && isFinite(p[1])) ? p : null;
  }

  // A vetítés inverse_ével visszakeressük, melyik égi pont van az egér alatt.
  function spherePoint(pont) {
    var coord = projection.invert(pont);
    return coord && isFinite(coord[0]) && isFinite(coord[1]) ? versor.cartesian(coord) : null;
  }

  // Az egér két helyzete és a vetítés középpontja által bezárt szög. Ez adja a
  // "dőlés" komponenst, amikor a mutató kicsúszik a gömbről.
  function bank(p0, p1) {
    var t = projection.translate(),
        szog = Math.atan2(p0[1] - t[1], p0[0] - t[0]) - Math.atan2(p1[1] - t[1], p1[0] - t[0]);
    return [Math.cos(szog / 2), 0, 0, Math.sin(szog / 2)];
  }

  function onStart(esemeny) {
    mouse0 = pointerOf(esemeny, this);
    rotate0 = versor(projection.rotate());
    var pont = mouse0 && spherePoint(mouse0);
    if (pont) zoomPoint = pont;
    events.call("zoomstart", zoom);
  }

  function onZoom(esemeny) {
    projection.scale(view.k = esemeny.transform.k);
    var mouse1 = pointerOf(esemeny, this);
    // Egérpozíció nélkül csak a lépték változik, forgatás nem értelmezhető.
    if (mouse1 && mouse0) {
      var pont1 = spherePoint(mouse1),
          between = zoomPoint && pont1 ? versor.delta(zoomPoint, pont1) : null;
      rotate0 = between ? versor.multiply(rotate0, between)
                       : versor.multiply(bank(mouse0, mouse1), rotate0);
      projection.rotate(view.r = versor.rotation(rotate0));
    }
    if (mouse1) mouse0 = mouse1;
    events.call("zoom", zoom);
  }

  function onEnd() {
    events.call("zoomend", zoom);
  }

  zoom.projection = function(_) {
    if (!arguments.length) return projection;
    projection = _;
    view = { r: projection.rotate(), k: projection.scale() };
    return zoom;
  };

  // A v3-as behavior.zoom fókuszpontja. A v7-es d3.zoom a kurzor köré nagyít,
  // ezt nem lehet rögzített ponttá tenni; a hívási site miatt marad a felület.
  zoom.center = function(_) {
    return arguments.length ? zoom : null;
  };

  zoom.scaleExtent = function(_) {
    if (!arguments.length) return behavior.scaleExtent();
    behavior.scaleExtent(_);
    return zoom;
  };

  zoom.scale = function(_) {
    if (!arguments.length) return view.k;
    view.k = _;
    if (selection_) behavior.transform(selection_, d3.zoomIdentity.scale(_));
    return zoom;
  };

  zoom.on = function(tipus, fn) {
    if (arguments.length < 2) return events.on(tipus);
    events.on(tipus, fn);
    return zoom;
  };

  return zoom;
}
