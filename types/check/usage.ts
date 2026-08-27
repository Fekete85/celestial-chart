// This file is NOT published: it exists to check the type definitions.
// `npm run types` compiles it, and fails if the types do not cover real usage —
// or if something in them was mistyped.
import Celestial, { SkyMap, Config, Projection, Center } from "../celestial.js";

// --- the original, global usage ---
Celestial.display({
  container: "celestial-map",
  width: 800,
  projection: "aitoff",
  transform: "equatorial",
  center: [0, 0, 0],
  stars: { limit: 6, colors: true, style: { fill: "#ffffff", opacity: 1 } },
  constellations: { names: true, namesType: "iau", lines: true },
  mw: { show: true },
  lines: { graticule: { show: true, lon: { pos: ["center"] } } },
  interactive: true,
  form: true,
  date: new Date()
});

Celestial.rotate({ center: [120, 30, 0] });
Celestial.apply({ stars: { show: false } });
const nagyitas: number = Celestial.zoomBy(1.5);
Celestial.exportSVG((svg: string) => console.log(svg.length));

// --- several independent maps ---
const a: SkyMap = new SkyMap({ container: "map-a", projection: "orthographic" }, { standalone: true });
const b = new SkyMap({ container: "map-b", projection: "mollweide" }, { standalone: true });

const vet: Projection = a.cfg.projection ?? "aitoff";
const kp: Center = [180, 55, 0];
a.rotate({ center: kp });
b.resize({ width: 600 });
const m = a.metrics();
const widthPx: number = m.width + m.margin[0];

// using the projection
const point_ = a.mapProjection([180, 55]);
if (point_) { const x: number = point_[0]; console.log(x); }
const visible: 0 | 1 = a.clip([180, 55]);

// one settings form per instance
a.form.fldEnable("horizon-show", true);
b.form.setCenter([0, 0, 0], "equatorial");

// library-level helpers
const vetitesek = Celestial.projections();
const airyLeptek: number = vetitesek.airy.scale;
const oraszog: number = Celestial.ha(new Date(), 19.2, 180);
const hor = Celestial.horizontal(new Date(), [180, 45], [47.5, 19.2]);
const back = Celestial.horizontal.inverse(new Date(), [hor[0], hor[1]], [47.5, 19.2]);
console.log(nagyitas, vet, widthPx, visible, oraszog, back, a === b);

// a partial configuration in its own variable
const beallitas: Config = { projection: "mercator", stars: { limit: 4 } };
Celestial.display(beallitas);
