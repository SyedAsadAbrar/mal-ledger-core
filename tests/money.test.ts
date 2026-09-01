import assert from "node:assert/strict";
import test from "node:test";

import {
  Money,
  minorUnitScale,
  precisionFor,
  roundFraction,
} from "../src/money.js";

test("AED uses two decimal places and 100 minor units per unit", () => {
  assert.equal(precisionFor("AED"), 2);
  assert.equal(minorUnitScale("AED"), 100);
});

test("BHD uses three decimal places and 1,000 minor units per unit", () => {
  assert.equal(precisionFor("BHD"), 3);
  assert.equal(minorUnitScale("BHD"), 1_000);
});

test("parses AED decimal text exactly", () => {
  assert.equal(Money.parse("AED", "1200.00").minorUnits, 120_000);
});

test("parses BHD decimal text exactly", () => {
  assert.equal(Money.parse("BHD", "10.000").minorUnits, 10_000);
});

test("accepts fewer decimal digits and normalizes to currency precision", () => {
  assert.equal(Money.parse("AED", "25").minorUnits, 2_500);
  assert.equal(Money.parse("AED", "25.0").minorUnits, 2_500);
  assert.equal(Money.parse("BHD", "3.3").minorUnits, 3_300);
});

test("formats AED at two decimal places", () => {
  assert.equal(Money.fromMinorUnits("AED", 25_000).format(), "250.00");
});

test("formats BHD at three decimal places", () => {
  assert.equal(Money.fromMinorUnits("BHD", 10_000).format(), "10.000");
});

test("formats negative amounts with the sign before the magnitude", () => {
  assert.equal(Money.fromMinorUnits("AED", -12_345).format(), "-123.45");
  assert.equal(Money.fromMinorUnits("BHD", -4).format(), "-0.004");
});

test("adds amounts in the same currency", () => {
  const result = Money.parse("AED", "250.00").add(
    Money.parse("AED", "400.00"),
  );

  assert.equal(result.minorUnits, 65_000);
  assert.equal(result.format(), "650.00");
});

test("subtracts amounts in the same currency", () => {
  const result = Money.parse("AED", "650.00").subtract(
    Money.parse("AED", "185.00"),
  );

  assert.equal(result.minorUnits, 46_500);
  assert.equal(result.format(), "465.00");
});

test("compares and negates exact amounts", () => {
  const smaller = Money.parse("BHD", "3.333");
  const larger = Money.parse("BHD", "3.334");

  assert.equal(smaller.compare(larger), -1);
  assert.equal(larger.compare(smaller), 1);
  assert.equal(smaller.compare(Money.parse("BHD", "3.333")), 0);
  assert.equal(smaller.negate().format(), "-3.333");
});

test("rejects operations between different currencies", () => {
  assert.throws(
    () => Money.parse("AED", "1.00").add(Money.parse("BHD", "1.000")),
    /same currency/,
  );
});

test("calculates exact 0.04 percent for AED 250.00", () => {
  const balance = Money.parse("AED", "250.00");
  const interest = Money.fromMinorUnits(
    "AED",
    roundFraction(balance.minorUnits, 4, 10_000),
  );

  assert.equal(interest.minorUnits, 10);
  assert.equal(interest.format(), "0.10");
});

test("rounds AED 415.00 interest half up to AED 0.17", () => {
  const balance = Money.parse("AED", "415.00");
  const interest = Money.fromMinorUnits(
    "AED",
    roundFraction(balance.minorUnits, 4, 10_000),
  );

  assert.equal(interest.minorUnits, 17);
  assert.equal(interest.format(), "0.17");
});

test("calculates exact 0.04 percent for BHD 10.000", () => {
  const balance = Money.parse("BHD", "10.000");
  const interest = Money.fromMinorUnits(
    "BHD",
    roundFraction(balance.minorUnits, 4, 10_000),
  );

  assert.equal(interest.minorUnits, 4);
  assert.equal(interest.format(), "0.004");
});

test("rounds exact half values away from zero", () => {
  assert.equal(roundFraction(1, 1, 2), 1);
  assert.equal(roundFraction(-1, 1, 2), -1);
});

test("rejects decimal text with excessive currency precision", () => {
  assert.throws(() => Money.parse("AED", "1.001"), /2 decimal places/);
  assert.throws(() => Money.parse("BHD", "1.0001"), /3 decimal places/);
});

test("rejects non-integer minor units", () => {
  assert.throws(
    () => Money.fromMinorUnits("AED", 10.5),
    /safe integer/,
  );
});
