import assert from "node:assert/strict";
import test from "node:test";

import { Ledger, type ReversalRecord } from "../src/ledger.js";
import { Money } from "../src/money.js";

const ACCOUNT_ID = "ACC-001";

function aedLedger(openingBalance = "0.00"): Ledger {
  return new Ledger([
    {
      id: ACCOUNT_ID,
      currency: "AED",
      openingBalance: Money.parse("AED", openingBalance),
    },
  ]);
}

function canonicalLedgerBeforeE9() {
  const ledger = aedLedger();
  ledger.postCredit({
    eventId: "E1",
    accountId: ACCOUNT_ID,
    amount: Money.parse("AED", "1200.00"),
    bookedDay: 1,
    valueDate: 1,
  });
  ledger.postDebit({
    eventId: "E2",
    accountId: ACCOUNT_ID,
    amount: Money.parse("AED", "950.00"),
    bookedDay: 1,
    valueDate: 1,
  });
  const authA = ledger.authorize({
    eventId: "E3",
    authorizationId: "Auth-A",
    accountId: ACCOUNT_ID,
    holdAmount: Money.parse("AED", "200.00"),
    bookedDay: 2,
    valueDate: 2,
  });
  ledger.postCredit({
    eventId: "E4",
    accountId: ACCOUNT_ID,
    amount: Money.parse("AED", "400.00"),
    bookedDay: 3,
    valueDate: 3,
  });
  ledger.settle({
    eventId: "E5",
    authorizationId: "Auth-A",
    accountId: ACCOUNT_ID,
    amount: Money.parse("AED", "185.00"),
    bookedDay: 4,
    valueDate: 4,
  });
  ledger.settle({
    eventId: "E6",
    authorizationId: "Auth-Z",
    accountId: ACCOUNT_ID,
    amount: Money.parse("AED", "180.00"),
    bookedDay: 4,
    valueDate: 4,
  });
  const e7 = ledger.postDebit({
    eventId: "E7",
    accountId: ACCOUNT_ID,
    amount: Money.parse("AED", "620.00"),
    bookedDay: 5,
    valueDate: 2,
  });
  ledger.assessOverdraftFees(ACCOUNT_ID, 5);
  const authB = ledger.authorize({
    eventId: "E8",
    authorizationId: "Auth-B",
    accountId: ACCOUNT_ID,
    holdAmount: Money.parse("AED", "90.00"),
    bookedDay: 5,
    valueDate: 5,
  });

  return { ledger, e7, authA, authB };
}

function reverseE7(ledger: Ledger) {
  return ledger.reverse({
    eventId: "E9",
    targetEventId: "E7",
    accountId: ACCOUNT_ID,
    bookedDay: 6,
    valueDate: 2,
  });
}

test("reversal derives equal opposite postings for DEBIT and CREDIT", () => {
  const ledger = aedLedger();
  ledger.postDebit({
    eventId: "debit-target",
    accountId: ACCOUNT_ID,
    amount: Money.parse("AED", "10.00"),
    bookedDay: 1,
    valueDate: 1,
  });

  const debitReversal = ledger.reverse({
    eventId: "reverse-debit",
    targetEventId: "debit-target",
    accountId: ACCOUNT_ID,
    bookedDay: 2,
    valueDate: 1,
  });
  const debitCompensation = ledger.entries.find(
    (entry) => entry.sequence === debitReversal.ledgerEntrySequence,
  );

  ledger.postCredit({
    eventId: "credit-target",
    accountId: ACCOUNT_ID,
    amount: Money.parse("AED", "7.00"),
    bookedDay: 2,
    valueDate: 2,
  });
  const creditReversal = ledger.reverse({
    eventId: "reverse-credit",
    targetEventId: "credit-target",
    accountId: ACCOUNT_ID,
    bookedDay: 3,
    valueDate: 2,
  });
  const creditCompensation = ledger.entries.find(
    (entry) => entry.sequence === creditReversal.ledgerEntrySequence,
  );

  assert.equal(debitCompensation?.type, "CREDIT");
  assert.equal(debitCompensation?.amount.format(), "10.00");
  assert.equal(creditCompensation?.type, "DEBIT");
  assert.equal(creditCompensation?.amount.format(), "7.00");
});

test("canonical E9 leaves the original E7 entry unchanged", () => {
  const { ledger, e7 } = canonicalLedgerBeforeE9();

  reverseE7(ledger);

  assert.equal(ledger.entries.find((entry) => entry.sequence === e7.sequence), e7);
  assert.equal(e7.eventId, "E7");
  assert.equal(e7.type, "DEBIT");
  assert.equal(e7.amount.format(), "620.00");
  assert.equal(e7.bookedDay, 5);
  assert.equal(e7.valueDate, 2);
  assert.equal(Object.isFrozen(e7), true);
});

