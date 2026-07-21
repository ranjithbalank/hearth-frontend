import type { Step } from "react-joyride";

import { NAV } from "./modules";
import type { Role } from "./types";

/** 1-2 bespoke steps for each unique landing screen, keyed by the landing
 *  PATH (from app-context's `landing()` prefs) rather than by role — roles
 *  that share a landing page (Super Admin/MD/CEO -> /executive, Restaurant
 *  Manager/F&B Cashier/Captain -> /pos, etc.) automatically share this copy
 *  too, instead of maintaining 17 near-duplicate entries. */
const LANDING_STEPS: Record<string, { target: string; title: string; content: string }[]> = {
  "/dashboard": [{
    target: '[data-tour="landing-dashboard"]',
    title: "Your dashboard",
    content: "Switch between the analytical and data views here — this is where each day starts.",
  }],
  "/executive": [{
    target: '[data-tour="landing-executive"]',
    title: "Executive overview",
    content: "Flip between hotel-only, restaurant-only, or the combined view of the whole property.",
  }],
  "/settings": [{
    target: '[data-tour="landing-settings"]',
    title: "Settings",
    content: "Every configuration panel — property details, editions, masters — lives behind this menu.",
  }],
  "/accounting": [{
    target: '[data-tour="landing-accounting"]',
    title: "Night audit & ledger",
    content: "Run the night audit and track the city ledger from here.",
  }],
  "/pos": [{
    target: '[data-tour="landing-pos"]',
    title: "Start an order",
    content: "Tap a table to open its order, or start a takeaway, delivery, or room order here.",
  }],
  "/frontdesk": [{
    target: '[data-tour="landing-frontdesk"]',
    title: "Walk-in check-in",
    content: "No booking? Register and check in a walk-in guest straight from here.",
  }],
  "/housekeeping": [{
    target: '[data-tour="landing-housekeeping"]',
    title: "Room status at a glance",
    content: "See what needs attention right now — dirty, cleaning, ready, and out-of-order counts.",
  }],
  "/kds": [{
    target: '[data-tour="landing-kds"]',
    title: "Live kitchen tickets",
    content: "Fired KOTs land here in real time — bump an item or a whole ticket once it's ready.",
  }],
  "/store": [{
    target: '[data-tour="landing-store"]',
    title: "Store & inventory",
    content: "Switch between stock, movements, and consumption from these tabs.",
  }],
  "/barpos": [{
    target: '[data-tour="landing-barpos"]',
    title: "Bar tables",
    content: "The bar runs its own tabs, separate from the restaurant floor — colors show which need attention.",
  }],
  "/hr": [{
    target: '[data-tour="landing-hr"]',
    title: "Roster, attendance & payroll",
    content: "Everything about staff — roster, attendance marking, and payroll — is one tab away.",
  }],
};

/** Builds one role's orientation tour: a step per sidebar group the role can
 *  actually see (reusing the exact same NAV + canAccess filter AppShell uses,
 *  so a step never points at a group a role doesn't have), the header's
 *  notifications bell, and 1-2 highlights on that role's landing screen.
 *  Capped so the whole tour stays a short, skimmable ~4-8 steps. */
export function buildTourSteps(role: Role, canAccess: (module: string) => boolean, landingPath: string): Step[] {
  const groups = NAV
    .map((g) => ({ ...g, items: g.items.filter((i) => canAccess(i.module ?? i.key)) }))
    .filter((g) => g.items.length > 0);

  const steps: Step[] = [
    {
      target: "body",
      placement: "center",
      title: `Welcome, ${role}`,
      content: "Quick tour of where things are — click Next to step through it, or Skip if you'd rather explore on your own.",
    },
  ];

  for (const g of groups.slice(0, 5)) {
    const labels = g.items.map((i) => i.label);
    const shown = labels.slice(0, 3).join(", ");
    const rest = labels.length > 3 ? `, +${labels.length - 3} more` : "";
    steps.push({
      target: `[data-tour="navgroup-${g.title}"]`,
      title: g.title,
      content: `Includes ${shown}${rest}.`,
    });
  }

  if (canAccess("notifications")) {
    steps.push({
      target: '[data-tour="header-notifications"]',
      title: "Notifications",
      content: "Anything that needs your attention — approvals, low stock, guest requests — shows up here.",
    });
  }

  steps.push(...(LANDING_STEPS[landingPath] ?? []));

  steps.push({
    target: '[data-tour="header-help"]',
    title: "Come back anytime",
    content: "Click here whenever you want to replay this tour.",
  });

  return steps;
}
