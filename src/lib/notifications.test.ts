import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { NOTIFICATION_ROUTES } from "./notifications";

/** A contract check rather than a unit test, and the most valuable case in
 *  this file.
 *
 *  A wrong path here is invisible: the alert renders correctly, reads
 *  correctly, and goes nowhere when clicked. Nothing else in the codebase
 *  connects this map to the router, so a route renamed in App.tsx silently
 *  orphans every alert that pointed at it. This reads the real route table
 *  out of App.tsx and holds the two together. */
const APP_TSX = readFileSync(
  fileURLToPath(new URL("../App.tsx", import.meta.url)), "utf8");

/** Every absolute path App.tsx mentions.
 *
 *  Deliberately not just `path="..."`: a block of sibling routes is declared by
 *  mapping over an array of literals (the /store/* screens), so matching only
 *  the attribute misses them and the check cries wolf. Collecting the path
 *  strings themselves catches both forms — and still fires for the thing this
 *  is for, since renaming a route removes its literal from the file entirely. */
const declaredRoutes = new Set(
  [...APP_TSX.matchAll(/"(\/[^"\s]*)"/g)].map((m) => m[1]),
);

describe("NOTIFICATION_ROUTES", () => {
  it("reads the router's own route table", () => {
    // Guards the guard: if App.tsx stops declaring routes this way, the test
    // below would pass vacuously against an empty set.
    expect(declaredRoutes.size).toBeGreaterThan(20);
    expect(declaredRoutes.has("/dashboard")).toBe(true);
  });

  it("points every alert at a route that exists", () => {
    for (const [module, target] of Object.entries(NOTIFICATION_ROUTES)) {
      // The map carries deep links with query strings ("/recipes?tab=pending");
      // the router only knows the path part.
      const path = target.split("?")[0];
      expect(declaredRoutes.has(path), `${module} → ${target} is not a declared route`)
        .toBe(true);
    }
  });

  it("uses absolute paths, so a link works from whatever screen you are on", () => {
    for (const target of Object.values(NOTIFICATION_ROUTES)) {
      expect(target.startsWith("/")).toBe(true);
    }
  });
});
