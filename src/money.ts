export const CURRENCY_PRECISION = {
  AED: 2,
  BHD: 3,
} as const;

export type Currency = keyof typeof CURRENCY_PRECISION;

const MAX_SAFE_MINOR_UNITS = BigInt(Number.MAX_SAFE_INTEGER);

export function precisionFor(currency: Currency): number {
  const precision = CURRENCY_PRECISION[currency];

  if (precision === undefined) {
    throw new RangeError(`Unsupported currency: ${String(currency)}`);
  }

  return precision;
}

export function minorUnitScale(currency: Currency): number {
  return 10 ** precisionFor(currency);
}

function requireSafeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${name} must be a safe integer`);
  }
}

function safeNumber(value: bigint): number {
  if (value > MAX_SAFE_MINOR_UNITS || value < -MAX_SAFE_MINOR_UNITS) {
    throw new RangeError("Minor units exceed the safe integer range");
  }

  return Number(value);
}

export class Money {
  private constructor(
    public readonly currency: Currency,
    public readonly minorUnits: number,
  ) {}

  static fromMinorUnits(currency: Currency, minorUnits: number): Money {
    precisionFor(currency);
    requireSafeInteger(minorUnits, "minorUnits");

    return new Money(currency, minorUnits);
  }

  static parse(currency: Currency, decimal: string): Money {
    const precision = precisionFor(currency);
    const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(decimal);

    if (!match) {
      throw new SyntaxError(`Invalid money amount: ${decimal}`);
    }

    const wholeDigits = match[2];
    const fractionDigits = match[3] ?? "";

    if (wholeDigits === undefined) {
      throw new SyntaxError(`Invalid money amount: ${decimal}`);
    }

    if (fractionDigits.length > precision) {
      throw new RangeError(
        `${currency} amounts support at most ${precision} decimal places`,
      );
    }

    const scale = BigInt(minorUnitScale(currency));
    const paddedFraction = fractionDigits.padEnd(precision, "0");
    const magnitude =
      BigInt(wholeDigits) * scale + BigInt(paddedFraction || "0");
    const signedMinorUnits = match[1] === "-" ? -magnitude : magnitude;

    return Money.fromMinorUnits(currency, safeNumber(signedMinorUnits));
  }

  format(): string {
    const scale = minorUnitScale(this.currency);
    const precision = precisionFor(this.currency);
    const magnitude = Math.abs(this.minorUnits);
    const whole = Math.floor(magnitude / scale);
    const fraction = String(magnitude % scale).padStart(precision, "0");
    const sign = this.minorUnits < 0 ? "-" : "";

    return `${sign}${whole}.${fraction}`;
  }

  add(other: Money): Money {
    this.requireSameCurrency(other);
    return Money.fromMinorUnits(
      this.currency,
      this.minorUnits + other.minorUnits,
    );
  }

  subtract(other: Money): Money {
    this.requireSameCurrency(other);
    return Money.fromMinorUnits(
      this.currency,
      this.minorUnits - other.minorUnits,
    );
  }

  compare(other: Money): -1 | 0 | 1 {
    this.requireSameCurrency(other);

    if (this.minorUnits < other.minorUnits) {
      return -1;
    }

    if (this.minorUnits > other.minorUnits) {
      return 1;
    }

    return 0;
  }

  negate(): Money {
    return Money.fromMinorUnits(this.currency, -this.minorUnits);
  }

  private requireSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new TypeError(
        `Money operations require the same currency: ${this.currency} and ${other.currency}`,
      );
    }
  }
}

/**
 * Returns minorUnits × numerator / denominator, rounded half up to an integer.
 * Ties are rounded away from zero. Inputs and the result must be safe integers.
 */
export function roundFraction(
  minorUnits: number,
  numerator: number,
  denominator: number,
): number {
  requireSafeInteger(minorUnits, "minorUnits");
  requireSafeInteger(numerator, "numerator");
  requireSafeInteger(denominator, "denominator");

  if (numerator < 0) {
    throw new RangeError("numerator must be non-negative");
  }

  if (denominator <= 0) {
    throw new RangeError("denominator must be positive");
  }

  const value = BigInt(minorUnits);
  const sign = value < 0n ? -1n : 1n;
  const magnitude = value < 0n ? -value : value;
  const divisor = BigInt(denominator);
  const product = magnitude * BigInt(numerator);
  const quotient = product / divisor;
  const remainder = product % divisor;
  const roundedMagnitude =
    remainder * 2n >= divisor ? quotient + 1n : quotient;

  return safeNumber(sign * roundedMagnitude);
}
