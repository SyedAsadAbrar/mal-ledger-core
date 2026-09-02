import assert from "node:assert/strict";
import test from "node:test";

import {
  Ledger,
  type AuthorizationRecord,
} from "../src/ledger.js";
import { Money } from "../src/money.js";

function aedLedger(openingBalance: string): Ledger {
  return new Ledger([
    {
      id: "aed-account",
      currency: "AED",
      openingBalance: Money.parse("AED", openingBalance),
    },
  ]);
}

function authorizeAed(
  ledger: Ledger,
  authorizationId: string,
  amount: string,
) {
  return ledger.authorize({
    eventId: `${authorizationId}-event`,
    authorizationId,
    accountId: "aed-account",
    holdAmount: Money.parse("AED", amount),
    bookedDay: 1,
    valueDate: 1,
  });
}

test("an authorization hold does not change ledger balance", () => {
  const ledger = aedLedger("250.00");

  authorizeAed(ledger, "Auth-1", "200.00");

  assert.equal(ledger.currentBalance("aed-account").format(), "250.00");
  assert.equal(ledger.entries.length, 0);
});

test("an approved hold reduces available balance", () => {
  const ledger = aedLedger("250.00");

  const authorization = authorizeAed(ledger, "Auth-1", "100.00");

  assert.equal(authorization.status, "APPROVED");
  assert.equal(ledger.availableBalance("aed-account").format(), "150.00");
});

test("approves an Auth-A-like AED 200 hold against AED 250", () => {
  const ledger = aedLedger("0.00");
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

  const authorization = ledger.authorize({
    eventId: "E3",
    authorizationId: "Auth-A",
    accountId: "aed-account",
    holdAmount: Money.parse("AED", "200.00"),
    bookedDay: 2,
    valueDate: 2,
  });

  assert.equal(authorization.status, "APPROVED");
  assert.equal(ledger.currentBalance("aed-account").format(), "250.00");
});

test("available balance after the Auth-A-like hold is AED 50", () => {
  const ledger = aedLedger("250.00");

  authorizeAed(ledger, "Auth-A", "200.00");

  assert.equal(ledger.availableBalance("aed-account").format(), "50.00");
});

test("declines a hold that would make available balance negative", () => {
  const ledger = aedLedger("50.00");

  const authorization = authorizeAed(ledger, "Auth-1", "60.00");

  assert.equal(authorization.status, "DECLINED");
  assert.equal(ledger.availableBalance("aed-account").format(), "50.00");
});

test("approves a hold that leaves available balance exactly zero", () => {
  const ledger = aedLedger("50.00");

  const authorization = authorizeAed(ledger, "Auth-1", "50.00");

  assert.equal(authorization.status, "APPROVED");
  assert.equal(ledger.availableBalance("aed-account").format(), "0.00");
});

test("a declined authorization creates no active hold", () => {
  const ledger = aedLedger("50.00");

  const authorization = authorizeAed(ledger, "Auth-1", "60.00");

  assert.equal(authorization.status, "DECLINED");
  assert.equal(ledger.authorizations.length, 1);
  assert.equal(ledger.activeHolds("aed-account").length, 0);
});

test("multiple approved holds are included in available balance", () => {
  const ledger = aedLedger("250.00");

  const first = authorizeAed(ledger, "Auth-1", "100.00");
  const second = authorizeAed(ledger, "Auth-2", "120.00");

  assert.equal(first.status, "APPROVED");
  assert.equal(second.status, "APPROVED");
  assert.equal(ledger.activeHolds("aed-account").length, 2);
  assert.equal(ledger.availableBalance("aed-account").format(), "30.00");
});

test("a later declined hold does not reduce available balance", () => {
  const ledger = aedLedger("250.00");
  authorizeAed(ledger, "Auth-1", "100.00");
  authorizeAed(ledger, "Auth-2", "120.00");

  const declined = authorizeAed(ledger, "Auth-3", "40.00");

  assert.equal(declined.status, "DECLINED");
  assert.equal(ledger.activeHolds("aed-account").length, 2);
  assert.equal(ledger.availableBalance("aed-account").format(), "30.00");
});

test("BHD authorization preserves exact three-decimal amounts", () => {
  const ledger = new Ledger([
    {
      id: "bhd-account",
      currency: "BHD",
      openingBalance: Money.parse("BHD", "10.000"),
    },
  ]);

  const authorization = ledger.authorize({
    eventId: "bhd-authorization-event",
    authorizationId: "Auth-1",
    accountId: "bhd-account",
    holdAmount: Money.parse("BHD", "3.334"),
    bookedDay: 1,
    valueDate: 1,
  });

  assert.equal(authorization.status, "APPROVED");
  assert.equal(authorization.holdAmount.minorUnits, 3_334);
  assert.equal(ledger.availableBalance("bhd-account").format(), "6.666");
});

