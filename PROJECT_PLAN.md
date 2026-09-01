# Project plan

This is a living implementation plan. Update statuses as work progresses without deciding later-phase semantics prematurely.

**Completed through:** Phase 9 — Reversal behavior

**Next phase:** Phase 10 — Interest accrual and capitalization (`not started`)

| Phase | Work | Status |
| ---: | --- | --- |
| 1 | Project scaffold | Complete |
| 2 | Establish expected ledger semantics and expected numbers | Complete |
| 3 | Money/currency representation | Complete |
| 4 | Basic credit/debit ledger postings | Complete |
| 5 | Authorization and available-balance handling | Complete |
| 6 | Settlement validation/lifecycle | Complete |
| 7 | Value-dated entries | Complete |
| 8 | Overdraft fee assessment | Complete |
| 9 | Reversal behavior | Complete |
| 10 | Interest accrual and capitalization | Not started |
| 11 | BHD instalment allocation | Not started |
| 12 | Full E1–E10 replay | Not started |
| 13 | Required daily output | Not started |
| 14 | Complete test suite and intentional failing test | Not started |
| 15 | Documentation review | Not started |
| 16 | Final clean-run verification | Not started |

## Phase notes

### Phase 2 — Design oracle

Phase 2 is complete. Canonical ledger semantics are established, expected numbers have been manually derived, all acceptance criteria are classified, and ambiguity decisions are documented. Implementation has not started.

Established directly from the assessment:

- stream sequence is exactly E1 → E2 → E3 → E4 → E5 → E6 → E7 → E8 → E9 → E10;
- supplied `Day` is booked/event-day metadata, not stream sequence;
- ledger closings use `value_date`;
- ledger balance, active holds, available balance, and authorization state are separate concepts;
- authorizations do not post to ledger balance;
- financial history and reversals are append-only;
- daily rounded interest accruals must sum exactly to the Day 6 capitalization.

Human-selected implementation policies establish that E5 terminally settles Auth-A and releases its full hold; E6 is rejected; backdated fee eligibility is evaluated chronologically; E9 reverses E7 only and leaves its three separately booked fees in place; operational decisions are never retroactively rewritten; rounding is half up; E10's final instalment absorbs the residual; and interest is derived after the full stream, before a single Day 6 capitalization.

## Manual E1–E10 replay

The rows remain in supplied stream sequence. “Booked/event day” is event metadata and may move backward; it is not the replay order.

| Event | Booked/event day / `value_date` | Account | Validity and ledger posting | State known at that stream point | Historical/value-dated and derived consequences |
| --- | --- | --- | --- | --- | --- |
| E1 | Day 1 / Day 1 | ACC-001 | Valid; credit AED 1,200.00 | Ledger AED 1,200.00; no holds; available AED 1,200.00 | Day 1 onward gains AED 1,200.00; positive-balance interest candidate. |
| E2 | Day 1 / Day 1 | ACC-001 | Valid; debit AED 950.00 | Ledger AED 250.00; no holds; available AED 250.00 | Day 1 closing becomes AED 250.00; positive-balance interest candidate. |
| E3 | Day 2 / Day 2 | ACC-001 | Approved because AED 250.00 − AED 200.00 = AED 50.00; no ledger posting | Ledger AED 250.00; Auth-A approved with AED 200.00 active hold; available AED 50.00 | No historical ledger change. A later backdated event must not silently rewrite this decision. |
| E4 | Day 3 / Day 3 | ACC-001 | Valid; credit AED 400.00 | Ledger AED 650.00; Auth-A hold AED 200.00; available AED 450.00 | Day 3 onward gains AED 400.00; positive-balance interest candidate. |
| E5 | Day 4 / Day 4 | ACC-001 | Accepted; debit AED 185.00 | Ledger AED 465.00; Auth-A settled; full AED 200.00 hold released; no holds; available AED 465.00 | Day 4 onward loses AED 185.00. The unused AED 15.00 ceases to be held and creates no ledger posting. |
| E6 | Day 4 / Day 4 | ACC-001 | Rejected; no posting | Ledger/available remain AED 465.00; Auth-Z has no state | Error: unknown authorization reference. AED 180.00 does not leave ACC-001. |
| E7 | Day 5 / Day 2 | ACC-001 | Valid; debit AED 620.00, then derive three fee postings | Before fees ledger is AED -155.00; after Day 2, Day 4, and Day 5 fees it is AED -230.00; no holds | Before fees: Day 2 AED -370.00, Day 3 AED 30.00, Days 4–5 AED -155.00. Chronological fees produce final closes of -395.00, 5.00, -205.00, and -230.00 for Days 2–5. |
| E8 | Day 5 / Day 5 | ACC-001 | Declined because AED -230.00 − AED 90.00 = AED -320.00 | Ledger/available remain AED -230.00; Auth-B declined; no new hold | No ledger or historical effect. This operational decline remains a fact after E9. |
| E9 | Day 6 / Day 2 | ACC-001 | Valid; retain E7 and append compensating credit AED 620.00 | Ledger/available become AED 390.00; no holds | Reverses E7's principal effect only. The three separately booked fee events remain; no inferred fee corrections are created. |
| E10 | Day 5 / Day 5, after E9 in stream | ACC-002 | Valid credits BHD 3.333, 3.333, and 3.334 | Ledger/available BHD 10.000; no holds | Day 5 onward gains BHD 10.000. Interest is derived for Days 5–6 after the full stream is known. |

