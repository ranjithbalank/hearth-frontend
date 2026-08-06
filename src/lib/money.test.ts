import { beforeEach, describe, expect, it } from "vitest";

import { compactMoney, currencySymbol, money, moneyKpi, num, setActiveCurrency } from "./money";

/** `activeSymbol` is module-level mutable state, so a case that switches
 *  currency leaks into every case after it. Resetting to the default before
 *  each one keeps them independent — without this the file passes when run
 *  alone and fails the moment the order changes. */
beforeEach(() => setActiveCurrency("INR"));

describe("money", () => {
  it("formats with the Indian grouping and always two decimals", () => {
    // 1,08,505 — lakhs, not 108,505. The grouping is the whole reason this
    // uses en-IN rather than the browser default.
    expect(money("108505.5")).toBe("₹1,08,505.50");
    expect(money(1234)).toBe("₹1,234.00");
  });

  it("accepts a number or the string the API actually sends", () => {
    expect(money("1234.50")).toBe(money(1234.5));
  });

  it("shows zero rather than NaN for junk input", () => {
    // A folio has to render even when a field arrives malformed. "₹NaN" on a
    // bill is worse than a wrong number — it is unreadable.
    expect(money("abc")).toBe("₹0.00");
    expect(money("")).toBe("₹0.00");
  });

  it("follows the property's currency", () => {
    setActiveCurrency("USD");
    expect(money(10)).toBe("$10.00");
    expect(currencySymbol()).toBe("$");
  });

  it("falls back to the bare code for a currency it does not know", () => {
    setActiveCurrency("XYZ");
    expect(currencySymbol()).toBe("XYZ ");
  });

  it("defaults to rupees when the property has no currency set", () => {
    setActiveCurrency(null);
    expect(currencySymbol()).toBe("₹");
  });
});

describe("moneyKpi", () => {
  it("drops the paise, because a KPI is scanned and not reconciled", () => {
    expect(moneyKpi("4548.57")).toBe("₹4,549");
    expect(moneyKpi("108505.62")).toBe("₹1,08,506");
  });

  it("is zero-safe like money()", () => {
    expect(moneyKpi("abc")).toBe("₹0");
  });
});

describe("compactMoney", () => {
  it("switches unit at thousand, lakh and crore", () => {
    expect(compactMoney(999)).toBe("₹999");
    expect(compactMoney(1000)).toBe("₹1.0k");
    expect(compactMoney(100000)).toBe("₹1.00L");
    expect(compactMoney(10000000)).toBe("₹1.00Cr");
  });

  it("uses the active currency rather than a hardcoded rupee", () => {
    setActiveCurrency("USD");
    expect(compactMoney(250000)).toBe("$2.50L");
  });
});

describe("num", () => {
  it("parses the decimal strings the API sends for money", () => {
    expect(num("1234.50")).toBe(1234.5);
    expect(num(7)).toBe(7);
  });
});
