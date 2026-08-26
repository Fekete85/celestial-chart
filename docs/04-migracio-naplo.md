# Migrációs napló

Ez a dokumentum azt rögzíti, mi történt a felmérés után: mit mértünk, mit
javítottunk, és min bukott el az első próbálkozás. A sorrend az ajánlott
lépéssorrendet követi (lásd a gyökér [`README.md`](../README.md)-t).

---

## 1. A referencia-háló használhatóvá tétele

### 1.1 Az összehasonlító

`harness/osszehasonlit.mjs` — két referencia-háló vetítésenkénti diffje: max /
átlag / p99 pixeleltérés, clipping-eltérés, szerkezeti eltérés.

Az összehasonlítót ugyanúgy validálni kell, mint a hálót magát: ha mindenre azt
mondaná, hogy „rendben", némán értéktelen lenne. A `--onteszt` ezt bizonyítja —
1 px elmozdulás, clipping-váltás, hiányzó vetítés és `pont → null` mind kiüt,
a fordított irány (`régi NaN → új szám`) viszont nem, mert ott nincs mihez
képest romlani.

### 1.2 A háló félvak volt

A felmérés azt állította, hogy a háló **25 vetítés × 4 forgatás × 413 pontot**
mér. Valójában a négy forgatás **ugyanazt a koordinátát** adta; csak a
láthatósági jelző különbözött.

Ok: a `Celestial.rotate()` d3-átmenetet indít, nem azonnal forgat. A mérés
szinkron ciklusban fut, tehát a forgatás **előtti** állapotot rögzítette.
A `Celestial.clip()` viszont a `cfg.center`-t nézi, ami szinkron frissül —
ezért tűnt úgy, hogy a négy forgatás különbözik.

Javítás: `disableAnimations: true` a generátor konfigjában, és az önellenőrzés
kiegészítése egy új feltétellel — *egy vetítésen belül két forgatás nem adhat
azonos koordinátákat*. Ez pontosan az a fajta hiba, amit az eredeti
önellenőrzés a vetítésekre már kiszűrt, a forgatásokra viszont nem.

> Tanulság: az önellenőrzés csak arra véd, amire megírták. Érdemes minden olyan
> tengelyre kiterjeszteni, amit a háló állítása szerint mér.

---

## 2. Matematikai hibák

Mindhárom a D3-tól függetlenül javítható — a `horizontal.js`, a `moon.js` és a
`transform.js` nulla D3-hívást tartalmaz.

### #148 — `horizontal.inverse()` hiányzó előjel-korrekció

Az `acos` 0–180°-ot ad, így az égbolt egyik fele elveszett. Az előre irány
kezeli a kétértelműséget (`if (Math.sin(ha) > 0) az = 2π - az`), az inverz nem.

| | round-trip hiba a horizont fölött |
|---|---|
| előtte | 153/306 pont rossz (50%), max. eltérés 171,4° |
| utána | 0/306, max. eltérés 0,0002° |

Mellékesen: a `.toFixed(6)` helyére rendes tartomány-korlátozás került. Az
`acos` 1 közelében meredek, ott az 1e-6-os csonkolás önmagában hibaforrás; a
`toFixed` csak véletlenül védte meg a zenitet a NaN-tól.

### #130 — „Wrong moon phase?"

A fázisszámítás **nem** hibás — 7 fogyatkozáshoz kötött szizígia-időpontra
0,25 fokon belül pontos, a szinodikus hónap 13 lunációra átlagosan 29,5306 nap.
A bejelentő által látott jelenség viszont valós, csak két másik hiba okozza:

**a) `moon.js corr()`** — Schlyter ekliptikai perturbációs tagjait (evekció,
variáció, évi egyenlet) közvetlenül a **rektaszcenzióhoz és deklinációhoz**
adta hozzá, ráadásul feleslegesen, mert az `elements()` sorfejtése ezeket már
tartalmazza.

Meeus *Astronomical Algorithms* 13.a (1992-04-12 0h):

| | RA | Dec |
|---|---|---|
| előtte | 133,18880° (**−1,50°**) | 13,88840° (−0,12°) |
| utána | 134,68889° (0,0004°) | 13,76789° (0,0005°) |
| Meeus | 134,68847° | 13,76837° |

1,5° ≈ három holdátmérő.

**b) A terminátor geometriája** (`canvas.js` és `svg.js`) — a terminátor-ellipszis
fél-kistengelye a korong sugarának `|cos(fázisszög)|`-szerese, ami a
megvilágított hányaddal `|2·ph − 1|`. A kód `1.6 · |ph − 0.5|`-öt használt
`2 · |ph − 0.5|` helyett: **teliholdkor a korong 19%-kal keskenyebb gibbuszként
rajzolódott ki**. Pontosan ez a bejelentés.

