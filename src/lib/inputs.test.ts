import { describe, expect, it } from "vitest";

import { amount, digits, gstin, personName, phone, signedAmount, username } from "./inputs";

/** These filters run on every keystroke of a controlled field, so what they
 *  reject never reaches the API. They are the cheapest thing in the codebase
 *  to get wrong and the cheapest to cover. */

describe("digits", () => {
  it("keeps only digits", () => {
    expect(digits("12a3-4")).toBe("1234");
  });

  it("caps length so a count field cannot take an essay", () => {
    expect(digits("1234567890")).toBe("123456");
    expect(digits("1234567890", 3)).toBe("123");
  });
});

describe("amount", () => {
  it("keeps digits and a decimal point", () => {
    expect(amount("1234.50")).toBe("1234.50");
  });

  it("strips currency symbols and letters someone pastes in", () => {
    expect(amount("₹1,234.50")).toBe("1234.50");
  });

  it("allows only one decimal point, however many are typed", () => {
    expect(amount("12.34.56")).toBe("12.3456".slice(0, 5));
  });

  it("caps the paise at two places", () => {
    expect(amount("12.3456")).toBe("12.34");
  });

  it("rejects a negative — use signedAmount where minus is meaningful", () => {
    expect(amount("-50")).toBe("50");
  });
});

describe("signedAmount", () => {
  it("keeps a leading minus, for a stock adjustment of ±", () => {
    expect(signedAmount("-12.50")).toBe("-12.50");
  });

  it("keeps only the leading minus, not one typed mid-number", () => {
    expect(signedAmount("12-50")).toBe("1250");
  });

  it("is unsigned when no minus was typed", () => {
    expect(signedAmount("12.50")).toBe("12.50");
  });
});

describe("phone", () => {
  it("is digits only — the country code comes from the picker beside it", () => {
    expect(phone("+91 98765 43210")).toBe("919876543210");
  });

  it("caps at the E.164 maximum", () => {
    expect(phone("1".repeat(20))).toHaveLength(15);
  });
});

describe("gstin", () => {
  it("uppercases and strips punctuation", () => {
    expect(gstin("29aabbc-c1234d1z5")).toBe("29AABBCC1234D1Z5".slice(0, 15));
  });

  it("caps at the statutory 15 characters", () => {
    expect(gstin("29AABBCC1234D1Z5EXTRA")).toHaveLength(15);
  });
});

describe("personName", () => {
  it("keeps the punctuation real names contain", () => {
    expect(personName("Mary-Jane O'Neil Jr.")).toBe("Mary-Jane O'Neil Jr.");
  });

  it("keeps non-Latin scripts, vowel marks and all", () => {
    // Indic vowel signs are combining MARKS, not letters. A letters-only
    // filter ate them and turned "मीरा" into "मर" — a guest's name corrupted
    // as they typed it, on a product built for Indian properties.
    expect(personName("मीरा राव")).toBe("मीरा राव");
    expect(personName("ரவி குமார்")).toBe("ரவி குமார்");
  });

  it("keeps Latin accents", () => {
    expect(personName("José Álvarez")).toBe("José Álvarez");
  });

  it("drops digits and symbols", () => {
    expect(personName("Rav1 @Kumar#")).toBe("Rav Kumar");
  });

  it("collapses runs of spaces", () => {
    expect(personName("Ravi    Kumar")).toBe("Ravi Kumar");
  });
});

describe("username", () => {
  it("produces something safe to log in with", () => {
    expect(username("Front Office!")).not.toMatch(/[!\s]/);
  });
});
