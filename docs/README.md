# Dokumentáció

A `celestial-chart` a [d3-celestial](https://github.com/ofrohn/d3-celestial) modernizált
forkja. A könyvtár használatát a gyökér [`README.md`](../README.md) írja le; itt a
munka dokumentációja van, magyarul.

| | |
|---|---|
| [`00-feasibility.md`](00-feasibility.md) | A kiindulópont: megéri-e átvenni a könyvtárat, és hogyan mérhető a migráció |
| [`01-codebase.md`](01-codebase.md) | A kódbázis felmérése: 5669 sor, 16 modul, D3-függés szerint bontva |
| [`02-migration.md`](02-migration.md) | A migráció terve, kockázat szerint |
| [`03-issues.md`](03-issues.md) | Az upstream 42 nyitott issue-jának átnézése |
| [`04-migration-log.md`](04-migration-log.md) | **A munka naplója**: mit mértünk, mit javítottunk, min bukott el az első próbálkozás |
| [`kepek/`](kepek/) | A vizuális összevetés rögzített képei (`d3v3-*` és `d3v7-*`) |

A méréshez tartozó eszközök a [`harness/`](../harness/) mappában vannak, saját
[README](../harness/README.md)-vel.
