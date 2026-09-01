import assert from "node:assert/strict";
import test from "node:test";

import {
  Ledger,
  type InterestCapitalization,
} from "../src/ledger.js";
import { Money } from "../src/money.js";

const AED_ACCOUNT_ID = "ACC-001";
const BHD_ACCOUNT_ID = "ACC-002";

function aedLedger(openingBalance = "0.00"): Ledger {
  return new Ledger([
    {
      id: AED_ACCOUNT_ID,
      currency: "AED",
      openingBalance: Money.parse("AED", openingBalance),
    },
  ]);
}

function canonicalLedgerAfterE9(): Ledger {
  const ledger = aedLedger();
  ledger.postCredit({
    eventId: "E1",
    accountId: AED_ACCOUNT_ID,
    amount: Money.parse("AED", "1200.00"),
    bookedDay: 1,
    valueDate: 1,
  });
  ledger.postDebit({
    eventId: "E2",
    accountId: AED_ACCOUNT_ID,
    amount: Money.parse("AED", "950.00"),
    bookedDay: 1,
    valueDate: 1,
  });
  ledger.authorize({
    eventId: "E3",
    authorizationId: "Auth-A",
    accountId: AED_ACCOUNT_ID,
    holdAmount: Money.parse("AED", "200.00"),
    bookedDay: 2,
    valueDate: 2,
  });
  ledger.postCredit({
    eventId: "E4",
    accountId: AED_ACCOUNT_ID,
    amount: Money.parse("AED", "400.00"),
    bookedDay: 3,
    valueDate: 3,
  });
  ledger.settle({
    eventId: "E5",
    authorizationId: "Auth-A",
    accountId: AED_ACCOUNT_ID,
    amount: Money.parse("AED", "185.00"),
    bookedDay: 4,
    valueDate: 4,
  });
  ledger.settle({
    eventId: "E6",
    authorizationId: "Auth-Z",
    accountId: AED_ACCOUNT_ID,
    amount: Money.parse("AED", "180.00"),
    bookedDay: 4,
    valueDate: 4,
  });
  ledger.postDebit({
    eventId: "E7",
    accountId: AED_ACCOUNT_ID,
    amount: Money.parse("AED", "620.00"),
    bookedDay: 5,
    valueDate: 2,
  });
  ledger.assessOverdraftFees(AED_ACCOUNT_ID, 5);
  ledger.authorize({
    eventId: "E8",
    authorizationId: "Auth-B",
    accountId: AED_ACCOUNT_ID,
    holdAmount: Money.parse("AED", "90.00"),
    bookedDay: 5,
    valueDate: 5,
  });
  ledger.reverse({
    eventId: "E9",
    targetEventId: "E7",
    accountId: AED_ACCOUNT_ID,
    bookedDay: 6,
    valueDate: 2,
  });
  return ledger;
}

function bhdLedgerWithDay5Credit(): Ledger {
  const ledger = new Ledger([
    {
      id: BHD_ACCOUNT_ID,
      currency: "BHD",
      openingBalance: Money.parse("BHD", "0.000"),
    },
  ]);
  ledger.postCredit({
    eventId: "BHD-D5-CREDIT",
    accountId: BHD_ACCOUNT_ID,
    amount: Money.parse("BHD", "10.000"),
    bookedDay: 5,
    valueDate: 5,
  });
  return ledger;
}

test("a positive AED closing earns exact daily interest", () => {
  const ledger = aedLedger("250.00");

  const capitalization = ledger.capitalizeInterest(AED_ACCOUNT_ID);

  assert.deepEqual(
    capitalization.dailyAccruals.map((accrual) => accrual.amount.format()),
    ["0.10", "0.10", "0.10", "0.10", "0.10", "0.10"],
  );
  assert.equal(capitalization.totalAmount.format(), "0.60");
});

test("a zero closing earns zero while a later positive closing earns interest", () => {
  const ledger = aedLedger();
  ledger.postCredit({
    eventId: "day-2-credit",
    accountId: AED_ACCOUNT_ID,
    amount: Money.parse("AED", "250.00"),
    bookedDay: 2,
    valueDate: 2,
  });

  const capitalization = ledger.capitalizeInterest(AED_ACCOUNT_ID);

  assert.equal(capitalization.dailyAccruals[0]?.closingBalance.format(), "0.00");
  assert.equal(capitalization.dailyAccruals[0]?.amount.format(), "0.00");
  assert.equal(capitalization.dailyAccruals[1]?.amount.format(), "0.10");
});

