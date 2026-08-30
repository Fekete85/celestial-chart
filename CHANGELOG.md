# Changelog

## 0.8.1

### Fixed

- Layers added with `Celestial.add()` could not draw. They reach the map through
  the global `Celestial` object — `Celestial.container`, `.context`,
  `.mapProjection` — which is how upstream's examples are written, and which
  worked upstream because `this` inside `display()` *was* the global object.
  In this fork the global receives that interface only after the constructor has
  finished, while the zoom behaviour already triggers a redraw inside it. A
  layer's `redraw` handler therefore ran against `Celestial.container === null`,
  and the resulting exception aborted `display()` itself: the map was left
  without its zoom, rotation and export interface. User layers are now held back
  until the interface is published, and drawn immediately afterwards. Covered by
  a browser assertion in `harness/verify.mjs`.

## 0.8.0 — first release of the fork

Forked from [d3-celestial](https://github.com/ofrohn/d3-celestial) `0.7.35`
(commit `7e720a3`, 2022-07-05).

Every change below is measured against the pinned upstream build: 67 projections
× 4 rotations × 413 sky points = 110 684 points, maximum difference **0.000 px**.

### Astronomical fixes

- **[#148](https://github.com/ofrohn/d3-celestial/issues/148)** `horizontal.inverse()`
  was missing a sign correction. `acos` returns 0–180°, so half the sky above the
  horizon — exactly the half where `sin(azimuth) > 0` — came back wrong, by up to
  171°. The forward direction already handled the ambiguity. Round-trip error:
  50% of points → 0%.
- **[#130](https://github.com/ofrohn/d3-celestial/issues/130)** *Wrong moon phase?*
  The phase computation is correct (verified against seven eclipse-anchored
  syzygies). Two other defects produced the reported symptom:
  - `moon.js` added Schlyter's **ecliptic** perturbation terms directly to right
    ascension and declination, where `elements()` already accounts for them.
    Meeus 13.a: RA error 1.50° → 0.0004°.
  - The terminator ellipse used `1.6 · |ph − 0.5|` where the geometry is
    `|2·ph − 1|`, so a full moon was drawn 19% narrow — as a gibbous.
- **[#157](https://github.com/ofrohn/d3-celestial/issues/157)** The guard written
  for the 180° centre change (`if (d > 3.14)`) was unreachable: `Round(d, 2)`
  cannot exceed 3.14. Antipodal endpoints then went through `geoInterpolate`,
  which divides by `sin(d) = 1.2e-16`. Measured angular error up to 139°.
- `Celestial.ha()` normalised with `if (ha < 180)` instead of `if (ha < 0)`,
  returning hour angles such as 460°.
- `Trig.normalize` / `normalize0` did not normalise inputs below −2π (−3π).
  Latent: the Moon's position stays sane from 1700 to 2300 either way.

### Rendering fixes

- Star colours: `d3.scaleQuantize` no longer accepts a descending domain, so
  after the D3 upgrade **every star rendered red**. The scale is now built
  ascending with a reversed range.
- Milky Way: d3-geo filled the **complement** of the outline at some
  orientations — the map greyed out and the Milky Way showed black. Detected by
  asking the rendered path whether it contains the galactic pole, which is known
  to lie outside every Milky Way contour. Verified across 44 orientations.
- Window resize reset the user's zoom: the guard in `resize(set)` never fired,
  because in D3 v7 the listener's first argument is the event object.
- SVG export wrote `Infinity` coordinates for mercator (the 179.95° background
  circle includes the poles); browsers discard such paths.
- The map failed to render when given neither a container element nor a width —
  `getWidth()` called `window.getBoundingClientRect()`, which does not exist.

### Projections

- `hatano` and `wagner7` restored: d3-geo-projection v4 no longer exports their
  raw functions.
- `healpix` restored to the v3 normalisation: v4 rescales x and y differently,
  so the configured `scale`/`ratio` would produce a wrongly proportioned map.
- `twoPointEquidistant`: v4's raw doubles its argument; the configured values are
  calibrated for v3.
- `wiechel`: reflecting the projected x is **not** equivalent to flipping the
  longitude for this projection, because the sign of λ also matters inside
  `atan2`. The v3 wrapping is kept.
- `cassini` and `quincuncial` remain unavailable — they are absent from the
  shipped upstream build as well.

### Architecture

- D3 v7, ES modules, tree-shaken and bundled. Four outputs: IIFE (global
  `Celestial`, unchanged usage), minified IIFE, ESM and CJS.
- Class-based instances (`SkyMap`), so several maps can share a page — each with
  its own configuration, projection, container and settings form
  ([#96](https://github.com/ofrohn/d3-celestial/issues/96),
  [#131](https://github.com/ofrohn/d3-celestial/issues/131)).
- Repeated `Celestial.display()` calls no longer append a duplicate settings form
  (six calls produced 469 fields instead of 67, sharing ids).
- TypeScript definitions, with a test that keeps them from drifting from the code.
- The spherical zoom plugin now uses [`versor`](https://github.com/d3/versor)
  (ISC) for the quaternion mathematics instead of a vendored copy.

### Privacy

- **No API key is shipped any more.** Upstream's defaults carried the author's
  TimeZoneDB account id, and `settimezone: true` was also a default — so any page
  embedding the library sent its visitors' coordinates to a third party, unasked,
  on a quota shared with every other d3-celestial site, over plain HTTP whenever
  the page itself was served over HTTP. A key in a client-side bundle cannot be
  kept secret, so the fix is no key rather than a different one.
- New `timezoneResolver(lat, lon, whenSeconds) => number | Promise<number>`
  config option: resolve the offset from your own service. It takes precedence
  over `timezoneid`, which still works with a key of your own.
- A test now fails the build if a credential-looking literal reappears in `src/`.

### Breaking changes

Behaviour that differs from upstream — all of them consequences of the fixes above:

- Moon right ascension and declination move by up to 1.50°; the terminator is wider.
- `horizontal.inverse()` returns the correct hemisphere.
- `Celestial.ha()` returns `[0, 360)`.
- SVG export clips paths to the output size.
- `Celestial.display()` additionally returns the created instance.
- With no `timezoneid` and no `timezoneResolver`, the UTC offset of a position is
  estimated from longitude instead of being looked up remotely. Configure one of
  the two to get exact offsets back.

A global `d3` is no longer required, or used, by the bundle.
