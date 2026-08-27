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
| a listener `(datum, index)`-et kapott | `(esemény, datum)` — a paraméter nélküli kezelőket nem érinti, a `resize(set)`-et igen |

### A vetítések tükrözése

Az égboltot kívülről befelé nézzük, ezért a hosszúságot tükrözni kell. A v3-as
kód a raw függvényt csomagolta be (`raw(-λ, φ)`); a v7-ben erre való a
`reflectX(true)`. **A kettő mérhetően azonos** — 24 vetítésen, sűrű rácson a
maximális eltérés 1e-9 px alatt —, de a `reflectX` az invert irányt is magától
kezeli, nem kell kézzel visszatükrözni.

### Két vetítés pótolva

A `hatano` és a `wagner7` a v3-as pluginban megvolt, a `d3-geo-projection`
v4-ben viszont nincs kiadott `raw` függvényük. A képleteket szó szerint
átvettük a v3-as forrásból, és a `test/vetitesek.teszt.mjs` a **pinelt v3-as
buildből kimért 162 pontos táblához** méri őket, 1e-10 tűréssel — a `mercator`
kontrollként ugyanabban a tesztben. A teszt akkor is szól, ha egy jövőbeli
d3-geo-projection pótolja őket, hogy a saját másolat elhagyható legyen.

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

4. **Az ablakátméretezés visszaállította a nagyítást.** A `resize(set)` védőága —
   „ha a szélesség nem változott és nincs kényszerítés, ne csinálj semmit" — a
   v7-ben soha nem lépett életbe, mert a listener első paramétere ott az
   eseményobjektum (a v3-ban a datum, azaz `undefined`). Így minden `resize`
   esemény újraszámolta a léptéket, és a `zoom.scale(...)` elvette a felhasználó
   nagyítását. A listener most nem adja tovább az eseményt.

5. **A `bvcolor` skála.** A v3-as `quantize` kezelte a csökkenő tartományt, a v4+
   a küszöbökre `bisect`-et használ, ami csak növekvő sorrendben helyes: a
   `[3.347, -0.335]` tartománnyal **minden csillag pirosra váltott**. Ez a
   térképen azonnal látszott — a referencia-háló viszont nem mér színt, tehát
   ezt semmilyen szám nem fogta volna meg.

> Tanulság: a numerikus háló a geometriát védi, semmi mást. A színek, az
> események, a betöltési lánc és az export mind a hálón kívül vannak.

Közös vonásuk, hogy **egyik sem dob kivételt**. A v3-as objektum-alakú `attr`
getterként fut le, a `d3.json` második paramétere `fetch`-opcióvá válik, az
eseményparaméter jelentése megváltozik, a `quantize` fordított tartománya értelmes
színt ad — csak rosszat. Egy `grep` a `d3.` előtagra ezekből egyet sem talál meg;
mindegyik kézi végigpróbálásból jött elő.

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

| nézet | eltérő pixel | max eltérés |
|---|---:|---:|
| mercator, teljes égbolt | 0,038% | 71 |
| mollweide, teljes égbolt | 0,061% | 72 |
| aitoff, teljes égbolt | 0,073% | 71 |
| airy, alaphelyzet | 0,110% | 206 |
| stereographic, északi sark | 0,231% | 162 |
| orthographic, Nagy Medve | 0,702% | 226 |

Mind a hat nézetben az eltérés néhány száz–néhány ezer pixel a csillagok és a
feliratok peremén — a szubpixeles élsimítás szintje. (A Tejút-inverzió javítása
előtt az orthographic nézet **68,1%** volt; lásd lentebb.)

---

## 7. Nyitott kérdések

### A Tejút kitöltése bizonyos tájolásoknál invertálódott — javítva

**Ez volt az egyetlen ismert vizuális regresszió; megoldva.** A tünet: a térkép
beszürkült, a Tejút feketén látszott — jellemzően akkor, amikor a sáv a korong
pereme felé került.

#### Az ok

A `mw.json` `ol1` körvonala **vékony gömbi héj**: 1,697π területű külső gyűrű,
benne egy 1,623π-s lyuk; a kettő különbsége a 0,069π-nyi Tejút-sáv. Két majdnem
főkör között 0,07π-nyi rés — a gömbi poligon belsejének eldöntése itt numerikusan
törékeny. Árulkodó, hogy a **d3-geo saját két függvénye is ellentmond egymásnak**:
a `geoArea` és a `geoContains` a sávot mondja, a `geoPath` viszont a
komplementert tölti ki.

