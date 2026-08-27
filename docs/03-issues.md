# Triage of the 42 open issues

Categorised by whether the modernisation solves them.

## Solved by the modernisation (7)

These are all shoots from the same root: the library works as a global script, with old D3.

| # | Title | Why it is solved |
|---|---|---|
| 147 | update d3 version | This is the task itself |
| 141 | refactor to es6 module | Phase 4 |
| 86 | React JS (16 comments) | Natural once it can be imported as ESM |
| 81 | Node js module | ESM + `package.json` exports |
| 115 | `d3_celestial__WEBPACK...display is not a function` | Bundler-compatible output |
| 134 | `d3 is not defined` | No more global `d3` dependency |
| 100 | `'#celestial*' is not a valid selector` | When the selector handling is rewritten |

## Partly solved (2)

| # | Title | What it needs |
|---|---|---|
| 96 | multiple instances with different configs | ESM alone is not enough — **eliminating the singleton** is needed (phase 5) |
| 131 | Unable to add multiple celestial maps | The same |

## Mathematical bugs — independent of D3 (3)

These are in the D3-free files, so they **can be fixed right now, immediately**.

| # | Title | State |
|---|---|---|
| **148** | `horizontal.inverse` missing sign correction | **Reproduced and quantified**: 153/306 points wrong, max. difference 171.4°. The fix is one line. See `harness/issue-148-check.mjs` |
| 130 | Wrong moon phase? | Not investigated. `moon.js` is 538 lines with zero D3 calls — testable the same way |
| 157 | Changing center by 12 hours interpolates badly | Not investigated. Probably the angle-boundary handling around `interpolateNumber` |

## Behavioural bugs — safely fixable with the net (7)

| # | Title |
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

## Feature requests (17)

Not bugs but extensions: #153 precession and nutation, #151 constellation figures, #149 radial
gradient, #145 simulating human vision, #144 image overlay, #142 margin, #139 clickable objects,
#137 date range, #128 initial data, #123 custom constellation boundaries, #110 line colour, #107
sky with horizon, #106 drawing onto an existing canvas, #97 custom line style, #91 languages, #79
background image, #64 horizon labels.

Several of these (#107, #64) ask for something we have already solved in our own `csillag` project as
a custom layer — meaning the library is extensible, just undocumented.

## Data bugs (1)

Issue #109 HAT-P Stars Missing — a catalogue question, not a code bug.

---

## What this triage shows

Of the 42 issues, **9 are real bugs** that the modernisation or the net makes safe, and **7** that it
solves directly. The majority are feature requests — which indicates that **the library is used and
wanted**, there is just nobody to receive the requests.

The fastest community value is not the D3 migration but **fixing #148**: a one-line change that fixes
half of the horizontal coordinate back-conversion, and that has been waiting since December 2023.
