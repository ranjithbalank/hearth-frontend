import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { MODULE_ENTITLEMENT, MODULE_LABEL } from "./modules";

/** These maps mirror the backend's `ALL_MODULES` and its entitlement gating.
 *  Mirrors drift: a module added server-side and forgotten here is invisible
 *  in the nav, and one removed server-side leaves a dead entry behind. This
 *  reads the backend's own list rather than a copy of it. */
const CONSTANTS_PY = readFileSync(
  fileURLToPath(new URL("../../../backend/apps/accounts/constants.py", import.meta.url)),
  "utf8");

const backendModules = new Set(
  [...CONSTANTS_PY.slice(CONSTANTS_PY.indexOf("ALL_MODULES = ["),
                         CONSTANTS_PY.indexOf("]", CONSTANTS_PY.indexOf("ALL_MODULES = [")))
    .matchAll(/"([a-z]+)"/g)].map((m) => m[1]),
);

describe("module maps mirror the backend", () => {
  it("finds the backend's module list", () => {
    // Guards the guard — an empty set would make everything below vacuous.
    expect(backendModules.size).toBeGreaterThan(20);
    expect(backendModules.has("dashboard")).toBe(true);
  });

  it("gates only modules the backend actually has", () => {
    for (const module of Object.keys(MODULE_ENTITLEMENT)) {
      expect(backendModules.has(module), `${module} is gated but unknown to the backend`)
        .toBe(true);
    }
  });

  it("names only modules the backend actually has", () => {
    for (const module of Object.keys(MODULE_LABEL)) {
      expect(backendModules.has(module), `${module} has a label but is unknown to the backend`)
        .toBe(true);
    }
  });

  it("never carries a blank label", () => {
    // Not "every module has a label" — MODULE_LABEL is deliberately partial.
    // It is built from the NAV tree, and sub-flows reached from another screen
    // (checkin, checkout) are not nav items, so consumers fall back to the raw
    // key (`MODULE_LABEL[m] ?? m`). What must not happen is an entry that
    // exists but is empty, which defeats that fallback and renders nothing.
    for (const [module, label] of Object.entries(MODULE_LABEL)) {
      expect(label, `${module} has a blank label`).toBeTruthy();
      expect(typeof label).toBe("string");
    }
  });

  it("uses only the four real entitlement flags", () => {
    const flags = new Set(Object.values(MODULE_ENTITLEMENT).filter(Boolean));
    for (const f of flags) {
      expect(["hms", "restaurant", "banquets", "rms"]).toContain(f);
    }
  });
});
