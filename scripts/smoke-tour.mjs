// Smoke-tests the onboarding product tour (src/shell/ProductTour.tsx,
// src/lib/tours.ts) across every demo role. For each role it logs in,
// lands on that role's home screen, and asserts the DOM actually has the
// elements the tour would spotlight — catching a typo'd data-tour attribute,
// a removed widget, or a landing route that drifted away from what
// tours.ts's LANDING_STEPS key expects, before it ships broken to a demo.
//
// Mirrors frontend/src/features/auth/Login.tsx's DEMO array and
// frontend/src/lib/app-context.tsx's landing() prefs map — keep in sync if
// either changes.
import { chromium } from "playwright";

const API = "http://localhost:8010";
const APP = "http://localhost:5177";

const ROLES = [
  { username: "superadmin", role: "Super Admin", landing: "executive" },
  { username: "admin", role: "Admin", landing: "settings" },
  { username: "md", role: "Managing Director", landing: "executive" },
  { username: "ceo", role: "CEO", landing: "executive" },
  { username: "gm", role: "General Manager", landing: "dashboard" },
  { username: "finance", role: "Finance", landing: "accounting" },
  { username: "restmanager", role: "Restaurant Manager", landing: "pos" },
  { username: "hotelmanager", role: "Hotel Manager", landing: "dashboard" },
  { username: "frontoffice", role: "Front Office", landing: "frontdesk" },
  { username: "cashier", role: "F&B Cashier", landing: "pos" },
  { username: "captain", role: "Captain", landing: "pos" },
  { username: "housekeeping", role: "Housekeeping", landing: "housekeeping" },
  { username: "chef", role: "Chef / Kitchen", landing: "kds" },
  { username: "store", role: "Store Keeper", landing: "store" },
  { username: "barcaptain", role: "Bar Captain", landing: "barpos" },
  { username: "barcashier", role: "Bar Cashier", landing: "barpos" },
  { username: "hr", role: "HR Manager", landing: "hr" },
];

const browser = await chromium.launch();
const failures = [];

// The auth endpoint throttles login attempts to 10/min per IP (security
// baseline, DEFAULT_THROTTLE_RATES["auth"]) — 17 logins back to back always
// trips it regardless of username, so pace requests under that rate.
async function login(username) {
  const attempt = () =>
    fetch(`${API}/api/auth/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password: "hearth123" }),
    });
  let res = await attempt();
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 65_000)); // full window reset
    res = await attempt();
  }
  return res;
}

for (const { username, role, landing } of ROLES) {
  const res = await login(username);
  if (!res.ok) {
    failures.push(`${role} (${username}): login failed — ${res.status}`);
    continue;
  }
  const { access, refresh } = await res.json();
  await new Promise((r) => setTimeout(r, 6500)); // stay under the 10/min throttle

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(APP);
  await page.evaluate(([a, r]) => {
    localStorage.setItem("hearth_access", a);
    localStorage.setItem("hearth_refresh", r);
  }, [access, refresh]);
  // Force a fresh auto-start regardless of any prior run in this browser profile.
  await page.evaluate((u) => localStorage.removeItem(`hearth_tour_seen_${u}`), username);
  await page.goto(`${APP}/${landing === "dashboard" ? "dashboard" : landing}`.replace("//", "/"));

  try {
    await page.waitForSelector('[data-tour="header-help"]', { timeout: 15000 });
  } catch {
    failures.push(`${role} (${username}): header-help never rendered — page didn't load or AppShell didn't mount`);
    await page.close();
    continue;
  }

  const navGroupCount = await page.locator('[data-tour^="navgroup-"]').count();
  if (navGroupCount === 0) {
    failures.push(`${role} (${username}): no [data-tour^="navgroup-"] elements — sidebar not rendered or role has zero accessible groups`);
  }

  // Landing widgets often sit behind an async query (Dashboard/Accounting/Pos
  // all render a Spinner until their first fetch resolves) — give them a
  // real chance to mount before declaring the target missing.
  const landingSelector = `[data-tour="landing-${landing}"]`;
  const landingCount = await page
    .waitForSelector(landingSelector, { timeout: 8000 })
    .then(() => 1)
    .catch(() => 0);
  if (landingCount === 0) {
    failures.push(`${role} (${username}): ${landingSelector} not found — landing widget missing, removed, or mistagged`);
  }

  await page.close();
}

await browser.close();

if (failures.length) {
  console.error(`\n${failures.length} tour smoke-test failure(s):\n` + failures.map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}
console.log(`All ${ROLES.length} roles: tour targets resolve correctly.`);
