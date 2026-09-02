# mal-ledger-core

A small in-memory account ledger implemented with TypeScript and Node.js. It intentionally has no API, UI, database, persistence, or application framework.

## Quick start

Requires Node.js 22 or later and npm.

```sh
npm ci
npm test
npm run replay
```

Additional commands:

```sh
npm run typecheck
npm run test:known-failure
```

`npm test` is the normal green suite. `npm run test:known-failure` is expected to fail: the assessment requires one annotated failing test against the design, and that test is deliberately excluded from the normal suite.

## What `npm run replay` prints

The replay processes E1–E10 and prints closing ledger balances, fee assessments, authorization states, and errors for each Day 1–6, followed by the interest capitalization summary.

| Day | ACC-001 | ACC-002 |
| ---: | ---: | ---: |
| 1 | AED 250.00 | BHD 0.000 |
| 2 | AED 225.00 | BHD 0.000 |
| 3 | AED 625.00 | BHD 0.000 |
| 4 | AED 415.00 | BHD 0.000 |
| 5 | AED 390.00 | BHD 10.000 |
| 6 | AED 390.93 | BHD 10.008 |

- Fees: ACC-001 is assessed AED 25.00 on Days 2, 4, and 5.
- Authorization lifecycle: Auth-A moves from `APPROVED` to `SETTLED`; Auth-B is `DECLINED`.
- Error: E6 reports `UNKNOWN_AUTHORIZATION` for Auth-Z and creates no debit.
- Interest capitalization: ACC-001 receives AED 0.93 and ACC-002 receives BHD 0.008.

## Important interpretation

1. Events replay in the supplied E1 → E10 order; they are not sorted by date.
2. Causal sequence, booked/event day, and `value_date` are separate concepts.
3. Value-dated financial history may be restated, but earlier operational authorization decisions are not retroactively rewritten.
4. Fees are append-only booked financial events.
5. Under the documented interpretation, E9 compensates E7 only and does not infer refunds for previously booked fees.
6. Interest is derived after the complete source stream and capitalized once at the end of Day 6.
7. E10 uses BHD 3.333, 3.333, and 3.334 because three exactly equal postings cannot represent BHD 10.000 at three-decimal precision.

Detailed choices and arithmetic are recorded in [AMBIGUITIES.md](AMBIGUITIES.md) and [NUMBERS.md](NUMBERS.md). Round-half-up is a selected implementation policy because the assessment does not specify tie-breaking.

## Acceptance criteria intentionally rejected

- Criterion 2: E7 makes Days 2, 4, and 5 negative before fees, so chronological assessment creates three fees rather than one.
- Criterion 6: under the documented policy, E9 targets E7 only; no fee-refund events are supplied.
- Criterion 7: `3 × BHD 3.334 = BHD 10.002`, not BHD 10.000.
- Criterion 8: capitalization is the exact sum of individually rounded daily accruals, so no remainder is discarded.

These are intentional design conclusions, not accidental test failures. See [REJECTED.md](REJECTED.md) for the complete rule analysis.

## Known limitation and intentional failure

Generic duplicate external source-event delivery is not deduplicated (A-09). E1–E10 contains no duplicate source IDs, so this does not affect the supplied replay.

`npm run test:known-failure` delivers the same AED 100.00 credit twice. It intentionally asserts the production-desirable AED 100.00 balance and fails because the current result is AED 200.00. A production ingestion contract would need to reject or idempotently ignore duplicate events.

## Repository layout

- `src/money.ts` — exact AED/BHD minor-unit representation and rational rounding.
- `src/ledger.ts` — in-memory append-only ledger, authorization, settlement, fee, reversal, interest, and instalment behavior.
- `src/scenario.ts` — fixed E1–E10 orchestration and report formatting.
- `src/replay.ts` — command-line replay entry point.
- `tests/` — focused domain and complete-scenario tests, plus the separately executed annotated expected failure.
- `NUMBERS.md` — canonical constants, arithmetic, and selected numerical policies.
- `AMBIGUITIES.md` — semantic ambiguities and documented resolutions.
- `REJECTED.md` — rejected acceptance criteria and abandoned approaches.
- `WORKLOG.md` — timestamped record of work actually performed.
- `PROJECT_PLAN.md` — implementation phases and design oracle.
