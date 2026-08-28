# celestial-chart

Interactive celestial map for the browser: stars, constellations, deep-sky objects,
the Milky Way and planets, in 67 map projections, rendered to canvas with SVG export.

A modernised fork of [d3-celestial](https://github.com/ofrohn/d3-celestial) by
Olaf Frohn, whose last release was in 2022 and which is pinned to D3 v3.

**Live demo: [celestial.blackit.hu](https://celestial.blackit.hu)** — pick a
projection, drag to rotate, scroll to zoom.

```bash
npm install celestial-chart
```

```js
import Celestial from "celestial-chart";

Celestial.display({
  container: "celestial-map",
  projection: "aitoff",
  stars: { limit: 6 },
  constellations: { names: true, lines: true }
});
```

Or a single script tag — **D3 is bundled, no separate `<script>` needed**:

```html
<link rel="stylesheet" href="node_modules/celestial-chart/celestial.css">
<div id="celestial-map"></div>
<script src="node_modules/celestial-chart/build/celestial.min.js"></script>
```

## What this fork changes

**It runs on current D3.** Upstream is pinned to D3 v3 (2016). This fork uses
D3 v7 as ES modules, bundled in — which resolves upstream
[#147](https://github.com/ofrohn/d3-celestial/issues/147) (D3 upgrade),
[#141](https://github.com/ofrohn/d3-celestial/issues/141) (ES modules),
[#134](https://github.com/ofrohn/d3-celestial/issues/134) (`d3 is not defined`),
[#115](https://github.com/ofrohn/d3-celestial/issues/115) (webpack),
[#86](https://github.com/ofrohn/d3-celestial/issues/86) (React) and
[#81](https://github.com/ofrohn/d3-celestial/issues/81) (Node).

One file instead of three, and smaller than the original despite a much newer D3:

| | files | minified |
|---|---:|---:|
| upstream (d3 + plugin + celestial) | 3 | 316 KB |
| celestial-chart | **1** | **295 KB** |

**Several maps on one page.** Upstream kept global state, so a page could hold
one map ([#96](https://github.com/ofrohn/d3-celestial/issues/96),
[#131](https://github.com/ofrohn/d3-celestial/issues/131)). Each instance now
owns its state — including its own settings form:

```js
import { SkyMap } from "celestial-chart";

const a = new SkyMap({ container: "map-a", projection: "orthographic" }, { standalone: true });
const b = new SkyMap({ container: "map-b", projection: "mollweide" },   { standalone: true });
```

**TypeScript types ship with the package.** Projection and coordinate-system
names are union types, so the editor offers all 69.

**Astronomical fixes.**

| | |
|---|---|
| [#148](https://github.com/ofrohn/d3-celestial/issues/148) | `horizontal.inverse()` lost the sign: **half** the sky above the horizon came back wrong, by up to 171°. |
| [#130](https://github.com/ofrohn/d3-celestial/issues/130) | The phase computation was fine; two other things were not. `moon.js` added ecliptic perturbations directly to right ascension — a **1.5° error**, three lunar diameters (Meeus 13.a). And the terminator ellipse used a factor of 1.6 instead of 2, so a **full moon was drawn gibbous**. |
| [#157](https://github.com/ofrohn/d3-celestial/issues/157) | The guard written for the 180° turn was unreachable (`Round(d,2)` never exceeds 3.14), so antipodal centre changes went through a degenerate great-circle interpolation — measured error up to 139°. |

Plus, found while testing: every star rendered red after the D3 upgrade
(`scaleQuantize` no longer accepts a descending domain); window resizing reset
the user's zoom; the settings form was appended again on every `display()` call;
`Celestial.ha()` returned hour angles outside any sane range; and the map failed
to render at all when given neither a container element nor a width.

## Time zones, and the key that is not here

The settings form shows the observer's local time, which means turning a
position into a UTC offset. A browser cannot do that for an arbitrary point on
Earth — only for the viewer's own zone — so it takes an outside source.

Upstream shipped the author's TimeZoneDB account id as a default, with
`settimezone: true` also being a default. Every page embedding the library
therefore sent its visitors' coordinates to a third party, unasked, on a quota
shared with every other d3-celestial site — and over plain HTTP whenever the
page itself was served over HTTP.

**This fork ships no key and no endpoint.** With nothing configured, no request
is made and the offset is estimated from longitude (15° per hour) — the fallback
the code always had for failed lookups. Accurate enough for most places, wrong
by up to an hour or two where zones follow politics rather than meridians.

To get exact offsets, configure one of these:

```js
// Your own service — nothing leaves your infrastructure.
Celestial.display({
  timezoneResolver: (lat, lon, when) =>
    fetch(`https://example.org/timezone?lat=${lat}&lon=${lon}&t=${when}`)
      .then(r => r.json())
      .then(j => j.offsetMinutes)
});

// Or the upstream route, with a key of your own.
Celestial.display({ timezoneid: "YOUR_OWN_TIMEZONEDB_KEY" });
```

`timezoneResolver` wins over `timezoneid`; if it rejects, the longitude estimate
takes over. A key in a client-side bundle is readable by anyone who loads the
page, so treat `timezoneid` as public, and prefer a resolver you control.

## Backwards compatibility

`Celestial.display(config)` behaves as before, including how successive calls
accumulate settings. It now also returns the instance it created.

Behaviour that intentionally differs — all of them bug fixes:

- Moon right ascension and declination move by up to 1.5°; the terminator is drawn wider.
- `horizontal.inverse()` returns the correct hemisphere.
- `Celestial.ha()` returns `[0, 360)`.
- SVG export clips paths to the output size (mercator produced `Infinity` coordinates, which browsers discard).
- `Trig.normalize` / `normalize0` normalise inputs below −2π correctly.

## How it is verified

Projection is a deterministic function — `(RA, Dec, projection, rotation) → (x, y)` —
so it can be pinned. `harness/` holds the output of the **pinned upstream v3 build**
and compares the fork against it:

```
67 projections × 4 rotations × 413 sky points = 110 684 measured points
maximum difference: 0.000 px
```

Bit-identical, including the clipping state of every point. The harness checks
itself too: it fails if two projections — or two rotations — produce the same
output, because a net that measures nothing passes everything.

```bash
npm run verify    # build + 71 unit tests + types + 28 browser assertions, ~2 min
```

The browser run regenerates both references, compares them, captures 12 screenshots
with a pixel diff, and drives the real UI (zoom, drag-rotate, projection switching,
forms, SVG export, two independent maps). It runs in CI on every push.

## Trying it locally

The data files are not in the npm package (they are large and they are the
upstream project's catalogues), so the demos load them from `harness/data/`.
They need a real HTTP server — in D3 v7 `d3.json` uses `fetch`, which the
browser refuses on `file://`.

```bash
npm run serve       # then open http://127.0.0.1:8877/demo/full.html
```

| page | what it shows |
|---|---|
| [`demo/full.html`](demo/full.html) | the whole interface: settings form, controls, location, SVG export |
| [`demo/module.html`](demo/module.html) | the same as an ES module import |
| [`demo/two-maps.html`](demo/two-maps.html) | two independent maps on one page |
| [`demo/two-forms.html`](demo/two-forms.html) | two maps, each with its own settings form |

The landing page behind the live demo lives in its own repository,
[celestial-demo](https://github.com/Fekete85/celestial-demo) — it consumes this
package as a dependency, so it is also a standing check that installing and
using the published library actually works.

## Documentation

The full configuration is documented in the
[upstream readme](https://github.com/ofrohn/d3-celestial#configuration) — the
option names are unchanged. Type definitions in `types/celestial.d.ts` list them
all, and a test keeps them from drifting from the code.

The migration itself is written up in [`docs/`](docs/) — what was measured,
what broke, and why.

## License

BSD 3-Clause, inherited from d3-celestial. See [`LICENSE`](LICENSE) and
[`NOTICE.md`](NOTICE.md).

This project is not affiliated with, nor endorsed by, Olaf Frohn or the D3 project.
