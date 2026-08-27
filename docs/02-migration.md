# Migration plan

Broken into phases such that **after every phase there is a working state**, and such that the first
two have value in themselves — even if the migration is never finished.

## Phase 0 — mathematical bugs (D3-independent)

`horizontal.js`, `moon.js` and `kepler.js` contain zero D3 calls. The bugs in them can be fixed
independently of the D3 version, and proved with a round-trip test.

| Issue | What is wrong | Proved |
|---|---|---|
| [#148](https://github.com/ofrohn/d3-celestial/issues/148) | `horizontal.inverse()` — missing sign correction | **yes**: 153/306 points wrong, max. difference 171.4° |
| [#130](https://github.com/ofrohn/d3-celestial/issues/130) | "Wrong moon phase?" | not yet |
| [#157](https://github.com/ofrohn/d3-celestial/issues/157) | 12-hour centre change interpolates badly | not yet |

**Output:** fixed mathematics + unit tests. This alone could be published as a PR to upstream as well
(though the author has not responded for 4.5 years).

## Phase 1 — the reference net

The [`harness/`](../harness/) already works: 25 projections × 4 rotations × 413 points.

**To be extended before the migration:**
- zoom levels (currently only the default one)
- `transform`: `ecliptic`, `galactic`, `supergalactic` (currently only `equatorial`)
- the output of `Celestial.getPlanet()` for a few dates
- canvas pixel hash: not just coordinates, but a fingerprint of the actual drawing

**Output:** `reference-d3v3.json`, the yardstick of the migration.

## Phase 2 — mechanical D3 replacement

In this order, because the later ones build on the earlier:

1. `d3.functor` → own 3-line replacement (14 places)
2. `d3.map` → native `Map` (1 place)
3. `d3.scale.quantize` → `d3.scaleQuantize` (1 place)
4. `d3.time.format` → `d3.timeFormat` (4 places)
5. `d3.event.target` → callback parameter (1 place)
6. `d3.json` + `d3.queue` → `Promise.all` (19 places) — **this is the biggest chunk**
7. `d3.geo.distance/path/graticule/interpolate` → `geoDistance` etc. (11 places)

The net gives feedback after every step. If a projection moves, it shows up immediately.

## Phase 3 — the risky part

**`d3.geo.projection` → `d3.geoProjection`** (4 places, but it affects 25 projections).

Method: one projection at a time. After each projection the net checks 4 rotations × 413 points.
Tolerance: 0.01 pixels — the floating-point difference has to be smaller than that.

**`d3.svg.symbol` + `customSymbol` → `d3.symbol`** (6 places, SVG output only).
If the SVG export can be dropped, this phase can be skipped.

## Phase 4 — ES modules

This resolves issues #86 (React), #81 (Node), #115 (webpack), #141 (ES module), #134
(`d3 is not defined`). The build uses `rollup`, the output is ESM + UMD.

**This is when tree-shaking starts to make sense**: instead of the current 148 KB monolithic D3, only
the modules actually used (`d3-geo`, `d3-geo-projection`, `d3-selection`, `d3-interpolate`,
`d3-shape`, `d3-array`) would be pulled in.

## Phase 5 — eliminating the singleton (optional)

Because of `Celestial`'s global state, two maps cannot exist on one page (#96, #131). This needs a
class-based rewrite. **The largest structural change**, and the net only partly protects against it —
it does not catch state-handling bugs. A separate decision.

## What is worth dropping

| Module | Lines | Why |
|---|---:|---|
| `form.js` | 786 | The built-in settings form. Most integrators build their own UI (we do too). |
| `datetimepicker.js` | 220 | The same — there is a native `<input type="datetime-local">` these days. |
| `timezones.js` + the timezone part of `location.js` | ~100 | **Calls an external API** (`api.timezonedb.com`) with a hard-coded key. That is blocked by CSP, and is a problem in principle too. The native `Intl.DateTimeFormat().resolvedOptions().timeZone` replaces it. |

That is 1100+ lines that do not have to be migrated. If they are needed, later, as a separate package.

## Realistic effort

| Phase | Estimate | Risk |
|---|---|---|
| 0. mathematics | 1–2 days | low |
| 1. extending the net | 1 day | none |
| 2. mechanical replacement | 2–3 days | low |
| 3. projections | **3–5 days** | **high** |
| 4. ES modules | 2–3 days | medium |
| 5. singleton | 3–5 days | high |

Phases 0–4: **roughly 10–14 days** of focused work. Phase 5 is a separate decision.

This is not "a weekend", but it is not hopeless either — and after phases 0–1 it is possible to stop
at any time having created real value along the way.
