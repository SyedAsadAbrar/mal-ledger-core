import {
  type AuthorizationCurrentState,
  type InterestCapitalization,
  Ledger,
  type SettlementRejectionReason,
} from "./ledger.js";
import { Money } from "./money.js";

const AED_ACCOUNT_ID = "ACC-001";
const BHD_ACCOUNT_ID = "ACC-002";
const FIRST_DAY = 1;
const LAST_DAY = 6;

export interface ReplayBalance {
  readonly accountId: string;
  readonly amount: Money;
}

export interface ReplayFee {
  readonly accountId: string;
  readonly amount: Money;
}

export interface ReplayAuthorization {
  readonly authorizationId: string;
  readonly state: AuthorizationCurrentState;
}

export interface ReplayError {
  readonly eventId: string;
  readonly code: SettlementRejectionReason;
  readonly authorizationId: string;
}

export interface ReplayDay {
  readonly day: number;
  readonly balances: readonly ReplayBalance[];
  readonly fees: readonly ReplayFee[];
  readonly authorizations: readonly ReplayAuthorization[];
  readonly errors: readonly ReplayError[];
}

export interface ReplayAudit {
  readonly sourceEventIds: readonly string[];
  readonly postingEventIds: readonly string[];
  readonly e7Day2BalanceBeforeFees: Money;
  readonly preInterestBalances: readonly ReplayBalance[];
  readonly e10Installments: readonly Money[];
}

export interface ReplayReport {
  readonly days: readonly ReplayDay[];
  readonly interestCapitalizations: readonly InterestCapitalization[];
  readonly audit: ReplayAudit;
}

function authorizationStatesForDay(
  day: number,
  authAApproved: AuthorizationCurrentState,
  authASettled: AuthorizationCurrentState,
  authBDeclined: AuthorizationCurrentState,
): readonly ReplayAuthorization[] {
  // These are end-of-day operational states for the fixed assessment window.
  // Later value-dated financial restatement does not rewrite them.
  if (day === 1) {
    return [];
  }

  if (day <= 3) {
    return [{ authorizationId: "Auth-A", state: authAApproved }];
  }

  if (day === 4) {
    return [{ authorizationId: "Auth-A", state: authASettled }];
  }

  return [
    { authorizationId: "Auth-A", state: authASettled },
    { authorizationId: "Auth-B", state: authBDeclined },
  ];
}

