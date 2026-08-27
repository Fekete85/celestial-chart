# Documentation

`celestial-chart` is a modernised fork of
[d3-celestial](https://github.com/ofrohn/d3-celestial). How to use the library is
described in the root [`README.md`](../README.md); what lives here is the
documentation of the work itself.

| | |
|---|---|
| [`00-feasibility.md`](00-feasibility.md) | The starting point: is the library worth taking over, and how can the migration be measured |
| [`01-codebase.md`](01-codebase.md) | Survey of the codebase: 5669 lines, 16 modules, broken down by D3 dependency |
| [`02-migration.md`](02-migration.md) | The migration plan, ordered by risk |
| [`03-issues.md`](03-issues.md) | Triage of the 42 open upstream issues |
| [`04-migration-log.md`](04-migration-log.md) | **The work log**: what was measured, what was fixed, and where the first attempt failed |
| [`images/`](images/) | The captured images of the visual comparison (`d3v3-*` and `d3v7-*`) |

The tools behind the measurements live in the [`harness/`](../harness/) folder,
with its own [README](../harness/README.md).
