# Migrációs terv

Fázisokra bontva úgy, hogy **minden fázis után működő állapot legyen**, és az első kettőnek
önmagában is legyen értéke — akkor is, ha a migráció soha nem fejeződik be.

## 0. fázis — matematikai hibák (D3-független)

A `horizontal.js`, `moon.js`, `kepler.js` nulla D3-hívást tartalmaz. Az itteni hibák a
D3-verziótól függetlenül javíthatók, és round-trip teszttel bizonyíthatók.

| Issue | Mi a baj | Bizonyítva |
|---|---|---|
| [#148](https://github.com/ofrohn/d3-celestial/issues/148) | `horizontal.inverse()` — hiányzó előjel-korrekció | **igen**: 153/306 pont hibás, max. eltérés 171,4° |
| [#130](https://github.com/ofrohn/d3-celestial/issues/130) | „Wrong moon phase?" | még nem |
| [#157](https://github.com/ofrohn/d3-celestial/issues/157) | 12 órás középpont-váltás rosszul interpolál | még nem |

**Kimenet:** javított matematika + unit tesztek. Ez önmagában publikálható PR-ként az upstreamnek is
(bár a szerző 4,5 éve nem reagál).

## 1. fázis — referencia-háló

A [`harness/`](../harness/) már működik: 25 vetítés × 4 forgatás × 413 pont.

**Bővítendő a migráció előtt:**
- zoom-szintek (jelenleg csak az alapértelmezett)
- `transform`: `ecliptic`, `galactic`, `supergalactic` (jelenleg csak `equatorial`)
- a `Celestial.getPlanet()` kimenete néhány dátumra
- canvas-pixelhash: nem csak koordináták, hanem a tényleges rajz ujjlenyomata

**Kimenet:** `referencia-d3v3.json`, ami a migráció mércéje.

## 2. fázis — mechanikus D3-csere

Sorrendben, mert a későbbiek az előzőekre épülnek:

1. `d3.functor` → saját 3 soros pótlás (14 hely)
2. `d3.map` → natív `Map` (1 hely)
3. `d3.scale.quantize` → `d3.scaleQuantize` (1 hely)
4. `d3.time.format` → `d3.timeFormat` (4 hely)
5. `d3.event.target` → callback-paraméter (1 hely)
6. `d3.json` + `d3.queue` → `Promise.all` (19 hely) — **ez a legnagyobb darab**
7. `d3.geo.distance/path/graticule/interpolate` → `geoDistance` stb. (11 hely)

A háló minden lépés után visszajelez. Ha egy vetítés elmozdul, azonnal látszik.

## 3. fázis — a kockázatos rész

**`d3.geo.projection` → `d3.geoProjection`** (4 hely, de 25 vetítést érint).

Módszer: vetítésenként, egyenként. Minden vetítés után a háló 4 forgatás × 413 pontot ellenőriz.
Tűrés: 0,01 pixel — a lebegőpontos eltérés ennél kisebb kell legyen.

**`d3.svg.symbol` + `customSymbol` → `d3.symbol`** (6 hely, csak az SVG-kimenet).
Ha az SVG-export elhagyható, ez a fázis kihagyható.

## 4. fázis — ES-modulok

Ez oldja meg a #86 (React), #81 (Node), #115 (webpack), #141 (ES-modul), #134 (`d3 is not defined`)
issue-kat. A build `rollup`-pal, a kimenet ESM + UMD.

**Ekkor lesz értelme a tree-shakingnek**: a jelenlegi 148 KB-os monolitikus D3 helyett csak a
használt modulok (`d3-geo`, `d3-geo-projection`, `d3-selection`, `d3-interpolate`, `d3-shape`,
`d3-array`) kerülnének be.

## 5. fázis — szingleton felszámolása (opcionális)

A `Celestial` globális állapota miatt nem lehet két térkép egy oldalon (#96, #131). Ehhez
osztály-alapú átírás kell. **A legnagyobb szerkezeti változás**, és a háló csak részben véd — az
állapotkezelés hibáit nem fogja meg. Külön döntés.

## Amit érdemes elhagyni

| Modul | Sor | Miért |
|---|---:|---|
| `form.js` | 786 | Beépített vezérlő űrlap. A legtöbb integrátor saját UI-t csinál (mi is). |
| `datetimepicker.js` | 220 | Ugyanaz — ma már van natív `<input type="datetime-local">`. |
| `timezones.js` + `location.js` időzóna-része | ~100 | **Külső API-t hív** (`api.timezonedb.com`) beégetett kulccsal. Ez CSP-vel blokkolt, és elvi probléma is. Natív `Intl.DateTimeFormat().resolvedOptions().timeZone` kiváltja. |

Ez 1100+ sor, amit nem kell migrálni. Ha kellenek, később, külön csomagként.

## Reális ráfordítás

| Fázis | Becslés | Kockázat |
|---|---|---|
| 0. matematika | 1–2 nap | alacsony |
| 1. háló bővítése | 1 nap | nincs |
| 2. mechanikus csere | 2–3 nap | alacsony |
| 3. projekciók | **3–5 nap** | **magas** |
| 4. ES-modulok | 2–3 nap | közepes |
| 5. szingleton | 3–5 nap | magas |

Fázis 0–4: **kb. 10–14 nap** fókuszált munka. Az 5. fázis külön döntés.

Ez nem „egy hétvége", de nem is reménytelen — és a 0–1. fázis után bármikor meg lehet állni úgy,
hogy közben valódi értéket hoztunk létre.
