# Migration log

This document records what happened after the survey: what was measured, what was
fixed, and where the first attempt failed. The order follows the recommended
sequence of steps (see the root [`README.md`](../README.md)).

---

## 1. Making the reference net usable

### 1.1 The comparator

`harness/compare.mjs` — a per-projection diff of two reference nets: max /
mean / p99 pixel difference, clipping difference, structural difference.

The comparator has to be validated just like the net itself: if it said
"fine" to everything, it would be silently worthless. `--selftest` proves this —
a 1 px displacement, a clipping flip, a missing projection and `point → null` all
fail it, while the opposite direction (`old NaN → new number`) does not, because
there is nothing there to get worse relative to.

### 1.2 The net was half blind

The survey claimed that the net measured **25 projections × 4 rotations × 413
points**. In reality the four rotations gave **the same coordinate**; only the
visibility flag differed.

Cause: `Celestial.rotate()` starts a d3 transition, it does not rotate
immediately. The measurement runs in a synchronous loop, so it recorded the state
**before** the rotation. `Celestial.clip()`, however, looks at `cfg.center`, which
updates synchronously — which is why it looked as though the four rotations differed.

Fix: `disableAnimations: true` in the generator's config, and the self-check
extended with a new condition — *within one projection, two rotations must not
give identical coordinates*. This is exactly the kind of bug that the original
self-check already filtered out for projections, but not for rotations.

> Lesson: a self-check only protects against what it was written for. It is worth
> extending it to every axis that the net claims to measure.

---

## 2. Mathematical bugs

All three can be fixed independently of D3 — `horizontal.js`, `moon.js` and
`transform.js` contain zero D3 calls.

### #148 — `horizontal.inverse()` missing sign correction

`acos` returns 0–180°, so one half of the sky was lost. The forward direction
handles the ambiguity (`if (Math.sin(ha) > 0) az = 2π - az`), the inverse does not.

| | round-trip error above the horizon |
|---|---|
| before | 153/306 points wrong (50%), max. difference 171.4° |
| after | 0/306, max. difference 0.0002° |

Incidentally: `.toFixed(6)` was replaced by proper range clamping. `acos` is steep
near 1, and there the 1e-6 truncation is itself a source of error; `toFixed` only
protected the zenith from NaN by accident.

### #130 — "Wrong moon phase?"

The phase computation is **not** wrong — it is accurate to within 0.25 degrees for
7 eclipse-anchored syzygy times, and the synodic month averages 29.5306 days over
13 lunations. The phenomenon the reporter saw is real, though; it is caused by two
other bugs:

**a) `moon.js corr()`** — it added Schlyter's ecliptic perturbation terms
(evection, variation, annual equation) directly to the **right ascension and
declination**, and needlessly at that, because the series expansion in
`elements()` already contains them.

Meeus *Astronomical Algorithms* 13.a (1992-04-12 0h):

| | RA | Dec |
|---|---|---|
| before | 133.18880° (**−1.50°**) | 13.88840° (−0.12°) |
| after | 134.68889° (0.0004°) | 13.76789° (0.0005°) |
| Meeus | 134.68847° | 13.76837° |

1.5° ≈ three lunar diameters.

**b) The geometry of the terminator** (`canvas.js` and `svg.js`) — the semi-minor
axis of the terminator ellipse is `|cos(phase angle)|` times the radius of the
disc, which in terms of the illuminated fraction is `|2·ph − 1|`. The code used
`1.6 · |ph − 0.5|` instead of `2 · |ph − 0.5|`: **at full moon the disc was drawn
19% narrower, as a gibbous**. That is exactly what was reported.

### #157 — "Changing center by 12 hours interpolates badly"

There is a guard branch in `celestial.js` for exactly this case:

```js
if (d > 3.14) cfg.center[0] -= 0.01; //180deg turn doesn't work well
```

This is **dead code**: `d = Round(d3.geoDistance(...), 2)`, the maximum of the
spherical distance is π, which rounded to two decimals is 3.14 — so `d > 3.14` is
never satisfied. The guard branch failed to fire in the single case it was written
for.

At exactly antipodal endpoints `geoInterpolate` divides by `sin(d) = 1.2e-16`, and
catastrophic cancellation occurs. Sampling the `[0,0] → [180,0]` turn in 20 steps:

