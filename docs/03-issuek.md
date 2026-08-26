# A 42 nyitott issue triázsa

Kategorizálva aszerint, hogy a modernizáció megoldja-e őket.

## A modernizáció megoldja (7 db)

Ezek mind ugyanannak a gyökérnek a hajtásai: a könyvtár globális szkriptként, régi D3-mal működik.

| # | Cím | Miért oldódik meg |
|---|---|---|
| 147 | update d3 version | Ez maga a feladat |
| 141 | refactor to es6 module | 4. fázis |
| 86 | React JS (16 komment) | ESM-import után természetes |
| 81 | Node js module | ESM + `package.json` exports |
| 115 | `d3_celestial__WEBPACK...display is not a function` | Bundler-kompatibilis kimenet |
| 134 | `d3 is not defined` | Nincs többé globális `d3`-függés |
| 100 | `'#celestial*' is not a valid selector` | A szelektor-kezelés átírásakor |

## Részben oldja meg (2 db)

| # | Cím | Mi kell hozzá |
|---|---|---|
| 96 | multiple instances with different configs | Az ESM önmagában kevés — **szingleton felszámolása** kell (5. fázis) |
| 131 | Unable to add multiple celestial maps | Ugyanaz |

## Matematikai hibák — függetlenek a D3-tól (3 db)

Ezek a D3-mentes fájlokban vannak, tehát **most, azonnal javíthatók**.

| # | Cím | Állapot |
|---|---|---|
| **148** | `horizontal.inverse` missing sign correction | **Reprodukálva és számszerűsítve**: 153/306 pont hibás, max. eltérés 171,4°. A javítás egy sor. Lásd `harness/issue-148-ellenorzes.mjs` |
| 130 | Wrong moon phase? | Nem vizsgáltuk. A `moon.js` 538 sor, nulla D3-hívás — ugyanígy tesztelhető |
| 157 | Changing center by 12 hours interpolates badly | Nem vizsgáltuk. Valószínűleg az `interpolateNumber` körüli szöghatár-kezelés |

## Viselkedési hibák — a hálóval biztonságosan javíthatók (7 db)

| # | Cím |
|---|---|
| 95 | daylight savings time transitions messing with orientation |
| 93 | Setting geopos in config doesn't change initial position |
| 94 | How to prevent animation on initial load? |
| 101 | Interactive:false rendering issue |
| 103 | disableAnimations doesn't apply to showConstellation |
| 113 | Bug when specifying zoomlevel in config |
| 138 | Changing the width causes issues |
| 124 | Bug when displaying planets but no stars |
| 125 | Rendering ra/dec labels after changing date/location |

## Funkciókérések (17 db)

Nem hibák, hanem bővítések: #153 precesszió és nutáció, #151 csillagkép-ábrák, #149 radiális
gradiens, #145 emberi látás szimulálása, #144 kép-overlay, #142 margó, #139 kattintható objektumok,
#137 dátumtartomány, #128 kezdeti adat, #123 saját csillagkép-határok, #110 vonalszín,
#107 égbolt horizonttal, #106 rajzolás meglévő canvasra, #97 egyedi vonalstílus, #91 nyelvek,
#79 háttérkép, #64 horizont-feliratok.

Ezek közül több (#107, #64) olyat kér, amit a mi `csillag` projektünkben már megoldottunk saját
rétegként — vagyis a könyvtár bővíthető, csak dokumentálatlanul.

## Adathibák (1 db)

#109 HAT-P Stars Missing — katalógus-kérdés, nem kódhiba.

---

## Amit ez a triázs mutat

A 42 issue-ból **9 valódi hiba**, amit a modernizáció vagy a háló biztonságossá tesz, és **7**, amit
közvetlenül megold. A többség funkciókérés — ami azt jelzi, hogy **a könyvtárat használják és
szeretnék**, csak nincs, aki fogadja a kéréseket.

A leggyorsabb közösségi érték nem a D3-migráció, hanem a **#148 javítása**: egy soros változtatás,
ami a horizontális koordináta-visszaszámítás felét javítja, és 2023 decembere óta vár.