## Historical balance oracle for E7

This table uses the decided E5/E6 outcomes and excludes interest. Newly discovered fee events are inserted chronologically by `value_date` while preserving the stream point at which they were generated.

| Day | Before E7 | After E7, before fees | Fee propagation | Closing after fees |
| --- | ---: | ---: | --- | ---: |
| Day 1 | AED 250.00 | AED 250.00 | None | AED 250.00 |
| Day 2 | AED 250.00 | AED -370.00 | Day 2 fee AED -25.00 | AED -395.00 |
| Day 3 | AED 650.00 | AED 30.00 | Day 2 fee carries forward AED -25.00 | AED 5.00 |
| Day 4 | AED 465.00 | AED -155.00 | Day 2 and Day 4 fees total AED -50.00 | AED -205.00 |
| Day 5 | AED 465.00 | AED -155.00 | Day 2, Day 4, and Day 5 fees total AED -75.00 | AED -230.00 |

E7 changes every Day 2–Day 5 historical balance. Negative pre-fee closings occur on Days 2, 4, and 5. The Day 2 fee reduces Day 3 from AED 30.00 to AED 5.00 but does not make it negative, so this data set creates no additional fee day solely through cascading. The fees deepen already-negative Days 4 and 5.

Each fee's `value_date` is its assessed historical day. Audit metadata must also retain that all three were discovered and appended while handling E7 at its stream position; they are not moved earlier in stream sequence.

## E9 append-only behavior

E9 never removes E7. It appends an AED 620.00 credit with `value_date` Day 2.

| Day | Canonical closing before interest capitalization |
| --- | ---: |
| Day 1 | AED 250.00 |
| Day 2 | AED 225.00 |
| Day 3 | AED 625.00 |
| Day 4 | AED 415.00 |
| Day 5 | AED 390.00 |
| Day 6 | AED 390.00 |

The three fees retain their AED -75.00 net effect because E9 references only E7 and the supplied stream contains no fee-correction events. Automatically generating recursive fee reversals was considered and rejected: it adds unstated causality policy, while explicit compensating events would preserve clearer append-only audit semantics.

## E10 instalment arithmetic

```text
BHD 10.000 / 3 = BHD 3.333333…
3 × BHD 3.334 = BHD 10.002
```

Three exactly equal postings cannot represent BHD 10.000 at three-decimal precision. The selected deterministic allocation is `3.333 + 3.333 + 3.334`: keep the first two at the representable base amount and let the final instalment reconcile the residual. Allocating the residual to the earliest instalment was considered and rejected for this implementation.

## Interest oracle

The rate is exact rational arithmetic:

```text
0.04% = 0.0004 = 4 / 10,000
```

Daily accrual is calculated from integer minor units using the rational rate and rounded half up to the account currency precision. The capitalization equals the sum of those already-rounded daily amounts; independently rounding a six-day aggregate could violate the explicit exact-sum rule.

Daily accruals remain derived values until the full E1–E10 stream and final historical closings are known. Day 6 interest uses the closing balance before capitalization, and capitalization earns no same-day interest.

| Account | Canonical daily pre-capitalization closings | Half-up rounded daily accruals | Capitalization | Final balance |
| --- | --- | --- | ---: | ---: |
| ACC-001 AED | 250.00, 225.00, 625.00, 415.00, 390.00, 390.00 | 0.10, 0.09, 0.25, 0.17, 0.16, 0.16 | AED 0.93 | AED 390.93 |
| ACC-002 BHD | 0.000, 0.000, 0.000, 0.000, 10.000, 10.000 | 0.000, 0.000, 0.000, 0.000, 0.004, 0.004 | BHD 0.008 | BHD 10.008 |

