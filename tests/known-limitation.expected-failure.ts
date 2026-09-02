import assert from "node:assert/strict";
import test from "node:test";

import { Ledger, type PostingInput } from "../src/ledger.js";
import { Money } from "../src/money.js";

// INTENTIONAL EXPECTED FAILURE
//
// This test documents A-09: generic external event-ID deduplication is
// deliberately not implemented. The supplied E1-E10 stream has no duplicate
// source events, so this behavior is outside the canonical assessment replay.
// A production ingestion contract should reject or idempotently ignore a
// duplicate delivery instead of applying it twice.
//
// Do not include this file in the normal green test suite.
test("duplicate external event delivery should not apply money twice", () => {
  const ledger = new Ledger([
    {
      id: "AED-ACCOUNT",
      currency: "AED",
      openingBalance: Money.parse("AED", "0.00"),
    },
  ]);
  const duplicateEvent: PostingInput = {
    eventId: "DUP-1",
    accountId: "AED-ACCOUNT",
    amount: Money.parse("AED", "100.00"),
    bookedDay: 1,
    valueDate: 1,
  };

  ledger.postCredit(duplicateEvent);
  ledger.postCredit(duplicateEvent);

  assert.equal(ledger.currentBalance("AED-ACCOUNT").format(), "100.00");
});
