# Ambiguities

Ledger and accounting ambiguities must be documented here before a behavior is implemented.

Each record will include:

- ambiguity
- why it matters
- possible interpretations
- chosen interpretation
- reasoning
- replay/test consequences
- status: Decided, outside supplied scenario, or candidate known production limitation

## A-01 — Retrospective fee assessment and assessment timing

- **Ambiguity:** Does backdated E7 trigger assessment for historical negative closings, and when are those fees appended?
- **Why it matters:** The answer determines whether E7 creates zero, one, or several fee events and how audit order is preserved.
- **Possible interpretations:** Never revisit closed days; rerun each affected historical day when E7 arrives; or defer all assessment until a final six-day reconciliation.
- **Chosen interpretation:** When E7 is handled at its stream position, recompute affected historical closings and append one missing fee per eligible `value_date`. Preserve both the discovery point in stream sequence and the fee's historical `value_date`.
- **Reasoning:** Eligibility explicitly includes all entries with `value_date <=` each day; the fee must not be pretended to have appeared earlier in stream sequence.
- **Replay/test consequences:** E7 appends fees for Days 2, 4, and 5, totalling AED 75.00.
- **Status:** Decided

## A-02 — Cascading fee assessment

- **Ambiguity:** Can an earlier day's fee make a later day's closing balance negative and therefore trigger another day's fee?
- **Why it matters:** Fee assessment may require chronological iteration rather than a single scan of balances before fees.
- **Possible interpretations:** Ignore fees when testing later days; include all earlier value-dated fee postings; or forbid fee-created eligibility.
- **Chosen interpretation:** Include earlier fee postings in later closings and process value dates chronologically until each day has at most one fee.
- **Reasoning:** A fee is a ledger entry and the rule says closing balance includes all entries with `value_date <=` that day. “Once per day” prevents same-day recursion.
- **Replay/test consequences:** Here the Day 2 fee changes Day 3 from AED 30.00 to AED 5.00 but creates no new negative day; Days 4 and 5 were already negative.
- **Status:** Decided

## A-03 — E9 and fees derived from E7

- **Ambiguity:** Does E9 reverse only E7's AED 620.00 posting, or recursively compensate fees previously derived from E7?
- **Why it matters:** The fee events have a net AED -75.00 effect on the canonical pre-interest ledger.
- **Possible interpretations:** Fees are final once assessed; recompute eligibility and append fee reversals; or require explicit external reversal events for fees.
- **Chosen interpretation:** E9 compensates E7 only. Retain all three fee postings; create no inferred fee corrections because none appear in the supplied stream.
- **Reasoning:** E9 explicitly references only E7. Automatic recursive correction adds unstated causality policy; explicit compensating fee events would be required for reimbursement.
- **Replay/test consequences:** ACC-001 closes Day 6 at AED 390.00 before interest, and acceptance criterion 6 is rejected.
- **Status:** Decided

## A-04 — Backdated changes and prior authorization decisions

- **Ambiguity:** Does E7's Day 2 `value_date` retrospectively change E3's already-made Auth-A approval?
- **Why it matters:** Rewriting E3 would cascade into settlement validity and all later balances.
- **Possible interpretations:** Re-evaluate historical authorizations; preserve all event-time decisions; or restate balances while flagging decisions for review.
- **Chosen interpretation:** Financial projections may be retrospectively restated; operational decisions already made remain historical facts unless an explicit later event changes their state.
- **Reasoning:** E3 was valid against the information available at its stream point, and append-only history does not authorize retroactive decision mutation.
- **Replay/test consequences:** Auth-A remains approved after E7, and Auth-B remains declined after E9.
- **Status:** Decided

## A-05 — Settlement below the authorization hold

- **Ambiguity:** Is E5's AED 185.00 settlement valid against an AED 200.00 hold, and does it close or partially consume Auth-A?
- **Why it matters:** It controls E5 validity, ledger balance, hold state, E7 fee days, and interest.
- **Possible interpretations:** Require exact settlement; accept as terminal settlement and release the hold; or treat it as partial capture while retaining AED 15.00.
- **Chosen interpretation:** “Settles for” is terminal: accept E5, debit AED 185.00, mark Auth-A settled, and release the full AED 200.00 hold. The unused AED 15.00 creates no ledger posting.
- **Reasoning:** The assessment does not say “partially settles” and supplies no later Auth-A event.
- **Replay/test consequences:** E5 leaves ledger and available balance AED 465.00 with no active hold; criterion 3 is accepted.
- **Status:** Decided

## A-06 — Settlement with an unknown authorization reference

- **Ambiguity:** May Auth-Z settle when no authorization relationship exists in this model?
- **Why it matters:** It determines whether E6 debits AED 180.00.
- **Possible interpretations:** Reject the missing relationship; or permit an independent debit despite the authorization reference.
- **Chosen interpretation:** Reject E6 with an error and no posting because a settlement explicitly referencing an authorization ID requires that relationship to exist in this assessment model.
- **Reasoning:** This is deliberately narrower than claiming all real-world card settlements require prior online authorization.
- **Replay/test consequences:** AED 180.00 does not leave ACC-001, Auth-Z gains no state, and criterion 4 is accepted.
- **Status:** Decided

