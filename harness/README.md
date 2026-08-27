# Referencia-háló

A `d3-celestial` vetítései determinisztikus függvények: `(RA, Dec, vetítés, forgatás) → (x, y)`.
Ez azt jelenti, hogy a jelenlegi (D3 v3-as) kimenet **rögzíthető**, és a migrált verziónak — adott
tűréssel — ugyanazt kell adnia.

## Használat

```bash
cd harness
python3 -m http.server 8877
# majd böngészőben: http://127.0.0.1:8877/referencia.html
```

Az oldal lefuttatja a mérést, és felkínálja a `referencia-d3v3.json` letöltését.

**Böngészőben fut, nem Node-ban** — a d3-celestial DOM-ot és canvas-t igényel.

A mérés lefutott. Két referencia van a repóban:

| | |
|---|---|
| `referencia-d3v3.json` | a pinelt upstream (D3 3.5.17) — `referencia.html` |
| `referencia-d3v7.json` | a migrált build (D3 7.9.0) — `referencia-uj.html` |

Összevetve: **25/25 vetítés, max eltérés 0.000 px** — a vetítési kimenet bitre azonos.

```bash
node osszehasonlit.mjs referencia-d3v3.json referencia-d3v7.json
```

## Mit mér

| | |
|---|---|
| Vetítések | 25 (`airy`, `mercator`, `orthographic`, `stereographic`, …) |
| Forgatások | 4 (alaphelyzet, Budapest zenitje, döntött nézet, magas északi szélesség) |
| Égi pontok | 413 (15°-os RA × 10°-os Dec rács + sarkok és peremesetek) |
| **Összesen** | **41 300 mért pont** |

Minden pontra rögzül: `[x, y, látható]` — a vetített pixelkoordináta és a `Celestial.clip()`
állapota. A clipping viselkedése a migráció egyik legkényesebb pontja, ezért külön mérjük.

## Önellenőrzés

A háló csak akkor ér valamit, ha bizonyíthatóan **mér is valamit**. A generátor ezért ellenőrzi:

- **nincs két azonos kimenetű vetítés** — ha lenne, az azt jelentené, hogy a vetítésváltás nem
  történt meg, és a referencia némán értéktelen
- **egy vetítésen belül nincs két azonos kimenetű forgatás** — ugyanez a forgatásokra
- **a pontok többsége egyedi** az első vetítésen belül

> Ez nem elméleti óvatosság, és kétszer is bizonyított:
>
> 1. A harness első verziója `Celestial.apply({projection})`-t hívott, amit az API nem támogat (a
>    `projection` újratöltést igényel). Így mind a 25 vetítés ugyanazt a kimenetet adta volna. Az
>    önellenőrzés fogta ki.
> 2. A második verzióban a **négy forgatás** adott azonos koordinátákat: a `Celestial.rotate()`
>    d3-átmenetet indít, a szinkron mérés tehát a forgatás előtti állapotot rögzítette. Ezt már nem
>    fogta ki az önellenőrzés, mert csak a vetítésekre nézett. Azóta `disableAnimations: true`, és a
>    forgatás-ellenőrzés is bekerült.
>
> Az önellenőrzés arra véd, amire megírták. Érdemes minden tengelyre kiterjeszteni, amit a háló az
> állítása szerint mér.

## Vizuális alapállapot

A háló számokat hasonlít össze. Hogy a Nagy Medve *úgy néz-e ki, ahogy kell*, azt meg kell nézni —
ehhez van a `vizualis.html`, ami a generátorral ellentétben minden réteget megjelenít
(csillagok m≤6, csillagképnevek és -vonalak, Tejút, ekliptika, koordinátaháló).

```bash
python3 -m http.server 8877
# http://127.0.0.1:8877/vizualis.html
# a vetítés váltása a konzolból: valt("orthographic", [180, 55])
```

A vetítés és a középpont az URL hash-éből jön, hogy oldalbetöltésenként **pontosan egy** `display()`
fusson:

```
#airy                                          alaphelyzet
#orthographic,180,55                           vetítés + középpont
#orthographic,180,55|{"mw":{"show":false}}     plusz konfigurációs felülbírálás
```

Ez nem kényelmi kérdés. A rögzítés eleinte nem volt reprodukálható — ugyanaz a verzió önmagához
mérve 3–6%-os pixeleltérést adott. Három ok, mind a könyvtár állapotkezeléséből:

| ok | ellenszer |
|---|---|
| az első `display()` a `location.js` `geo()`-ján át az **aktuális időből** származtat középpontot | `follow: "center"`, `location: false` |
| animált átmenet közben fényképeztünk | `disableAnimations: true` |
| a második `display()` más állapotot hagy maga után, mint az első (#96/#131) | oldalanként egy `display()` |

Ezek után a zajszint **pontosan nulla**: ugyanaz a verzió kétszer futtatva bitre azonos képet ad.
Az összevetéshez a `kepdiff.html` van, ami két PNG-t pixelenként hasonlít össze.

A rögzített képek a [`docs/kepek/`](../docs/kepek/) mappában, `d3v3-` és `d3v7-` előtaggal:

| Kép | Mit ellenőriz |
|---|---|
| `d3v3-aitoff-teljes-eg.png` | teljes égbolt, Tejút-sáv és ekliptika elhelyezkedése |
| `d3v3-mollweide-teljes-eg.png` | másik teljes-égbolt vetítés, összevetésre |
| `d3v3-mercator-teljes-eg.png` | téglalap alakú vetítés, pólusok felé nyúlás |
| `d3v3-orthographic-nagymedve.png` | **félteke-vágás** + felismerhető alakzat (Nagy Göncöl, Cassiopeia W-je) |
| `d3v3-stereographic-eszaki-sark.png` | pólusra centrált nézet |
| `d3v3-airy-alap.png` | a generátor alapértelmezett vetítése |

A migráció minden fázisa után ugyanezekkel a beállításokkal kell újra lefényképezni, és a két
képsort egymás mellé tenni. Ezt semmilyen automatizmus nem váltja ki.

## Az #148 issue ellenőrzése

```bash
node issue-148-ellenorzes.mjs
```

Round-trip teszt a `horizontal()` / `horizontal.inverse()` párosra: ha mindkettő helyes, az oda-vissza
átszámítás visszaadja a kiindulási koordinátát.

Eredmény: az eredeti kód a horizont fölötti pontok **50%-át** rosszul adja vissza (max. eltérés
171,4°), a javítással 0 hiba (max. 0,0002°).

## Fájlok

| | |
|---|---|
| `referencia.html` + `referencia.js` | a generátor |
| `referencia-uj.html` | ugyanaz a generátor a migrált buildre — **csak a buildet tölti be**, külső D3 nélkül |
| `referencia-d3v3.json` | **a rögzített referencia** — ehhez méri magát a migrált verzió (712 KB) |
| `referencia-d3v7.json` | a migrált build kimenete |
| `referencia-minta.json` | a formátum bemutatása, olvasható méretben |
| `osszehasonlit.mjs` | a két referencia diffje (`--onteszt` a saját érvényességére) |
| `vizualis.html` / `vizualis-uj.html` | a vizuális összevetés oldalai |
| `kepdiff.html` | két PNG pixelenkénti összevetése |
| `issue-148-ellenorzes.mjs` | a #148 numerikus vizsgálata (Node) |
| `vendor/` | a vizsgált verzió pinelt másolata — hogy a referencia reprodukálható legyen |
| `data/` | minimális adatkészlet (a `display()` akkor is betölt, ha minden réteg rejtett) |
