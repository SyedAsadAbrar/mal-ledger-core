import assert from "node:assert/strict";
import test from "node:test";

import { Ledger, type LedgerEntry } from "../src/ledger.js";
import { Money } from "../src/money.js";

test("creates an AED account with a zero opening balance", () => {
  const ledger = new Ledger([
    {
      id: "aed-account",
      currency: "AED",
      openingBalance: Money.parse("AED", "0.00"),
    },
  ]);

  assert.equal(ledger.currentBalance("aed-account").format(), "0.00");
});

test("creates a BHD account with a zero opening balance", () => {
  const ledger = new Ledger([
    {
      id: "bhd-account",
      currency: "BHD",
      openingBalance: Money.parse("BHD", "0.000"),
    },
  ]);

  assert.equal(ledger.currentBalance("bhd-account").format(), "0.000");
});

test("includes the opening balance in the current ledger balance", () => {
  const ledger = new Ledger([
    {
      id: "aed-account",
      currency: "AED",
      openingBalance: Money.parse("AED", "45.00"),
    },
  ]);

  assert.equal(ledger.currentBalance("aed-account").format(), "45.00");
});

test("CREDIT increases the current ledger balance", () => {
  const ledger = new Ledger([
    {
      id: "aed-account",
      currency: "AED",
      openingBalance: Money.parse("AED", "0.00"),
    },
  ]);

  ledger.postCredit({
    eventId: "credit-1",
    accountId: "aed-account",
    amount: Money.parse("AED", "1200.00"),
    bookedDay: 1,
    valueDate: 1,
  });

  assert.equal(ledger.currentBalance("aed-account").format(), "1200.00");
});

test("DEBIT decreases the current ledger balance", () => {
  const ledger = new Ledger([
    {
      id: "aed-account",
      currency: "AED",
      openingBalance: Money.parse("AED", "1200.00"),
    },
  ]);

  ledger.postDebit({
    eventId: "debit-1",
    accountId: "aed-account",
    amount: Money.parse("AED", "950.00"),
    bookedDay: 1,
    valueDate: 1,
  });

  assert.equal(ledger.currentBalance("aed-account").format(), "250.00");
});

test("AED 1200 credit followed by AED 950 debit leaves AED 250", () => {
  const ledger = new Ledger([
    {
      id: "aed-account",
      currency: "AED",
      openingBalance: Money.parse("AED", "0.00"),
    },
  ]);

  ledger.postCredit({
    eventId: "credit-1",
    accountId: "aed-account",
    amount: Money.parse("AED", "1200.00"),
    bookedDay: 1,
    valueDate: 1,
  });
  ledger.postDebit({
    eventId: "debit-1",
    accountId: "aed-account",
    amount: Money.parse("AED", "950.00"),
    bookedDay: 1,
    valueDate: 1,
  });

  assert.equal(ledger.currentBalance("aed-account").format(), "250.00");
});

test("BHD postings retain three-decimal exactness", () => {
  const ledger = new Ledger([
    {
      id: "bhd-account",
      currency: "BHD",
      openingBalance: Money.parse("BHD", "0.000"),
    },
  ]);

  ledger.postCredit({
    eventId: "credit-1",
    accountId: "bhd-account",
    amount: Money.parse("BHD", "3.333"),
    bookedDay: 1,
    valueDate: 1,
  });
  ledger.postCredit({
    eventId: "credit-2",
    accountId: "bhd-account",
    amount: Money.parse("BHD", "0.001"),
    bookedDay: 1,
    valueDate: 1,
  });

  assert.equal(ledger.currentBalance("bhd-account").minorUnits, 3_334);
  assert.equal(ledger.currentBalance("bhd-account").format(), "3.334");
});

test("rejects a posting whose currency differs from the account", () => {
  const ledger = new Ledger([
    {
      id: "aed-account",
      currency: "AED",
      openingBalance: Money.parse("AED", "0.00"),
    },
  ]);

  assert.throws(
    () =>
      ledger.postCredit({
        eventId: "credit-1",
        accountId: "aed-account",
        amount: Money.parse("BHD", "1.000"),
        bookedDay: 1,
        valueDate: 1,
      }),
    /Posting currency must match account currency/,
  );
});

