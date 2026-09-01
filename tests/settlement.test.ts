import assert from "node:assert/strict";
import test from "node:test";

import {
  Ledger,
  type SettlementRecord,
} from "../src/ledger.js";
import { Money } from "../src/money.js";

function aedLedger(openingBalance = "650.00"): Ledger {
  return new Ledger([
    {
      id: "ACC-001",
      currency: "AED",
      openingBalance: Money.parse("AED", openingBalance),
    },
  ]);
}

function approveAuthA(ledger: Ledger, holdAmount = "200.00") {
  return ledger.authorize({
    eventId: "E3",
    authorizationId: "Auth-A",
    accountId: "ACC-001",
    holdAmount: Money.parse("AED", holdAmount),
    bookedDay: 2,
    valueDate: 2,
  });
}

function settleAuthA(
  ledger: Ledger,
  amount = "185.00",
  eventId = "E5",
) {
  return ledger.settle({
    eventId,
    authorizationId: "Auth-A",
    accountId: "ACC-001",
    amount: Money.parse("AED", amount),
    bookedDay: 4,
    valueDate: 4,
  });
}

function e5ReadyLedger() {
  const ledger = aedLedger();
  const authorization = approveAuthA(ledger);
  return { ledger, authorization };
}

test("accepts a valid settlement against an active approved authorization", () => {
  const { ledger } = e5ReadyLedger();

  const settlement = settleAuthA(ledger);

  assert.equal(settlement.result, "ACCEPTED");
  assert.equal(settlement.rejectionReason, null);
});

test("an accepted settlement appends a DEBIT financial posting", () => {
  const { ledger } = e5ReadyLedger();

  const settlement = settleAuthA(ledger);
  const entry = ledger.entries[0];

  assert.equal(ledger.entries.length, 1);
  assert.equal(entry?.type, "DEBIT");
  assert.equal(entry?.amount.format(), "185.00");
  assert.equal(entry?.sequence, settlement.ledgerEntrySequence);
});

test("settlement leaves the original authorization record unchanged", () => {
  const { ledger, authorization } = e5ReadyLedger();

  settleAuthA(ledger);

  assert.equal(authorization.eventId, "E3");
  assert.equal(authorization.authorizationId, "Auth-A");
  assert.equal(authorization.status, "APPROVED");
  assert.equal(authorization.holdAmount.format(), "200.00");
  assert.equal(Object.isFrozen(authorization), true);
});

test("an accepted settlement derives SETTLED authorization state", () => {
  const { ledger } = e5ReadyLedger();

  settleAuthA(ledger);

  assert.equal(ledger.authorizationState("Auth-A"), "SETTLED");
  assert.equal(ledger.authorizations[0]?.status, "APPROVED");
});

test("accepts an E5-like AED 185 settlement against an AED 200 hold", () => {
  const { ledger } = e5ReadyLedger();

  const settlement = settleAuthA(ledger, "185.00");

  assert.equal(settlement.result, "ACCEPTED");
  assert.equal(settlement.amount.format(), "185.00");
});

test("E5-like settlement leaves ledger balance at AED 465", () => {
  const { ledger } = e5ReadyLedger();

  settleAuthA(ledger);

  assert.equal(ledger.currentBalance("ACC-001").format(), "465.00");
});

test("unused AED 15 of the hold creates no financial posting", () => {
  const { ledger } = e5ReadyLedger();

  settleAuthA(ledger);

  assert.equal(ledger.entries.length, 1);
  assert.deepEqual(
    ledger.entries.map((entry) => entry.amount.format()),
    ["185.00"],
  );
});

test("accepted settlement releases the entire original hold", () => {
  const { ledger } = e5ReadyLedger();

  settleAuthA(ledger);

  assert.equal(ledger.activeHolds("ACC-001").length, 0);
});

test("available balance after E5-like settlement is AED 465", () => {
  const { ledger } = e5ReadyLedger();

  settleAuthA(ledger);

  assert.equal(ledger.availableBalance("ACC-001").format(), "465.00");
});

test("accepts settlement exactly equal to the hold", () => {
  const { ledger } = e5ReadyLedger();

  const settlement = settleAuthA(ledger, "200.00");

  assert.equal(settlement.result, "ACCEPTED");
  assert.equal(ledger.currentBalance("ACC-001").format(), "450.00");
  assert.equal(ledger.activeHolds("ACC-001").length, 0);
});

