# Numbers

These values form the canonical Phase 2 numerical oracle. Assessment facts, mathematical consequences, and human-selected implementation policies are deliberately separated.

## Specified by assessment

| Constant | Value | Source | Reasoning |
| --- | --- | --- | --- |
| Replay window | Day 1 through Day 6 | Assessment | Explicit six-day window. |
| ACC-001 opening balance | AED 0.00 | Assessment | Explicit account opening state. |
| ACC-002 opening balance | BHD 0.000 | Assessment | Explicit account opening state. |
| AED precision | 2 decimal places | Assessment | Amounts are stored and rounded at currency precision. |
| BHD precision | 3 decimal places | Assessment | Amounts are stored and rounded at currency precision. |
| Overdraft fee | AED 25.00 per eligible account/day | Assessment | Explicit amount and once-per-day frequency; BHD applicability is unresolved. |
| Daily positive-balance interest rate | 0.04% | Assessment | Applied to positive closing ledger balances. |
| E1 | Booked/event Day 1; value Day 1; AED +1,200.00 | Assessment | ACC-001 credit. |
| E2 | Booked/event Day 1; value Day 1; AED -950.00 | Assessment | ACC-001 debit. |
| E3 | Booked/event Day 2; value Day 2; AED 200.00 hold | Assessment | ACC-001 Auth-A authorization. |
| E4 | Booked/event Day 3; value Day 3; AED +400.00 | Assessment | ACC-001 credit. |
| E5 | Booked/event Day 4; value Day 4; AED 185.00 settlement | Assessment | ACC-001 Auth-A settlement. |
| E6 | Booked/event Day 4; value Day 4; AED 180.00 settlement | Assessment | ACC-001 Auth-Z settlement with no preceding authorization. |
| E7 | Booked/event Day 5; value Day 2; AED -620.00 | Assessment | ACC-001 backdated debit. |
| E8 | Booked/event Day 5; value Day 5; AED 90.00 hold | Assessment | ACC-001 Auth-B authorization. |
| E9 | Booked/event Day 6; value Day 2; reverses E7 | Assessment | Full reversal implies an AED +620.00 compensating posting. |
| E10 | Booked/event Day 5; value Day 5; BHD +10.000 in 3 instalments | Assessment | ACC-002 credit; exact allocation is an implementation policy. |

## Mathematically derived

