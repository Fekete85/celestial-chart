# d3-celestial modernizáció — megvalósíthatósági felmérés

Ez a repó **nem a fork**, hanem az azt megelőző felmérés: megéri-e átvenni és modernizálni a
[d3-celestial](https://github.com/ofrohn/d3-celestial) könyvtárat, és ha igen, hogyan.

A vizsgált verzió: `ofrohn/d3-celestial @ 7e720a3` (2022-07-05).

---

## A négy legfontosabb megállapítás

### 1. A projekt gazdátlan, de nem halott

| | |
|---|---|
| Szerző utolsó hozzászólása bármihez | **2022-01-20** |
| Utolsó nem-dependabot merge | 2022-01-20 |
| Nyitott PR-ok elfogadás nélkül | #135 (2022), #150 (2024), #152 (2025), #154–156 (2025) |
| Nyitott issue | **42** |
| Csillag / fork | 740 / 204 |

A 204 forkból **egy sem** végzett érdemi karbantartást (a legaktívabb, `mcoenca`, 47 committal egy
saját párizsi alkalmazás). Vagyis: van igény, van közösség, de nincs gazda.

**Következmény:** amit itt terveznénk, az nem upstream PR, hanem **hard fork** — saját néven, saját
karbantartással. A szerző 2021-ben maga írta három issue-ra:

> *„The app has reached a state where it is difficult to add features without breaking something."*

### 2. A kódbázis harmada érintetlenül átvihető

5669 sor, 16 modul. D3-függés szerint:

| Csoport | Sor | D3-hívás | Mi ez |
|---|---:|---:|---|
| **Tiszta matematika** | 1421 | **0** | `moon.js`, `kepler.js`, `transform.js`, `horizontal.js`, `get.js`, `add.js` |
| **Mag** | 2050 | 59 | `celestial.js`, `canvas.js`, `projection.js`, `config.js`, `util.js` |
| **Opcionális** | 2198 | 71 | `form.js`, `svg.js`, `location.js`, `datetimepicker.js`, `timezones.js` |

A csillagászati számítások (holdfázis, Kepler-pálya, koordináta-transzformáció) **egyetlen D3-hívást
sem tartalmaznak**. A beépített vezérlő űrlap és az SVG-kimenet elhagyható vagy későbbre halasztható.

**Az első fázis tehát ~2050 sor, nem 5669.**

### 3. A migráció mérhetővé tehető — és ez a kulcs

A szerző idézett mondata nem a D3 verziójáról szól, hanem arról, hogy **nincs regressziós háló**.
Egy vetítési könyvtárnál a helyesség azt jelenti, hogy a pixelek a helyükön vannak.

A vetítés viszont determinisztikus függvény: `(RA, Dec, vetítés, forgatás) → (x, y)`. Tehát
rögzíthető. A [`harness/`](harness/) mappában **működő referencia-generátor** van:

```
25 vetítés × 4 forgatás × 413 égi pont = 41 300 mért pont
```

Rögzíti a vetített pixelkoordinátákat **és a clipping állapotát** is. A migrált verziónak — adott
tűréssel — ugyanezt kell adnia.

**A mérés lefutott**: `harness/referencia-d3v3.json` (D3 3.5.17, 25/25 vetítés, 41 300 pont,
0 hibás, önellenőrzés rendben). Innentől bármihez hozzá lehet nyúlni.

> A harness első verziója **hibás volt**: a `Celestial.apply()`-jal váltott vetítést, amit az API nem
> támogat (`projection` újratöltést igényel), így minden vetítés ugyanazt a kimenetet adta volna. Egy
> beépített **önellenőrzés** fogta ki: ha két különböző vetítés azonos kimenetet ad, a referencia
> némán értéktelen. Ez jól mutatja, hogy a hálót magát is validálni kell.

### 4. Van értékes munka, ami nem is igényli a D3-migrációt

A [#148](https://github.com/ofrohn/d3-celestial/issues/148) issue (bejelentve 2023-12-08, azóta
válasz nélkül) szerint a `horizontal.inverse()` függvényből hiányzik egy előjel-korrekció.

Reprodukáltuk és számszerűsítettük ([`harness/issue-148-ellenorzes.mjs`](harness/issue-148-ellenorzes.mjs)):

```
EREDETI:    153/306 pont tér vissza rosszul (50%), legnagyobb eltérés 171,4°
JAVÍTOTT:     0/306 hiba, legnagyobb eltérés 0,0002°
```

A hiba a horizont fölötti pontok **felét** érinti — pontosan azt a felét, ahol `sin(azimut) > 0`.
Az `acos` mindig 0–180°-ot ad, így az égbolt egyik fele elveszik; az előre irány kezeli ezt
(`if (Math.sin(ha) > 0) az = 2π - az`), az inverz nem.

**A javítás egyetlen sor, és a `horizontal.js` nulla D3-hívást tartalmaz** — vagyis a D3-verziótól
teljesen függetlenül javítható.

---

## Ajánlott sorrend

Az első két lépésnek **önmagában is van értéke**, függetlenül attól, hogy a migráció valaha befejeződik-e.

| # | Lépés | Miért ez a sorrend | Kockázat |
|---|---|---|---|
| 1 | **Matematikai hibák javítása** (#148, #130 holdfázis, #157 interpoláció) | D3-mentes fájlok, round-trip teszttel bizonyítható | alacsony |
| 2 | ~~**Referencia-háló rögzítése** a jelenlegi verzióra~~ **kész** | Ezután bármihez hozzá lehet nyúlni félelem nélkül | nincs |
| 3 | Mechanikus D3-csere: `d3.functor`, `d3.json` promisifikálás, `d3.event` | Gépies, a háló azonnal visszajelez | alacsony |
| 4 | `d3.geo.*` → `d3-geo` + `d3-geo-projection` | **Ez az érdemi rész**, vetítésenként mérve | **magas** |
| 5 | ES-modulok, tree-shaking | Ez oldja meg a #86, #81, #115, #141 issue-kat | közepes |
| 6 | `form.js` / `svg.js` — migrálás vagy elhagyás | Külön döntés, nem blokkoló | – |

Részletek: [`docs/01-kodbazis.md`](docs/01-kodbazis.md) · [`docs/02-migracio.md`](docs/02-migracio.md) ·
[`docs/03-issuek.md`](docs/03-issuek.md)

## Mit old meg a modernizáció, és mit nem

**Megoldja** (7 issue egy csapásra): #147 (D3-frissítés), #141 (ES-modul), #86 (React), #81 (Node),
#115 (webpack), #134 (`d3 is not defined`), és részben #96/#131 (több példány egy oldalon — ez a
globális állapot problémája, amit egy osztály-alapú átírás szüntet meg).

**Nem oldja meg**: a matematikai hibákat (#148, #130, #157) és a funkciókéréseket. Azok külön munkák
— de a referencia-háló ezeket is biztonságossá teszi.

## Amit a felmérés nem tud eldönteni

A vetítések **vizuális** helyességét. A háló számokat hasonlít össze; hogy a Nagy Medve úgy néz-e ki,
ahogy kell, azt **meg kell nézni**. A migráció minden fázisa után kell egy emberi pillantás — ezt
semmilyen automatizmus nem váltja ki.

Amit tehettünk: rögzítettük, hogy *most* hogy néz ki. A [`docs/kepek/`](docs/kepek/) mappában hat kép
van a jelenlegi verzióról (`harness/vizualis.html`), köztük a félteke-vágást és a Nagy Göncölt mutató
orthographic nézet. A migráció után ugyanezeket kell újra elkészíteni és egymás mellé tenni — az
összevetés marad emberi feladat, de már van mihez hasonlítani.

## Licenc

Az upstream BSD-3-Clause, a fork is az marad. Az `upstream/` mappa gitignore-olt; a
[`harness/vendor/`](harness/vendor/) a vizsgált verzió pinelt másolatát tartalmazza, hogy a
referencia reprodukálható legyen.