test("ledger history preserves append order", () => {
  const ledger = new Ledger([
    {
      id: "aed-account",
      currency: "AED",
      openingBalance: Money.parse("AED", "0.00"),
    },
  ]);

  ledger.postCredit({
    eventId: "first",
    accountId: "aed-account",
    amount: Money.parse("AED", "10.00"),
    bookedDay: 2,
    valueDate: 2,
  });
  ledger.postDebit({
    eventId: "second",
    accountId: "aed-account",
    amount: Money.parse("AED", "3.00"),
    bookedDay: 1,
    valueDate: 1,
  });

  assert.deepEqual(
    ledger.entries.map((entry) => entry.eventId),
    ["first", "second"],
  );
});

test("sequence follows append order rather than booked day", () => {
  const ledger = new Ledger([
    {
      id: "aed-account",
      currency: "AED",
      openingBalance: Money.parse("AED", "0.00"),
    },
  ]);

  const first = ledger.postCredit({
    eventId: "later-day-first",
    accountId: "aed-account",
    amount: Money.parse("AED", "10.00"),
    bookedDay: 5,
    valueDate: 5,
  });
  const second = ledger.postDebit({
    eventId: "earlier-day-second",
    accountId: "aed-account",
    amount: Money.parse("AED", "1.00"),
    bookedDay: 2,
    valueDate: 2,
  });

  assert.equal(first.sequence, 1);
  assert.equal(second.sequence, 2);
});

test("an earlier entry remains unchanged after later postings", () => {
  const ledger = new Ledger([
    {
      id: "aed-account",
      currency: "AED",
      openingBalance: Money.parse("AED", "0.00"),
    },
  ]);
  const first = ledger.postCredit({
    eventId: "first",
    accountId: "aed-account",
    amount: Money.parse("AED", "10.00"),
    bookedDay: 1,
    valueDate: 1,
  });

  ledger.postDebit({
    eventId: "second",
    accountId: "aed-account",
    amount: Money.parse("AED", "2.00"),
    bookedDay: 2,
    valueDate: 2,
  });

  assert.equal(first.eventId, "first");
  assert.equal(first.type, "CREDIT");
  assert.equal(first.amount.format(), "10.00");
  assert.equal(first.sequence, 1);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.amount), true);
});

test("exposed history cannot mutate the ledger's internal history", () => {
  const ledger = new Ledger([
    {
      id: "aed-account",
      currency: "AED",
      openingBalance: Money.parse("AED", "0.00"),
    },
  ]);
  const entry = ledger.postCredit({
    eventId: "credit-1",
    accountId: "aed-account",
    amount: Money.parse("AED", "10.00"),
    bookedDay: 1,
    valueDate: 1,
  });
  const exposed = ledger.entries as LedgerEntry[];

  exposed.length = 0;
  assert.equal(ledger.entries.length, 1);

  assert.throws(() => {
    (entry as unknown as { sequence: number }).sequence = 99;
  }, TypeError);
  assert.throws(() => {
    (entry.amount as unknown as { minorUnits: number }).minorUnits = 0;
  }, TypeError);

  assert.equal(ledger.entries[0]?.sequence, 1);
  assert.equal(ledger.currentBalance("aed-account").format(), "10.00");
});

test("rejects zero and negative posting magnitudes", () => {
  const ledger = new Ledger([
    {
      id: "aed-account",
      currency: "AED",
      openingBalance: Money.parse("AED", "0.00"),
    },
  ]);

  assert.throws(
    () =>
      ledger.postCredit({
        eventId: "zero",
        accountId: "aed-account",
        amount: Money.parse("AED", "0.00"),
        bookedDay: 1,
        valueDate: 1,
      }),
    /positive magnitude/,
  );
  assert.throws(
    () =>
      ledger.postDebit({
        eventId: "negative",
        accountId: "aed-account",
        amount: Money.parse("AED", "-1.00"),
        bookedDay: 1,
        valueDate: 1,
      }),
    /positive magnitude/,
  );
});

test("distinct accounts maintain independent balances", () => {
  const ledger = new Ledger([
    {
      id: "first-account",
      currency: "AED",
      openingBalance: Money.parse("AED", "5.00"),
    },
    {
      id: "second-account",
      currency: "AED",
      openingBalance: Money.parse("AED", "20.00"),
    },
  ]);

  ledger.postCredit({
    eventId: "first-credit",
    accountId: "first-account",
    amount: Money.parse("AED", "10.00"),
    bookedDay: 1,
    valueDate: 1,
  });
  ledger.postDebit({
    eventId: "second-debit",
    accountId: "second-account",
    amount: Money.parse("AED", "3.00"),
    bookedDay: 1,
    valueDate: 1,
  });

  assert.equal(ledger.currentBalance("first-account").format(), "15.00");
  assert.equal(ledger.currentBalance("second-account").format(), "17.00");
});
