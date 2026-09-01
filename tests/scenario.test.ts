import assert from "node:assert/strict";
import test from "node:test";

import {
  formatReplayReport,
  runAssessmentScenario,
} from "../src/scenario.js";

test("source events are processed in exact E1 through E10 order", () => {
  const report = runAssessmentScenario();

  assert.deepEqual(report.audit.sourceEventIds, [
    "E1",
    "E2",
    "E3",
    "E4",
    "E5",
    "E6",
    "E7",
    "E8",
    "E9",
    "E10",
  ]);
  assert.ok(
    report.audit.sourceEventIds.indexOf("E10") >
      report.audit.sourceEventIds.indexOf("E9"),
  );
});

test("E6 is the only error and creates no financial posting", () => {
  const report = runAssessmentScenario();
  const errors = report.days.flatMap((day) => day.errors);

  assert.deepEqual(errors, [
    {
      eventId: "E6",
      code: "UNKNOWN_AUTHORIZATION",
      authorizationId: "Auth-Z",
    },
  ]);
  assert.equal(report.days[3]?.errors.length, 1);
  assert.equal(report.audit.postingEventIds.includes("E6"), false);
});

test("fee assessments are retained exactly on Days 2, 4, and 5", () => {
  const report = runAssessmentScenario();

  assert.deepEqual(
    report.days
      .filter((day) => day.fees.length > 0)
      .map((day) => day.day),
    [2, 4, 5],
  );
  assert.deepEqual(
    report.days.flatMap((day) =>
      day.fees.map((fee) => `${day.day}:${fee.amount.format()}`),
    ),
    ["2:25.00", "4:25.00", "5:25.00"],
  );
});

test("authorization output preserves Auth-A lifecycle and Auth-B decline", () => {
  const report = runAssessmentScenario();

  assert.deepEqual(
    report.days.map((day) =>
      day.authorizations.map(
        (authorization) =>
          `${authorization.authorizationId}:${authorization.state}`,
      ),
    ),
    [
      [],
      ["Auth-A:APPROVED"],
      ["Auth-A:APPROVED"],
      ["Auth-A:SETTLED"],
      ["Auth-A:SETTLED", "Auth-B:DECLINED"],
      ["Auth-A:SETTLED", "Auth-B:DECLINED"],
    ],
  );
});

test("E7 intermediate and post-E9 pre-interest AED oracles remain distinct", () => {
  const report = runAssessmentScenario();
  const acc001PreInterest = report.audit.preInterestBalances.find(
    (balance) => balance.accountId === "ACC-001",
  );

  assert.equal(report.audit.e7Day2BalanceBeforeFees.format(), "-370.00");
  assert.equal(acc001PreInterest?.amount.format(), "390.00");
  assert.equal(
    report.audit.postingEventIds.filter((eventId) =>
      eventId.startsWith("FEE:ACC-001:"),
    ).length,
    3,
  );
});

test("E10 creates the exact three BHD instalments", () => {
  const report = runAssessmentScenario();

  assert.deepEqual(
    report.audit.e10Installments.map((installment) => installment.format()),
    ["3.333", "3.333", "3.334"],
  );
  assert.deepEqual(
    report.audit.postingEventIds.filter((eventId) =>
      eventId.startsWith("E10:INSTALLMENT:"),
    ),
    [
      "E10:INSTALLMENT:1",
      "E10:INSTALLMENT:2",
      "E10:INSTALLMENT:3",
    ],
  );
});

test("interest capitalizes to AED 0.93 and BHD 0.008 after E10", () => {
  const report = runAssessmentScenario();

  assert.deepEqual(
    report.interestCapitalizations.map((capitalization) => [
      capitalization.accountId,
      capitalization.totalAmount.format(),
    ]),
    [
      ["ACC-001", "0.93"],
      ["ACC-002", "0.008"],
    ],
  );
  assert.ok(
    report.audit.postingEventIds.indexOf("INTEREST:ACC-002:D6") >
      report.audit.postingEventIds.indexOf("E10:INSTALLMENT:3"),
  );
});

test("final Day 1 through Day 6 ledger balances match the oracle", () => {
  const report = runAssessmentScenario();

  assert.deepEqual(
    report.days.map((day) => ({
      day: day.day,
      balances: day.balances.map(
        (balance) =>
          `${balance.accountId}:${balance.amount.currency}:${balance.amount.format()}`,
      ),
    })),
    [
      { day: 1, balances: ["ACC-001:AED:250.00", "ACC-002:BHD:0.000"] },
      { day: 2, balances: ["ACC-001:AED:225.00", "ACC-002:BHD:0.000"] },
      { day: 3, balances: ["ACC-001:AED:625.00", "ACC-002:BHD:0.000"] },
      { day: 4, balances: ["ACC-001:AED:415.00", "ACC-002:BHD:0.000"] },
      { day: 5, balances: ["ACC-001:AED:390.00", "ACC-002:BHD:10.000"] },
      { day: 6, balances: ["ACC-001:AED:390.93", "ACC-002:BHD:10.008"] },
    ],
  );
});

test("derived postings appear exactly once with no fee refund", () => {
  const report = runAssessmentScenario();

  assert.deepEqual(report.audit.postingEventIds, [
    "E1",
    "E2",
    "E4",
    "E5",
    "E7",
    "FEE:ACC-001:D2",
    "FEE:ACC-001:D4",
    "FEE:ACC-001:D5",
    "E9",
    "E10:INSTALLMENT:1",
    "E10:INSTALLMENT:2",
    "E10:INSTALLMENT:3",
    "INTEREST:ACC-001:D6",
    "INTEREST:ACC-002:D6",
  ]);
  assert.equal(
    report.audit.postingEventIds.some((eventId) =>
      eventId.includes("REFUND"),
    ),
    false,
  );
});

test("formatted output shows all four required sections for every day", () => {
  const output = formatReplayReport(runAssessmentScenario());

  for (let day = 1; day <= 6; day += 1) {
    assert.match(output, new RegExp(`Day ${day}\\n`));
  }

  assert.equal(output.split("  Balances:").length - 1, 6);
  assert.equal(output.split("  Fees:").length - 1, 6);
  assert.equal(output.split("  Fees: none").length - 1, 3);
  assert.equal(output.split("  Authorizations:").length - 1, 6);
  assert.equal(output.split("  Authorizations: none").length - 1, 1);
  assert.equal(output.split("  Errors:").length - 1, 6);
  assert.equal(output.split("  Errors: none").length - 1, 5);
  assert.match(output, /E6: UNKNOWN_AUTHORIZATION for Auth-Z/);
  assert.match(output, /Interest capitalizations:\n  ACC-001: AED 0\.93\n  ACC-002: BHD 0\.008/);
});