test("a negative closing earns zero while a later positive closing earns interest", () => {
  const ledger = aedLedger("-10.00");
  ledger.postCredit({
    eventId: "day-2-credit",
    accountId: AED_ACCOUNT_ID,
    amount: Money.parse("AED", "260.00"),
    bookedDay: 2,
    valueDate: 2,
  });

  const capitalization = ledger.capitalizeInterest(AED_ACCOUNT_ID);

  assert.equal(capitalization.dailyAccruals[0]?.closingBalance.format(), "-10.00");
  assert.equal(capitalization.dailyAccruals[0]?.amount.format(), "0.00");
  assert.equal(capitalization.dailyAccruals[1]?.closingBalance.format(), "250.00");
  assert.equal(capitalization.dailyAccruals[1]?.amount.format(), "0.10");
});

test("daily interest uses exact round-half-up arithmetic", () => {
  const ledger = aedLedger("415.00");

  const capitalization = ledger.capitalizeInterest(AED_ACCOUNT_ID);

  assert.equal(capitalization.dailyAccruals[0]?.amount.format(), "0.17");
});

test("canonical AED daily bases and individually rounded accruals are exact", () => {
  const ledger = canonicalLedgerAfterE9();

  const capitalization = ledger.capitalizeInterest(AED_ACCOUNT_ID);

  assert.deepEqual(
    capitalization.dailyAccruals.map((accrual) => ({
      day: accrual.day,
      basis: accrual.closingBalance.format(),
      interest: accrual.amount.format(),
    })),
    [
      { day: 1, basis: "250.00", interest: "0.10" },
      { day: 2, basis: "225.00", interest: "0.09" },
      { day: 3, basis: "625.00", interest: "0.25" },
      { day: 4, basis: "415.00", interest: "0.17" },
      { day: 5, basis: "390.00", interest: "0.16" },
      { day: 6, basis: "390.00", interest: "0.16" },
    ],
  );
});

test("capitalization total is the exact sum of rounded daily accruals", () => {
  const ledger = canonicalLedgerAfterE9();

  const capitalization = ledger.capitalizeInterest(AED_ACCOUNT_ID);
  const summedDailyAccruals = capitalization.dailyAccruals.reduce(
    (total, accrual) => total.add(accrual.amount),
    Money.parse("AED", "0.00"),
  );

  assert.equal(capitalization.totalAmount.format(), "0.93");
  assert.equal(
    capitalization.totalAmount.minorUnits,
    summedDailyAccruals.minorUnits,
  );
});

test("capitalization appends exactly one linked end-of-Day-6 credit", () => {
  const ledger = canonicalLedgerAfterE9();
  const entryCountBefore = ledger.entries.length;

  const capitalization = ledger.capitalizeInterest(AED_ACCOUNT_ID);
  const appendedEntries = ledger.entries.slice(entryCountBefore);
  const credit = appendedEntries[0];

  assert.equal(appendedEntries.length, 1);
  assert.equal(capitalization.capitalizationId, "INTEREST:ACC-001:D6");
  assert.equal(capitalization.ledgerEntrySequence, capitalization.sequence + 1);
  assert.equal(credit?.sequence, capitalization.ledgerEntrySequence);
  assert.equal(credit?.eventId, capitalization.capitalizationId);
  assert.equal(credit?.type, "CREDIT");
  assert.equal(credit?.amount.format(), "0.93");
  assert.equal(credit?.bookedDay, 6);
  assert.equal(credit?.valueDate, 6);
});

test("canonical AED final balance is AED 390.93", () => {
  const ledger = canonicalLedgerAfterE9();

  ledger.capitalizeInterest(AED_ACCOUNT_ID);

  assert.equal(ledger.currentBalance(AED_ACCOUNT_ID).format(), "390.93");
});

test("Day 6 basis is stored before capitalization and does not self-accrue", () => {
  const ledger = canonicalLedgerAfterE9();

  const capitalization = ledger.capitalizeInterest(AED_ACCOUNT_ID);

  assert.equal(capitalization.dailyAccruals[5]?.closingBalance.format(), "390.00");
  assert.equal(capitalization.dailyAccruals[5]?.amount.format(), "0.16");
  assert.equal(
    ledger.balanceAtValueDate(AED_ACCOUNT_ID, 6).format(),
    "390.93",
  );
  assert.equal(
    ledger
      .balanceAtValueDate(AED_ACCOUNT_ID, 6, capitalization.asOfSequence)
      .format(),
    "390.00",
  );
});