| Number | Value | Derivation / conditions |
| --- | ---: | --- |
| AED minor-unit scale | 100 | `10^2` from AED precision. |
| BHD minor-unit scale | 1,000 | `10^3` from BHD precision. |
| Overdraft fee in AED minor units | 2,500 | `25.00 × 100`. |
| Interest rate as exact ratio | `4 / 10,000` | `0.04% = 0.0004`. |
| ACC-001 after E2 | AED 250.00 | `1,200.00 - 950.00`. |
| E3 available after hold | AED 50.00 | `250.00 - 200.00`; therefore Auth-A is approved. |
| ACC-001 after E4 | Ledger AED 650.00; available AED 450.00 | `250.00 + 400.00`; subtract Auth-A AED 200.00 hold. |
| ACC-001 after E5 | Ledger/available AED 465.00 | `650.00 - 185.00`; terminal settlement releases the full hold. |
| Day 2 before E7 exists | AED 250.00 | E1 and E2 are the only ledger postings with `value_date <= Day 2`. |
| Day 2 after E7, before fees | AED -370.00 | `1,200.00 - 950.00 - 620.00`. |
| Post-E7 pre-fee closings, Days 1–5 | AED 250.00, -370.00, 30.00, -155.00, -155.00 | Includes the decided E5 acceptance and E6 rejection. |
| E7 fee count/total | 3 / AED 75.00 | Negative fee-eligible value dates are Days 2, 4, and 5 after chronological propagation. |
| Post-E7 closings with fees, Days 1–5 | AED 250.00, -395.00, 5.00, -205.00, -230.00 | Earlier fee postings propagate by `value_date`. |
| E8 authorization result | Declined | `-230.00 - 90.00 = -320.00`; no hold is created. |
| Post-E9 pre-interest ledger | AED 390.00 | `465.00 - 75.00`; E9 reverses E7 while the three fee events remain. |
| Exact E10 quotient | BHD 3.333333… | `10.000 / 3`; not representable at three decimals. |
| Three BHD 3.334 postings | BHD 10.002 | Exceeds E10 by BHD 0.002. |
| Canonical E10 allocation | BHD `3.333 + 3.333 + 3.334` | Final instalment absorbs the residual; total is BHD 10.000. |
| ACC-001 pre-interest closings, Days 1–6 | AED 250.00, 225.00, 625.00, 415.00, 390.00, 390.00 | E9 principal reversal is included; three fees remain. |
| ACC-001 daily rounded interest | AED 0.10, 0.09, 0.25, 0.17, 0.16, 0.16 | Exact rational rate rounded half up per day. |
| ACC-001 capitalization | AED 0.93 | Sum of individually rounded daily accruals. |
| Final ACC-001 balance | AED 390.93 | `390.00 + 0.93`. |
| ACC-002 pre-interest closings, Days 1–6 | BHD 0.000, 0.000, 0.000, 0.000, 10.000, 10.000 | E10 has `value_date` Day 5. |
| ACC-002 daily rounded interest | BHD 0.000, 0.000, 0.000, 0.000, 0.004, 0.004 | Exact rational rate; no half-minor-unit tie. |
| ACC-002 capitalization | BHD 0.008 | Sum of Day 5 and Day 6 accruals. |
| Final ACC-002 balance | BHD 10.008 | `10.000 + 0.008`. |

## Human-selected implementation policies

| Choice | Selected policy | Why it is an implementation choice |
| --- | --- | --- |
| Time model | Supplied order is stream sequence; supplied Day is booked/event metadata; `value_date` drives historical financial effect | E10's Day 5 metadata follows E9's Day 6 metadata in stream sequence. |
| Historical vs operational state | Restate historical finances but never retroactively rewrite completed operational decisions | The assessment defines value dating but not retroactive authorization mutation. |
| Rounding mode | Round half up to currency precision | Assessment states precision but not tie handling. |
| E10 remainder placement | Final instalment gets the extra fils | Exact equality is impossible at BHD precision. |
| E5 settlement | Accept terminally, close Auth-A, release the entire hold | Settlement/hold lifecycle is not a non-negotiable rule. |
| E6 settlement | Reject with no posting | Unknown-authorization validation is unspecified. |
| E7 fee assessment | Recompute affected value dates chronologically and append Days 2, 4, and 5 fees at E7's stream point | Retrospective assessment timing is unspecified. |
| E9 fee consequences | Compensate E7 only; retain all separately booked fees | Automatic derived-fee reversal is unspecified and no correction events exist. |
| Interest timing | Derive after the full stream; accrue Day 6 before capitalization; capitalize the rounded-daily sum | Booked/event days are non-monotonic in stream sequence. |

## Phase 3 representation details

| Detail | Implementation | Reasoning |
| --- | --- | --- |
| Stored money amount | Safe-integer JavaScript `number` minor units | Assessment values are tiny and bounded; construction and operations reject non-integers and values outside `Number.isSafeInteger`. |
| Supported currencies | `AED` and `BHD` only | Matches the assessment scope. |
| Precision source | One currency-to-precision map | Minor-unit scale is derived as `10^precision`, avoiding scattered scale constants. |
| Decimal parsing | Exact sign/digit parsing with `bigint` intermediate arithmetic | Never converts a financial decimal through floating point. |
| Accepted decimal forms | Whole units or one through the currency's maximum fractional digits | `"25"` and `"25.0"` AED normalize to `"25.00"`; excess precision is rejected rather than truncated. |
| Formatting | Sign plus integer quotient and zero-padded minor-unit remainder | Always emits exactly two AED or three BHD decimal places. |
| Rational rounding | Exact `bigint` product/division/remainder, then round half up | Result is converted back only after confirming it is a safe integer minor-unit amount. |
| Half-up negative tie | Away from zero | `-0.5` minor unit rounds to `-1`, mirroring positive half-up magnitude rounding. |