A szerző is tudott a jelenségről: a `getMwbackground()` kommentje szerint az a
réteg azért van, hogy „megakadályozza a teljes térkép beszürkülését bizonyos
tájolásokban".

Amit a diagnózis kizárt (mind mérve):

| feltevés | eredmény |
|---|---|
| a `reflectX` okozza | nem — a régi `raw(-λ,φ)` becsomagolással ugyanaz |
| a `clipAngle(90)` okozza | nem — vágás nélkül is |
| az adaptív újramintavételezés | nem — `precision(0)` és `precision(10)` mellett is |
| a kitöltési szabály | nem — `nonzero` és `evenodd` egyaránt |
| rossz körüljárás a lyukaknál | nem — bármelyik gyűrűt megfordítva ugyanaz |
| antimeridiánnál elvágott poligon | nem — a `d3.geoStitch` semmit nem változtat |

#### A javítás: a galaktikus pólus mint ellenőrző pont

Van egy pont, amelyről **biztosan tudjuk a helyes választ**: a galaktikus pólus.
A Tejút körvonalai a galaktikus egyenlítő körüli sávok, a pólus mindegyiken
kívül esik — a komplementerükön (`mwbg`) pedig belül. A két pólus antipodális,
tehát vágott vetítésnél is pontosan az egyik látszik.

A már felépített canvas-útvonalat kérdezzük meg `context.isPointInPath()`-tal, és
ha az ítélet ellentmond a tudottnak, a megfordított gyűrűkkel rajzolunk újra
(`celestial.js`, `galaktikusPolus()` / `rosszIranyu()` / `megforditva()`).

Két apróság, ami mérésből derült ki:

- Az `isPointInPath` **eszközkoordinátában** várja a pontot, a kontextuson viszont
  `setTransform(pixelRatio, …)` van — ezért kell a szorzás. (Retina kijelzőn
  enélkül némán rossz oldalra döntene.)
- A detektor **O(1)**, szemben a korábban kipróbált megközelítésekkel: a
  forgatott poligon `geoArea`-ja 6,7 ms (ritkítva 0,4 ms), a `geoContains` a
  teljes felbontású poligonon 4,3 ms — mindkettő túl drága képkockánként.

#### Ellenőrzés

| | |
|---|---|
| 44 tájolás (20 széles + 24 sűrű a kritikus tartományban) | **mind megegyezik a v3-mal** |
| korábban invertálódó esetek | `[180,45]`, `[180,55]`, `[270,45]`, `[0,−45]`, `[250,30]`, `[280,60]` — mind javítva |
| 12 egymás utáni húzásos forgatás a demólapon | a szürke arány végig 18–24% (45% fölött lenne inverzió), 0 konzolhiba |
| orthographic Nagy Medve pixeldiff | 68,1% → 0,70% |

Egy korábbi, területmegmaradáson alapuló javítás (a forgatott poligon `geoArea`-ja
egy teljes gömbbel eltért) a hat esetből hármat oldott meg; a pólus-alapú detektor
mind a hatot, és ki is váltotta.

- **`cassini` és `quincuncial`** — a `config.js` felsorolja őket, de a
  `d3.geo.projection` **pinelt upstream buildjében sincsenek benne**: az
  upstream is `TypeError`-t dob rájuk. Nem migrációs regresszió, hanem meglévő
  hiba; a `quincuncial` a plugin forrásában sem szerepel (csak
  `peirceQuincuncial`), a `cassini` pedig csak a nem-minifikált változatban.
  A 69 konfigurált vetítésből **67 működik — pontosan annyi, mint az upstreamben**.
- **`Celestial.ha()`** (`horizontal.js`) — nincs hívója a forrásban, és a
  `if (ha < 180) ha = ha + 360;` sora gyanús (`ha < 0` lenne a szokásos).
  Holt kód, nem nyúltunk hozzá.