### #157 — „Changing center by 12 hours interpolates badly"

A `celestial.js`-ben van egy védőág pontosan erre az esetre:

```js
if (d > 3.14) cfg.center[0] -= 0.01; //180deg turn doesn't work well
```

Ez **holt kód**: `d = Round(d3.geoDistance(...), 2)`, a gömbi távolság maximuma
π, ennek két tizedesre kerekítve 3.14 — a `d > 3.14` tehát soha nem teljesül.
A védőág abban az egyetlen esetben nem tüzelt, amiért megírták.

Pontosan antipodális végpontoknál a `geoInterpolate` `sin(d) = 1.2e-16`-tal
oszt, és katasztrofális kioltás lép fel. A `[0,0] → [180,0]` fordulat 20 lépéses
mintavétele:

| | lépéshossz | középpont hosszúsága t = 0…1 |
|---|---|---|
| előtte | 0,000° … 54,736° | 0, 17, 30, **90**, 44, **90**, 136, **90**, 150, 163, 180 |
| utána | 8,999° … 9,000° | 0, 18, 36, 54, 72, 90, 108, 126, 144, 162, 180 |

Maximális szöghiba a referencia-slerphez képest: **139,07°** — innen a
bejelentett „flickers and jumps".

Javítás: `d >= 3.14`, és a **kiindulópontot** bökjük meg, nem a célt. A cél
bökése 0,01°-os maradandó hibát hagyna a konfigban, ami ismételt hívásoknál
halmozódik; ráadásul a `config.set()` tömbökre referenciamásolatot ad, így a
két végpont ugyanaz a tömb lehet, és a bökés mindkettőt elmozdítaná.

**Ismert korlát:** ha az antipódus a pólusból adódik (`[0,90] → [180,-90]`), a
hosszúság megbökése nem segít, mert ott a hosszúság szabad paraméter. Ez a
javítás előtt is így volt; külön teszt dokumentálja.

---

## 3. D3 v3 → v7

### Amit cserélni kellett

| v3 | v7 |
|---|---|
| `d3.geo.projection`, `.path`, `.circle`, `.graticule`, `.distance`, `.interpolate` | `d3.geoProjection`, `geoPath`, `geoCircle`, `geoGraticule`, `geoDistance`, `geoInterpolate` |
| `d3.geo.<nev>.raw` | `d3.geo<Nev>Raw` (`naturalEarth` → `geoNaturalEarth1Raw`) |
| `circle.angle(a).origin(c)` | `circle.radius(a).center(c)` |
| `graticule.minorStep()` | `graticule.stepMinor()` |
| `d3.functor` | saját `functor()` |
| `d3.json(url, cb)` | `d3.json(url).then(...)` — `loadJson()` tartja a régi `(error, json)` alakot |
| `d3.time.format(s)` és `.parse` | `d3.timeFormat(s)`, `d3.timeParse(s)` |
| `d3.scale.quantize` | `d3.scaleQuantize` |
| `d3.svg.symbol().type("circle")` | `d3.symbol().type(d3.symbolCircle)` |
| `d3.map({...})` | natív `Map` |
| `d3.queue(n)` | saját `feladatsor(n)` |
| `d3.behavior.zoom`, `d3.mouse`, `d3.event` | `d3.zoom`, `d3.pointer`, a listener első paramétere |
| `selection[0].length` | `selection.empty()` |
| `selection.classed({...})`, `.attr({...})`, `.style({...})` | `osztalyoz()`, `attrok()`, `stilusok()` |

### A vetítések tükrözése

Az égboltot kívülről befelé nézzük, ezért a hosszúságot tükrözni kell. A v3-as
kód a raw függvényt csomagolta be (`raw(-λ, φ)`); a v7-ben erre való a
`reflectX(true)`. **A kettő mérhetően azonos** — 24 vetítésen, sűrű rácson a
maximális eltérés 1e-9 px alatt —, de a `reflectX` az invert irányt is magától
kezeli, nem kell kézzel visszatükrözni.

### A zoom-plugin

Jason Davies `d3.geo.zoom`-ja `d3.behavior.zoom`-ra, `d3.event`-re és
`d3.rebind`-ra épült; mind a három megszűnt. A **kvaternió-matematika
változatlan maradt** (az nem függött a D3-tól), csak a ragasztó új. A kifelé
mutatott felület (`projection`, `center`, `scaleExtent`, `scale`, `on`)
szándékosan a régi, hogy a `celestial.js` hívási helyei ne változzanak.

