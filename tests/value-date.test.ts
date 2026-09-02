import assert from "node:assert/strict";
import test from "node:test";

import { Ledger } from "../src/ledger.js";
import { Money } from "../src/money.js";

const ACCOUNT_ID = "ACC-001";

function createLedger(openingBalance = "0.00"): Ledger {
  return new Ledger([
    {
      id: ACCOUNT_ID,
      currency: "AED",
      openingBalance: Money.parse("AED", openingBalance),
    },
  ]);
}

function postCanonicalThroughE5(ledger: Ledger): void {
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
}

function postE7(ledger: Ledger) {
  return ledger.postDebit({
    eventId: "E7",
    accountId: ACCOUNT_ID,
    amount: Money.parse("AED", "620.00"),
    bookedDay: 5,
    valueDate: 2,
  });
}

test("includes the opening balance in a value-date projection", () => {
  const ledger = createLedger("45.00");

  assert.equal(ledger.balanceAtValueDate(ACCOUNT_ID, 1).format(), "45.00");
});

test("sequence cutoff zero returns the opening balance only", () => {
  const ledger = createLedger("45.00");
  ledger.postCredit({
    eventId: "credit",
    accountId: ACCOUNT_ID,
    amount: Money.parse("AED", "10.00"),
    bookedDay: 1,
    valueDate: 1,
  });

  assert.equal(
    ledger.balanceAtValueDate(ACCOUNT_ID, 1, 0).format(),
    "45.00",
  );
});

test("canonical Day 1 closing before E7 is AED 250.00", () => {
  const ledger = createLedger();
  postCanonicalThroughE5(ledger);

  assert.equal(ledger.balanceAtValueDate(ACCOUNT_ID, 1).format(), "250.00");
});

test("canonical Day 2 closing before E7 is AED 250.00", () => {
  const ledger = createLedger();
  postCanonicalThroughE5(ledger);

  assert.equal(ledger.balanceAtValueDate(ACCOUNT_ID, 2).format(), "250.00");
});

test("canonical Day 3 closing before E7 is AED 650.00", () => {
  const ledger = createLedger();
  postCanonicalThroughE5(ledger);

  assert.equal(ledger.balanceAtValueDate(ACCOUNT_ID, 3).format(), "650.00");
});

test("canonical Day 4 closing before E7 is AED 465.00", () => {
  const ledger = createLedger();
  postCanonicalThroughE5(ledger);

  assert.equal(ledger.balanceAtValueDate(ACCOUNT_ID, 4).format(), "465.00");
});

test("canonical Day 5 closing before E7 is AED 465.00", () => {
  const ledger = createLedger();
  postCanonicalThroughE5(ledger);

  assert.equal(ledger.balanceAtValueDate(ACCOUNT_ID, 5).format(), "465.00");
});

test("E7 restates canonical Day 1 through Day 5 pre-fee closings", () => {
  const ledger = createLedger();
  postCanonicalThroughE5(ledger);
  postE7(ledger);

  assert.deepEqual(
    [1, 2, 3, 4, 5].map((day) =>
      ledger.balanceAtValueDate(ACCOUNT_ID, day).format(),
    ),
    ["250.00", "-370.00", "30.00", "-155.00", "-155.00"],
  );
});

test("Day 2 at the sequence immediately before E7 remains AED 250.00", () => {
  const ledger = createLedger();
  postCanonicalThroughE5(ledger);
  const e7 = postE7(ledger);

  assert.equal(
    ledger.balanceAtValueDate(ACCOUNT_ID, 2, e7.sequence - 1).format(),
    "250.00",
  );
});

test("Day 2 at E7's sequence is AED -370.00", () => {
  const ledger = createLedger();
  postCanonicalThroughE5(ledger);
  const e7 = postE7(ledger);

  assert.equal(
    ledger.balanceAtValueDate(ACCOUNT_ID, 2, e7.sequence).format(),
    "-370.00",
  );
});

test("an omitted sequence cutoff includes everything currently known", () => {
  const ledger = createLedger();
  postCanonicalThroughE5(ledger);
  postE7(ledger);

  assert.equal(
    ledger.balanceAtValueDate(ACCOUNT_ID, 2).format(),
    "-370.00",
  );
});