| | step length | longitude of the centre, t = 0…1 |
|---|---|---|
| before | 0.000° … 54.736° | 0, 17, 30, **90**, 44, **90**, 136, **90**, 150, 163, 180 |
| after | 8.999° … 9.000° | 0, 18, 36, 54, 72, 90, 108, 126, 144, 162, 180 |

Maximum angular error relative to the reference slerp: **139.07°** — hence the
reported "flickers and jumps".

Fix: `d >= 3.14`, and nudge the **starting point**, not the target. Nudging the
target would leave a permanent 0.01° error in the config, which accumulates over
repeated calls; on top of that, `config.set()` copies arrays by reference, so the
two endpoints may be the very same array, and the nudge would move both.

**Known limitation:** if the antipode arises from the pole (`[0,90] → [180,-90]`),
nudging the longitude does not help, because there longitude is a free parameter.
This was already the case before the fix; a separate test documents it.

---

## 3. D3 v3 → v7

### What had to be replaced

| v3 | v7 |
|---|---|
| `d3.geo.projection`, `.path`, `.circle`, `.graticule`, `.distance`, `.interpolate` | `d3.geoProjection`, `geoPath`, `geoCircle`, `geoGraticule`, `geoDistance`, `geoInterpolate` |
| `d3.geo.<name>.raw` | `d3.geo<Name>Raw` (`naturalEarth` → `geoNaturalEarth1Raw`) |
| `circle.angle(a).origin(c)` | `circle.radius(a).center(c)` |
| `graticule.minorStep()` | `graticule.stepMinor()` |
| `d3.functor` | own `functor()` |
| `d3.json(url, cb)` | `d3.json(url).then(...)` — `loadJson()` keeps the old `(error, json)` shape |
| `d3.time.format(s)` and `.parse` | `d3.timeFormat(s)`, `d3.timeParse(s)` |
| `d3.scale.quantize` | `d3.scaleQuantize` |
| `d3.svg.symbol().type("circle")` | `d3.symbol().type(d3.symbolCircle)` |
| `d3.map({...})` | native `Map` |
| `d3.queue(n)` | own `taskQueue(n)` |
| `d3.behavior.zoom`, `d3.mouse`, `d3.event` | `d3.zoom`, `d3.pointer`, the listener's first parameter |
| `selection[0].length` | `selection.empty()` |
| `selection.classed({...})`, `.attr({...})`, `.style({...})` | `classes_()`, `attrs()`, `styles_()` |
| the listener received `(datum, index)` | `(event, datum)` — handlers without parameters are unaffected, `resize(set)` is affected |

### Mirroring the projections

We look at the sky from the outside in, so longitude has to be mirrored. The v3
code wrapped the raw function (`raw(-λ, φ)`); in v7 `reflectX(true)` is meant for
this. **The two are measurably identical** — across 24 projections, on a dense
grid, the maximum difference is under 1e-9 px — but `reflectX` also handles the
invert direction on its own, so there is no need to mirror back by hand.

### Two projections restored

`hatano` and `wagner7` existed in the v3 plugin, but `d3-geo-projection` v4 has no
released `raw` function for them. We took the formulas verbatim from the v3 source,
and `test/projections.test.mjs` measures them against a **162-point table taken
from the pinned v3 build**, with a tolerance of 1e-10 — with `mercator` as a
control in the same test. The test also speaks up if a future
d3-geo-projection restores them, so that our own copy can be dropped.

### The zoom plugin

Jason Davies' `d3.geo.zoom` was built on `d3.behavior.zoom`, `d3.event` and
`d3.rebind`; all three are gone. **The quaternion mathematics stayed unchanged**
(that did not depend on D3), only the glue is new. The outward-facing surface
(`projection`, `center`, `scaleExtent`, `scale`, `on`) is deliberately the old one,
so that the call sites in `celestial.js` do not change.

---

## 4. The measurement

`harness/reference-d3v3.json` (pinned upstream) vs `harness/reference-d3v7.json`
(migrated build), 41 300 measured points:

```
25/25 projections — max difference 0.000 px, 0 clipping differences, 0 structural differences
```

In other words, the projection output is **bit-identical**.

