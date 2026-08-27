import * as d3 from "../src/d3.js";
import versor from "versor";

// Spherical zoom and rotation: dragging turns the globe, the wheel zooms.
//
// The algorithm comes from Jason Davies' `d3.geo.zoom` plugin (2014,
// http://www.jasondavies.com/maps/rotate/). The quaternion mathematics is not
// copied from it: we use the `versor` package, which provides the same
// computation from Mike Bostock under the ISC licence — so distributing this
// fork is licence-clean. The D3 glue (v7 d3.zoom, d3.pointer) is ours.
//
// The outward interface deliberately stays that of the v3 `d3.geo.zoom`
// (projection, center, scaleExtent, scale, on), so that celestial.js's call
// sites did not have to change.
export function geoZoom() {
  var projection,
      selection_ = null,             // what it was called on: the transform goes here
      events = d3.dispatch("zoomstart", "zoom", "zoomend"),
      view = { r: [0, 0, 0], k: 1 },
      // Here d3.zoom's k is the projection scale itself (in pixels), not a
      // factor around 1 — so scaleExtent receives the same numbers as in v3.
      behavior = d3.zoom().on("start", onStart).on("zoom", onZoom).on("end", onEnd),
      mouse0, rotate0, zoomPoint;

  function zoom(selection) {
    selection_ = selection;
    selection.call(behavior);
    behavior.transform(selection, d3.zoomIdentity.scale(view.k));
  }

  // d3.pointer returns [NaN, NaN] when the event carries no pointer position —
  // for instance on a programmatic zoom.transform() call. v3's d3.mouse never
  // saw such a case, because there the zoom always started from a real UI event.
  // Left unhandled, the NaN travels through the quaternions and the projection's
  // rotation becomes NaN.
  function pointerOf(event_, el) {
    var p = d3.pointer(event_, el);
    return (isFinite(p[0]) && isFinite(p[1])) ? p : null;
  }

  // Use the projection's inverse to find which point of the sky is under the cursor.
  function spherePoint(point_) {
    var coord = projection.invert(point_);
    return coord && isFinite(coord[0]) && isFinite(coord[1]) ? versor.cartesian(coord) : null;
  }

  // The angle subtended by the two pointer positions at the projection centre.
  // This gives the "bank" component when the pointer slides off the globe.
  function bank(p0, p1) {
    var t = projection.translate(),
        angle_ = Math.atan2(p0[1] - t[1], p0[0] - t[0]) - Math.atan2(p1[1] - t[1], p1[0] - t[0]);
    return [Math.cos(angle_ / 2), 0, 0, Math.sin(angle_ / 2)];
  }

  function onStart(event_) {
    mouse0 = pointerOf(event_, this);
    rotate0 = versor(projection.rotate());
    var point_ = mouse0 && spherePoint(mouse0);
    if (point_) zoomPoint = point_;
    events.call("zoomstart", zoom);
  }

  function onZoom(event_) {
    projection.scale(view.k = event_.transform.k);
    var mouse1 = pointerOf(event_, this);
    // Without a pointer position only the scale changes; rotation is undefined.
    if (mouse1 && mouse0) {
      var point1 = spherePoint(mouse1),
          between = zoomPoint && point1 ? versor.delta(zoomPoint, point1) : null;
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

  // The focal point of v3's behavior.zoom. v7's d3.zoom zooms around the
  // cursor and that cannot be pinned to a fixed point; the method is kept only
  // because the call site expects it.
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

  zoom.on = function(type_, fn) {
    if (arguments.length < 2) return events.on(type_);
    events.on(type_, fn);
    return zoom;
  };

  return zoom;
}