## A-07 — Monetary rounding mode

- **Ambiguity:** The specification gives precision but no tie-breaking or directed rounding mode.
- **Why it matters:** Interest and allocations can differ by a minor unit.
- **Possible interpretations:** Half-even, half-up, truncation, or a calculation-specific mode.
- **Chosen interpretation:** Use exact integer/rational calculations and round half up to the account currency's precision.
- **Reasoning:** It is deterministic and simple to defend; it is a human-selected policy, not a universal banking rule.
- **Replay/test consequences:** Future tests need exact-half cases, although none of the supplied expected interest amounts lands on a half-minor-unit tie.
- **Status:** Decided

## A-08 — BHD 10.000 instalment remainder

- **Ambiguity:** Which instalment receives the one-fils remainder when BHD 10.000 is divided by three?
- **Why it matters:** Exact equality is impossible at three decimals, but postings must sum exactly to the credit.
- **Possible interpretations:** Put BHD 0.001 on the first or final instalment; rotate remainder placement; or reject the instruction as impossible.
- **Chosen interpretation:** Allocate BHD 3.333, BHD 3.333, and BHD 3.334; the final instalment absorbs the exact residual.
- **Reasoning:** The first two use the representable base amount and the final posting reconciles `10,000 - 6,666 = 3,334` minor units. Earliest-remainder allocation was valid but rejected.
- **Replay/test consequences:** Assert every posting is valid BHD precision and the three sum to BHD 10.000.
- **Status:** Decided

## A-09 — Duplicate event IDs

- **Ambiguity:** Should an exact duplicate be an idempotent no-op or a validation error, and what if its payload differs?
- **Why it matters:** Duplicate postings violate event identity and append-only financial integrity.
- **Possible interpretations:** Reject every duplicate; no-op exact duplicates but reject conflicts; or append duplicates as separate arrivals.
- **Chosen interpretation:** None for Phase 2; duplicate handling is deliberately outside the supplied replay.
- **Reasoning:** No duplicate occurs in E1–E10, and selecting production idempotency semantics is not required to implement the canonical scenario.
- **Replay/test consequences:** Do not add duplicate behavior or tests in the initial replay implementation.
- **Status:** Outside supplied scenario / intentionally not implemented

## A-10 — Unknown reversal target

- **Ambiguity:** What happens when a reversal references no known reversible posting?
- **Why it matters:** Creating a credit without an original would corrupt the ledger.
- **Possible interpretations:** Reject; append a zero-effect rejected event; or treat it as an independent adjustment.
- **Chosen interpretation:** None for Phase 2; unknown-target handling is deliberately outside the supplied replay.
- **Reasoning:** E9 references known E7, so the canonical implementation need not invent a broader reversal validation contract yet.
- **Replay/test consequences:** Do not add this negative case to the initial replay implementation.
- **Status:** Outside supplied scenario / intentionally not implemented

## A-11 — Reversal of an already-reversed event

- **Ambiguity:** May a second reversal target E7 after it has already been fully reversed?
- **Why it matters:** A second compensating credit would overstate the account.
- **Possible interpretations:** Reject; idempotent no-op; or permit only explicitly supported partial reversals.
- **Chosen interpretation:** None for Phase 2; repeated-target handling is deliberately outside the supplied replay.
- **Reasoning:** E7 is reversed exactly once by E9, and partial/repeated reversal semantics are production scope beyond this scenario.
- **Replay/test consequences:** The initial implementation only needs the known, once-reversed E7 path.
- **Status:** Outside supplied scenario / intentionally not implemented

## A-12 — AED fee rule and BHD accounts

- **Ambiguity:** The fee is denominated as AED 25.00 but the rule says “per account,” including a BHD account.
- **Why it matters:** An AED amount cannot be posted directly into a BHD ledger without an exchange-rate or separate currency balance.
- **Possible interpretations:** Fee applies only to AED accounts; use BHD 25.000; convert using a supplied rate; or post to a separate AED balance.
- **Chosen interpretation:** No BHD overdraft fee behavior is implemented because ACC-002 never becomes negative.
- **Reasoning:** Applying AED 25.00 to a BHD ledger would require an unstated exchange rate, equivalent amount, or multi-currency balance.
- **Replay/test consequences:** The canonical replay is unaffected; negative BHD accounts are not a supported scenario.
- **Status:** Candidate known production limitation

## A-13 — Day 6 interest and capitalization order

- **Ambiguity:** Is Day 6 interest computed before or after the capitalization credit enters the Day 6 closing balance?
- **Why it matters:** Including the capitalization in its own basis creates circular or self-accruing interest.
- **Possible interpretations:** Accrue on the pre-capitalization close; capitalize first; or value-date capitalization after Day 6.
- **Chosen interpretation:** Calculate and round Day 6 interest on the pre-capitalization closing balance, then append one capitalization credit at end of Day 6.
- **Reasoning:** This yields a finite ordering and matches “accruals capitalize ... at the end of Day 6.”
- **Replay/test consequences:** Day 6 accrual is included exactly once and capitalization does not earn same-day interest.
- **Status:** Decided