A single difference: at 3 points the old code returned NaN, the new one a defined
value. All three are the **antipode** of the projection (`azimuthalEqualArea`),
where the denominator of the formula `sqrt(2/(1+cos d))` tends to zero. d3-geo has
had a guard branch for this since v2; v3 did not. This is an improvement, not a
regression — the comparator counts it in a separate column and does not fail on it.

Regeneration:

```bash
npm install && npm run build
python3 -m http.server 8877
# http://127.0.0.1:8877/harness/reference.html      (pinned v3)
# http://127.0.0.1:8877/harness/reference-new.html   (migrated build)
node harness/compare.mjs harness/reference-d3v3.json harness/reference-d3v7.json
```

---

## 5. What the net does not measure — and what we found there

The generator runs with `interactive: false`, `form: false`, so it says nothing
about the interactive surface. Looking at that separately (`demo/full.html`), four
bugs came up:

1. **The zoom set the rotation to NaN on load.** At a programmatic
   `zoom.transform()` call there is no mouse position, `d3.pointer` gives
   `[NaN, NaN]`, and that propagates through the quaternions. The v3 `d3.mouse`
   never received such a thing, because there the zoom always started from a real
   UI event.

2. **`selection.attr({...})` runs as a getter.** The v3 object shape was removed in
   v4, but it does not throw: it returns a value, and the next link in the chain is
   no longer working on a selection. `exportSVG` fell over on its first line.

3. **Promisifying `d3.json` was missed in `svg.js` and `location.js`.**
   In v7 the second parameter is a `fetch` option, not a callback — the loading
   callbacks never ran, and the SVG export silently never completed.

4. **Window resizing reset the zoom.** The guard branch in `resize(set)` —
   "if the width has not changed and there is no forcing, do nothing" — never took
   effect in v7, because there the listener's first parameter is the event object
   (in v3 it was the datum, i.e. `undefined`). So every `resize` event recomputed
   the scale, and `zoom.scale(...)` took away the user's zoom. The listener no
   longer passes the event on.

5. **The `bvcolor` scale.** The v3 `quantize` handled a descending domain; v4+ uses
   `bisect` on the thresholds, which is only correct in ascending order: with the
   `[3.347, -0.335]` domain **every star turned red**. This was immediately visible
   on the map — but the reference net does not measure colour, so no number would
   have caught it.

> Lesson: the numeric net protects the geometry, nothing else. The colours, the
> events, the loading chain and the export are all outside the net.

What they have in common is that **none of them throws an exception**. The v3
object-shaped `attr` runs as a getter, the second parameter of `d3.json` becomes a
`fetch` option, the meaning of the event parameter changes, the reversed domain of
`quantize` gives a sensible colour — just the wrong one. A `grep` for the `d3.`
prefix finds none of these; every one of them came out of a manual walkthrough.

---

## 6. Visual comparison

`harness/visual.html` and `harness/visual-new.html` draw the same view with the old
and the new code respectively; `harness/image-diff.html` compares the two PNGs
pixel by pixel.

**The recording was not reproducible at first**: the same version measured against
itself gave a 3–6% difference. Three causes, all three from the library's state
handling:

