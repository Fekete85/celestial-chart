# Dokumentáció

A `celestial-chart` a [d3-celestial](https://github.com/ofrohn/d3-celestial) modernizált
forkja. A könyvtár használatát a gyökér [`README.md`](../README.md) írja le; itt a
munka dokumentációja van, magyarul.

| | |
|---|---|
| [`00-felmeres.md`](00-felmeres.md) | A kiindulópont: megéri-e átvenni a könyvtárat, és hogyan mérhető a migráció |
| [`01-kodbazis.md`](01-kodbazis.md) | A kódbázis felmérése: 5669 sor, 16 modul, D3-függés szerint bontva |
| [`02-migracio.md`](02-migracio.md) | A migráció terve, kockázat szerint |
| [`03-issuek.md`](03-issuek.md) | Az upstream 42 nyitott issue-jának átnézése |
| [`04-migracio-naplo.md`](04-migracio-naplo.md) | **A munka naplója**: mit mértünk, mit javítottunk, min bukott el az első próbálkozás |
| [`kepek/`](kepek/) | A vizuális összevetés rögzített képei (`d3v3-*` és `d3v7-*`) |

A méréshez tartozó eszközök a [`harness/`](../harness/) mappában vannak, saját
[README](../harness/README.md)-vel.