export function runAssessmentScenario(): ReplayReport {
  const ledger = new Ledger([
    {
      id: AED_ACCOUNT_ID,
      currency: "AED",
      openingBalance: Money.parse("AED", "0.00"),
    },
    {
      id: BHD_ACCOUNT_ID,
      currency: "BHD",
      openingBalance: Money.parse("BHD", "0.000"),
    },
  ]);
  const sourceEventIds: string[] = [];

  function processSourceEvent<T>(eventId: string, action: () => T): T {
    sourceEventIds.push(eventId);
    return action();
  }

  processSourceEvent("E1", () =>
    ledger.postCredit({
      eventId: "E1",
      accountId: AED_ACCOUNT_ID,
      amount: Money.parse("AED", "1200.00"),
      bookedDay: 1,
      valueDate: 1,
    }),
  );

  processSourceEvent("E2", () =>
    ledger.postDebit({
      eventId: "E2",
      accountId: AED_ACCOUNT_ID,
      amount: Money.parse("AED", "950.00"),
      bookedDay: 1,
      valueDate: 1,
    }),
  );

  const authA = processSourceEvent("E3", () =>
    ledger.authorize({
      eventId: "E3",
      authorizationId: "Auth-A",
      accountId: AED_ACCOUNT_ID,
      holdAmount: Money.parse("AED", "200.00"),
      bookedDay: 2,
      valueDate: 2,
    }),
  );

  processSourceEvent("E4", () =>
    ledger.postCredit({
      eventId: "E4",
      accountId: AED_ACCOUNT_ID,
      amount: Money.parse("AED", "400.00"),
      bookedDay: 3,
      valueDate: 3,
    }),
  );

  processSourceEvent("E5", () =>
    ledger.settle({
      eventId: "E5",
      authorizationId: "Auth-A",
      accountId: AED_ACCOUNT_ID,
      amount: Money.parse("AED", "185.00"),
      bookedDay: 4,
      valueDate: 4,
    }),
  );
  const authAAfterE5 = ledger.authorizationState("Auth-A");

  const e6 = processSourceEvent("E6", () =>
    ledger.settle({
      eventId: "E6",
      authorizationId: "Auth-Z",
      accountId: AED_ACCOUNT_ID,
      amount: Money.parse("AED", "180.00"),
      bookedDay: 4,
      valueDate: 4,
    }),
  );

  processSourceEvent("E7", () =>
    ledger.postDebit({
      eventId: "E7",
      accountId: AED_ACCOUNT_ID,
      amount: Money.parse("AED", "620.00"),
      bookedDay: 5,
      valueDate: 2,
    }),
  );
  const e7Day2BalanceBeforeFees = ledger.balanceAtValueDate(
    AED_ACCOUNT_ID,
    2,
  );
  ledger.assessOverdraftFees(AED_ACCOUNT_ID, 5);

  const authB = processSourceEvent("E8", () =>
    ledger.authorize({
      eventId: "E8",
      authorizationId: "Auth-B",
      accountId: AED_ACCOUNT_ID,
      holdAmount: Money.parse("AED", "90.00"),
      bookedDay: 5,
      valueDate: 5,
    }),
  );

  processSourceEvent("E9", () =>
    ledger.reverse({
      eventId: "E9",
      targetEventId: "E7",
      accountId: AED_ACCOUNT_ID,
      bookedDay: 6,
      valueDate: 2,
    }),
  );

  const e10Entries = processSourceEvent("E10", () =>
    ledger.postCreditInstallments({
      eventId: "E10",
      accountId: BHD_ACCOUNT_ID,
      totalAmount: Money.parse("BHD", "10.000"),
      installmentCount: 3,
      bookedDay: 5,
      valueDate: 5,
    }),
  );

  const preInterestBalances: readonly ReplayBalance[] = [
    {
      accountId: AED_ACCOUNT_ID,
      amount: ledger.currentBalance(AED_ACCOUNT_ID),
    },
    {
      accountId: BHD_ACCOUNT_ID,
      amount: ledger.currentBalance(BHD_ACCOUNT_ID),
    },
  ];

  const interestCapitalizations = [
    ledger.capitalizeInterest(AED_ACCOUNT_ID),
    ledger.capitalizeInterest(BHD_ACCOUNT_ID),
  ];

  if (authAAfterE5 === undefined) {
    throw new Error("Auth-A state is missing after E5");
  }

  const replayErrors: readonly ReplayError[] =
    e6.rejectionReason === null
      ? []
      : [
          {
            eventId: e6.eventId,
            code: e6.rejectionReason,
            authorizationId: e6.authorizationId,
          },
        ];
  const days: ReplayDay[] = [];

  for (let day = FIRST_DAY; day <= LAST_DAY; day += 1) {
    days.push({
      day,
      balances: [
        {
          accountId: AED_ACCOUNT_ID,
          amount: ledger.balanceAtValueDate(AED_ACCOUNT_ID, day),
        },
        {
          accountId: BHD_ACCOUNT_ID,
          amount: ledger.balanceAtValueDate(BHD_ACCOUNT_ID, day),
        },
      ],
      fees: ledger.overdraftFees
        .filter((fee) => fee.assessedDay === day)
        .map((fee) => ({
          accountId: fee.accountId,
          amount: fee.amount,
        })),
      authorizations: authorizationStatesForDay(
        day,
        authA.status,
        authAAfterE5,
        authB.status,
      ),
      errors: e6.bookedDay === day ? replayErrors : [],
    });
  }

  return {
    days,
    interestCapitalizations,
    audit: {
      sourceEventIds,
      postingEventIds: ledger.entries.map((entry) => entry.eventId),
      e7Day2BalanceBeforeFees,
      preInterestBalances,
      e10Installments: e10Entries.map((entry) => entry.amount),
    },
  };
}

function formatMoney(amount: Money): string {
  return `${amount.currency} ${amount.format()}`;
}

export function formatReplayReport(report: ReplayReport): string {
  const dayBlocks = report.days.map((day) => {
    const lines = [`Day ${day.day}`, "  Balances:"];

    for (const balance of day.balances) {
      lines.push(`    ${balance.accountId}: ${formatMoney(balance.amount)}`);
    }

    if (day.fees.length === 0) {
      lines.push("  Fees: none");
    } else {
      lines.push("  Fees:");
      for (const fee of day.fees) {
        lines.push(`    ${fee.accountId}: ${formatMoney(fee.amount)}`);
      }
    }

    if (day.authorizations.length === 0) {
      lines.push("  Authorizations: none");
    } else {
      lines.push("  Authorizations:");
      for (const authorization of day.authorizations) {
        lines.push(
          `    ${authorization.authorizationId}: ${authorization.state}`,
        );
      }
    }

    if (day.errors.length === 0) {
      lines.push("  Errors: none");
    } else {
      lines.push("  Errors:");
      for (const error of day.errors) {
        lines.push(
          `    ${error.eventId}: ${error.code} for ${error.authorizationId}`,
        );
      }
    }

    return lines.join("\n");
  });
  const interestLines = ["Interest capitalizations:"];

  for (const capitalization of report.interestCapitalizations) {
    interestLines.push(
      `  ${capitalization.accountId}: ${formatMoney(capitalization.totalAmount)}`,
    );
  }

  return [...dayBlocks, interestLines.join("\n")].join("\n\n");
}