test("reversal records, amounts, and exposed history are immutable", () => {
  const ledger = aedLedger();
  ledger.postDebit({
    eventId: "target",
    accountId: ACCOUNT_ID,
    amount: Money.parse("AED", "10.00"),
    bookedDay: 1,
    valueDate: 1,
  });
  const reversal = ledger.reverse({
    eventId: "reversal",
    targetEventId: "target",
    accountId: ACCOUNT_ID,
    bookedDay: 2,
    valueDate: 1,
  });
  const exposed = ledger.reversals as ReversalRecord[];

  exposed.length = 0;
  assert.equal(ledger.reversals.length, 1);
  assert.equal(Object.isFrozen(reversal), true);
  assert.equal(Object.isFrozen(reversal.amount), true);
  assert.throws(() => {
    (reversal as unknown as { targetEventId: string }).targetEventId = "other";
  }, TypeError);
  assert.throws(() => {
    (reversal.amount as unknown as { minorUnits: number }).minorUnits = 0;
  }, TypeError);
});

test("E9 links E7 to one adjacent AED 620.00 CREDIT", () => {
  const { ledger, e7 } = canonicalLedgerBeforeE9();

  const reversal = reverseE7(ledger);
  const credit = ledger.entries.find(
    (entry) => entry.sequence === reversal.ledgerEntrySequence,
  );

  assert.equal(reversal.eventId, "E9");
  assert.equal(reversal.targetEventId, "E7");
  assert.equal(reversal.targetLedgerEntrySequence, e7.sequence);
  assert.equal(reversal.originalPostingType, "DEBIT");
  assert.equal(reversal.reversalPostingType, "CREDIT");
  assert.equal(reversal.amount.format(), "620.00");
  assert.equal(reversal.ledgerEntrySequence, reversal.sequence + 1);
  assert.equal(credit?.eventId, "E9");
  assert.equal(credit?.type, "CREDIT");
  assert.equal(credit?.amount.format(), "620.00");
  assert.equal(credit?.bookedDay, 6);
  assert.equal(credit?.valueDate, 2);
});

test("canonical current balance moves from AED -230.00 to AED 390.00", () => {
  const { ledger } = canonicalLedgerBeforeE9();

  assert.equal(ledger.currentBalance(ACCOUNT_ID).format(), "-230.00");
  reverseE7(ledger);

  assert.equal(ledger.currentBalance(ACCOUNT_ID).format(), "390.00");
});

test("canonical post-E9 Day 1 through Day 6 balances are exact", () => {
  const { ledger } = canonicalLedgerBeforeE9();
  reverseE7(ledger);

  assert.deepEqual(
    [1, 2, 3, 4, 5, 6].map((day) =>
      ledger.balanceAtValueDate(ACCOUNT_ID, day).format(),
    ),
    ["250.00", "225.00", "625.00", "415.00", "390.00", "390.00"],
  );
});

test("canonical E9 retains all three existing overdraft fees", () => {
  const { ledger } = canonicalLedgerBeforeE9();
  const feesBefore = ledger.overdraftFees;

  reverseE7(ledger);

  assert.equal(ledger.overdraftFees.length, 3);
  assert.deepEqual(
    ledger.overdraftFees.map((fee) => fee.assessedDay),
    [2, 4, 5],
  );
  assert.deepEqual(ledger.overdraftFees, feesBefore);
});

test("canonical E9 generates no fee-refund posting", () => {
  const { ledger } = canonicalLedgerBeforeE9();
  const postingCountBefore = ledger.entries.length;

  reverseE7(ledger);
  const appended = ledger.entries.slice(postingCountBefore);

  assert.equal(appended.length, 1);
  assert.equal(appended[0]?.eventId, "E9");
  assert.equal(appended[0]?.type, "CREDIT");
  assert.equal(appended[0]?.amount.format(), "620.00");
  assert.equal(ledger.overdraftFees.length, 3);
});

test("E9 does not rewrite Auth-A or Auth-B operational history", () => {
  const { ledger, authA, authB } = canonicalLedgerBeforeE9();

  reverseE7(ledger);

  assert.equal(authA.status, "APPROVED");
  assert.equal(ledger.authorizationState("Auth-A"), "SETTLED");
  assert.equal(authB.status, "DECLINED");
  assert.equal(ledger.authorizationState("Auth-B"), "DECLINED");
  assert.equal(ledger.activeHolds(ACCOUNT_ID).length, 0);
});