## A-14 — Historical interest recomputation

- **Ambiguity:** Do E7 and E9 restate already-calculated daily interest for earlier value dates?
- **Why it matters:** Day 2–Day 5 accruals differ across the E7 and E9 historical states.
- **Possible interpretations:** Finalize on each booked/event day; recompute uncapitalized accruals after backdated entries; or post daily interest entries and later corrections.
- **Chosen interpretation:** Replay the complete stream, apply value-dated postings and fees, derive final Day 1–Day 6 closes, round each day's positive interest half up, and book only their sum at end of Day 6.
- **Reasoning:** Daily accruals are derived rather than booked events, and E10 appears after E9 despite its earlier booked/event day.
- **Replay/test consequences:** ACC-001 capitalizes AED 0.93 and ACC-002 BHD 0.008; no daily interest ledger postings exist.
- **Status:** Decided

## A-15 — Stream sequence, booked/event day, `value_date`, and “per day”

- **Ambiguity:** E10 has booked/event Day 5 but follows E9 with booked/event Day 6; supplied Day therefore cannot define stream sequence or trigger finalization by itself.
- **Why it matters:** Finalizing Day 6 before reading E10 would omit ACC-002's Day 5–6 interest.
- **Possible interpretations:** Treat supplied Day as stream order; sort by Day or `value_date`; or preserve supplied stream order while treating Day and `value_date` as separate metadata.
- **Chosen interpretation:** Replay E1→E10 exactly as supplied. Supplied Day is booked/event metadata. `value_date` determines historical financial effect. Operational decisions use information available at the event's stream point; fees/interest use value-date days.
- **Reasoning:** This honors causal order, allows historical restatement, and avoids pretending booked/event days are monotonic.
- **Replay/test consequences:** E10 contributes BHD interest for Days 5 and 6 even though it follows E9 in the stream; outputs must expose both date dimensions.
- **Status:** Decided

## A-16 — Settlement against an already declined authorization

- **Ambiguity:** Should a later settlement against a known declined authorization post a debit?
- **Why it matters:** It would define lifecycle behavior beyond E6's unknown reference.
- **Possible interpretations:** Reject; permit as an independent debit; or accept under a separate offline-settlement model.
- **Chosen interpretation:** Reject the settlement attempt with no financial posting. The declined authorization remains `DECLINED`.
- **Reasoning:** Phase 6 accepts settlement only against an active approved authorization. Treating the attempt as an independent debit would discard the explicit authorization relationship.
- **Replay/test consequences:** Focused lifecycle tests retain an inspectable rejected attempt and verify no debit; E1–E10 remains unaffected because Auth-B is never settled.
- **Status:** Decided

## A-17 — Duplicate authorization IDs

- **Ambiguity:** Should a second authorization request reuse an authorization ID that already identifies an approved or declined historical decision?
- **Why it matters:** Later lifecycle events must resolve one unambiguous authorization record by ID.
- **Possible interpretations:** Allow duplicates; scope uniqueness per account; accept exact duplicates as idempotent no-ops; or reject reuse across the ledger.
- **Chosen interpretation:** Authorization IDs are unique across the ledger. Once an ID has produced either an approved or declined decision, any later request using that ID is rejected without appending another authorization record.
- **Reasoning:** One ledger-wide identity rule is the smallest model that makes future lifecycle references unambiguous. This is distinct from unresolved duplicate external event-ID ingestion in A-09.
- **Replay/test consequences:** Focused tests reject reuse after a recorded decision. No generic event-ID deduplication is added.
- **Status:** Decided

## A-18 — Settlement greater than the approved hold

- **Ambiguity:** May a settlement exceed the amount of its active approved hold?
- **Why it matters:** Accepting over-capture would debit more than the amount reserved and requires policy not present in the assessment.
- **Possible interpretations:** Reject any amount above the hold; allow over-capture if ledger funds exist; or allow it under a separate tolerance policy.
- **Chosen interpretation:** Reject a settlement greater than the original approved hold, append no debit, and leave the full hold active.
- **Reasoning:** The assessment requires only E5's below-hold terminal settlement and provides no over-capture or tolerance rule.
- **Replay/test consequences:** Equal or lower positive amounts may settle; an over-capture attempt remains inspectable with no balance or hold change.
- **Status:** Decided

## A-19 — Repeated settlement of one authorization

- **Ambiguity:** Can an authorization produce more than one accepted settlement?
- **Why it matters:** A second accepted debit would duplicate capture after the terminal lifecycle event and after the hold has been released.
- **Possible interpretations:** Reject later attempts; accept multiple captures up to the hold; or treat an exact retry as idempotent.
- **Chosen interpretation:** An authorization settles at most once. Every later settlement attempt is rejected and retained for inspection without another debit.
- **Reasoning:** Phase 2 defines E5 as terminal rather than partial, and generic event-idempotency semantics remain unresolved in A-09.
- **Replay/test consequences:** The first valid attempt derives `SETTLED`; later attempts leave that state and the financial history unchanged.
- **Status:** Decided
