// A könyvtár központi objektuma.
//
// Külön modulban él, nem a celestial.js-ben, mert szinte minden modul
// hivatkozik rá — több közülük már betöltéskor (pl. `Celestial.settings = ...`).
// A modulgráf körkörös (celestial ↔ config ↔ form ↔ svg), és körben az számít,
// mi értékelődik ki előbb. Ez a fájl semmit nem importál, tehát mindig elsőként
// fut le, és mire bárki hozzányúl, már létezik.
export var Celestial = {
  version: '0.8.0-dev',
  container: null,
  data: []
};