test("rejects settlement greater than the approved hold", () => {
  const { ledger } = e5ReadyLedger();

  const settlement = settleAuthA(ledger, "201.00");

  assert.equal(settlement.result, "REJECTED");
  assert.equal(settlement.rejectionReason, "AMOUNT_EXCEEDS_HOLD");
  assert.equal(ledger.entries.length, 0);
});

test("rejected over-capture leaves the original hold active", () => {
  const { ledger } = e5ReadyLedger();

  settleAuthA(ledger, "201.00");

  assert.equal(ledger.authorizationState("Auth-A"), "APPROVED");
  assert.equal(ledger.activeHolds("ACC-001").length, 1);
  assert.equal(ledger.availableBalance("ACC-001").format(), "450.00");
});

test("rejects an Auth-Z-like unknown authorization settlement", () => {
  const ledger = aedLedger();

  const settlement = ledger.settle({
    eventId: "E6",
    authorizationId: "Auth-Z",
    accountId: "ACC-001",
    amount: Money.parse("AED", "180.00"),
    bookedDay: 4,
    valueDate: 4,
  });

  assert.equal(settlement.result, "REJECTED");
  assert.equal(settlement.rejectionReason, "UNKNOWN_AUTHORIZATION");
});

test("unknown authorization rejection creates no debit or authorization state", () => {
  const ledger = aedLedger();

  ledger.settle({
    eventId: "E6",
    authorizationId: "Auth-Z",
    accountId: "ACC-001",
    amount: Money.parse("AED", "180.00"),
    bookedDay: 4,
    valueDate: 4,
  });

  assert.equal(ledger.entries.length, 0);
  assert.equal(ledger.authorizations.length, 0);
  assert.equal(ledger.authorizationState("Auth-Z"), undefined);
  assert.equal(ledger.currentBalance("ACC-001").format(), "650.00");
});

test("a declined authorization cannot settle", () => {
  const ledger = aedLedger("50.00");
  const authorization = approveAuthA(ledger, "60.00");

  const settlement = settleAuthA(ledger, "10.00");

  assert.equal(authorization.status, "DECLINED");
  assert.equal(settlement.result, "REJECTED");
  assert.equal(settlement.rejectionReason, "AUTHORIZATION_DECLINED");
  assert.equal(ledger.authorizationState("Auth-A"), "DECLINED");
  assert.equal(ledger.entries.length, 0);
});

test("an already-settled authorization cannot settle again", () => {
  const { ledger } = e5ReadyLedger();
  settleAuthA(ledger, "185.00", "E5");

  const second = settleAuthA(ledger, "10.00", "second-settlement");

  assert.equal(second.result, "REJECTED");
  assert.equal(second.rejectionReason, "ALREADY_SETTLED");
  assert.equal(ledger.authorizationState("Auth-A"), "SETTLED");
});

test("a second settlement creates no second debit", () => {
  const { ledger } = e5ReadyLedger();
  settleAuthA(ledger, "185.00", "E5");

  settleAuthA(ledger, "10.00", "second-settlement");

  assert.equal(ledger.entries.length, 1);
  assert.equal(ledger.currentBalance("ACC-001").format(), "465.00");
});

test("rejects a zero settlement amount", () => {
  const { ledger } = e5ReadyLedger();

  const settlement = settleAuthA(ledger, "0.00");

  assert.equal(settlement.result, "REJECTED");
  assert.equal(settlement.rejectionReason, "INVALID_AMOUNT");
  assert.equal(ledger.entries.length, 0);
});

test("rejects a negative settlement amount", () => {
  const { ledger } = e5ReadyLedger();

  const settlement = settleAuthA(ledger, "-1.00");

  assert.equal(settlement.result, "REJECTED");
  assert.equal(settlement.rejectionReason, "INVALID_AMOUNT");
  assert.equal(ledger.entries.length, 0);
});

test("rejects a cross-currency settlement", () => {
  const { ledger } = e5ReadyLedger();

  const settlement = ledger.settle({
    eventId: "E5",
    authorizationId: "Auth-A",
    accountId: "ACC-001",
    amount: Money.parse("BHD", "0.185"),
    bookedDay: 4,
    valueDate: 4,
  });

  assert.equal(settlement.result, "REJECTED");
  assert.equal(settlement.rejectionReason, "CURRENCY_MISMATCH");
  assert.equal(ledger.entries.length, 0);
});