test("an earlier causal cutoff remains stable after E7 is appended", () => {
  const ledger = createLedger();
  postCanonicalThroughE5(ledger);
  const beforeE7 = ledger.entries.at(-1)?.sequence;
  postE7(ledger);

  assert.equal(beforeE7, 6);
  assert.equal(
    ledger.balanceAtValueDate(ACCOUNT_ID, 2, beforeE7).format(),
    "250.00",
  );
});

test("current balance still includes every processed financial posting", () => {
  const ledger = createLedger();
  postCanonicalThroughE5(ledger);
  postE7(ledger);

  assert.equal(ledger.currentBalance(ACCOUNT_ID).format(), "-155.00");
  assert.equal(ledger.balanceAtValueDate(ACCOUNT_ID, 1).format(), "250.00");
});

test("booked day does not control value-date inclusion", () => {
  const ledger = createLedger();
  ledger.postDebit({
    eventId: "backdated",
    accountId: ACCOUNT_ID,
    amount: Money.parse("AED", "10.00"),
    bookedDay: 5,
    valueDate: 2,
  });

  assert.equal(ledger.balanceAtValueDate(ACCOUNT_ID, 2).format(), "-10.00");
});

test("postings after the requested value date are excluded", () => {
  const ledger = createLedger();
  ledger.postCredit({
    eventId: "future-value",
    accountId: ACCOUNT_ID,
    amount: Money.parse("AED", "10.00"),
    bookedDay: 1,
    valueDate: 4,
  });

  assert.equal(ledger.balanceAtValueDate(ACCOUNT_ID, 3).format(), "0.00");
  assert.equal(ledger.balanceAtValueDate(ACCOUNT_ID, 4).format(), "10.00");
});

test("append order need not match value-date order", () => {
  const ledger = createLedger();
  ledger.postCredit({
    eventId: "later-value-first",
    accountId: ACCOUNT_ID,
    amount: Money.parse("AED", "100.00"),
    bookedDay: 1,
    valueDate: 5,
  });
  ledger.postDebit({
    eventId: "earlier-value-second",
    accountId: ACCOUNT_ID,
    amount: Money.parse("AED", "20.00"),
    bookedDay: 5,
    valueDate: 2,
  });

  assert.equal(ledger.balanceAtValueDate(ACCOUNT_ID, 2).format(), "-20.00");
});

test("rejects an unknown account", () => {
  const ledger = createLedger();

  assert.throws(
    () => ledger.balanceAtValueDate("missing", 1),
    /Unknown account/,
  );
});

test("rejects invalid value dates", () => {
  const ledger = createLedger();

  for (const valueDate of [0, -1, 1.5, Number.NaN]) {
    assert.throws(
      () => ledger.balanceAtValueDate(ACCOUNT_ID, valueDate),
      /valueDate must be a positive integer/,
    );
  }
});

test("rejects invalid causal sequence cutoffs", () => {
  const ledger = createLedger();

  for (const cutoff of [-1, 1.5, Number.NaN]) {
    assert.throws(
      () => ledger.balanceAtValueDate(ACCOUNT_ID, 1, cutoff),
      /asOfSequence must be a non-negative safe integer/,
    );
  }
});

test("projection does not mutate immutable posting history", () => {
  const ledger = createLedger();
  const entry = ledger.postCredit({
    eventId: "credit",
    accountId: ACCOUNT_ID,
    amount: Money.parse("AED", "10.00"),
    bookedDay: 3,
    valueDate: 2,
  });

  ledger.balanceAtValueDate(ACCOUNT_ID, 2);

  assert.equal(ledger.entries[0], entry);
  assert.equal(entry.sequence, 1);
  assert.equal(entry.valueDate, 2);
  assert.equal(Object.isFrozen(entry), true);
});

test("backdated postings do not rewrite authorization decisions or state", () => {
  const ledger = createLedger();
  postCanonicalThroughE5(ledger);

  assert.equal(ledger.authorizations[0]?.status, "APPROVED");
  assert.equal(ledger.authorizationState("Auth-A"), "SETTLED");

  postE7(ledger);

  assert.equal(ledger.authorizations[0]?.status, "APPROVED");
  assert.equal(ledger.authorizationState("Auth-A"), "SETTLED");
});
