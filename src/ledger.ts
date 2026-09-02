import { type Currency, Money } from "./money.js";

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

  get entries(): readonly LedgerEntry[] {
    return this.postingHistory.slice();
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
      sequence: this.postingHistory.length + 1,
    });

    this.postingHistory.push(entry);
    return entry;
  }

  private requireAccount(accountId: string): AccountDefinition {
    const account = this.accounts.get(accountId);

    if (account === undefined) {
      throw new Error(`Unknown account: ${accountId}`);
    }

    return account;
  }
}
