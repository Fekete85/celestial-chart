# A kódbázis elemzése

Vizsgált verzió: `ofrohn/d3-celestial @ 7e720a3` (2022-07-05), 16 modul, 5669 sor.

## Fájlonkénti D3-függés

| Fájl | Sor | D3-hívás | Használt API-k |
|---|---:|---:|---|
| `celestial.js` | 1011 | 43 | `geo.circle`, `geo.distance`, `geo.graticule`, `geo.path`, `geo.projection`, `geo.zoom`, `geo.interpolate`, `interpolateLab`, `interpolateNumber`, `json`, `select` |
| `svg.js` | 828 | 36 | `functor`, `geo.circle`, `geo.distance`, `geo.graticule`, `geo.path`, `svg.symbol`, `svg.customSymbol`, `svg.symbolTypes`, `queue`, `map`, `json` |
| `form.js` | 786 | 17 | `select`, `selectAll`, `time.format` |
| `datetimepicker.js` | 220 | 11 | `select`, `time.format` |
| `canvas.js` | 258 | 10 | `functor` |
| `location.js` | 304 | 6 | `event.target`, `json`, `select`, `time.format` |
| `projection.js` | 76 | 4 | `geo`, `geo.projection` |
| `util.js` | 191 | 1 | `interpolateNumber` |
| `timezones.js` | 60 | 1 | `json` |
| `config.js` | 514 | 1 | `scale.quantize` |
| **`transform.js`** | 90 | **0** | — |
| **`moon.js`** | 538 | **0** | — |
| **`kepler.js`** | 474 | **0** | — |
| **`horizontal.js`** | 78 | **0** | — |
| **`get.js`** | 200 | **0** | — |
| **`add.js`** | 41 | **0** | — |

**1421 sor (25%) teljesen D3-mentes** — ez a csillagászati mag: holdfázis, Kepler-pályák,
koordináta-transzformációk, horizontális átszámítás.

## Teljes D3 API-leltár

| Előfordulás | API (v3) | Megfelelője v7-ben | Nehézség |
|---:|---|---|---|
| 45× | `d3.select` / `d3.selectAll` | `d3-selection`, azonos név | könnyű — de az `.on()` eseménykezelés változott |
| 18× | `d3.json(url, cb)` | `d3-fetch`, **Promise-alapú** | közepes — callback-lánc átírása |
| 14× | `d3.functor` | **v4-ben megszűnt** | könnyű — 3 soros pótlás |
| 7× | `d3.geo.circle` | `d3.geoCircle` | közepes |
| 6× | `d3.interpolateLab` | `d3-interpolate`, azonos név | triviális |
| 6× | `d3.geo.distance` | `d3.geoDistance` | könnyű |
| 5× | `d3.interpolateNumber` | `d3-interpolate`, azonos név | triviális |
| 4× | `d3.time.format` | `d3.timeFormat` (`d3-time-format`) | könnyű |
| 4× | `d3.geo.projection` | `d3.geoProjection` | **NEHÉZ** — a raw projection API eltér |
| 3× | `d3.svg.symbol` | `d3.symbol` (`d3-shape`) | **NEHÉZ** — más felépítés |
| 3× | `d3.svg.customSymbol` | *nem D3* — a könyvtár saját kiterjesztése | **NEHÉZ** — újraírandó |
| 2× | `d3.geo.path` | `d3.geoPath` | könnyű |
| 2× | `d3.geo.graticule` | `d3.geoGraticule` | könnyű |
| 1× | `d3.geo.zoom` | külön csomag: `d3-geo-zoom` (más API) | közepes |
| 1× | `d3.geo.interpolate` | `d3.geoInterpolate` | könnyű |
| 1× | `d3.scale.quantize` | `d3.scaleQuantize` (`d3-scale`) | könnyű |
| 1× | `d3.queue` | **megszűnt** — `Promise.all` | közepes |
| 1× | `d3.map` | **v6-ban megszűnt** — natív `Map` | könnyű |
| 1× | `d3.event.target` | v6-tól az event a callback paramétere | könnyű |

## A három valódi kockázat

**1. `d3.geo.projection` (4 előfordulás, de a könyvtár lelke).**
A v3-ban `d3.geo.projection(raw)` egy raw projekciós függvényt burkol. A v7-ben `d3.geoProjection(project)`
hasonló, de a `.rotate()`, `.clipAngle()`, `.precision()` viselkedése finoman eltér. A d3-celestial 25
vetítést épít erre, köztük sajátokat is. **Ezt vetítésenként kell mérni** — pontosan erre való a
referencia-háló.

**2. `d3.svg.symbol` + `customSymbol` (6 előfordulás).**
A könyvtár saját szimbólumtípusokat definiál a v3 `d3.svg.symbol` kiterjesztésével. A v7 `d3.symbol`
más felépítésű: a szimbólumtípus egy objektum `draw(context, size)` metódussal. Ez nem átnevezés,
hanem újraírás — de jól körülhatárolt, és csak az SVG-kimenetet érinti.

**3. Globális állapot.**
A `Celestial` egy globális szingleton. Ezért nem lehet két térkép egy oldalon (#96, #131). Az
ES-modul átállás önmagában nem oldja meg — ahhoz osztály-alapú átírás kell, ami viszont a
legnagyobb szerkezeti változás. Érdemes külön fázisként kezelni.

## Ami könnyebb, mint elsőre látszik

- A `d3.functor` pótlása: `const functor = v => typeof v === "function" ? v : () => v;`
- Az `interpolateLab` / `interpolateNumber` változatlanul megvan a `d3-interpolate`-ben
- A `d3-geo` `geoCircle`, `geoDistance`, `geoPath`, `geoGraticule` funkcionálisan azonos, csak a név más
- A `topojson` külön él, verziófüggetlen

## Mérési módszer

A számok reprodukálhatók:

```bash
git clone --depth 50 https://github.com/ofrohn/d3-celestial.git upstream
cd upstream
grep -ohE "d3\.[a-zA-Z]+(\.[a-zA-Z]+)?" src/*.js | sort | uniq -c | sort -rn
for f in src/*.js; do
  echo "$(basename $f) $(wc -l < $f) $(grep -oE 'd3\.[a-zA-Z]+' $f | wc -l)"
done
```