| cause | solution |
|---|---|
| the first `display()` calls `geo()` in `location.js`, which derives a centre from the **current time** | `follow: "center"`, `location: false` |
| we took the snapshot during the animated transition | `disableAnimations: true` |
| the second `display()` leaves behind a different state than the first (global state, #96/#131) | exactly one `display()` per page load, the view from the URL hash |

After this **the noise floor is exactly zero** — the same version run twice gives a
bit-identical image. Only from that point does comparing old and new make sense.

The result (proportion of differing pixels, `d3v3-*` vs `d3v7-*`):

| view | differing pixels | max difference |
|---|---:|---:|
| mercator, whole sky | 0.038% | 71 |
| mollweide, whole sky | 0.061% | 72 |
| aitoff, whole sky | 0.073% | 71 |
| airy, default position | 0.110% | 206 |
| stereographic, north pole | 0.231% | 162 |
| orthographic, Great Bear | 0.702% | 226 |

In all six views the difference is a few hundred to a few thousand pixels at the
edges of the stars and the labels — the level of subpixel anti-aliasing. (Before
the Milky Way inversion was fixed, the orthographic view was at **68.1%**; see
below.)

---

## 7. Open questions

### The Milky Way fill inverted at certain orientations — fixed

**This was the only known visual regression; it is solved.** The symptom: the map
greyed out and the Milky Way showed black — typically when the band moved towards
the edge of the disc.

#### The cause

The `ol1` outline in `mw.json` is a **thin spherical shell**: an outer ring of area
1.697π with a 1.623π hole in it; the difference between the two is the 0.069π Milky
Way band. A gap of 0.07π between two nearly great circles — deciding the interior of
the spherical polygon is numerically fragile here. Tellingly, **d3-geo's own two
functions contradict each other**: `geoArea` and `geoContains` say the band, while
`geoPath` fills the complement.

The author knew about the phenomenon too: according to the comment on
`getMwbackground()`, that layer exists to "prevent the whole map from greying out at
certain orientations".

What the diagnosis ruled out (all of it measured):

| hypothesis | result |
|---|---|
| `reflectX` causes it | no — the same with the old `raw(-λ,φ)` wrapping |
| `clipAngle(90)` causes it | no — the same without clipping |
| adaptive resampling | no — the same with `precision(0)` and `precision(10)` |
| the fill rule | no — the same with `nonzero` and `evenodd` |
| wrong winding on the holes | no — the same with either ring reversed |
| a polygon cut at the antimeridian | no — `d3.geoStitch` changes nothing |

#### The fix: the galactic pole as a check point

There is one point for which **we know the right answer for certain**: the galactic
pole. The Milky Way outlines are bands around the galactic equator, and the pole
falls outside all of them — while inside their complement (`mwbg`). The two poles
are antipodal, so with a clipped projection exactly one of them is visible.

We ask the already-built canvas path with `context.isPointInPath()`, and if the
verdict contradicts what we know, we redraw with the reversed rings
(`celestial.js`, `galacticPole()` / `wrongWinding()` / `reversed()`).

Two small things that came out of measurement:

- `isPointInPath` expects the point in **device coordinates**, but the context has
  `setTransform(pixelRatio, …)` on it — hence the multiplication. (On a retina
  display it would silently decide the wrong way without it.)
- The detector is **O(1)**, unlike the approaches tried earlier: `geoArea` on the
  rotated polygon takes 6.7 ms (0.4 ms decimated), `geoContains` on the
  full-resolution polygon 4.3 ms — both far too expensive per frame.

#### Verification

| | |
|---|---|
| 44 orientations (20 broad + 24 dense in the critical range) | **all match v3** |
| previously inverting cases | `[180,45]`, `[180,55]`, `[270,45]`, `[0,−45]`, `[250,30]`, `[280,60]` — all fixed |
| 12 consecutive drag rotations on the demo page | the grey proportion stays at 18–24% throughout (an inversion would be above 45%), 0 console errors |
| orthographic Great Bear pixel diff | 68.1% → 0.70% |

An earlier fix based on area conservation (the `geoArea` of the rotated polygon
differed by one whole sphere) solved three of the six cases; the pole-based detector
solved all six, and replaced it.

- **`cassini` and `quincuncial`** — `config.js` lists them, but they are **not in
  the pinned upstream build of `d3.geo.projection` either**: upstream throws a
  `TypeError` on them too. Not a migration regression but an existing bug;
  `quincuncial` does not appear in the plugin source at all (only
  `peirceQuincuncial`), and `cassini` only in the non-minified variant.
  Of the 69 configured projections **67 work — exactly as many as in upstream**.
- **`Celestial.ha()`** (`horizontal.js`) — nothing in the source calls it, and its
  line `if (ha < 180) ha = ha + 360;` is suspicious (`ha < 0` would be the usual).
  Dead code, we did not touch it.
- **Global state** (#96/#131) — calling `Celestial.display()` repeatedly does not
  lead to the same place. That is the subject of the modularisation phase (step 5).

---

## 8. ES modules and tree-shaking (step 5)

### Why this was the riskiest step

Until then the source files were plain scripts: they declared top-level `var`s and
functions, which the build strung together into a single closure. Every
cross-reference was **implicit** — `svg.js` saw `celestial.js`'s variables because
they ran in the same scope. Modularisation makes all of this explicit: 17 files,
~6000 lines, some 90 shared names.

That is why it was not done by hand: a scope analysis was produced for every file
with `acorn` (top-level declarations vs. free variables), and the `import`/`export`
blocks were generated from the resulting graph. Not a single line of the code body
changed.

The analysis immediately showed two things:

- **A name collision**: `cartesian` was declared twice — the one in `util.js`
  expects **radians**, the one in `lib/geo-zoom.js` **degrees**. In the
  concatenated build the latter overwrote the former, so the `poligonContains()`
  function in `util.js` would have called a `cartesian` in the wrong unit. A latent
  bug: nothing calls `poligonContains`. Modularisation removes it automatically.
- **`timezones()` is unreachable**: nothing calls it, and it is not attached to the
  `Celestial` object either. Because of that, the `topojson` dependency would also
  have ended up in the package needlessly. The file stayed where it was, with a
  comment; the bundler simply leaves it out.

### The circular imports

The graph is circular (`celestial ↔ config ↔ form ↔ svg`), and in a cycle what
matters is what is evaluated first. Several modules touch the central object
**at load time** already (`Celestial.settings = …`, `Celestial.projection = …`), so
if it had stayed in `celestial.js`, some of them would still see it uninitialised.

Solution: the `Celestial` object was moved into its own import-free module
(`src/core.js`). That way it always runs first. The remaining cross-references are
runtime ones, and there the live bindings of ES modules give exactly the right
behaviour — `cfg`, `parentElement`, `starnames` and `dsonames` receive their values
in `display()`, and the importers see the fresh value.

### Wrapping D3

`src/d3.js` lists in a single place what is needed:

```js
export { select, selectAll, pointer } from "d3-selection";
export { geoPath, geoProjection, geoCircle, … } from "d3-geo";
…
import "d3-transition";   // for the side effect: the .transition() method on selection
```

The call sites stayed in `d3.geoPath()` form (`import * as d3 from "./d3.js"`), so
the diff stayed small — and the bundler still pulls in exactly this list. The raw
functions of the projections have to be resolved by name; that is the only dynamic
access, and it is confined to `projection.js`.

### Result

| | files | size |
|---|---:|---:|
| upstream v3 (d3 + plugin + celestial) | 3 | 316 KB |
| migrated, before modularisation (d3 v7 + plugin + celestial) | 3 | 463 KB |
| **after modularisation** | **1** | **291 KB** |

The browser needs a single file, and **no global `d3` is required** — that is
upstream #134 ("d3 is not defined"). The build produces four shapes:

| | |
|---|---|
| `build/celestial.js` / `.min.js` | IIFE, global `Celestial` — the old usage unchanged |
| `build/celestial.mjs` | ES module: `import Celestial from "…"` (#141, #115, #86) |
| `build/celestial.cjs` | CommonJS: `require(…)` (#81) |

### Verification

- **The reference net is bit-identical** — not only against the v3 baseline, but
  also against the v7 build from BEFORE modularisation: 25/25 projections, max
  difference 0.000 px. So modularisation changed nothing numerically.
- The harness page now only loads the build; on the page `typeof d3 === "undefined"`,
  and the measurement still runs.
- 44 tests, with real ESM imports (the earlier `vm`-based loader is gone) — the
  tests now run the actual module graph.
- `demo/module.html`: with `<script type="module">`, without a global `Celestial` or
  `d3` — 5044 stars, 0 errors.
- `demo/full.html`: the full surface in global form — zoom, drag rotation,
  projection switching, SVG export, 0 errors.
- In Node it can be loaded both as `import` and as `require`.

## 9. Class-based rewrite — several maps on one page

Upstream #96 and #131: the library kept global state, so only one map worked on a
page.

### The starting point was better than expected

`Celestial.display()` **had already been written as a constructor** — with
`this.container = …`, `this.clip = …`, `this.rotate = …` lines at the end. It was
just called as `Celestial.display(config)`, so `this` was the global object itself.
The skeleton was there; three things blocked instantiation.

**1. Module-level state.** `cfg`, `mapProjection`, `parentElement`, `zoom`, `map`,
`circle`, `daylight`, `starnames`, `dsonames`, `zoomextent` and `zoomlevel` lived at
the top of the module, so every map shared them. They moved into the constructor.

**2. The shared configuration.** `settings.set()` wrote into and read from a
module-level `globalConfig`, so the second map inherited the first one's. It
received an optional `base` parameter: if present, it starts from that and does not
write back to the global one. Without it the old behaviour remains, so that
`Celestial.settings()` keeps working.

**3. The shared container.** The constructor took over the global
`Celestial.container`, so the second map would have drawn into the first one's. Now
it looks it up inside its own parent.

### Getters, not value copies

`cfg`, `mapProjection`, `container` and `map` **are reassigned** during drawing
(`cfg = cfg.set(…)`, `mapProjection = projectionTween(…)`). With a simple
`this.x = x` assignment the old value would stick on the instance — for example
`Celestial.mapProjection` would be stale after a projection switch. These are now
getters, and the backwards-compatible surface also copies with **property
descriptors** rather than by value, so liveness is preserved. This also removes an
existing, latent staleness bug.

### What the measurement caught along the way

Calling `Celestial.display()` repeatedly **appended another complete settings form
every time**: after six calls there were 469 fields instead of 67, with identical
`id`s — and the `$("…")` lookups always found the first one. `form()` now empties
the existing form before rebuilding it.

### Backwards compatibility

The surface and the behaviour of `Celestial.display(config)` are unchanged —
including the fact that successive calls build on the accumulated global settings.
The only difference is that it now also returns an instance.

```js
// the old way, unchanged
Celestial.display({ container: "map", projection: "aitoff" });

// several independent maps
import { SkyMap } from "celestial-chart";
const a = new SkyMap({ container: "map-a", projection: "orthographic" }, { standalone: true });
const b = new SkyMap({ container: "map-b", projection: "mollweide" },   { standalone: true });
```

`standalone: true` is the point: the instance is built only from the defaults and
its own config, not from the accumulated global settings.

### Verification

- **The reference net is bit-identical** after every sub-step: 25/25 projections,
  max difference 0.000 px.
- `demo/two-maps.html`: two maps on one page, with different projections and
  centres — separate `cfg`, separate `mapProjection`, separate container, each with
  its own 5044 stars, one `container` element per map.
- `demo/full.html`: the complete old surface — zoom, drag rotation, four projection
  switches, two transformations, use of the settings form, `Celestial.rotate`,
  `Celestial.apply`, SVG export. 0 console errors, and the form stays at 67 fields
  throughout.
- 44 tests green.

### What is still left of this

The built-in settings form, the geolocation and the SVG export work on the
**current** (most recently created) map, through a module-level `current` pointer.
There is one form per page, so this is the old behaviour — but if someone wants two
*interactive* maps with their own forms, these have to be handed over per instance
as well. The drawing, however, is already fully instance-based.

## 10. Extending the net to every projection

Until then the reference measured **25 projections** out of 69 — a well-chosen
selection, but a selection. And the net only protects what it measures: in the
remaining 44, a botched formula would have gone unnoticed.

The list is now taken from `config.js`, so that it cannot drift away from it:
**110 684 measured points**, with 4 rotations per projection.

### What it found immediately

Three projections differed from v3, each for a different reason.

**`wiechel` — 1125 px.** The formula is **identical** in v3 and v4; the difference
was in the mirroring. We look at the sky from the outside in, which v3 solved by
wrapping the raw function (`raw(-λ, φ)`), while we used v7's `reflectX(true)`. The
two **give exactly the same thing for 65 projections** — but not for all of them:
for wiechel the sign of λ matters INSIDE the formula too
(`atan2(sin λ · cos φ, −sin φ)`), not just in the x coordinate of the end result.

We went back to the v3-faithful wrapping. Lesson: the claim "these two are
equivalent" has to be proved on the set where it is used — the original measurement
covered 24 projections, and the exception happened not to be among them.

**`twoPointEquidistant` — 555 px.** The first thing the v4 raw does is `z0 *= 2`;
v3 used the parameter directly. The values in `config.js` are calibrated for v3, so
a conversion table halves them. (The round trip leaves ~1e-9 of floating-point
noise; in pixels, 0.000.)

**`healpix` — 114 px.** v4 rescaled the projection: v3 did `point[0] /= 2`, while v4
does `point[0] *= 4/τ` and `point[1] /= h` — **differently** for x and for y, so the
aspect ratio is different too. The `scale`/`ratio` values in `config.js` would
therefore give a wrongly proportioned map. We carried the v3 variant forward; the
Collignon and cylindrical equal-area projections come from v4.

### Result

```
67/69 projections, 110 684 measured points, max difference 0.000 px
```

The missing two (`cassini`, `quincuncial`) are **not in the shipped upstream build
either** — a `TypeError` there too. The net measures this as well: both sides report
67 successful projections.

`test/projections.test.mjs` measures six projections against the 162-point table of
the pinned v3 build (`hatano`, `wagner7`, `healpix`, `wiechel`,
`twoPointEquidistant`, and `mercator` as a control), and a separate test speaks up
if a future d3-geo-projection makes one of our own copies unnecessary.

## 11. Remaining upstream bugs

Four items, all from the "small, clean function without test coverage" class — the
same one that produced #157.

### `Celestial.ha()` — a mistyped normalisation

```js
var ha = getMST(dt, lng) - ra;
if (ha < 180) ha = ha + 360;      // a 100° hour angle became 460°
```

Both `getMST` and `ra` are in `[0,360)`, so the difference is in `(-360, 360)` —
values below zero are the ones that need wrapping. **In the same file, two lines
above**, `horizontal()` correctly writes `if (ha < 0)`. Public surface, nothing in
the library calls it.

The test does not start from the formula but from the meaning: the hour angle is
zero when the object stands on the meridian (azimuth 0° or 180°). We find that from
`horizontal()`, so the two functions also stay consistent with each other.

### `getWidth()` — a non-existent method

```js
else w = window.getBoundingClientRect().width - margin[0]*2;
```

`window` has no `getBoundingClientRect` method. This branch runs when there is **no
container element and no width given** — that is, in the simplest beginner usage.
Reproduced: `display()` blew up with an exception, with no canvas and no stars. In
that case the map goes into `body`, so the width of `document.body` is what counts.
After the fix: 1469 px, 5044 stars.

This is now a permanent check in the smoke test (`harness/no-container.html`).

### `Trig.normalize` / `normalize0` — latent

```js
normalize:  ((val + 2π) % 2π)          // −30 → −4.867
normalize0: ((val + 3π) % 2π) − π
```

The JS `%` keeps the sign of the dividend, so a single shift is only enough if the
input does not go below −2π (respectively −3π). The mean orbital elements grow large
as one moves away from J2000 — and there the old formula did not return a normalised
angle.

**Latent, not active**: the Moon's position stays sensible throughout from 1700 to
2300. It still does after the fix — which proves that it does not change the working
cases.

### `Trig.spherical` and friends — dead code

Nothing in the library calls the `Trig.spherical`, `tanh`, `acosh` and `distance`
methods. On top of that, `spherical` is **not the inverse** of `cartesian`: it uses
`atan` instead of `atan2` (losing the quadrant, and dividing by zero when x = 0),
and the second value it returns is polar distance, not latitude.

We did not touch it — nothing calls it — but marked it in a comment so that no new
code gets built on it. `tanh`, `asinh`, `acosh`, `sinh` and `cosh`, on the other
hand, are **correct**: a test measures them against their built-in `Math.*`
counterparts.

### `cassini`, `quincuncial`

Removed from the list: it turned out that these are **not a migration regression** —
they are not in the shipped upstream build of `d3.geo.projection` either, a
`TypeError` there too. The reference net measures this as well: both sides report 67
successful projections out of 69.

## 12. Instantiating the settings form — closing #96/#131

After the class-based rewrite the **drawing** was already per instance, but the
built-in settings form, the geolocation, the date picker and the SVG export all
worked on a shared `current` pointer. Two interactive maps on one page would have
written each other's fields.

### Why a closure, not a class

Putting form.js into a class would have been the obvious move. Except that in d3's
event handlers `this` means the **DOM element** (`testNumber(this)`), and inside a
method that would clash. A closure preserves both: `this` stays the DOM element, and
`sky` is visible lexically.

The analysis showed that of form.js's 13 top-level functions **3 are pure**
(`popError`, `testNumber`, `testColor`) — those stayed — and **9 are
instance-dependent** (197 lines), all of them through `$form`. Those moved inside
the `form(sky)` closure, which returns an interface; the instance holds it as
`sky.form`.

The same for `geo(sky)`, `datetimepicker(sky, …)`, `exportSVG(sky, …)`, and the
three functions in `get.js` also receive the instance. `$(id)` moved into the
closure in `celestial.js` — it was only used from there.

The form's handlers (`apply`, `reproject`, `rotate`, …) called the global
`Celestial` in 37 places; those now call `sky`. The library-level helper functions
(`Celestial.projections()`, `eulerAngles()`, `getPoint()`) stayed global — those are
not instance state.

### Two pitfalls that the measurement caught

**Ordering.** `redraw()` already runs while the zoom is being set up, and it calls
`setCenter`. In the old code that was a module-level function, so it always existed;
and the field lookup is guarded against a missing form. Now the `form` object itself
has to exist — its creation was moved ahead of building the projection.

**Infinite recursion.** The backwards-compatible surface copies the instance's
properties onto `Celestial` — including `exportSVG`. If that calls
`Celestial.exportSVG`, it calls itself. The instance's method now addresses the
module function directly.

**Late values.** The constellation list receives its value AFTER loading, by which
time the global surface has already been copied. Forwarding accessors were added for
these two names (`constellations`, `constellation`), so that
`Celestial.constellations` works the old way.

### The proof

`demo/two-forms.html`: two interactive maps, each with its own settings form.
Switching the projection on map A's form:

```
A: orthographic → hammer      B: mollweide → mollweide
```

Separate form element, separate form interface, separate SVG export, 67 and 67
fields, 5044 and 5044 stars, 0 console errors. This is now a permanent check in the
smoke test.

## 13. TypeScript types

`types/celestial.d.ts` describes the public surface. We did two things differently
from how a .d.ts is usually made.

### The body of Config is generated

The library has **~110 settings**, five levels deep. Typed out by hand it would
start drifting from day one. So we generated it from the defaults in
`src/config.js`, with a refinement table for those fields where the type cannot be
inferred from the default value (`center`, `geopos`, `daterange`, the ones
defaulting to `null`).

The projection union is generated too: all 69 names are in it, so the editor offers
them.

### The type cannot drift

A `.d.ts` is the quietest kind of lie: it compiles, nobody runs it, and it slowly
drifts away from the code. It needed the same principle as the reference net —
**measure it, do not believe it**. `test/types.test.mjs` makes four assertions:

| | |
|---|---|
| every runtime setting appears in the type | fails if a new setting is added to `config.js` |
| the type does not invent a non-existent setting | fails if a name is mistyped in the `.d.ts` |
| the projection union lists exactly the supported ones | in both directions |
| the transformation union is complete | |

We tried the detector in both directions: it fails both for a new key added to
`config.js` and for a made-up name added to the `.d.ts`.

### Compilation is a check too

`types/check/usage.ts` describes real usage — the old global surface, two
independent instances, the settings form, using the projection — and it compiles in
`strict` mode. `npm run types` runs this, and so does CI.

This is what caught the flaw in the first version: `CelestialFelulet extends
Partial<SkyMap>` was technically accurate (the methods really do only exist after
`display()`), but every call would have required `?.`. The type now shows them as
present, and the documentation says from when.

## 14. Where the sequence of steps stands

| # | Step | State |
|---|---|---|
| 1 | Mathematical bugs (#148, #130, #157) | **done**, 38 tests |
| 2 | Pinning the reference net | **done** — 67/69 projections, 110 684 points, automated |
| 3 | Mechanical D3 replacement | **done** |
| 4 | `d3.geo.*` → `d3-geo` + `d3-geo-projection` | **done**, 25/25 bit-identical |
| 5 | ES modules, tree-shaking | **done**, 463 KB / 3 files → 291 KB / 1 file |
| 6 | `form.js` / `svg.js` — migrate or drop | migrated, works |

Beyond that: a **class-based interface** (`SkyMap`), several independent
*interactive* maps on one page, each with its own settings form — upstream
#96 and #131 closed.

Projections: **67/69 work, exactly as many as in upstream.** Tests: 44, all green.