---

## 4. A mérés

`harness/referencia-d3v3.json` (pinelt upstream) vs `harness/referencia-d3v7.json`
(migrált build), 41 300 mért pont:

```
25/25 vetítés — max eltérés 0.000 px, 0 clipping-eltérés, 0 szerkezeti eltérés
```

Vagyis a vetítési kimenet **bitre azonos**.

Egyetlen különbség: 3 pontban a régi kód NaN-t adott, az új definiált értéket.
Mindhárom a vetítés **antipódusa** (`azimuthalEqualArea`), ahol a képlet
`sqrt(2/(1+cos d))` nevezője nullához tart. A d3-geo v2 óta van erre védőág, a
v3-ban nem volt. Ez javulás, nem regresszió — az összehasonlító külön oszlopban
számolja, és nem bukik el rajta.

Újraelőállítás:

```bash
npm install && npm run epit
python3 -m http.server 8877
# http://127.0.0.1:8877/harness/referencia.html      (pinelt v3)
# http://127.0.0.1:8877/harness/referencia-uj.html   (migrált build)
node harness/osszehasonlit.mjs harness/referencia-d3v3.json harness/referencia-d3v7.json
```

---

## 5. Amit a háló nem mér — és amit ott találtunk

A generátor `interactive: false`, `form: false` mellett fut, tehát az interaktív
felületről semmit nem mond. Külön megnézve (`demo/teljes.html`) négy hiba jött elő:

1. **A zoom betöltéskor NaN-ra állította a forgatást.** A programozott
   `zoom.transform()` hívásnál nincs egérpozíció, a `d3.pointer` `[NaN, NaN]`-t
   ad, és az végigfut a kvaterniókon. A v3-as `d3.mouse` ilyet sosem kapott,
   mert ott a zoom mindig valódi UI-eseményből indult.

2. **`selection.attr({...})` getterként fut le.** A v3-as objektum-alak a v4-ben
   megszűnt, de nem dob kivételt: egy értéket ad vissza, és a lánc következő
   tagja már nem szelekción dolgozik. Az `exportSVG` az első sorában elhasalt.

3. **A `d3.json` promisifikálása kimaradt az `svg.js`-ből és a `location.js`-ből.**
   A v7-ben a második paraméter `fetch`-opció, nem callback — a betöltési
   callbackek sosem futottak le, és az SVG-export némán soha nem készült el.

4. **A `bvcolor` skála.** A v3-as `quantize` kezelte a csökkenő tartományt, a v4+
   a küszöbökre `bisect`-et használ, ami csak növekvő sorrendben helyes: a
   `[3.347, -0.335]` tartománnyal **minden csillag pirosra váltott**. Ez a
   térképen azonnal látszott — a referencia-háló viszont nem mér színt, tehát
   ezt semmilyen szám nem fogta volna meg.

> Tanulság: a numerikus háló a geometriát védi, semmi mást. A színek, az
> események, a betöltési lánc és az export mind a hálón kívül vannak.

---

## 6. Vizuális összevetés

A `harness/vizualis.html` és a `harness/vizualis-uj.html` ugyanazt a nézetet
rajzolja a régi, illetve az új kóddal; a `harness/kepdiff.html` pixelenként veti
össze a két PNG-t.

**A rögzítés eleinte nem volt reprodukálható**: ugyanaz a verzió önmagához mérve
3–6%-os eltérést adott. Három ok, mindhárom a könyvtár állapotkezeléséből:

