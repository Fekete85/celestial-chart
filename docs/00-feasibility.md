# Feasibility survey and migration overview

> This document is the **starting point** of the work: the survey that decided whether it was worth
> taking over and modernising the [d3-celestial](https://github.com/ofrohn/d3-celestial) library. The
> finished fork is described in [`README.md`](../README.md), the detailed log in
> [`04-migration-log.md`](04-migration-log.md).

The version examined: `ofrohn/d3-celestial @ 7e720a3` (2022-07-05).

---

## The four most important findings

### 1. The project is unmaintained, but not dead

| | |
|---|---|
| Author's last comment on anything | **2022-01-20** |
| Last non-dependabot merge | 2022-01-20 |
| Open PRs without acceptance | #135 (2022), #150 (2024), #152 (2025), #154–156 (2025) |
| Open issues | **42** |
| Stars / forks | 740 / 204 |

**None** of the 204 forks has done any substantial maintenance (the most active one, `mcoenca`, has 47
commits on a Paris-specific application of its own). In other words: there is demand, there is a
community, but there is no maintainer.

**Consequence:** what we would plan here is not an upstream PR but a **hard fork** — under its own
name, with its own maintenance. In 2021 the author himself wrote on three issues:

> *"The app has reached a state where it is difficult to add features without breaking something."*

### 2. A third of the codebase can be carried over untouched

5669 lines, 16 modules. By D3 dependency:

| Group | Lines | D3 calls | What it is |
|---|---:|---:|---|
| **Pure mathematics** | 1421 | **0** | `moon.js`, `kepler.js`, `transform.js`, `horizontal.js`, `get.js`, `add.js` |
| **Core** | 2050 | 59 | `celestial.js`, `canvas.js`, `projection.js`, `config.js`, `util.js` |
| **Optional** | 2198 | 71 | `form.js`, `svg.js`, `location.js`, `datetimepicker.js`, `timezones.js` |

The astronomical computations (lunar phase, Kepler orbits, coordinate transformation) contain **not a
single D3 call**. The built-in settings form and the SVG output can be dropped or postponed.

**The first phase is therefore ~2050 lines, not 5669.**

### 3. The migration can be made measurable — and that is the key

The sentence quoted from the author is not about the D3 version, it is about there being **no
regression net**. In a projection library, correctness means the pixels are where they belong.

But projection is a deterministic function: `(RA, Dec, projection, rotation) → (x, y)`. So it can be
pinned. The [`harness/`](../harness/) folder holds a **working reference generator**:

```
67 projections × 4 rotations × 413 sky points = 110 684 measured points
```

It records the projected pixel coordinates **and the clipping state** as well. The migrated version
has to produce the same thing — within a given tolerance.

**The measurement has been run** — and the net itself needed fixing. The first version measured the
*same* coordinate for all four rotations: `Celestial.rotate()` starts a d3 transition, so the
synchronous measurement recorded the state before the rotation. Only the visibility flag differed,
which is why it went unnoticed. `disableAnimations: true`, and the self-check extended: *within one
projection, two rotations must not give identical coordinates*.

> The same class of bug that the self-check already caught in the net's first version — just on a
> different axis. A self-check only protects against what it was written for.

> The first version of the harness was **wrong**: it switched projections with `Celestial.apply()`,
> which the API does not support (`projection` requires a reload), so every projection would have
> produced the same output. A built-in **self-check** caught it: if two different projections give
> identical output, the reference is silently worthless. This shows nicely that the net itself has to
> be validated.

### 4. There is valuable work that does not even require the D3 migration

Issue [#148](https://github.com/ofrohn/d3-celestial/issues/148) (reported 2023-12-08, unanswered
since) says that a sign correction is missing from the `horizontal.inverse()` function.

We reproduced and quantified it ([`harness/issue-148-check.mjs`](../harness/issue-148-check.mjs)):

```
ORIGINAL:   153/306 points come back wrong (50%), largest difference 171.4°
FIXED:        0/306 wrong, largest difference 0.0002°
```

The bug affects **half** of the points above the horizon — exactly the half where `sin(azimuth) > 0`.
`acos` always returns 0–180°, so one half of the sky is lost; the forward direction handles this
(`if (Math.sin(ha) > 0) az = 2π - az`), the inverse does not.

**The fix is a single line, and `horizontal.js` contains zero D3 calls** — meaning it can be fixed
entirely independently of the D3 version.

---

## Recommended order

The first two steps **have value in themselves**, regardless of whether the migration is ever finished.

| # | Step | Why this order | Risk |
|---|---|---|---|
| 1 | **Fixing the mathematical bugs** (#148, #130 lunar phase, #157 interpolation) | D3-free files, provable with a round-trip test | low |
| 2 | ~~**Pinning the reference net** against the current version~~ **done** | After this, anything can be touched without fear | none |
| 3 | ~~Mechanical D3 replacement~~ **done** | Mechanical, the net gives immediate feedback | low |
| 4 | ~~`d3.geo.*` → `d3-geo` + `d3-geo-projection`~~ **done** | **This is the substantial part**, measured per projection | **high** |
| 5 | ~~ES modules, tree-shaking~~ **done** | This resolves issues #86, #81, #115, #141 | medium |
| 6 | ~~`form.js` / `svg.js`~~ **migrated, works** | A separate decision, not blocking | – |

Steps 1–6 are complete. The result and the bugs found along the way:
[`04-migration-log.md`](04-migration-log.md).

### Usage

```js
import Celestial from "celestial-chart";           // ES module
const { Celestial } = require("celestial-chart");  // CommonJS
```

**TypeScript types** ship with the package — no `@types` package needed. The projection and
coordinate-system names are union types, so the editor offers them:

```ts
import Celestial, { SkyMap, Config } from "celestial-chart";
Celestial.display({ projection: "mollweide", transform: "galactic" });
//                               ^ one of the 69 supported names
```

The type cannot drift away from the code: a test measures whether every runtime setting appears in
it, and whether it invents one that does not exist.

Several independent maps on one page (upstream #96, #131):

```js
import { SkyMap } from "celestial-chart";
const a = new SkyMap({ container: "map-a", projection: "orthographic" }, { standalone: true });
const b = new SkyMap({ container: "map-b", projection: "mollweide" },   { standalone: true });
```

or in the browser, the old way — but now from **a single file, without external D3**:

```html
<script src="build/celestial.min.js"></script>
```

| | files | size |
|---|---:|---:|
| upstream v3 (d3 + plugin + celestial) | 3 | 316 KB |
| migrated, before modularisation | 3 | 463 KB |
| **now** | **1** | **291 KB** |

### The balance sheet of the migration

```
110 684 measured points — 67/67 projections max difference 0.000 px, 0 clipping differences
```

The projection output is **bit-identical** to the D3 v3 version. (Two of the 69 configured
projections are not in the upstream shipped build either — it throws an error there too.) At three
points the old code returned NaN (the antipode of the projection), the new one a defined value —
that is an improvement.

**Eight bugs** came up during the migration, six of which the numeric net would not even have
caught (colours, events, window resizing, loading chain, SVG export), because it only measures
geometry. None of them threw an exception — all of them came out of manual walkthroughs.

Measured visually across six views, the difference is **0.04–0.70%** at the edges of the stars and
labels, i.e. anti-aliasing. **The Milky Way fill has also been verified over 44 orientations to match**
the v3 one — there is no known visual regression.

Details: [`01-codebase.md`](01-codebase.md) · [`02-migration.md`](02-migration.md) ·
[`03-issues.md`](03-issues.md)

## Verification

```bash
npm install
npm run verify        # build + 60 tests + type check + the net's self-test + 27 browser assertions
```

`verify` runs the whole investigation end to end in headless Chromium (~2 minutes): regenerating and
comparing both references, 12 images + pixel diff, an interactive smoke test (zoom, rotation,
projection switch, settings form, SVG export, two independent maps), console-error watching. The same
thing runs in CI on every push.

For manual investigation:

```bash
npm run serve
# http://127.0.0.1:8877/harness/reference.html      measuring the pinned v3
# http://127.0.0.1:8877/harness/reference-new.html   measuring the migrated build
# http://127.0.0.1:8877/harness/visual.html#orthographic,180,55       old image
# http://127.0.0.1:8877/harness/visual-new.html#orthographic,180,55    new image
# http://127.0.0.1:8877/demo/full.html             the full surface: settings form, zoom, SVG export
```

## What the modernisation solves, and what it does not

**It solves** (7 issues in one go): #147 (D3 upgrade), #141 (ES module), #86 (React), #81 (Node),
#115 (webpack), #134 (`d3 is not defined`), and partly #96/#131 (multiple instances on one page —
that is the problem of global state, which a class-based rewrite removes).

**It also solves**: #96 and #131 (multiple instances on one page) — via the class-based interface.
Several *interactive* maps work on one page too, each with its own settings form
([`demo/two-forms.html`](../demo/two-forms.html)).

**It does not solve**: the mathematical bugs (#148, #130, #157) and the feature requests. Those are
separate pieces of work — but the reference net makes those safe as well.

## What the survey cannot decide

The **visual** correctness of the projections. The net compares numbers; whether the Great Bear looks
the way it should has to be **looked at**. After every phase of the migration a human glance is
needed — no automation replaces that.

What we could do: we recorded how it looks *now*, and repeated it with the migrated version. The
[`images/`](images/) folder holds six images each (`d3v3-*` / `d3v7-*`), among them the orthographic
view showing the hemisphere clipping and the Big Dipper.

The recording was **not reproducible** at first — the same version measured against itself gave a 3–6%
pixel difference. Three causes, all of them from the library's state handling: the first `display()`
derives a centre from the current time, we took the snapshot during the animated transition, and the
second `display()` leaves behind a different state than the first. After switching these off the noise
floor is **exactly zero** — only from that point does comparing old and new mean anything.

## Licence

Upstream is BSD-3-Clause, and the fork stays that. The `upstream/` folder is gitignored; the
[`harness/vendor/`](../harness/vendor/) folder contains a pinned copy of the examined version so that
the reference stays reproducible.
