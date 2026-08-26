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
- **a pontok többsége egyedi** az első vetítésen belül

> Ez nem elméleti óvatosság: a harness első verziója `Celestial.apply({projection})`-t hívt, amit az
> API nem támogat (a `projection` újratöltést igényel). Így mind a 25 vetítés ugyanazt a kimenetet
> adta volna. Az önellenőrzés fogta ki.

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
| `referencia-minta.json` | a formátum bemutatása (a teljes ~712 KB) |
| `issue-148-ellenorzes.mjs` | a #148 numerikus vizsgálata (Node) |
| `vendor/` | a vizsgált verzió pinelt másolata — hogy a referencia reprodukálható legyen |
| `data/` | minimális adatkészlet (a `display()` akkor is betölt, ha minden réteg rejtett) |
