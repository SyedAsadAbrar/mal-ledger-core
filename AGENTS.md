# Agent instructions

These instructions apply to all future work in this repository.

1. Read `PROJECT_PLAN.md`, `AMBIGUITIES.md`, `REJECTED.md`, and `NUMBERS.md` before changing business logic.
2. Treat the assessment specification and documented human decisions as authoritative.
3. Never silently resolve a ledger or accounting ambiguity in code.
4. If behavior is genuinely ambiguous, document it in `AMBIGUITIES.md` before implementing it.
5. Keep financial ledger and event history append-only.
6. Never mutate or delete an existing financial event.
7. Keep stream sequence, booked/event day, and `value_date` as separate concepts.
8. Use integer minor units for financial amounts when money logic is implemented; do not use JavaScript floating-point arithmetic for ledger money.
9. Prefer the smallest understandable implementation that satisfies the assessment and is easy to defend.
10. Do not introduce a web layer, API, UI, database, persistence, Docker, queues, or distributed infrastructure unless the project scope explicitly changes.
11. Add focused tests alongside implemented business rules.
12. Run relevant tests and typechecking after implementation changes.
13. Maintain `PROJECT_PLAN.md` as work progresses.
14. Never fabricate `WORKLOG.md`; record only work actually performed.
15. Preserve Git history; never squash or rewrite previous commits.
16. Do not commit unless the current task explicitly requests a commit.
17. Do not begin a later phase while the current phase is incomplete.
18. Do not change an already documented business decision silently.
