import assert from "node:assert/strict";
import test from "node:test";

import {
  Ledger,
  type OverdraftFeeAssessment,
} from "../src/ledger.js";
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

function canonicalLedgerThroughE7(): Ledger {
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
  ledger.authorize({
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
  ledger.postDebit({
    eventId: "E7",
    accountId: ACCOUNT_ID,
    amount: Money.parse("AED", "620.00"),
    bookedDay: 5,
    valueDate: 2,
  });
  return ledger;
}

test("a positive closing balance produces no overdraft fee", () => {
  const ledger = aedLedger("1.00");

  const appended = ledger.assessOverdraftFees(ACCOUNT_ID, 1);

  assert.equal(appended.length, 0);
  assert.equal(ledger.overdraftFees.length, 0);
  assert.equal(ledger.entries.length, 0);
});

test("a zero closing balance produces no overdraft fee", () => {
  const ledger = aedLedger("0.00");

  ledger.assessOverdraftFees(ACCOUNT_ID, 1);

  assert.equal(ledger.overdraftFees.length, 0);
  assert.equal(ledger.entries.length, 0);
});

test("a negative AED closing balance produces an AED 25.00 fee", () => {
  const ledger = aedLedger("-1.00");

  const [fee] = ledger.assessOverdraftFees(ACCOUNT_ID, 1);

  assert.equal(fee?.amount.currency, "AED");
  assert.equal(fee?.amount.minorUnits, 2_500);
  assert.equal(fee?.amount.format(), "25.00");
});

test("an overdraft fee creates a normal DEBIT financial posting", () => {
  const ledger = aedLedger("-1.00");

  const [fee] = ledger.assessOverdraftFees(ACCOUNT_ID, 1);
  const entry = ledger.entries[0];

  assert.equal(ledger.entries.length, 1);
  assert.equal(entry?.type, "DEBIT");
  assert.equal(entry?.amount.format(), "25.00");
  assert.equal(entry?.sequence, fee?.ledgerEntrySequence);
});

test("the generated fee debit value date equals the assessed day", () => {
  const ledger = aedLedger("-1.00");

  const [fee] = ledger.assessOverdraftFees(ACCOUNT_ID, 3);
  const entry = ledger.entries.find(
    (candidate) => candidate.sequence === fee?.ledgerEntrySequence,
  );

  assert.equal(fee?.assessedDay, 1);
  assert.equal(entry?.valueDate, fee?.assessedDay);
});

test("the generated fee debit booked day equals the assessed day", () => {
  const ledger = aedLedger("10.00");
  ledger.postDebit({
    eventId: "day-3-debit",
    accountId: ACCOUNT_ID,
    amount: Money.parse("AED", "11.00"),
    bookedDay: 5,
    valueDate: 3,
  });

  const [fee] = ledger.assessOverdraftFees(ACCOUNT_ID, 3);
  const entry = ledger.entries.find(
    (candidate) => candidate.sequence === fee?.ledgerEntrySequence,
  );

  assert.equal(fee?.assessedDay, 3);
  assert.equal(entry?.bookedDay, 3);
  assert.equal(entry?.valueDate, 3);
});

test("fee records and amounts are immutable", () => {
  const ledger = aedLedger("-1.00");
  const [fee] = ledger.assessOverdraftFees(ACCOUNT_ID, 1);

  assert.ok(fee);
  assert.equal(Object.isFrozen(fee), true);
  assert.equal(Object.isFrozen(fee.amount), true);
  assert.throws(() => {
    (fee as unknown as { assessedDay: number }).assessedDay = 2;
  }, TypeError);
  assert.throws(() => {
    (fee.amount as unknown as { minorUnits: number }).minorUnits = 0;
  }, TypeError);
  assert.equal(ledger.overdraftFees[0]?.assessedDay, 1);
});

test("exposed fee history cannot mutate internal fee history", () => {
  const ledger = aedLedger("-1.00");
  ledger.assessOverdraftFees(ACCOUNT_ID, 1);
  const exposed = ledger.overdraftFees as OverdraftFeeAssessment[];

  exposed.length = 0;

  assert.equal(ledger.overdraftFees.length, 1);
  assert.equal(ledger.entries.length, 1);
});

test("once-per-account/day uniqueness prevents duplicate fees", () => {
  const ledger = aedLedger("-1.00");

  ledger.assessOverdraftFees(ACCOUNT_ID, 1);
  ledger.assessOverdraftFees(ACCOUNT_ID, 1);

  assert.equal(ledger.overdraftFees.length, 1);
  assert.equal(ledger.entries.length, 1);
});

test("the same day is assessed independently for different AED accounts", () => {
  const ledger = new Ledger([
    {
      id: "first-account",
      currency: "AED",
      openingBalance: Money.parse("AED", "-1.00"),
    },
    {
      id: "second-account",
      currency: "AED",
      openingBalance: Money.parse("AED", "-2.00"),
    },
  ]);

  ledger.assessOverdraftFees("first-account", 1);
  ledger.assessOverdraftFees("second-account", 1);

  assert.deepEqual(
    ledger.overdraftFees.map((fee) => [fee.accountId, fee.assessedDay]),
    [
      ["first-account", 1],
      ["second-account", 1],
    ],
  );
});

test("repeated canonical assessment appends no duplicate fee debits", () => {
  const ledger = canonicalLedgerThroughE7();

  ledger.assessOverdraftFees(ACCOUNT_ID, 5);
  const postingCount = ledger.entries.length;
  ledger.assessOverdraftFees(ACCOUNT_ID, 5);

  assert.equal(ledger.overdraftFees.length, 3);
  assert.equal(ledger.entries.length, postingCount);
});

test("the Day 2 fee changes canonical Day 2 through Day 5 closes", () => {
  const ledger = canonicalLedgerThroughE7();

  ledger.assessOverdraftFees(ACCOUNT_ID, 2);

  assert.deepEqual(
    [2, 3, 4, 5].map((day) =>
      ledger.balanceAtValueDate(ACCOUNT_ID, day).format(),
    ),
    ["-395.00", "5.00", "-180.00", "-180.00"],
  );
});

test("chronological canonical assessment does not generate a Day 3 fee", () => {
  const ledger = canonicalLedgerThroughE7();

  ledger.assessOverdraftFees(ACCOUNT_ID, 5);

  assert.equal(
    ledger.overdraftFees.some((fee) => fee.assessedDay === 3),
    false,
  );
});

test("canonical E7 assessment generates the Day 2 fee", () => {
  const ledger = canonicalLedgerThroughE7();

  ledger.assessOverdraftFees(ACCOUNT_ID, 5);

  assert.equal(
    ledger.overdraftFees.some((fee) => fee.assessedDay === 2),
    true,
  );
});

test("canonical E7 assessment generates the Day 4 fee", () => {
  const ledger = canonicalLedgerThroughE7();

  ledger.assessOverdraftFees(ACCOUNT_ID, 5);

  assert.equal(
    ledger.overdraftFees.some((fee) => fee.assessedDay === 4),
    true,
  );
});

test("canonical E7 assessment generates the Day 5 fee", () => {
  const ledger = canonicalLedgerThroughE7();

  ledger.assessOverdraftFees(ACCOUNT_ID, 5);

  assert.equal(
    ledger.overdraftFees.some((fee) => fee.assessedDay === 5),
    true,
  );
});

test("canonical E7 fees total AED 75.00", () => {
  const ledger = canonicalLedgerThroughE7();

  ledger.assessOverdraftFees(ACCOUNT_ID, 5);
  const total = ledger.overdraftFees.reduce(
    (sum, fee) => sum.add(fee.amount),
    Money.parse("AED", "0.00"),
  );

  assert.equal(total.format(), "75.00");
});

test("canonical post-fee Day 1 through Day 5 balances are exact", () => {
  const ledger = canonicalLedgerThroughE7();

  ledger.assessOverdraftFees(ACCOUNT_ID, 5);

  assert.deepEqual(
    [1, 2, 3, 4, 5].map((day) =>
      ledger.balanceAtValueDate(ACCOUNT_ID, day).format(),
    ),
    ["250.00", "-395.00", "5.00", "-205.00", "-230.00"],
  );
});

test("a later historical credit does not delete an existing fee", () => {
  const ledger = aedLedger("-10.00");
  ledger.assessOverdraftFees(ACCOUNT_ID, 1);

  ledger.postCredit({
    eventId: "later-backdated-credit",
    accountId: ACCOUNT_ID,
    amount: Money.parse("AED", "100.00"),
    bookedDay: 5,
    valueDate: 1,
  });
  ledger.assessOverdraftFees(ACCOUNT_ID, 1);

  assert.equal(ledger.balanceAtValueDate(ACCOUNT_ID, 1).format(), "65.00");
  assert.equal(ledger.overdraftFees.length, 1);
  assert.equal(ledger.entries.length, 2);
});

test("a generated fee naturally reduces current ledger balance", () => {
  const ledger = aedLedger("-10.00");

  ledger.assessOverdraftFees(ACCOUNT_ID, 1);

  assert.equal(ledger.currentBalance(ACCOUNT_ID).format(), "-35.00");
});

test("fee record and linked debit occupy adjacent global sequences", () => {
  const ledger = aedLedger();
  const source = ledger.postDebit({
    eventId: "source-debit",
    accountId: ACCOUNT_ID,
    amount: Money.parse("AED", "1.00"),
    bookedDay: 1,
    valueDate: 1,
  });

  const [fee] = ledger.assessOverdraftFees(ACCOUNT_ID, 1);
  const feeDebit = ledger.entries.find(
    (entry) => entry.sequence === fee?.ledgerEntrySequence,
  );

  assert.equal(source.sequence, 1);
  assert.equal(fee?.sequence, 2);
  assert.equal(fee?.ledgerEntrySequence, 3);
  assert.equal(feeDebit?.sequence, 3);
});

test("generated fee identity is distinct from source event identity", () => {
  const ledger = aedLedger();
  ledger.postDebit({
    eventId: "E7",
    accountId: ACCOUNT_ID,
    amount: Money.parse("AED", "1.00"),
    bookedDay: 5,
    valueDate: 1,
  });

  const [fee] = ledger.assessOverdraftFees(ACCOUNT_ID, 1);
  const feeDebit = ledger.entries.find(
    (entry) => entry.sequence === fee?.ledgerEntrySequence,
  );

  assert.equal(fee?.feeId, "FEE:ACC-001:D1");
  assert.equal(feeDebit?.eventId, fee?.feeId);
  assert.notEqual(feeDebit?.eventId, "E7");
});

test("a positive BHD account produces no fee", () => {
  const ledger = new Ledger([
    {
      id: "ACC-002",
      currency: "BHD",
      openingBalance: Money.parse("BHD", "10.000"),
    },
  ]);

  ledger.assessOverdraftFees("ACC-002", 5);

  assert.equal(ledger.overdraftFees.length, 0);
  assert.equal(ledger.entries.length, 0);
});

test("a negative non-AED fee requirement fails without conversion", () => {
  const ledger = new Ledger([
    {
      id: "ACC-002",
      currency: "BHD",
      openingBalance: Money.parse("BHD", "-0.001"),
    },
  ]);

  assert.throws(
    () => ledger.assessOverdraftFees("ACC-002", 1),
    /Overdraft fees are unsupported for currency BHD/,
  );
  assert.equal(ledger.overdraftFees.length, 0);
  assert.equal(ledger.entries.length, 0);
});

test("rejects an invalid through day", () => {
  const ledger = aedLedger();

  for (const throughDay of [0, -1, 1.5, Number.NaN]) {
    assert.throws(
      () => ledger.assessOverdraftFees(ACCOUNT_ID, throughDay),
      /throughDay must be a positive integer/,
    );
  }
});

test("rejects fee assessment for an unknown account", () => {
  const ledger = aedLedger();

  assert.throws(
    () => ledger.assessOverdraftFees("missing", 1),
    /Unknown account/,
  );
});
