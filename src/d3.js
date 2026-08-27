// Only the D3 functions the library actually uses.
//
// Why this shape: the call sites stay in `d3.geoPath()` form, so modularisation
// did not have to rewrite every line of the code — yet the bundler pulls in
// exactly what is listed here instead of the whole `d3` package. This is also
// what removes the need for a global `d3` (upstream #134, "d3 is not defined").
//
// The projections' raw functions are deliberately NOT here: projection.js
// resolves those by name, so it imports the two packages as namespaces.
export { select, selectAll, pointer } from "d3-selection";
export { json } from "d3-fetch";
export {
  geoPath, geoProjection, geoCircle, geoGraticule,
  geoDistance, geoInterpolate, geoRotation, geoArea, geoContains
} from "d3-geo";
export { interpolateNumber, interpolateLab } from "d3-interpolate";
export { scaleQuantize } from "d3-scale";
export { timeFormat, timeParse } from "d3-time-format";
export {
  symbol, symbolCircle, symbolCross, symbolDiamond,
  symbolSquare, symbolStar, symbolTriangle, symbolWye
} from "d3-shape";
export { zoom, zoomIdentity } from "d3-zoom";
export { dispatch } from "d3-dispatch";

// Imported for its side effect: d3-transition is what adds the .transition()
// method to the selection prototype, which celestial.js's animations use.
import "d3-transition";
