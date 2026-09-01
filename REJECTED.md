# Rejected decisions

## Rejected acceptance criteria

### Criterion 2 — E7 causes exactly one Day 2 fee

**Rejected.** E7 first restates the pre-fee closings for Days 2–5 to AED -370.00, AED 30.00, AED -155.00, and AED -155.00. Chronological assessment then produces:

- Day 2 fee AED 25.00, leaving Day 2 at AED -395.00 and propagating to later days;
- Day 3 at AED 5.00 after that propagation, so no Day 3 fee;
- Day 4 at AED -180.00 before its fee and AED -205.00 after it;
- Day 5 at AED -205.00 before its fee and AED -230.00 after it.

E7 therefore causes three fee events—Days 2, 4, and 5—totalling AED 75.00. “Once per day” limits each eligible value date to one fee; it does not limit E7 to one fee across all affected dates.

### Criterion 6 — E9 restores all balances and fees

**Rejected.** E9 explicitly references E7, so it appends an AED 620.00 compensating posting and leaves E7 unchanged. The three fee events are separate booked ledger events, and the supplied stream contains no fee-correction events. Their AED -75.00 effect remains, leaving final pre-interest ACC-001 closings of AED 250.00, 225.00, 625.00, 415.00, 390.00, and 390.00 for Days 1–6.

The primary reason is not merely append-only history: E9 reverses E7 itself, not the independently booked fees. Append-only semantics reinforce that those events cannot silently disappear; any reimbursement would require explicit compensating fee events.

### Criterion 7 — Three instalments of BHD 3.334

**Rejected.** `3 × BHD 3.334 = BHD 10.002`, exceeding E10's BHD 10.000 total by BHD 0.002. This conflicts with the specified credit amount and three-decimal currency precision. The selected exact-total allocation is BHD 3.333, BHD 3.333, and BHD 3.334, with the final instalment absorbing the residual.

### Criterion 8 — Discard an interest remainder

**Rejected.** The non-negotiable rule says rounded daily accruals must sum exactly to the capitalized total. Discarding any difference makes the capitalization unequal to that sum. Capitalization must be calculated as the sum of rounded daily accruals.

## Acceptance-criteria analysis

| # | Classification | Arithmetic or rule reasoning |
| ---: | --- | --- |
| 1 | Accepted | After E7 is handled at its stream point and before fees, Day 2 includes E1 `+1,200.00`, E2 `-950.00`, and E7 `-620.00`: `1,200.00 - 950.00 - 620.00 = -370.00`. Holds do not enter ledger balance. |
| 2 | Rejected | Chronological value-date assessment produces fees for Days 2, 4, and 5, totalling AED 75.00—not one fee. |
| 3 | Accepted | “Settles for AED 185.00” is a terminal settlement of active approved Auth-A. It posts AED -185.00, marks Auth-A settled, releases the entire AED 200.00 hold, and leaves ledger/available AED 465.00. |
| 4 | Accepted | In this assessment model, settlement of an authorization ID requires that relationship to exist. Auth-Z is unknown, so E6 records an error, creates no authorization, and posts no AED 180.00 debit. |
| 5 | Accepted | The authorization formula explicitly subtracts active holds from ledger balance. A hold changes available balance and authorization state, not ledger postings. The criterion is conditional; E8 itself is declined. |
| 6 | Rejected | E9 compensates E7 only. The stream has no events reversing the three separately booked fee postings, so their AED -75.00 effect remains. |
| 7 | Rejected | `3 × 3.334 = 10.002`, not BHD 10.000. Exact equal instalments are impossible at BHD precision. |
| 8 | Rejected | Discarding a remainder contradicts the explicit requirement that capitalization equal the sum of rounded daily accruals. |

## Abandoned implementation approaches

- Sorting the input stream by `value_date`: rejected because stream sequence is explicitly supplied and operational decisions depend on that sequence.
- Treating later value-dated entries as rewriting previous authorization outcomes: rejected because financial history may be restated while operational decisions remain historical facts.
- Automatically and recursively compensating all fees derived from E7 when E9 arrives: rejected because E9 references only E7 and the stream contains no fee-correction events.
- Using three BHD 3.334 postings: rejected because they do not reconcile to E10's total.
- Allocating E10's residual to the earliest instalment: considered valid but rejected in favor of letting the final instalment reconcile the exact residual.
- Calculating capitalization independently and discarding a difference: rejected because the exact-sum rule requires capitalization to equal the rounded-daily sum.
