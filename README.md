# mal-ledger-core

A deliberately small TypeScript project for an in-memory account-ledger assessment.

Phase 1, the runnable project scaffold, is complete. Ledger business logic has not been implemented. The project has no web or API layer, UI, database, persistence, or application framework.

## Requirements

- Node.js 22 or later
- npm

## Commands

```sh
npm test
npm run typecheck
npm run replay
```

`npm run replay` currently runs a harmless scaffold placeholder. Event replay will be implemented in a later project phase.

## Layout

- `src/` — the current scaffold export and replay placeholder
- `tests/` — the scaffold verification test
- `PROJECT_PLAN.md` — living implementation sequence
- `NUMBERS.md` — future constants and expected-number decisions
- `AMBIGUITIES.md` — future semantic ambiguities and decisions
- `REJECTED.md` — future rejected criteria and abandoned approaches
- `WORKLOG.md` — factual record of work actually performed