test("rejects a cross-currency authorization hold", () => {
  const ledger = aedLedger("250.00");

  assert.throws(
    () =>
      ledger.authorize({
        eventId: "authorization-event",
        authorizationId: "Auth-1",
        accountId: "aed-account",
        holdAmount: Money.parse("BHD", "1.000"),
        bookedDay: 1,
        valueDate: 1,
      }),
    /Hold currency must match account currency/,
  );
});

test("rejects a zero authorization hold", () => {
  const ledger = aedLedger("250.00");

  assert.throws(
    () => authorizeAed(ledger, "Auth-1", "0.00"),
    /positive magnitude/,
  );
});

test("rejects a negative authorization hold", () => {
  const ledger = aedLedger("250.00");

  assert.throws(
    () => authorizeAed(ledger, "Auth-1", "-1.00"),
    /positive magnitude/,
  );
});

test("rejects authorization against an unknown account", () => {
  const ledger = new Ledger();

  assert.throws(
    () =>
      ledger.authorize({
        eventId: "authorization-event",
        authorizationId: "Auth-1",
        accountId: "missing-account",
        holdAmount: Money.parse("AED", "1.00"),
        bookedDay: 1,
        valueDate: 1,
      }),
    /Unknown account/,
  );
});

test("authorization history is append-only and immutable", () => {
  const ledger = aedLedger("250.00");
  const first = authorizeAed(ledger, "Auth-1", "100.00");
  authorizeAed(ledger, "Auth-2", "200.00");
  const exposed = ledger.authorizations as AuthorizationRecord[];

  exposed.length = 0;
  assert.equal(ledger.authorizations.length, 2);
  assert.deepEqual(
    ledger.authorizations.map((authorization) => authorization.authorizationId),
    ["Auth-1", "Auth-2"],
  );

  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.holdAmount), true);
  assert.throws(() => {
    (first as unknown as { status: string }).status = "DECLINED";
  }, TypeError);
  assert.throws(() => {
    (first.holdAmount as unknown as { minorUnits: number }).minorUnits = 0;
  }, TypeError);
  assert.equal(ledger.authorizations[0]?.status, "APPROVED");
});

test("rejects reuse of an authorization ID", () => {
  const ledger = aedLedger("0.00");
  const first = authorizeAed(ledger, "Auth-1", "1.00");

  assert.equal(first.status, "DECLINED");
  assert.throws(
    () => authorizeAed(ledger, "Auth-1", "1.00"),
    /Authorization already exists/,
  );
  assert.equal(ledger.authorizations.length, 1);
});

test("postings and authorizations share one causal sequence", () => {
  const ledger = aedLedger("0.00");
  const credit = ledger.postCredit({
    eventId: "credit-1",
    accountId: "aed-account",
    amount: Money.parse("AED", "1200.00"),
    bookedDay: 1,
    valueDate: 1,
  });
  const debit = ledger.postDebit({
    eventId: "debit-1",
    accountId: "aed-account",
    amount: Money.parse("AED", "950.00"),
    bookedDay: 1,
    valueDate: 1,
  });
  const authorization = ledger.authorize({
    eventId: "E3",
    authorizationId: "Auth-A",
    accountId: "aed-account",
    holdAmount: Money.parse("AED", "200.00"),
    bookedDay: 2,
    valueDate: 2,
  });
  const laterCredit = ledger.postCredit({
    eventId: "credit-2",
    accountId: "aed-account",
    amount: Money.parse("AED", "400.00"),
    bookedDay: 3,
    valueDate: 3,
  });

  assert.equal(credit.sequence, 1);
  assert.equal(debit.sequence, 2);
  assert.equal(authorization.sequence, 3);
  assert.equal(laterCredit.sequence, 4);
});

test("later postings do not recalculate a historical decision", () => {
  const ledger = aedLedger("100.00");
  const authorization = authorizeAed(ledger, "Auth-1", "100.00");

  ledger.postDebit({
    eventId: "later-debit",
    accountId: "aed-account",
    amount: Money.parse("AED", "10.00"),
    bookedDay: 2,
    valueDate: 1,
  });

  assert.equal(authorization.status, "APPROVED");
  assert.equal(ledger.authorizations[0]?.status, "APPROVED");
  assert.equal(ledger.availableBalance("aed-account").format(), "-10.00");
});