test("all daily bases use the same causal snapshot", () => {
  const ledger = canonicalLedgerAfterE9();

  const capitalization = ledger.capitalizeInterest(AED_ACCOUNT_ID);

  for (const accrual of capitalization.dailyAccruals) {
    assert.equal(
      accrual.closingBalance.format(),
      ledger
        .balanceAtValueDate(
          AED_ACCOUNT_ID,
          accrual.day,
          capitalization.asOfSequence,
        )
        .format(),
    );
  }
  assert.ok(capitalization.asOfSequence < capitalization.sequence);
});

test("BHD Day 5 and Day 6 each accrue BHD 0.004", () => {
  const ledger = bhdLedgerWithDay5Credit();

  const capitalization = ledger.capitalizeInterest(BHD_ACCOUNT_ID);

  assert.deepEqual(
    capitalization.dailyAccruals.map((accrual) => accrual.amount.format()),
    ["0.000", "0.000", "0.000", "0.000", "0.004", "0.004"],
  );
});

test("BHD capitalization is exactly BHD 0.008", () => {
  const ledger = bhdLedgerWithDay5Credit();

  const capitalization = ledger.capitalizeInterest(BHD_ACCOUNT_ID);

  assert.equal(capitalization.totalAmount.format(), "0.008");
  assert.equal(ledger.currentBalance(BHD_ACCOUNT_ID).format(), "10.008");
});

test("authorization holds do not reduce the interest basis", () => {
  const ledger = aedLedger("250.00");
  ledger.authorize({
    eventId: "authorization",
    authorizationId: "hold",
    accountId: AED_ACCOUNT_ID,
    holdAmount: Money.parse("AED", "200.00"),
    bookedDay: 1,
    valueDate: 1,
  });

  assert.equal(ledger.availableBalance(AED_ACCOUNT_ID).format(), "50.00");
  const capitalization = ledger.capitalizeInterest(AED_ACCOUNT_ID);

  assert.equal(capitalization.dailyAccruals[0]?.closingBalance.format(), "250.00");
  assert.equal(capitalization.dailyAccruals[0]?.amount.format(), "0.10");
});

test("duplicate capitalization for the same account and window is rejected", () => {
  const ledger = aedLedger("250.00");
  ledger.capitalizeInterest(AED_ACCOUNT_ID);
  const entryCount = ledger.entries.length;

  assert.throws(
    () => ledger.capitalizeInterest(AED_ACCOUNT_ID),
    /Interest already capitalized/,
  );
  assert.equal(ledger.interestCapitalizations.length, 1);
  assert.equal(ledger.entries.length, entryCount);
});

test("a zero-total window is rejected without an audit record or posting", () => {
  const ledger = aedLedger();

  assert.throws(
    () => ledger.capitalizeInterest(AED_ACCOUNT_ID),
    /No positive interest to capitalize/,
  );
  assert.equal(ledger.interestCapitalizations.length, 0);
  assert.equal(ledger.entries.length, 0);
});

test("interest records, nested accruals, money, and exposed history are immutable", () => {
  const ledger = aedLedger("250.00");
  const capitalization = ledger.capitalizeInterest(AED_ACCOUNT_ID);
  const exposed = ledger.interestCapitalizations as InterestCapitalization[];

  exposed.length = 0;
  assert.equal(ledger.interestCapitalizations.length, 1);
  assert.equal(Object.isFrozen(capitalization), true);
  assert.equal(Object.isFrozen(capitalization.dailyAccruals), true);
  assert.equal(Object.isFrozen(capitalization.dailyAccruals[0]), true);
  assert.equal(Object.isFrozen(capitalization.dailyAccruals[0]?.closingBalance), true);
  assert.equal(Object.isFrozen(capitalization.dailyAccruals[0]?.amount), true);
  assert.equal(Object.isFrozen(capitalization.totalAmount), true);
  assert.throws(() => {
    (capitalization.dailyAccruals as unknown as unknown[]).push({});
  }, TypeError);
  assert.throws(() => {
    (capitalization.totalAmount as unknown as { minorUnits: number }).minorUnits = 0;
  }, TypeError);
});
