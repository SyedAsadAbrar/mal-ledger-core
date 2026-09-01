import assert from "node:assert/strict";
import test from "node:test";

import { Ledger } from "../src/ledger.js";
import { allocateInstallments, Money } from "../src/money.js";

const ACCOUNT_ID = "ACC-002";

function bhdLedger(): Ledger {
  return new Ledger([
    {
      id: ACCOUNT_ID,
      currency: "BHD",
      openingBalance: Money.parse("BHD", "0.000"),
    },
  ]);
}

function postE10(ledger: Ledger) {
  return ledger.postCreditInstallments({
    eventId: "E10",
    accountId: ACCOUNT_ID,
    totalAmount: Money.parse("BHD", "10.000"),
    installmentCount: 3,
    bookedDay: 5,
    valueDate: 5,
  });
}

test("BHD 10.000 divides into 3.333, 3.333, and 3.334", () => {
  const installments = allocateInstallments(
    Money.parse("BHD", "10.000"),
    3,
  );

  assert.deepEqual(
    installments.map((installment) => installment.format()),
    ["3.333", "3.333", "3.334"],
  );
});

test("allocated instalments sum exactly to BHD 10.000", () => {
  const installments = allocateInstallments(
    Money.parse("BHD", "10.000"),
    3,
  );
  const total = installments.reduce(
    (sum, installment) => sum.add(installment),
    Money.parse("BHD", "0.000"),
  );

  assert.equal(total.minorUnits, 10_000);
  assert.equal(total.format(), "10.000");
});

test("allocation does not use three BHD 3.334 values", () => {
  const installments = allocateInstallments(
    Money.parse("BHD", "10.000"),
    3,
  );

  assert.notDeepEqual(
    installments.map((installment) => installment.format()),
    ["3.334", "3.334", "3.334"],
  );
  assert.notEqual(
    installments.reduce(
      (sum, installment) => sum + installment.minorUnits,
      0,
    ),
    10_002,
  );
});

test("the final instalment receives the one-minor-unit residual", () => {
  const installments = allocateInstallments(
    Money.parse("BHD", "10.000"),
    3,
  );

  assert.deepEqual(
    installments.map((installment) => installment.minorUnits),
    [3_333, 3_333, 3_334],
  );
  const first = installments[0];
  const final = installments[2];

  assert.ok(first);
  assert.ok(final);
  assert.equal(final.minorUnits - first.minorUnits, 1);
});

test("an E10-like source event creates exactly three CREDIT entries", () => {
  const ledger = bhdLedger();

  const entries = postE10(ledger);

  assert.equal(entries.length, 3);
  assert.equal(ledger.entries.length, 3);
  assert.deepEqual(
    entries.map((entry) => entry.type),
    ["CREDIT", "CREDIT", "CREDIT"],
  );
  assert.deepEqual(
    entries.map((entry) => entry.sequence),
    [1, 2, 3],
  );
});

test("all E10 child credits use booked Day 5 and value Day 5", () => {
  const ledger = bhdLedger();

  const entries = postE10(ledger);

  assert.deepEqual(
    entries.map((entry) => [entry.bookedDay, entry.valueDate]),
    [
      [5, 5],
      [5, 5],
      [5, 5],
    ],
  );
});

test("the three E10 postings have an exact BHD 10.000 ledger effect", () => {
  const ledger = bhdLedger();

  postE10(ledger);

  assert.deepEqual(
    ledger.entries.map((entry) => entry.amount.format()),
    ["3.333", "3.333", "3.334"],
  );
  assert.equal(ledger.currentBalance(ACCOUNT_ID).format(), "10.000");
});

test("E10 affects historical balances from value Day 5 onward", () => {
  const ledger = bhdLedger();

  postE10(ledger);

  assert.deepEqual(
    [1, 2, 3, 4, 5, 6].map((day) =>
      ledger.balanceAtValueDate(ACCOUNT_ID, day).format(),
    ),
    ["0.000", "0.000", "0.000", "0.000", "10.000", "10.000"],
  );
});

test("deterministic child identities preserve the E10 source relationship", () => {
  const ledger = bhdLedger();

  const entries = postE10(ledger);

  assert.deepEqual(
    entries.map((entry) => entry.eventId),
    [
      "E10:INSTALLMENT:1",
      "E10:INSTALLMENT:2",
      "E10:INSTALLMENT:3",
    ],
  );
  assert.equal(new Set(entries.map((entry) => entry.eventId)).size, 3);
});

test("allocation rejects invalid counts and non-positive totals", () => {
  const positive = Money.parse("BHD", "10.000");

  for (const count of [0, -1, 1.5, Number.NaN]) {
    assert.throws(
      () => allocateInstallments(positive, count),
      /installment count/,
    );
  }

  assert.throws(
    () => allocateInstallments(Money.parse("BHD", "0.000"), 3),
    /installment total must be positive/,
  );
  assert.throws(
    () => allocateInstallments(Money.parse("BHD", "-1.000"), 3),
    /installment total must be positive/,
  );
  assert.throws(
    () => allocateInstallments(Money.parse("BHD", "0.002"), 3),
    /must not exceed total minor units/,
  );
});
