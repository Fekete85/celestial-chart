# Notices and attributions

`celestial-chart` is a fork of [d3-celestial](https://github.com/ofrohn/d3-celestial)
by Olaf Frohn, distributed under the BSD 3-Clause License. See `LICENSE` for the
full text, which covers both the original work and this fork.

Per clause 3 of that license, the name of the original copyright holder is used
here **only to identify the origin of the code** — not to endorse or promote this
fork. This project is not affiliated with, nor endorsed by, Olaf Frohn.

Likewise, this package is not an official D3 module and is not affiliated with
the D3 project.

## Bundled dependencies

The distributed bundles (`build/celestial.js`, `.min.js`, `.mjs`, `.cjs`) include
the following packages, all © Mike Bostock, ISC License:

    d3-dispatch   d3-fetch     d3-geo       d3-geo-projection
    d3-interpolate d3-scale    d3-selection d3-shape
    d3-time-format d3-transition d3-zoom    versor

ISC License text: https://opensource.org/licenses/ISC

## Algorithm credits

**Spherical drag-to-rotate** (`lib/geo-zoom.js`) implements the approach of
Jason Davies' `d3.geo.zoom` plugin (2014, http://www.jasondavies.com/maps/rotate/).
The quaternion mathematics is **not** copied from that plugin: it comes from the
`versor` package (Mike Bostock, ISC), which provides the same computation under
clear terms. The D3 v7 glue code is original to this fork.

**Astronomical algorithms** in `src/kepler.js` and `src/moon.js` follow Paul
Schlyter's *How to compute planetary positions* and Jean Meeus' *Astronomical
Algorithms*; both are inherited from the upstream project.

## Data files

The star, deep-sky and Milky Way data under `harness/data/` is a minimal subset
copied from the upstream repository for reproducible testing. The full data sets,
their sources and licensing are documented upstream.
