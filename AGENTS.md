# Agent instructions

These instructions apply to all future work in this repository.

1. Read `PROJECT_PLAN.md`, `AMBIGUITIES.md`, `REJECTED.md`, and `NUMBERS.md` before changing business logic.
2. Treat the assessment specification and explicitly documented decisions as authoritative.
3. Never silently resolve a ledger or accounting ambiguity in code.
4. If behavior is ambiguous and not yet documented, record it in `AMBIGUITIES.md` before implementing the chosen behavior.
5. Keep all financial events append-only. Never mutate or delete an existing financial event.
6. Keep processing/booking day separate from `value_date`.
7. Represent currency amounts using integer minor units rather than JavaScript floating-point arithmetic when financial logic is added.
8. Prefer the smallest implementation that satisfies the assessment.
9. Do not introduce APIs, databases, persistence, UI, Docker, queues, or distributed-system infrastructure.
10. Add focused tests for every business rule when that rule is implemented.
11. Run the relevant tests after every implementation change.
12. Do not change previously documented business decisions without explicitly updating the relevant decision documentation.
13. Maintain `PROJECT_PLAN.md` as implementation progresses.
14. Do not fabricate `WORKLOG.md` history. Only append entries that correspond to work actually performed.
15. Do not squash or rewrite existing Git history.
16. Do not commit unless explicitly asked to commit.