| ok | megoldás |
|---|---|
| az első `display()` meghívja a `location.js` `geo()`-ját, ami az **aktuális időből** származtat középpontot | `follow: "center"`, `location: false` |
| animált átmenet közben fényképeztünk | `disableAnimations: true` |
| a második `display()` más állapotot hagy maga után, mint az első (globális állapot, #96/#131) | oldalbetöltésenként pontosan egy `display()`, a nézet az URL hash-ből |

Ezek után **a zajszint pontosan nulla** — ugyanaz a verzió kétszer futtatva
bitre azonos képet ad. Csak innentől értelmes a régi és az új összevetése.

Az eredmény (eltérő pixelek aránya, `d3v3-*` vs `d3v7-*`):

| nézet | eltérő pixel | max eltérés | |
|---|---:|---:|---|
| aitoff, teljes égbolt | 0,073% | 71 | élsimítás |
| mollweide, teljes égbolt | 0,061% | 72 | élsimítás |
| mercator, teljes égbolt | 0,038% | 71 | élsimítás |
| stereographic, északi sark | 0,231% | 162 | élsimítás |
| airy, alaphelyzet | 0,110% | 206 | élsimítás |
| **orthographic, Nagy Medve** | **68,1%** | 226 | **Tejút-inverzió, lásd lentebb** |

Öt nézetben az eltérés néhány száz pixel a csillagok és a feliratok peremén —
a szubpixeles élsimítás szintje. A hatodik a Tejút-réteg ismert regressziója.

---

## 7. Nyitott kérdések

### A Tejút kitöltése bizonyos tájolásoknál invertálódik

**Ez az egyetlen ismert vizuális regresszió.** 14 tájolásra megmérve
(orthographic, csak a Tejút-réteg, a korongon belüli világos pixelek aránya):

| középpont | v3 | v7 | |
|---|---:|---:|---|
| [0,0], [60,0], [120,0], [180,0], [240,0], [300,0] | 11–24% | ugyanaz | rendben |
| [0,45], [90,45], [180,−45], [0,85] | 15–20% | ugyanaz | rendben |
| **[180,45]** | 6% | **85%** | invertált |
| **[180,55]** | 8% | **83%** | invertált |
| **[270,45]** | 19% | **72%** | invertált |
| **[0,−45]** | 9% | **82%** | invertált |

Tehát 10/14 tájolásnál azonos, 4-nél **csak a v7** tölti ki a komplementert.

Amit a diagnózis kizárt (mind mérve, [180,55]-nél):

| feltevés | eredmény |
|---|---|
| a `reflectX` okozza | nem — a régi `raw(-λ,φ)` becsomagolással ugyanaz a 84% |
| a `clipAngle(90)` okozza | nem — vágás nélkül 87% |
| az adaptív újramintavételezés | nem — `precision(0)` és `precision(10)` mellett is 84% |
| a kitöltési szabály | nem — `nonzero` és `evenodd` egyaránt |
| rossz körüljárás a lyukaknál | nem — bármelyik gyűrűt megfordítva 84% |
| antimeridiánnál elvágott poligon | nem — a `d3.geoStitch` semmit nem változtat |

A tényleges ok az adat szerkezete: az `ol1` egy **vékony gömbi héj** — a külső
gyűrű 1,697π területű, a benne lévő nagy lyuk 1,623π, a kettő különbsége a
0,069π-nyi Tejút-sáv. Két majdnem főkör között 0,07π-nyi rés: a gömbi poligon
belsejének eldöntése itt numerikusan törékeny. Árulkodó, hogy a **d3-geo saját
két függvénye is ellentmond egymásnak**: a `geoArea` 0,0689π-t mond (a sávot),
a `geoPath` viszont a komplementert tölti ki.

A szerző maga is tudott a jelenségről: a `getMwbackground()` kommentje szerint
az a réteg azért van, hogy „megakadályozza a teljes térkép beszürkülését
bizonyos tájolásokban".

Érdemi javítás a Tejút-adat gyűrűszerkezetének rendbetétele lenne (a különálló
foltokat külön poligonokba, a lyukakat a saját poligonjukba), nem a rajzoló
foltozása. Ez adatmunka, nem migráció — külön lépés.
- **`cassini`, `hatano`, `quincuncial`, `wagner7`** — a `d3-geo-projection` v4-ben
  nincs kiadott `raw` függvényük. A 69 konfigurált vetítésből 65 működik; ez a
  négy jelenleg `Projection not supported` hibát ad. Egyik sincs a háló 25-ös
  halmazában, de a hiba így is regresszió az upstreamhez képest.
- **`Celestial.ha()`** (`horizontal.js`) — nincs hívója a forrásban, és a
  `if (ha < 180) ha = ha + 360;` sora gyanús (`ha < 0` lenne a szokásos).
  Holt kód, nem nyúltunk hozzá.
- **A globális állapot** (#96/#131) — a `Celestial.display()` ismételt hívása nem
  ugyanoda vezet. Ez a modulosítási fázis (5. lépés) tárgya.

---

## 8. Hol tart a lépéssorrend

| # | Lépés | Állapot |
|---|---|---|
| 1 | Matematikai hibák (#148, #130, #157) | **kész**, 38 teszt |
| 2 | Referencia-háló rögzítése | **kész**, és a háló maga is javítva |
| 3 | Mechanikus D3-csere | **kész** |
| 4 | `d3.geo.*` → `d3-geo` + `d3-geo-projection` | **kész**, 25/25 bitre azonos |
| 5 | ES-modulok, tree-shaking | nincs elkezdve |
| 6 | `form.js` / `svg.js` — migrálás vagy elhagyás | migrálva, működik |
