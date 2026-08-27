# Analysis of the codebase

Version examined: `ofrohn/d3-celestial @ 7e720a3` (2022-07-05), 16 modules, 5669 lines.

## D3 dependency per file

| File | Lines | D3 calls | APIs used |
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

**1421 lines (25%) are completely D3-free** — this is the astronomical core: lunar phase, Kepler
orbits, coordinate transformations, horizontal conversion.

## Full D3 API inventory

| Occurrences | API (v3) | Equivalent in v7 | Difficulty |
|---:|---|---|---|
| 45× | `d3.select` / `d3.selectAll` | `d3-selection`, same name | easy — but `.on()` event handling changed |
| 18× | `d3.json(url, cb)` | `d3-fetch`, **Promise-based** | medium — rewriting the callback chain |
| 14× | `d3.functor` | **removed in v4** | easy — a 3-line replacement |
| 7× | `d3.geo.circle` | `d3.geoCircle` | medium |
| 6× | `d3.interpolateLab` | `d3-interpolate`, same name | trivial |
| 6× | `d3.geo.distance` | `d3.geoDistance` | easy |
| 5× | `d3.interpolateNumber` | `d3-interpolate`, same name | trivial |
| 4× | `d3.time.format` | `d3.timeFormat` (`d3-time-format`) | easy |
| 4× | `d3.geo.projection` | `d3.geoProjection` | **HARD** — the raw projection API differs |
| 3× | `d3.svg.symbol` | `d3.symbol` (`d3-shape`) | **HARD** — different structure |
| 3× | `d3.svg.customSymbol` | *not D3* — the library's own extension | **HARD** — has to be rewritten |
| 2× | `d3.geo.path` | `d3.geoPath` | easy |
| 2× | `d3.geo.graticule` | `d3.geoGraticule` | easy |
| 1× | `d3.geo.zoom` | separate package: `d3-geo-zoom` (different API) | medium |
| 1× | `d3.geo.interpolate` | `d3.geoInterpolate` | easy |
| 1× | `d3.scale.quantize` | `d3.scaleQuantize` (`d3-scale`) | easy |
| 1× | `d3.queue` | **removed** — `Promise.all` | medium |
| 1× | `d3.map` | **removed in v6** — native `Map` | easy |
| 1× | `d3.event.target` | from v6 on, the event is the callback parameter | easy |

## The three real risks

**1. `d3.geo.projection` (4 occurrences, but it is the soul of the library).**
In v3, `d3.geo.projection(raw)` wraps a raw projection function. In v7, `d3.geoProjection(project)`
is similar, but the behaviour of `.rotate()`, `.clipAngle()` and `.precision()` differs subtly.
d3-celestial builds 25 projections on this, including its own. **This has to be measured per
projection** — which is exactly what the reference net is for.

**2. `d3.svg.symbol` + `customSymbol` (6 occurrences).**
The library defines its own symbol types by extending the v3 `d3.svg.symbol`. The v7 `d3.symbol` is
built differently: a symbol type is an object with a `draw(context, size)` method. This is not a
rename but a rewrite — though it is well bounded, and only affects the SVG output.

**3. Global state.**
`Celestial` is a global singleton. That is why two maps cannot exist on one page (#96, #131). Moving
to ES modules does not solve this by itself — that needs a class-based rewrite, which in turn is the
largest structural change. Worth handling as a separate phase.

## What is easier than it looks at first

- Replacing `d3.functor`: `const functor = v => typeof v === "function" ? v : () => v;`
- `interpolateLab` / `interpolateNumber` still exist unchanged in `d3-interpolate`
- `d3-geo`'s `geoCircle`, `geoDistance`, `geoPath`, `geoGraticule` are functionally identical, only the name differs
- `topojson` lives separately and is version-independent

## Measurement method

The numbers are reproducible:

```bash
git clone --depth 50 https://github.com/ofrohn/d3-celestial.git upstream
cd upstream
grep -ohE "d3\.[a-zA-Z]+(\.[a-zA-Z]+)?" src/*.js | sort | uniq -c | sort -rn
for f in src/*.js; do
  echo "$(basename $f) $(wc -l < $f) $(grep -oE 'd3\.[a-zA-Z]+' $f | wc -l)"
done
```
