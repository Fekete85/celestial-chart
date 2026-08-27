// Böngészős belépési pont: a régi, globális `Celestial` felület.
// A D3 bele van csomagolva, tehát nem kell külön script-tag hozzá.
import { Celestial } from "./celestial.js";
window.Celestial = Celestial;