- **A globális állapot** (#96/#131) — a `Celestial.display()` ismételt hívása nem
  ugyanoda vezet. Ez a modulosítási fázis (5. lépés) tárgya.

---

## 8. ES-modulok és tree-shaking (5. lépés)

### Miért volt ez a legkockázatosabb lépés

A forrásfájlok addig sima szkriptek voltak: felső szintű `var`-okat és
függvényeket deklaráltak, amiket a build egyetlen closure-be fűzött. Minden
kereszthivatkozás **implicit** volt — a `svg.js` látta a `celestial.js`
változóit, mert ugyanabban a hatókörben futottak. A modulosítás ezt az egészet
explicitté teszi: 17 fájl, ~6000 sor, mintegy 90 megosztott név.

Ezért nem kézzel történt: `acorn`-nal hatókör-elemzés készült minden fájlra
(felső szintű deklarációk vs. szabad változók), és a kapott gráfból generálódtak
az `import`/`export` blokkok. A kód törzse egyetlen sorral sem változott.

Az elemzés két dolgot azonnal kimutatott:

- **Névütközés**: a `cartesian` kétszer volt deklarálva — a `util.js`-ben
  **radiánt** vár, a `lib/geo-zoom.js`-ben **fokot**. Az összefűzött buildben az
  utóbbi írta felül az előbbit, tehát a `util.js` `poligonContains()` függvénye
  rossz egységű `cartesian`-t hívott volna. Lappangó hiba: a `poligonContains`-t
  semmi nem hívja. A modulosítás magától megszünteti.
- **A `timezones()` elérhetetlen**: semmi nem hívja, és a `Celestial` objektumra
  sem kerül fel. Emiatt a `topojson` függőség is feleslegesen került volna a
  csomagba. A fájl a helyén maradt, kommenttel; a csomagoló egyszerűen kihagyja.

### A körkörös importok

A gráf körkörös (`celestial ↔ config ↔ form ↔ svg`), és körben az számít, mi
értékelődik ki előbb. Több modul már **betöltéskor** hozzányúl a központi
objektumhoz (`Celestial.settings = …`, `Celestial.projection = …`), tehát ha az
a `celestial.js`-ben maradt volna, egyesek még inicializálatlanul látnák.

Megoldás: a `Celestial` objektum saját, importmentes modulba került
(`src/mag.js`). Így mindig elsőként fut le. A többi kereszthivatkozás
futásidejű, ott az ES-modulok élő kötései pontosan a megfelelő viselkedést
adják — a `cfg`, `parentElement`, `starnames`, `dsonames` a `display()`-ben
kap értéket, és az importálók a friss értéket látják.

### A D3 becsomagolása

A `src/d3.js` egyetlen helyen sorolja fel, mire van szükség:

```js
export { select, selectAll, pointer } from "d3-selection";
export { geoPath, geoProjection, geoCircle, … } from "d3-geo";
…
import "d3-transition";   // mellékhatásért: a selection .transition() metódusa
```

A hívási helyek `d3.geoPath()` alakban maradtak (`import * as d3 from "./d3.js"`),
tehát a diff kicsi maradt — a csomagoló mégis pontosan ezt a listát húzza be.
A vetítések nyers függvényeit névből kell feloldani, ez az egyetlen dinamikus
hozzáférés, és a `projection.js`-be van bezárva.

### Eredmény

| | fájlok | méret |
|---|---:|---:|
| upstream v3 (d3 + plugin + celestial) | 3 | 316 KB |
| migrált, modulosítás előtt (d3 v7 + plugin + celestial) | 3 | 463 KB |
| **modulosítás után** | **1** | **291 KB** |

A böngészőnek egyetlen fájl kell, és **nincs szükség globális `d3`-ra** — ez az
upstream #134 („d3 is not defined"). A build négy alakot ad:

| | |
|---|---|
| `build/celestial.js` / `.min.js` | IIFE, globális `Celestial` — a régi használat változatlanul |
| `build/celestial.mjs` | ES-modul: `import Celestial from "…"` (#141, #115, #86) |
| `build/celestial.cjs` | CommonJS: `require(…)` (#81) |

### Ellenőrzés

- **A referencia-háló bitre azonos** — nemcsak a v3-as alapvonallal, hanem a
  modulosítás ELŐTTI v7-es buildel is: 25/25 vetítés, max eltérés 0,000 px.
  A modulosítás tehát numerikusan semmit nem változtatott.
- A harness oldala már csak a buildet tölti be; a lapon `typeof d3 === "undefined"`,
  és a mérés így is lefut.
- 44 teszt, valódi ESM-importokkal (a korábbi `vm`-alapú betöltő megszűnt) —
  a tesztek most a tényleges modulgráfot futtatják.
- `demo/modul.html`: `<script type="module">`-lal, globális `Celestial` és `d3`
  nélkül — 5044 csillag, 0 hiba.
- `demo/teljes.html`: a teljes felület globális alakban — zoom, húzásos forgatás,
  vetítésváltás, SVG-export, 0 hiba.
- Node-ban `import` és `require` alakban is betölthető.

## 9. Osztály-alapú átírás — több térkép egy oldalon

Az upstream #96 és #131: a könyvtár globális állapotot tartott, ezért egy oldalon
csak egy térkép működött.

### A kiindulás jobb volt, mint vártuk

A `Celestial.display()` **már addig is konstruktorként volt megírva** — a végén
`this.container = …`, `this.clip = …`, `this.rotate = …` sorokkal. Csak éppen
`Celestial.display(config)` alakban hívva, tehát a `this` maga a globális
objektum volt. A váz megvolt; három dolog blokkolta a példányosítást.

**1. Modulszintű állapot.** A `cfg`, `mapProjection`, `parentElement`, `zoom`,
`map`, `circle`, `daylight`, `starnames`, `dsonames`, `zoomextent`, `zoomlevel`
a modul tetején éltek, tehát minden térkép osztozott rajtuk. Bekerültek a
konstruktorba.

**2. A közös konfiguráció.** A `settings.set()` egy modulszintű `globalConfig`-ba
írt és onnan olvasott, így a második térkép örökölte az elsőét. Kapott egy
opcionális `alap` paramétert: ha van, abból indul és nem ír vissza a globálisba.
Enélkül a régi viselkedés marad, hogy a `Celestial.settings()` működjön.

**3. A közös tároló.** A konstruktor a globális `Celestial.container`-t vette át,
tehát a második térkép az elsőébe rajzolt volna. Most a saját szülőjén belül
keresi meg.

### Getterek, nem értékmásolás

A `cfg`, `mapProjection`, `container` és `map` a rajzolás közben **újra értéket
kap** (`cfg = cfg.set(…)`, `mapProjection = projectionTween(…)`). Egyszerű
`this.x = x` értékadással a példányon a régi érték ragadna be — a
`Celestial.mapProjection` például egy vetítésváltás után elavult lenne. Ezek
most getterek, és a visszafelé kompatibilis felület is **tulajdonság-leírókkal**
másol, nem értékkel, tehát a liveness megmarad. Ez egy meglévő, lappangó
elavulási hibát is megszüntet.

### Amit közben kifogott a mérés

A `Celestial.display()` ismételt hívása **minden alkalommal hozzáfűzött egy
újabb teljes űrlapot**: hat hívás után 469 mező volt 67 helyett, azonos
`id`-kkel — a `$("…")` lekérdezések pedig mindig az elsőt találták meg. A
`form()` most kiüríti a meglévő űrlapot, mielőtt újraépíti.

### Visszafelé kompatibilitás

A `Celestial.display(config)` felülete és viselkedése változatlan — beleértve
azt is, hogy az egymást követő hívások a felhalmozott globális beállításra
épülnek. Annyi a különbség, hogy most vissza is ad egy példányt.

```js
// a régi mód, változatlanul
Celestial.display({ container: "map", projection: "aitoff" });

// több független térkép
import { Egbolt } from "d3-celestial-modern";
const a = new Egbolt({ container: "map-a", projection: "orthographic" }, { onallo: true });
const b = new Egbolt({ container: "map-b", projection: "mollweide" },   { onallo: true });
```

Az `onallo: true` a lényeg: a példány csak az alapértelmezésekre és a saját
configjára épül, nem a felhalmozott globálisra.

### Ellenőrzés

- **A referencia-háló bitre azonos** minden részlépés után: 25/25 vetítés,
  max eltérés 0,000 px.
- `demo/ket-terkep.html`: két térkép egy oldalon, külön vetítéssel és
  középponttal — külön `cfg`, külön `mapProjection`, külön tároló, mindkettőben
  a maga 5044 csillaga, egyetlen `container` elem térképenként.
- `demo/teljes.html`: a teljes régi felület — zoom, húzásos forgatás, négy
  vetítésváltás, két transzformáció, űrlaphasználat, `Celestial.rotate`,
  `Celestial.apply`, SVG-export. 0 konzolhiba, és az űrlap végig 67 mező marad.
- 44 teszt zöld.

### Ami még hátra van ebből

A beépített űrlap, a helymeghatározás és az SVG-export az **aktuális** (legutóbb
létrehozott) térképen dolgozik, egy modulszintű `aktualis` mutatón keresztül.
Egy oldalon egy űrlap van, tehát ez a régi viselkedés — de ha valaki két
*interaktív* térképet akar saját űrlappal, ezeket is át kell adni példányonként.
A rajzolás viszont már teljesen példány-alapú.

## 10. A háló kiterjesztése minden vetítésre

A referencia addig **25 vetítést** mért a 69-ből — egy jól megválasztott
válogatást, de válogatást. A háló viszont csak arra véd, amit mér: a maradék
44-ben egy elrontott képlet észrevétlen maradt volna.

A listát most a `config.js`-ből vesszük, hogy ne csússzon el tőle:
**110 684 mért pont** vetítésenként 4 forgatással.

### Amit azonnal talált

Három vetítés tért el a v3-tól, mindhárom más okból.

**`wiechel` — 1125 px.** A képlet v3-ban és v4-ben **azonos**; a különbség a
tükrözésben volt. Az égboltot kívülről befelé nézzük, ezt a v3 a raw függvény
becsomagolásával oldotta meg (`raw(-λ, φ)`), mi viszont a v7 `reflectX(true)`-ját
használtuk. A kettő **65 vetítésre pontosan ugyanazt adja** — de nem mindre: a
wiechelnél a λ előjele a képlet BELSEJÉBEN is számít
(`atan2(sin λ · cos φ, −sin φ)`), nem csak a végeredmény x-koordinátájában.

Visszaálltunk a v3-hű becsomagolásra. Tanulság: az „ez a kettő egyenértékű"
állítást azon a halmazon kell bizonyítani, amelyen használjuk — az eredeti
mérés 24 vetítésre szólt, és pont a kivétel nem volt köztük.

**`twoPointEquidistant` — 555 px.** A v4-es raw első dolga `z0 *= 2`; a v3
közvetlenül használta a paramétert. A `config.js` értékei a v3-hoz vannak
kalibrálva, ezért egy átváltó tábla felezi. (Az oda-vissza út ~1e-9
lebegőpontos zajt hagy; pixelben 0,000.)

**`healpix` — 114 px.** A v4 átskálázta a vetítést: a v3 `point[0] /= 2`-t
csinált, a v4 `point[0] *= 4/τ` és `point[1] /= h` — x-re és y-ra
**különbözőképp**, tehát az oldalarány is más. A `config.js` `scale`/`ratio`
értékei így hibás méretű térképet adnának. A v3-as változatot vittük tovább,
a Collignon és a hengeres egyenlő területű vetítés a v4-ből jön.

### Eredmény

```
67/69 vetítés, 110 684 mért pont, max eltérés 0,000 px
```

A hiányzó kettő (`cassini`, `quincuncial`) a **szállított upstream buildben
sincs benne** — ott is `TypeError`. A háló ezt is méri: mindkét oldal 67
sikeres vetítést jelent.

A `test/vetitesek.teszt.mjs` hat vetítést mér a pinelt v3-as build 162 pontos
táblájához (`hatano`, `wagner7`, `healpix`, `wiechel`, `twoPointEquidistant`,
és `mercator` kontrollként), és külön teszt szól, ha egy jövőbeli
d3-geo-projection feleslegessé teszi valamelyik saját másolatot.

## 11. Maradék upstream hibák

Négy tétel, mind a „kis, tiszta függvény, tesztlefedettség nélkül" osztályból —
ugyanabból, amelyik a #157-et is adta.

### `Celestial.ha()` — elírt normálás

```js
var ha = getMST(dt, lng) - ra;
if (ha < 180) ha = ha + 360;      // 100° óraszögből 460° lett
```

A `getMST` és az `ra` is `[0,360)`, tehát a különbség `(-360, 360)` — nullánál
kisebb értéket kell körbeforgatni. **Ugyanabban a fájlban, két sorral feljebb**
a `horizontal()` helyesen `if (ha < 0)`-t ír. Publikus felület, a könyvtárban
semmi nem hívja.

A teszt nem a képletből indul, hanem a jelentésből: az óraszög akkor nulla,
amikor az objektum a délkörön áll (azimut 0° vagy 180°). Ezt a `horizontal()`-ból
keressük meg, tehát a két függvény egymáshoz mérve is konzisztens marad.

### `getWidth()` — nem létező metódus

```js
else w = window.getBoundingClientRect().width - margin[0]*2;
```

A `window`-nak nincs `getBoundingClientRect` metódusa. Ez az ág akkor fut, ha
**nincs konténer-elem és nincs megadott szélesség** — vagyis a legegyszerűbb
kezdő használatnál. Reprodukálva: a `display()` kivétellel elszállt, canvas és
csillagok nélkül. A térkép ilyenkor a `body`-ba kerül, tehát a `document.body`
szélessége a mérvadó. Javítás után 1469 px, 5044 csillag.

Ez most állandó ellenőrzés a füstpróbában (`harness/nincs-container.html`).

### `Trig.normalize` / `normalize0` — lappangó

```js
normalize:  ((val + 2π) % 2π)          // −30 → −4,867
normalize0: ((val + 3π) % 2π) − π
```

A JS `%` megtartja az osztandó előjelét, ezért egyetlen eltolás csak akkor elég,
ha a bemenet nem megy −2π (illetve −3π) alá. A közepes pályaelemek J2000-től
távolodva nagyra nőnek — ott a régi képlet nem normált szöget adott.

**Lappangó, nem aktív**: a Hold pozíciója 1700 és 2300 között végig értelmes
marad. A javítás után is az — ez bizonyítja, hogy a működő eseteken nem
változtat.

### `Trig.spherical` és társai — halott kód

A `Trig.spherical`, `tanh`, `acosh` és `distance` metódusokat a könyvtárban
semmi nem hívja. A `spherical` ráadásul **nem inverze** a `cartesian`-nak:
`atan` van benne `atan2` helyett (elveszti a kvadránst, és x = 0 esetén nullával
oszt), a visszaadott második érték pedig pólustávolság, nem szélesség.

Nem nyúltunk hozzá — nincs hívója —, de kommentben jelölve, hogy ne épüljön rá
új kód. A `tanh`, `asinh`, `acosh`, `sinh`, `cosh` viszont **helyes**: teszt méri
őket a beépített `Math.*` megfelelőikhez.

### `cassini`, `quincuncial`

Kikerültek a listáról: kiderült, hogy **nem migrációs regresszió** — a
`d3.geo.projection` szállított upstream buildjében sincsenek benne, ott is
`TypeError`. A referencia-háló ezt is méri: mindkét oldal 67 sikeres vetítést
jelent a 69-ből.

## 12. Az űrlap példányosítása — a #96/#131 lezárása

Az osztály-alapú átírás után a **rajzolás** már példányonként ment, de a
beépített űrlap, a helymeghatározás, a dátumválasztó és az SVG-export egy közös
`aktualis` mutatón dolgozott. Két interaktív térkép egy oldalon egymás mezőit
írta volna.

### Miért lezárás, nem osztály

Kézenfekvő lett volna osztályba tenni a form.js-t. Csakhogy a d3
eseménykezelőiben a `this` a **DOM-elemet** jelenti (`testNumber(this)`), és egy
metódusban ez ütközne. A lezárás (closure) mindkettőt megőrzi: a `this` marad a
DOM-elem, az `egbolt` pedig lexikálisan látszik.

Az elemzés megmutatta, hogy a form.js 13 felső szintű függvényéből **3 tiszta**
(`popError`, `testNumber`, `testColor`) — ezek maradtak —, **9 példányfüggő**
(197 sor), és mind a `$form`-on keresztül. Ezek beköltöztek a `form(egbolt)`
lezárásába, ami egy felületet ad vissza; a példány `egbolt.urlap`-ként tartja.

Ugyanígy: `geo(egbolt)`, `datetimepicker(egbolt, …)`, `exportSVG(egbolt, …)`,
és a `get.js` három függvénye is megkapja a példányt. A `$(id)` a
`celestial.js` lezárásába került — csak onnan használták.

Az űrlap kezelői (`apply`, `reproject`, `rotate`, …) 37 helyen a globális
`Celestial`-t hívták; ezek most `egbolt`-ot. A könyvtárszintű segédfüggvények
(`Celestial.projections()`, `eulerAngles()`, `getPoint()`) globálisak maradtak —
azok nem példány-állapot.

### Két buktató, amit a mérés fogott ki

**Sorrend.** A `redraw()` már a zoom beállításakor lefut, és hívja a
`setCenter`-t. A régi kódban az modulszintű függvény volt, tehát mindig
létezett; a mezőkeresés pedig védve van a hiányzó űrlap ellen. Most magának az
`urlap` objektumnak kell léteznie — a létrehozása a vetítés felépítése elé
került.

**Végtelen rekurzió.** A visszafelé kompatibilis felület a példány
tulajdonságait másolja a `Celestial`-ra — köztük az `exportSVG`-t. Ha az a
`Celestial.exportSVG`-t hívja, önmagát hívja. A példány metódusa most
közvetlenül a modulfüggvényt szólítja.

**Késői értékek.** A csillagképlista a betöltés UTÁN kap értéket, amikor a
globális felület már lemásolódott. Erre a két névre (`constellations`,
`constellation`) továbbító hozzáférés került, hogy a `Celestial.constellations`
a régi módon működjön.

### A bizonyíték

`demo/ket-urlap.html`: két interaktív térkép, mindegyik saját űrlappal. Az A
térkép űrlapján vetítést váltva:

```
A: orthographic → hammer      B: mollweide → mollweide
```

Külön űrlap-elem, külön űrlapfelület, külön SVG-export, 67-67 mező,
5044-5044 csillag, 0 konzolhiba. Ez most állandó ellenőrzés a füstpróbában.

## 13. TypeScript-típusok

A `types/celestial.d.ts` a publikus felületet írja le. Két dolgot csináltunk
másképp, mint ahogy egy .d.ts általában készül.

### A Config törzse generált

A könyvtárnak **~110 beállítása** van, öt szint mélyen. Kézzel átgépelve az
első naptól kezdve csúszna. Ezért a `src/config.js` alapértelmezéseiből
generáltuk, egy finomító táblával azokra a mezőkre, ahol a típus nem derül ki
az alapértékből (`center`, `geopos`, `daterange`, a `null` alapértelmezésűek).

A vetítés-unió is generált: mind a 69 név szerepel, tehát a szerkesztő
felkínálja őket.

### A típus nem csúszhat el

Egy `.d.ts` a legcsendesebb hazugság: lefordul, senki nem futtatja, és lassan
eltávolodik a kódtól. Ugyanaz az elv kellett rá, mint a referencia-hálóra —
**mérjük, ne higgyük**. A `test/tipusok.teszt.mjs` négy állítást tesz:

| | |
|---|---|
| minden futásidejű beállítás szerepel a típusban | kiüt, ha új beállítás kerül a `config.js`-be |
| a típus nem talál ki nem létező beállítást | kiüt, ha a `.d.ts`-ben elgépelünk egy nevet |
| a vetítés-unió pontosan a támogatottakat sorolja | mindkét irányban |
| a transzformáció-unió teljes | |

A detektort mindkét irányban kipróbáltuk: `config.js`-be tett új kulcsra és a
`.d.ts`-be tett kitalált névre is megbukik.

### A fordítás is ellenőrzés

`types/proba/hasznalat.ts` valódi használatot ír le — a régi globális felületet,
két független példányt, az űrlapot, a vetítés használatát —, és `strict` módban
fordul. A `npm run tipus` ezt futtatja, és a CI is.

Ez fogta ki az első változat hibáját: a `CelestialFelulet extends Partial<Egbolt>`
technikailag pontos volt (a metódusok tényleg csak a `display()` után léteznek),
de minden hívás `?.`-ot igényelt volna. A típus most jelenlévőnek mutatja őket,
és a dokumentáció mondja meg, mikortól.

## 14. Hol tart a lépéssorrend

| # | Lépés | Állapot |
|---|---|---|
| 1 | Matematikai hibák (#148, #130, #157) | **kész**, 38 teszt |
| 2 | Referencia-háló rögzítése | **kész** — 67/69 vetítés, 110 684 pont, automatizálva |
| 3 | Mechanikus D3-csere | **kész** |
| 4 | `d3.geo.*` → `d3-geo` + `d3-geo-projection` | **kész**, 25/25 bitre azonos |
| 5 | ES-modulok, tree-shaking | **kész**, 463 KB / 3 fájl → 291 KB / 1 fájl |
| 6 | `form.js` / `svg.js` — migrálás vagy elhagyás | migrálva, működik |

Ezen felül: **osztály-alapú felület** (`Egbolt`), több független *interaktív*
térkép egy oldalon, saját űrlappal — az upstream #96 és #131 lezárva.

Vetítések: **67/69 működik, ugyanannyi, mint az upstreamben.** Tesztek: 44, mind zöld.
