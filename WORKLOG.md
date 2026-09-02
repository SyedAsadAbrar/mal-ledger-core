# Worklog

## 2026-09-01T21:00:02+04:00 — Project scaffolding

- Created the initial documentation structure.
- Added a minimal TypeScript and Node.js test setup.
- Added a harmless replay placeholder without ledger business logic.

## 2026-09-01T21:34:07+04:00 — Phase 1 scaffold finalization

- Finalized the persistent agent rules and marked Phase 1 complete with Phase 2 not started.
- Clarified the scaffold-only README and future ambiguity-record template.
- Verified the clean install, typecheck, scaffold test, and replay placeholder.
- Confirmed generated artifacts are ignored and no ledger business logic or Phase 2 analysis is present.

## 2026-09-01T21:42:26+04:00 — Phase 2 semantic and numerical analysis

- Replayed E1–E10 manually in supplied order while separating processing state, value-dated history, ledger balance, holds, and available balance.
- Calculated the E7 fee and E9 reversal scenarios, E10 instalment mismatch, and conditional daily-interest totals.
- Classified all eight acceptance criteria and documented the two definite rejections.
- Recorded genuine unresolved ambiguities and proposed interpretations for human review.
- Kept Phase 2 in progress and made no source or test changes.

## 2026-09-01T23:09:21+04:00 — Phase 2 design-oracle finalization

- Reviewed and preserved the useful existing Phase 2 analysis and arithmetic.
- Applied the human-approved time, settlement, fee, reversal, allocation, rounding, and interest policies.
- Reconciled the replay, acceptance classifications, ambiguity statuses, and expected numbers into one canonical design oracle.
- Marked Phase 2 complete with Phase 3 not started and made no source or test changes.

## 2026-09-01T23:17:13+04:00 — Phase 3 exact money representation

- Added the AED/BHD safe-integer minor-unit money model with exact decimal parsing, fixed-precision formatting, basic same-currency operations, and rational round-half-up support.
- Added focused tests for precision, scales, parsing, normalization, formatting, operations, currency mismatch, interest primitives, half ties, and invalid inputs.
- Documented the concrete representation choices and marked Phase 3 complete with Phase 4 not started.
- Ran TypeScript checking and the complete test suite successfully.

## 2026-09-01T23:27:14+04:00 — Phase 4 basic ledger postings

- Added minimal account registration and append-only CREDIT/DEBIT postings using positive exact-money magnitudes.
- Preserved booked day, value date, event identity, and one-based stream append sequence on frozen ledger entries.
- Derived current per-account balances from opening balances and immutable posting history.
- Added focused account, posting, balance, currency, ordering, immutability, magnitude, and account-isolation tests.
- Ran TypeScript checking and the complete test suite successfully.

## 2026-09-01T23:37:07+04:00 — Phase 5 authorization holds

- Added immutable approved/declined authorization decisions and derived active holds and available balances.
- Generalized the Phase 4 sequence counter so financial postings and authorization decisions share one causal order.
- Documented and implemented ledger-wide unique authorization IDs without adding generic external event-ID deduplication.
- Added focused approval, decline, boundary, hold, currency, identity, immutability, historical-decision, and causal-order tests.
- Ran TypeScript checking and the complete test suite successfully.

## 2026-09-01T23:47:35+04:00 — Phase 6 settlement lifecycle

- Corrected authorization audit identity to preserve source event ID separately from authorization ID.
- Added immutable accepted/rejected settlement records, derived `SETTLED` state, full terminal hold release, and normal DEBIT posting for accepted settlement amounts.
- Added inspectable rejection reasons for unknown, declined, repeated, over-capture, invalid, cross-currency, and account-mismatch attempts.
- Linked accepted settlement records to their generated posting sequence while preserving one causal record order.
- Added 26 focused settlement lifecycle, audit identity, immutability, error, financial-posting, and sequence tests.
- Ran TypeScript checking and the complete test suite successfully.

## 2026-09-01T23:59:40+04:00 — Phase 7 value-dated balance projections

- Added a read-only historical balance projection filtered by both `value_date` and optional causal sequence cutoff.
- Preserved the existing current-balance calculation, immutable append order, and recorded authorization outcomes.
- Added 21 focused tests covering canonical pre-E7 and post-E7 balances, historical knowledge cutoffs, date semantics, validation, and immutability.
- Documented cutoff zero as opening-balance-only and marked Phase 7 complete with Phase 8 not started.
- Ran TypeScript checking and the complete test suite successfully.

## 2026-09-02T01:06:49+04:00 — Phase 8 overdraft fee assessment

- Added immutable overdraft fee records linked to normal AED DEBIT postings in the existing global causal sequence.
- Implemented chronological rolling assessment, account/day uniqueness, append-only fee history, deterministic generated identities, and explicit negative non-AED failure.
- Added 26 focused tests covering eligibility, metadata, immutability, uniqueness, cascading, canonical E7 fees and balances, historical restatement, currency boundaries, and sequence links.
- Documented the fee identity/date policy and negative non-AED implementation boundary, and marked Phase 8 complete with Phase 9 not started.
- Ran TypeScript checking and the complete test suite successfully.

## 2026-09-02T01:24:12+04:00 — Phase 9 append-only reversal

- Added immutable reversal records linked to derived opposite financial postings in the existing global causal sequence.
- Implemented unique target lookup, ambiguous/unknown target rejection, account validation, and one successful reversal per target posting sequence.
- Added 14 focused tests covering opposite posting derivation, E7 immutability, E9 links and balances, fee retention, authorization history, causal cutoffs, and invalid targets.
- Resolved the unknown, ambiguous, and repeated reversal-target decisions and marked Phase 9 complete with Phase 10 not started.
- Ran TypeScript checking and the complete test suite successfully.

## 2026-09-02T01:35:46+04:00 — Phase 10 interest capitalization

- Added one-snapshot Day 1–Day 6 positive-balance interest derivation with exact rational round-half-up arithmetic.
- Added immutable daily accrual and capitalization audit records linked to one normal end-of-Day-6 CREDIT posting.
- Enforced exact summation of individually rounded accruals, per-account/window uniqueness, and explicit zero-total rejection.
- Added 16 focused tests covering AED and BHD accruals, canonical values, holds, snapshot timing, posting identity, duplicates, and nested immutability.
- Ran TypeScript checking and the complete test suite successfully.

## 2026-09-02T01:42:05+04:00 — Phase 11 exact BHD instalments

- Added exact positive-money instalment allocation using integer quotient/remainder arithmetic with the residual assigned to the final instalment.
- Added a minimal ledger API that maps one source credit to deterministic child CREDIT postings using ordinary ledger history.
- Added 10 focused tests for canonical BHD values, exact reconciliation, residual placement, dates, causal order, historical balances, child identities, and invalid input.
- Documented the concrete E10 minor-unit arithmetic and source/child identity strategy, and marked Phase 11 complete with Phase 12 not started.
- Ran TypeScript checking and the complete test suite successfully.
