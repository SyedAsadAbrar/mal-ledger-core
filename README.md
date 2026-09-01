# mal-ledger-core

A deliberately small TypeScript project for an in-memory account ledger core.

This scaffold contains no ledger business logic. The project has no web or API layer, UI, database, persistence, or application framework.

## Requirements

- Node.js 22 or later
- npm

## Commands

```sh
npm test
npm run typecheck
npm run replay
```

`npm run replay` currently runs a harmless placeholder. The E1-E10 replay will be implemented in a later project phase.

## Layout

- `src/` — future ledger source code and the current setup placeholders
- `tests/` — tests, beginning with a scaffold verification test
- `PROJECT_PLAN.md` — living implementation sequence
- `NUMBERS.md` — constants and expected-number decisions
- `AMBIGUITIES.md` — unresolved and resolved semantic ambiguities
- `REJECTED.md` — rejected criteria and abandoned approaches
- `WORKLOG.md` — factual record of work actually performed
