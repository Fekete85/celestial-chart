# Reference net

The `d3-celestial` projections are deterministic functions: `(RA, Dec, projection, rotation) → (x, y)`.
That means the current (D3 v3) output can be **recorded**, and the migrated version has to produce
the same thing — within a given tolerance.

## Usage

```bash
cd harness
python3 -m http.server 8877
# then in the browser: http://127.0.0.1:8877/reference.html
```

The page runs the measurement and offers `reference-d3v3.json` for download.

**It runs in the browser, not in Node** — d3-celestial needs a DOM and a canvas.

The measurement has been run. There are two references in the repo:

| | |
|---|---|
| `reference-d3v3.json` | the pinned upstream (D3 3.5.17) — `reference.html` |
| `reference-d3v7.json` | the migrated build (D3 7.9.0) — `reference-new.html` |

Compared: **25/25 projections, max difference 0.000 px** — the projection output is bit-identical.

```bash
node compare.mjs reference-d3v3.json reference-d3v7.json
```

## What it measures

| | |
|---|---|
| Projections | 25 (`airy`, `mercator`, `orthographic`, `stereographic`, …) |
| Rotations | 4 (default orientation, the zenith over Budapest, tilted view, high northern latitude) |
| Sky points | 413 (a 15° RA × 10° Dec grid + poles and edge cases) |
| **Total** | **41,300 measured points** |

For every point we record `[x, y, visible]` — the projected pixel coordinate and the state of
`Celestial.clip()`. The behaviour of clipping is one of the most delicate points of the migration,
which is why we measure it separately.

## Self-check

The net is only worth something if it demonstrably **measures something**. The generator therefore
checks that:

- **no two projections produce the same output** — if they did, it would mean that the projection
  switch never happened, and the reference is silently worthless
- **within a projection, no two rotations produce the same output** — the same thing for rotations
- **most of the points are unique** within the first projection

> This is not theoretical caution, and it has been proven twice:
>
> 1. The first version of the harness called `Celestial.apply({projection})`, which the API does not
>    support (`projection` requires a reload). So all 25 projections would have produced the same
>    output. The self-check caught it.
> 2. In the second version the **four rotations** gave identical coordinates: `Celestial.rotate()`
>    starts a d3 transition, so the synchronous measurement recorded the state before the rotation.
>    This time the self-check did *not* catch it, because it only looked at the projections. Since
>    then `disableAnimations: true` is set, and the rotation check has been added too.
>
> A self-check only protects against what it was written for. It is worth extending it to every axis
> the net claims to measure.

## Visual baseline

The net compares numbers. Whether Ursa Major *looks the way it should* has to be looked at — that is
what `visual.html` is for, which, unlike the generator, renders every layer (stars m≤6, constellation
names and lines, Milky Way, ecliptic, coordinate grid).

```bash
python3 -m http.server 8877
# http://127.0.0.1:8877/visual.html
# switching projection from the console: valt("orthographic", [180, 55])
```

The projection and the centre come from the URL hash, so that **exactly one** `display()` runs per
page load:

```
#airy                                          default orientation
#orthographic,180,55                           projection + centre
#orthographic,180,55|{"mw":{"show":false}}     plus a configuration override
```

This is not a matter of convenience. At first the capture was not reproducible — the same version
measured against itself gave a 3–6% pixel difference. Three causes, all of them from the library's
state handling:

| cause | remedy |
|---|---|
| the first `display()`, via `geo()` in `location.js`, derives the centre from the **current time** | `follow: "center"`, `location: false` |
| we were photographing during an animated transition | `disableAnimations: true` |
| the second `display()` leaves behind a different state than the first (#96/#131) | one `display()` per page |

After that the noise level is **exactly zero**: running the same version twice gives a bit-identical
image. For the comparison there is `image-diff.html`, which compares two PNGs pixel by pixel.

The recorded images are in [`docs/images/`](../docs/images/), with the `d3v3-` and `d3v7-` prefixes:

| Image | What it checks |
|---|---|
| `d3v3-aitoff-full-sky.png` | the whole sky, the position of the Milky Way band and the ecliptic |
| `d3v3-mollweide-full-sky.png` | another whole-sky projection, for comparison |
| `d3v3-mercator-full-sky.png` | rectangular projection, stretching towards the poles |
| `d3v3-orthographic-big-dipper.png` | **hemisphere clipping** + a recognisable shape (the Plough, the W of Cassiopeia) |
| `d3v3-stereographic-north-pole.png` | a view centred on the pole |
| `d3v3-airy-base.png` | the generator's default projection |

After every phase of the migration these have to be photographed again with the same settings, and
the two sets of images placed side by side. No amount of automation replaces this.

## Checking issue #148

```bash
node issue-148-check.mjs
```

A round-trip test for the `horizontal()` / `horizontal.inverse()` pair: if both are correct, the
round-trip conversion gives back the starting coordinate.

Result: the original code returns **50% of the points** above the horizon incorrectly (max difference
171.4°); with the fix there are 0 errors (max 0.0002°).

## Files

| | |
|---|---|
| `reference.html` + `reference.js` | the generator |
| `reference-new.html` | the same generator against the migrated build — **it loads only the build**, with no external D3 |
| `reference-d3v3.json` | **the recorded reference** — this is what the migrated version measures itself against (712 KB) |
| `reference-d3v7.json` | the output of the migrated build |
| `reference-sample.json` | a demonstration of the format, at a readable size |
| `compare.mjs` | the diff of the two references (`--selftest` for its own validity) |
| `visual.html` / `visual-new.html` | the pages for the visual comparison |
| `image-diff.html` | pixel-by-pixel comparison of two PNGs |
| `issue-148-check.mjs` | the numerical investigation of #148 (Node) |
| `vendor/` | a pinned copy of the version under test — so that the reference is reproducible |
| `data/` | a minimal data set (`display()` loads even when every layer is hidden) |