## Canonical daily output target

These are final historical closings after the complete stream and retained fee events, but before Day 6 interest capitalization.

| Value-date day | ACC-001 | ACC-002 | Fee assessments retained in history |
| --- | ---: | ---: | --- |
| Day 1 | AED 250.00 | BHD 0.000 | None |
| Day 2 | AED 225.00 | BHD 0.000 | ACC-001 AED 25.00 |
| Day 3 | AED 625.00 | BHD 0.000 | None |
| Day 4 | AED 415.00 | BHD 0.000 | ACC-001 AED 25.00 |
| Day 5 | AED 390.00 | BHD 10.000 | ACC-001 AED 25.00 |
| Day 6 | AED 390.00 | BHD 10.000 | None |

Authorization outcomes are Auth-A `APPROVED` at E3 then `SETTLED` at E5, and Auth-B `DECLINED` at E8 with no hold created. The only replay error is E6's unknown Auth-Z settlement. End-of-Day-6 capitalization credits AED 0.93 and BHD 0.008, producing final balances AED 390.93 and BHD 10.008.

### Phase 3 — Money/currency representation

Phase 3 is complete. `src/money.ts` provides the bounded assessment money model:

- AED and BHD precision are defined once and minor-unit scales are derived from them;
- stored amounts use safe-integer `number` minor units with validation at construction and after operations;
- decimal strings are parsed exactly with digit and `bigint` arithmetic, accepting fewer fractional digits by right-padding and rejecting excess precision;
- formatting always emits the currency's fixed precision, including negative amounts;
- add, subtract, compare, and negate reject cross-currency use where applicable;
- `roundFraction` uses exact integer arithmetic and round-half-up for later rational-rate calculations.

No account, ledger, event, fee, authorization, settlement, reversal, interest lifecycle, or replay behavior was implemented.

### Phase 4 — Basic credit/debit ledger postings

Phase 4 is complete. `src/ledger.ts` provides the minimal append-only ledger foundation:

- accounts have only an ID, currency, and opening balance;
- CREDIT and DEBIT entries store positive `Money` magnitudes, with posting type determining direction;
- each frozen entry preserves event ID, account ID, booked day, value date, and a one-based append sequence;
- entries remain in causal insertion order and exposed history is a copy, with no update or delete path;
- current ledger balance is derived from opening balance plus all appended postings for that account;
- account and posting currency must match, and posting magnitudes must be positive.

No authorization, hold, available-balance, settlement, fee, reversal, historical balance, interest, allocation, or replay behavior was implemented. Duplicate event IDs are not deduplicated in this phase.

### Phase 5 — Authorization and available-balance handling

Phase 5 is complete. The ledger now records immutable authorization decisions with only `APPROVED` and `DECLINED` states:

- available balance is derived as current ledger balance minus all approved holds for the account;
- a positive hold is approved when available balance after the hold is zero or positive, otherwise it is declined;
- approved authorizations remain active holds, while declined decisions remain inspectable but contribute no hold;
- authorization hold currency must match the account and authorization IDs are unique across the ledger;
- postings and authorization decisions share one ledger-owned causal sequence counter;
- later postings change derived balances but never recalculate a recorded authorization decision.

Authorizations create no financial posting and do not change ledger balance. No settlement, hold release, expiry, reversal, fee, historical balance, interest, allocation, or replay behavior was implemented.

### Phase 6 — Settlement validation/lifecycle

Phase 6 is complete. Authorization and settlement lifecycle history is append-only:

- authorization records now preserve source `eventId` separately from `authorizationId`;
- immutable settlement records retain accepted/rejected result, rejection reason, date metadata, causal sequence, and the linked debit sequence when accepted;
- current authorization state is derived as `APPROVED`, `DECLINED`, or `SETTLED` without mutating the original decision;
- settlement is accepted only for an active approved authorization with matching account/currency and a positive amount no greater than the hold;
- accepted settlement appends one normal DEBIT posting, releases the entire hold through lifecycle projection, and creates no posting for unused hold;
- unknown, declined, already-settled, over-capture, invalid-amount, currency-mismatch, and account-mismatch attempts remain inspectable rejections with no debit;
- one source settlement event is represented by adjacent causal records sharing `eventId`, with the settlement explicitly linking to its generated posting sequence.

