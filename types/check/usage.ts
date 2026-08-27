// Ez a fájl NEM kerül a csomagba: a típusdefiníció ellenőrzésére való.
// A `npm run tipus` lefordítja, és megbukik, ha a típusok nem fedik a valódi
// használatot — vagy ha valamit rosszul gépeltünk el bennük.
import Celestial, { SkyMap, Config, Vetites, Kozeppont } from "../celestial.js";

// --- a régi, globális használat ---
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

// --- több független térkép ---
const a: SkyMap = new SkyMap({ container: "map-a", projection: "orthographic" }, { standalone: true });
const b = new SkyMap({ container: "map-b", projection: "mollweide" }, { standalone: true });

const vet: Vetites = a.cfg.projection ?? "aitoff";
const kp: Kozeppont = [180, 55, 0];
a.rotate({ center: kp });
b.resize({ width: 600 });
const m = a.metrics();
const widthPx: number = m.width + m.margin[0];

// a vetítés használata
const pont = a.mapProjection([180, 55]);
if (pont) { const x: number = pont[0]; console.log(x); }
const visible: 0 | 1 = a.clip([180, 55]);

// űrlap példányonként
a.form.fldEnable("horizon-show", true);
b.form.setCenter([0, 0, 0], "equatorial");

// könyvtárszintű segédek
const vetitesek = Celestial.projections();
const airyLeptek: number = vetitesek.airy.scale;
const oraszog: number = Celestial.ha(new Date(), 19.2, 180);
const hor = Celestial.horizontal(new Date(), [180, 45], [47.5, 19.2]);
const back = Celestial.horizontal.inverse(new Date(), [hor[0], hor[1]], [47.5, 19.2]);
console.log(nagyitas, vet, widthPx, visible, oraszog, back, a === b);

// részleges konfiguráció külön változóban
const beallitas: Config = { projection: "mercator", stars: { limit: 4 } };
Celestial.display(beallitas);