test("rejects settlement account mismatch", () => {
  const ledger = new Ledger([
    {
      id: "ACC-001",
      currency: "AED",
      openingBalance: Money.parse("AED", "650.00"),
    },
    {
      id: "ACC-002",
      currency: "AED",
      openingBalance: Money.parse("AED", "650.00"),
    },
  ]);
  approveAuthA(ledger);

  const settlement = ledger.settle({
    eventId: "E5",
    authorizationId: "Auth-A",
    accountId: "ACC-002",
    amount: Money.parse("AED", "185.00"),
    bookedDay: 4,
    valueDate: 4,
  });

  assert.equal(settlement.result, "REJECTED");
  assert.equal(settlement.rejectionReason, "ACCOUNT_MISMATCH");
  assert.equal(ledger.entries.length, 0);
  assert.equal(ledger.activeHolds("ACC-001").length, 1);
});

test("rejected settlement attempts remain inspectable", () => {
  const ledger = aedLedger();

  const rejected = ledger.settle({
    eventId: "E6",
    authorizationId: "Auth-Z",
    accountId: "ACC-001",
    amount: Money.parse("AED", "180.00"),
    bookedDay: 4,
    valueDate: 4,
  });

  assert.equal(ledger.settlements.length, 1);
  assert.equal(ledger.settlements[0], rejected);
  assert.equal(ledger.settlements[0]?.eventId, "E6");
  assert.equal(
    ledger.settlements[0]?.rejectionReason,
    "UNKNOWN_AUTHORIZATION",
  );
});

test("settlement records and amounts are immutable", () => {
  const { ledger } = e5ReadyLedger();
  const settlement = settleAuthA(ledger);

  assert.equal(Object.isFrozen(settlement), true);
  assert.equal(Object.isFrozen(settlement.amount), true);
  assert.throws(() => {
    (settlement as unknown as { result: string }).result = "REJECTED";
  }, TypeError);
  assert.throws(() => {
    (settlement.amount as unknown as { minorUnits: number }).minorUnits = 0;
  }, TypeError);
  assert.equal(ledger.settlements[0]?.result, "ACCEPTED");
});

test("exposed settlement history cannot mutate internal state", () => {
  const { ledger } = e5ReadyLedger();
  settleAuthA(ledger);
  const exposed = ledger.settlements as SettlementRecord[];

  exposed.length = 0;

  assert.equal(ledger.settlements.length, 1);
  assert.equal(ledger.authorizationState("Auth-A"), "SETTLED");
  assert.equal(ledger.entries.length, 1);
});

test("causal sequence spans postings, authorizations, and settlements", () => {
  const ledger = aedLedger("0.00");
  const e1 = ledger.postCredit({
    eventId: "E1",
    accountId: "ACC-001",
    amount: Money.parse("AED", "1200.00"),
    bookedDay: 1,
    valueDate: 1,
  });
  const e2 = ledger.postDebit({
    eventId: "E2",
    accountId: "ACC-001",
    amount: Money.parse("AED", "950.00"),
    bookedDay: 1,
    valueDate: 1,
  });
  const e3 = approveAuthA(ledger);
  const e4 = ledger.postCredit({
    eventId: "E4",
    accountId: "ACC-001",
    amount: Money.parse("AED", "400.00"),
    bookedDay: 3,
    valueDate: 3,
  });
  const e5 = settleAuthA(ledger);
  const e5Debit = ledger.entries.find((entry) => entry.eventId === "E5");
  const e6 = ledger.settle({
    eventId: "E6",
    authorizationId: "Auth-Z",
    accountId: "ACC-001",
    amount: Money.parse("AED", "180.00"),
    bookedDay: 4,
    valueDate: 4,
  });

  assert.deepEqual(
    [
      e1.sequence,
      e2.sequence,
      e3.sequence,
      e4.sequence,
      e5.sequence,
      e5Debit?.sequence,
      e6.sequence,
    ],
    [1, 2, 3, 4, 5, 6, 7],
  );
  assert.equal(e5.ledgerEntrySequence, e5Debit?.sequence);
});

test("source event ID remains distinct from authorization ID", () => {
  const { ledger, authorization } = e5ReadyLedger();

  const settlement = settleAuthA(ledger);
  const debit = ledger.entries[0];

  assert.equal(authorization.eventId, "E3");
  assert.equal(authorization.authorizationId, "Auth-A");
  assert.notEqual(authorization.eventId, authorization.authorizationId);
  assert.equal(settlement.eventId, "E5");
  assert.equal(settlement.authorizationId, "Auth-A");
  assert.equal(debit?.eventId, "E5");
  assert.equal(debit?.sequence, settlement.ledgerEntrySequence);
});