test("causal cutoffs preserve pre-E9 and post-E9 Day 2 projections", () => {
  const { ledger, authB } = canonicalLedgerBeforeE9();
  const beforeE9Sequence = authB.sequence;

  assert.equal(
    ledger.balanceAtValueDate(ACCOUNT_ID, 2, beforeE9Sequence).format(),
    "-395.00",
  );

  const reversal = reverseE7(ledger);

  assert.equal(
    ledger.balanceAtValueDate(ACCOUNT_ID, 2, beforeE9Sequence).format(),
    "-395.00",
  );
  assert.equal(
    ledger.balanceAtValueDate(ACCOUNT_ID, 2, reversal.sequence).format(),
    "-395.00",
  );
  assert.equal(
    ledger
      .balanceAtValueDate(
        ACCOUNT_ID,
        2,
        reversal.ledgerEntrySequence,
      )
      .format(),
    "225.00",
  );
});

test("reversal account mismatch fails without financial effect", () => {
  const ledger = new Ledger([
    {
      id: ACCOUNT_ID,
      currency: "AED",
      openingBalance: Money.parse("AED", "0.00"),
    },
    {
      id: "ACC-OTHER",
      currency: "AED",
      openingBalance: Money.parse("AED", "0.00"),
    },
  ]);
  ledger.postDebit({
    eventId: "target",
    accountId: ACCOUNT_ID,
    amount: Money.parse("AED", "10.00"),
    bookedDay: 1,
    valueDate: 1,
  });

  assert.throws(
    () =>
      ledger.reverse({
        eventId: "reversal",
        targetEventId: "target",
        accountId: "ACC-OTHER",
        bookedDay: 2,
        valueDate: 1,
      }),
    /Reversal account must match target account/,
  );
  assert.equal(ledger.reversals.length, 0);
  assert.equal(ledger.entries.length, 1);
  assert.equal(ledger.currentBalance(ACCOUNT_ID).format(), "-10.00");
  assert.equal(ledger.currentBalance("ACC-OTHER").format(), "0.00");
});

test("unknown reversal target fails without financial effect", () => {
  const ledger = aedLedger("10.00");

  assert.throws(
    () =>
      ledger.reverse({
        eventId: "reversal",
        targetEventId: "missing",
        accountId: ACCOUNT_ID,
        bookedDay: 2,
        valueDate: 1,
      }),
    /Unknown reversal target/,
  );
  assert.equal(ledger.reversals.length, 0);
  assert.equal(ledger.entries.length, 0);
  assert.equal(ledger.currentBalance(ACCOUNT_ID).format(), "10.00");
});

test("ambiguous duplicate target identity fails rather than guessing", () => {
  const ledger = aedLedger();
  ledger.postCredit({
    eventId: "duplicate",
    accountId: ACCOUNT_ID,
    amount: Money.parse("AED", "1.00"),
    bookedDay: 1,
    valueDate: 1,
  });
  ledger.postCredit({
    eventId: "duplicate",
    accountId: ACCOUNT_ID,
    amount: Money.parse("AED", "2.00"),
    bookedDay: 1,
    valueDate: 1,
  });

  assert.throws(
    () =>
      ledger.reverse({
        eventId: "reversal",
        targetEventId: "duplicate",
        accountId: ACCOUNT_ID,
        bookedDay: 2,
        valueDate: 1,
      }),
    /Ambiguous reversal target/,
  );
  assert.equal(ledger.reversals.length, 0);
  assert.equal(ledger.entries.length, 2);
  assert.equal(ledger.currentBalance(ACCOUNT_ID).format(), "3.00");
});

test("a second reversal of the same target creates no compensation", () => {
  const ledger = aedLedger();
  ledger.postDebit({
    eventId: "target",
    accountId: ACCOUNT_ID,
    amount: Money.parse("AED", "10.00"),
    bookedDay: 1,
    valueDate: 1,
  });
  ledger.reverse({
    eventId: "first-reversal",
    targetEventId: "target",
    accountId: ACCOUNT_ID,
    bookedDay: 2,
    valueDate: 1,
  });
  const postingCount = ledger.entries.length;

  assert.throws(
    () =>
      ledger.reverse({
        eventId: "second-reversal",
        targetEventId: "target",
        accountId: ACCOUNT_ID,
        bookedDay: 3,
        valueDate: 1,
      }),
    /already reversed/,
  );
  assert.equal(ledger.reversals.length, 1);
  assert.equal(ledger.entries.length, postingCount);
  assert.equal(ledger.currentBalance(ACCOUNT_ID).format(), "0.00");
});
