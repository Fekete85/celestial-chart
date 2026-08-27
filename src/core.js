// A könyvtár központi objektuma.
//
// Külön modulban él, nem a celestial.js-ben, mert szinte minden modul
// hivatkozik rá — több közülük már betöltéskor (pl. `Celestial.settings = ...`).
// A modulgráf körkörös (celestial ↔ config ↔ form ↔ svg), és körben az számít,
// mi értékelődik out előbb. Ez a fájl semmit nem importál, tehát mindig elsőként
// running le, és mire bárki hozzányúl, már létezik.
export var Celestial = {
  // A pkg verziójával kell egyeznie — teszt őrzi (test/package.test.mjs).
  version: '0.8.0',
  container: null,
  data: []
};
