// Csak azok a D3-függvények, amiket a könyvtár ténylegesen használ.
//
// Miért így: a hívási helyek `d3.geoPath()` alakban maradnak, tehát a
// modulosítás nem írja át a kód minden sorát — de a csomagoló mégis pontosan
// azt húzza be, ami itt fel van sorolva, a teljes `d3` csomag helyett. Ezzel
// szűnik meg a globális `d3` igénye is (upstream #134: "d3 is not defined").
//
// A vetítések nyers (raw) függvényeit NEM itt tartjuk: azokat a projection.js
// oldja fel névből, ezért ott külön, névtérként importálódnak.
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

// Mellékhatásért: a d3-transition egészíti ki a selection prototípusát a
// .transition() metódussal, amit a celestial.js animációi használnak.
import "d3-transition";
