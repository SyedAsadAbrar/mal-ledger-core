import { type Currency, Money } from "./money.js";

const OVERDRAFT_FEE_AMOUNT = Money.parse("AED", "25.00");
Object.freeze(OVERDRAFT_FEE_AMOUNT);

export interface AccountDefinition {
  readonly id: string;
  readonly currency: Currency;
  readonly openingBalance: Money;
}

export type PostingType = "CREDIT" | "DEBIT";

export interface PostingInput {
  readonly eventId: string;
  readonly accountId: string;
  readonly amount: Money;
  readonly bookedDay: number;
  readonly valueDate: number;
}

export interface LedgerEntry extends PostingInput {
  readonly type: PostingType;
  readonly sequence: number;
}

export type AuthorizationStatus = "APPROVED" | "DECLINED";
export type AuthorizationCurrentState = AuthorizationStatus | "SETTLED";

export interface AuthorizationInput {
  readonly eventId: string;
  readonly authorizationId: string;
  readonly accountId: string;
  readonly holdAmount: Money;
  readonly bookedDay: number;
  readonly valueDate: number;
}

export interface AuthorizationRecord extends AuthorizationInput {
  readonly status: AuthorizationStatus;
  readonly sequence: number;
}

export type SettlementResult = "ACCEPTED" | "REJECTED";

export type SettlementRejectionReason =
  | "UNKNOWN_AUTHORIZATION"
  | "AUTHORIZATION_DECLINED"
  | "ALREADY_SETTLED"
  | "ACCOUNT_MISMATCH"
  | "CURRENCY_MISMATCH"
  | "INVALID_AMOUNT"
  | "AMOUNT_EXCEEDS_HOLD";

export interface SettlementInput {
  readonly eventId: string;
  readonly authorizationId: string;
  readonly accountId: string;
  readonly amount: Money;
  readonly bookedDay: number;
  readonly valueDate: number;
}

export interface SettlementRecord extends SettlementInput {
  readonly result: SettlementResult;
  readonly rejectionReason: SettlementRejectionReason | null;
  readonly sequence: number;
  readonly ledgerEntrySequence: number | null;
}

export interface OverdraftFeeAssessment {
  readonly feeId: string;
  readonly accountId: string;
  readonly assessedDay: number;
  readonly amount: Money;
  readonly sequence: number;
  readonly ledgerEntrySequence: number;
}

function immutableMoney(money: Money): Money {
  const snapshot = Money.fromMinorUnits(money.currency, money.minorUnits);
  Object.freeze(snapshot);
  return snapshot;
}

function requireNonEmpty(value: string, name: string): void {
  if (value.length === 0) {
    throw new RangeError(`${name} must not be empty`);
  }
}