No historical balance projection, fee, reversal, interest, capitalization, instalment allocation, authorization expiry/cancellation, or full replay behavior was implemented.

### Phase 7 — Value-dated entries

Phase 7 is complete. `Ledger.balanceAtValueDate(accountId, valueDate, asOfSequence?)` provides a read-only historical projection:

- the projection starts with the account opening balance and scans immutable posting history without sorting it;
- a posting contributes only when its `valueDate` is on or before the requested day and its causal `sequence` is on or before the cutoff;
- omitting the cutoff uses every record currently known, while cutoff `0` represents knowledge before the first one-based record and therefore returns opening balance only;
- booked day remains audit metadata and does not determine historical economic inclusion;
- `currentBalance` remains the processed-state projection over every known financial posting, independent of value date;
- later backdated postings can restate historical balances but do not rewrite recorded authorization decisions or lifecycle state.

The canonical pre-E7 Day 1–Day 5 closes and post-E7 pre-fee closes are covered by focused tests, including Day 2 viewed immediately before and at E7's causal sequence. No fee generation, reversal, interest, capitalization, instalment allocation, or full replay behavior was implemented.

### Phase 8 — Overdraft fee assessment

Phase 8 is complete. `Ledger.assessOverdraftFees(accountId, throughDay)` performs the minimal append-only fee lifecycle:

- days are inspected from Day 1 through `throughDay` in chronological order using the latest value-dated projection on every iteration;
- each negative AED closing with no existing `(accountId, assessedDay)` fee immediately appends an immutable AED 25.00 assessment followed by a linked normal DEBIT posting;
- each newly appended fee posting participates in the next day's balance, enabling chronological cascading without a frozen causal cutoff;
- generated identity `FEE:<accountId>:D<assessedDay>` is distinct from external source IDs, while booked day and `valueDate` both equal the assessed day and global sequence records later discovery;
- fee history is exposed through a defensive copy and is never removed when later financial information restates a day to positive;
- non-negative BHD days create no fee, while a negative non-AED closing fails explicitly because no conversion rule exists.

The canonical E7 assessment generates Day 2, Day 4, and Day 5 fees totalling AED 75.00 and produces Day 1–Day 5 closes of AED 250.00, -395.00, 5.00, -205.00, and -230.00. No reversal, fee refund/correction, interest, capitalization, instalment allocation, or full replay behavior was implemented.

### Phase 9 — Reversal behavior

Phase 9 is complete. `Ledger.reverse(input)` provides append-only full financial reversal:

- the target is resolved by exact `targetEventId` across financial posting history; zero matches, multiple matches, account mismatch, and an already-reversed target fail before any append;
- reversal amount and direction are derived from the unique target posting, so callers cannot supply arbitrary compensation;
- a successful immutable reversal record preserves source and target identities, target posting sequence, amount, original/opposite types, date metadata, causal sequence, and the linked adjacent posting sequence;
- the compensating posting uses the reversal source event ID and ordinary CREDIT/DEBIT history, so current and value-dated balances require no reversal-specific calculation;
- each target financial posting sequence may be reversed once, while generic external event-ID deduplication remains deliberately unimplemented;
- reversal history is exposed through a defensive copy and neither the target posting nor any existing fee record is mutated or removed.

Canonical E9 retains E7 and all three AED 25.00 fees, appends one AED 620.00 CREDIT with booked Day 6 and `valueDate` Day 2, and leaves Auth-A settled and Auth-B declined. The post-E9 pre-interest Day 1–Day 6 closes are AED 250.00, 225.00, 625.00, 415.00, 390.00, and 390.00. No fee refund, interest, capitalization, instalment allocation, final replay, or output behavior was implemented.

## Assessment tensions

- E10's “three equal instalments” cannot coexist exactly with BHD 10.000 and three-decimal storage. The selected final-residual policy produces near-equal postings.
- The overdraft fee is denominated only in AED while its wording says “per account” and a BHD account exists. The supplied replay never makes ACC-002 negative, so no observed result resolves this.
- Booked/event days are non-monotonic in supplied stream sequence because E10 (Day 5) follows E9 (Day 6). This is valid metadata but prevents a simple finalize-on-day-change algorithm.
- Acceptance criteria 7 and 8 intentionally contradict arithmetic and the exact-sum rule respectively; they are rejected in `REJECTED.md`.