## Phase 4 representation details

| Detail | Implementation | Reasoning |
| --- | --- | --- |
| First causal record sequence | 1 | One ledger-owned counter orders immutable postings and operational records independently of booked day and `value_date`; records from one source event share `eventId`. |

## Phase 7 representation details

| Detail | Implementation | Reasoning |
| --- | --- | --- |
| Earliest causal knowledge cutoff | 0 | Stored records remain one-based; zero cleanly represents the state before any event and includes only opening balance. |
| Omitted causal knowledge cutoff | Latest currently known sequence | Historical queries default to everything processed so far while an explicit cutoff preserves an earlier knowledge state. |

## Phase 8 representation details

| Detail | Implementation | Reasoning |
| --- | --- | --- |
| Fee uniqueness | One assessment per `(accountId, assessedDay)` | Implements the assessment's once-per-day/per-account rule without generic external event-ID deduplication. |
| Generated fee identity | `FEE:<accountId>:D<assessedDay>` | Deterministic internal identity remains distinct from E1–E10 source event IDs. |
| Fee date metadata | Booked day and `valueDate` both equal assessed day | Global sequence separately preserves when the retrospectively assessed fee was appended. |
| Fee causal records | Assessment record followed by linked debit sequence | Keeps one global ordering and uses the ordinary financial posting history for all balance effects. |
| Negative non-AED closing | Explicit unsupported-fee-currency error | No FX or BHD-equivalent fee amount is specified. |

## Phase 9 representation details

| Detail | Implementation | Reasoning |
| --- | --- | --- |
| Reversal amount | Exact target posting amount | Full reversal is derived; callers cannot supply an arbitrary amount. |
| Reversal direction | Opposite target posting type | DEBIT becomes CREDIT and CREDIT becomes DEBIT through a normal financial posting. |
| Target identity resolution | Exactly one financial posting matching `targetEventId` | Zero or multiple matches fail without guessing or changing generic event-ID policy. |
| Reversal uniqueness | One successful reversal per target posting sequence | Prevents duplicate compensation while keeping source event-ID deduplication out of scope. |
| Reversal causal records | Audit record followed by linked compensating posting | Preserves append-only global order and allows causal-cutoff reconstruction. |
| Canonical E9 compensation | AED +620.00, booked Day 6, value Day 2 | Exactly offsets E7 principal while retained fees preserve their AED -75.00 effect. |

## Phase 10 representation details

| Detail | Implementation | Reasoning |
| --- | --- | --- |
| Interest assessment window | Day 1 through Day 6 | Matches the fixed assessment window without introducing a generic schedule model. |
| Daily basis snapshot | One latest-known causal sequence captured before capitalization | Every day uses the same financial knowledge state and the Day 6 credit cannot enter its own basis. |
| Daily accrual storage | Six immutable derived values with closing balance and rounded amount | Preserves explainable audit detail without creating daily financial postings. |
| Capitalization total | Exact `Money.add` sum of individually rounded daily amounts | Enforces the assessment's exact-sum invariant without independent aggregate rounding. |
| Generated interest identity | `INTEREST:<accountId>:D6` | Deterministic internal identity is distinct from external source event IDs. |
| Capitalization date metadata | Booked day and `valueDate` both equal Day 6 | Represents the one end-of-window financial credit. |
| Capitalization uniqueness | One successful capitalization per account for the Day 1–Day 6 window | Prevents duplicate credits without adding generic source event deduplication. |
| Zero rounded total | Reject without a capitalization record or posting | Preserves the positive financial-posting invariant and avoids zero-value ledger events. |