function requireDay(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a positive integer`);
  }
}

export class Ledger {
  private readonly accounts = new Map<string, AccountDefinition>();
  private readonly postingHistory: LedgerEntry[] = [];
  private readonly authorizationHistory: AuthorizationRecord[] = [];
  private readonly authorizationById = new Map<string, AuthorizationRecord>();
  private readonly settlementHistory: SettlementRecord[] = [];
  private readonly overdraftFeeHistory: OverdraftFeeAssessment[] = [];
  private nextSequence = 1;

  constructor(accounts: readonly AccountDefinition[] = []) {
    for (const account of accounts) {
      this.registerAccount(account);
    }
  }

  registerAccount(account: AccountDefinition): void {
    requireNonEmpty(account.id, "account id");

    if (this.accounts.has(account.id)) {
      throw new Error(`Account already exists: ${account.id}`);
    }

    if (account.openingBalance.currency !== account.currency) {
      throw new TypeError(
        `Opening balance currency must match account currency: ${account.id}`,
      );
    }

    const storedAccount: AccountDefinition = Object.freeze({
      id: account.id,
      currency: account.currency,
      openingBalance: immutableMoney(account.openingBalance),
    });

    this.accounts.set(storedAccount.id, storedAccount);
  }

  postCredit(input: PostingInput): LedgerEntry {
    return this.append("CREDIT", input);
  }

  postDebit(input: PostingInput): LedgerEntry {
    return this.append("DEBIT", input);
  }

  authorize(input: AuthorizationInput): AuthorizationRecord {
    requireNonEmpty(input.eventId, "event id");
    requireNonEmpty(input.authorizationId, "authorization id");
    requireDay(input.bookedDay, "bookedDay");
    requireDay(input.valueDate, "valueDate");

    const account = this.requireAccount(input.accountId);

    if (this.authorizationById.has(input.authorizationId)) {
      throw new Error(
        `Authorization already exists: ${input.authorizationId}`,
      );
    }

    if (input.holdAmount.currency !== account.currency) {
      throw new TypeError(
        `Hold currency must match account currency: ${input.accountId}`,
      );
    }

    if (input.holdAmount.minorUnits <= 0) {
      throw new RangeError("Hold amount must be a positive magnitude");
    }

    const availableAfterHold = this.availableBalance(input.accountId).subtract(
      input.holdAmount,
    );
    const status: AuthorizationStatus =
      availableAfterHold.minorUnits >= 0 ? "APPROVED" : "DECLINED";
    const authorization: AuthorizationRecord = Object.freeze({
      eventId: input.eventId,
      authorizationId: input.authorizationId,
      accountId: input.accountId,
      holdAmount: immutableMoney(input.holdAmount),
      bookedDay: input.bookedDay,
      valueDate: input.valueDate,
      status,
      sequence: this.nextSequence,
    });

    this.authorizationHistory.push(authorization);
    this.authorizationById.set(
      authorization.authorizationId,
      authorization,
    );
    this.nextSequence += 1;
    return authorization;
  }

  settle(input: SettlementInput): SettlementRecord {
    requireNonEmpty(input.eventId, "event id");
    requireNonEmpty(input.authorizationId, "authorization id");
    requireDay(input.bookedDay, "bookedDay");
    requireDay(input.valueDate, "valueDate");

    const authorization = this.authorizationById.get(input.authorizationId);

    if (authorization === undefined) {
      return this.appendSettlement(
        input,
        "REJECTED",
        "UNKNOWN_AUTHORIZATION",
        null,
      );
    }

    if (authorization.accountId !== input.accountId) {
      return this.appendSettlement(
        input,
        "REJECTED",
        "ACCOUNT_MISMATCH",
        null,
      );
    }

    if (authorization.holdAmount.currency !== input.amount.currency) {
      return this.appendSettlement(
        input,
        "REJECTED",
        "CURRENCY_MISMATCH",
        null,
      );
    }

    if (input.amount.minorUnits <= 0) {
      return this.appendSettlement(
        input,
        "REJECTED",
        "INVALID_AMOUNT",
        null,
      );
    }

    if (authorization.status === "DECLINED") {
      return this.appendSettlement(
        input,
        "REJECTED",
        "AUTHORIZATION_DECLINED",
        null,
      );
    }

    if (this.authorizationState(input.authorizationId) === "SETTLED") {
      return this.appendSettlement(
        input,
        "REJECTED",
        "ALREADY_SETTLED",
        null,
      );
    }

    if (input.amount.compare(authorization.holdAmount) === 1) {
      return this.appendSettlement(
        input,
        "REJECTED",
        "AMOUNT_EXCEEDS_HOLD",
        null,
      );
    }

    const settlement = this.appendSettlement(
      input,
      "ACCEPTED",
      null,
      this.nextSequence + 1,
    );
    const entry = this.append("DEBIT", {
      eventId: input.eventId,
      accountId: input.accountId,
      amount: input.amount,
      bookedDay: input.bookedDay,
      valueDate: input.valueDate,
    });

    if (entry.sequence !== settlement.ledgerEntrySequence) {
      throw new Error("Settlement posting sequence invariant failed");
    }

    return settlement;
  }

  assessOverdraftFees(
    accountId: string,
    throughDay: number,
  ): readonly OverdraftFeeAssessment[] {
    requireDay(throughDay, "throughDay");
    const account = this.requireAccount(accountId);
    const appended: OverdraftFeeAssessment[] = [];

    for (let day = 1; day <= throughDay; day += 1) {
      const balance = this.balanceAtValueDate(accountId, day);
      const alreadyAssessed = this.hasOverdraftFee(accountId, day);

      if (balance.minorUnits >= 0 || alreadyAssessed) {
        continue;
      }

      if (account.currency !== "AED") {
        throw new Error(
          `Overdraft fees are unsupported for currency ${account.currency}`,
        );
      }

      appended.push(this.appendOverdraftFee(accountId, day));
    }

    return appended;
  }

  get entries(): readonly LedgerEntry[] {
    return this.postingHistory.slice();
  }

  get authorizations(): readonly AuthorizationRecord[] {
    return this.authorizationHistory.slice();
  }

  get settlements(): readonly SettlementRecord[] {
    return this.settlementHistory.slice();
  }

  get overdraftFees(): readonly OverdraftFeeAssessment[] {
    return this.overdraftFeeHistory.slice();
  }

  authorizationState(
    authorizationId: string,
  ): AuthorizationCurrentState | undefined {
    const authorization = this.authorizationById.get(authorizationId);

    if (authorization === undefined) {
      return undefined;
    }

    if (authorization.status === "DECLINED") {
      return "DECLINED";
    }

    const hasAcceptedSettlement = this.settlementHistory.some(
      (settlement) =>
        settlement.authorizationId === authorizationId &&
        settlement.result === "ACCEPTED",
    );

    return hasAcceptedSettlement ? "SETTLED" : "APPROVED";
  }

  activeHolds(accountId: string): readonly AuthorizationRecord[] {
    this.requireAccount(accountId);
    return this.authorizationHistory.filter(
      (authorization) =>
        authorization.accountId === accountId &&
        this.authorizationState(authorization.authorizationId) ===
          "APPROVED",
    );
  }

  currentBalance(accountId: string): Money {
    const account = this.requireAccount(accountId);
    let balance = account.openingBalance;

    for (const entry of this.postingHistory) {
      if (entry.accountId !== accountId) {
        continue;
      }

      balance =
        entry.type === "CREDIT"
          ? balance.add(entry.amount)
          : balance.subtract(entry.amount);
    }

    return balance;
  }

  balanceAtValueDate(
    accountId: string,
    valueDate: number,
    asOfSequence?: number,
  ): Money {
    requireDay(valueDate, "valueDate");

    if (
      asOfSequence !== undefined &&
      (!Number.isSafeInteger(asOfSequence) || asOfSequence < 0)
    ) {
      throw new RangeError(
        "asOfSequence must be a non-negative safe integer",
      );
    }

    const account = this.requireAccount(accountId);
    const sequenceCutoff = asOfSequence ?? this.nextSequence - 1;
    let balance = account.openingBalance;

    for (const entry of this.postingHistory) {
      if (
        entry.accountId !== accountId ||
        entry.valueDate > valueDate ||
        entry.sequence > sequenceCutoff
      ) {
        continue;
      }

      balance =
        entry.type === "CREDIT"
          ? balance.add(entry.amount)
          : balance.subtract(entry.amount);
    }

    return balance;
  }

  availableBalance(accountId: string): Money {
    let available = this.currentBalance(accountId);

    for (const authorization of this.activeHolds(accountId)) {
      available = available.subtract(authorization.holdAmount);
    }

    return available;
  }

  private append(type: PostingType, input: PostingInput): LedgerEntry {
    requireNonEmpty(input.eventId, "event id");
    requireDay(input.bookedDay, "bookedDay");
    requireDay(input.valueDate, "valueDate");

    const account = this.requireAccount(input.accountId);

    if (input.amount.currency !== account.currency) {
      throw new TypeError(
        `Posting currency must match account currency: ${input.accountId}`,
      );
    }

    if (input.amount.minorUnits <= 0) {
      throw new RangeError("Posting amount must be a positive magnitude");
    }

    const entry: LedgerEntry = Object.freeze({
      eventId: input.eventId,
      accountId: input.accountId,
      type,
      amount: immutableMoney(input.amount),
      bookedDay: input.bookedDay,
      valueDate: input.valueDate,
      sequence: this.nextSequence,
    });

    this.postingHistory.push(entry);
    this.nextSequence += 1;
    return entry;
  }

  private appendSettlement(
    input: SettlementInput,
    result: SettlementResult,
    rejectionReason: SettlementRejectionReason | null,
    ledgerEntrySequence: number | null,
  ): SettlementRecord {
    const settlement: SettlementRecord = Object.freeze({
      eventId: input.eventId,
      authorizationId: input.authorizationId,
      accountId: input.accountId,
      amount: immutableMoney(input.amount),
      bookedDay: input.bookedDay,
      valueDate: input.valueDate,
      result,
      rejectionReason,
      sequence: this.nextSequence,
      ledgerEntrySequence,
    });

    this.settlementHistory.push(settlement);
    this.nextSequence += 1;
    return settlement;
  }

  private hasOverdraftFee(accountId: string, assessedDay: number): boolean {
    return this.overdraftFeeHistory.some(
      (fee) =>
        fee.accountId === accountId && fee.assessedDay === assessedDay,
    );
  }

  private appendOverdraftFee(
    accountId: string,
    assessedDay: number,
  ): OverdraftFeeAssessment {
    if (this.hasOverdraftFee(accountId, assessedDay)) {
      throw new Error(
        `Overdraft fee already exists: ${accountId} Day ${assessedDay}`,
      );
    }

    const feeId = `FEE:${accountId}:D${assessedDay}`;
    const fee: OverdraftFeeAssessment = Object.freeze({
      feeId,
      accountId,
      assessedDay,
      amount: immutableMoney(OVERDRAFT_FEE_AMOUNT),
      sequence: this.nextSequence,
      ledgerEntrySequence: this.nextSequence + 1,
    });

    this.overdraftFeeHistory.push(fee);
    this.nextSequence += 1;

    const entry = this.append("DEBIT", {
      eventId: feeId,
      accountId,
      amount: OVERDRAFT_FEE_AMOUNT,
      bookedDay: assessedDay,
      valueDate: assessedDay,
    });

    if (entry.sequence !== fee.ledgerEntrySequence) {
      throw new Error("Overdraft fee posting sequence invariant failed");
    }

    return fee;
  }

  private requireAccount(accountId: string): AccountDefinition {
    const account = this.accounts.get(accountId);

    if (account === undefined) {
      throw new Error(`Unknown account: ${accountId}`);
    }

    return account;
  }
}
