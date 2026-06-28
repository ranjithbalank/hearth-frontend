import type { Entitlement } from "./types";

/** Which entitlement flag each module requires (mirrors the backend). */
export const MODULE_ENTITLEMENT: Record<string, keyof Entitlement | undefined> = {
  execdashboard: "hms",
  frontdesk: "hms",
  checkin: "hms",
  checkout: "hms",
  livegrid: "hms",
  folio: "hms",
  reservations: "hms",
  housekeeping: "hms",
  roommaster: "hms",
  accounting: "hms",
  engineering: "hms",
  hr: "hms",
  revenue: "rms",
  channel: "hms",
  booking: "hms",
  banquets: "banquets",
  pos: "restaurant",
  inventory: "restaurant",
  procurement: "restaurant",
  recipes: "restaurant",
  tablemaster: "restaurant",
  menumaster: "restaurant",
};

export interface NavItem {
  key: string;
  label: string;
  path: string;
}
export interface NavGroup {
  title: string;
  items: NavItem[];
}

/** Nav groups, ordered. Visibility is filtered by role ∧ entitlement at render. */
export const NAV: NavGroup[] = [
  {
    title: "Executive",
    items: [{ key: "execdashboard", label: "Executive Overview", path: "/executive" }],
  },
  {
    title: "Rooms",
    items: [
      { key: "dashboard", label: "Dashboard", path: "/dashboard" },
      { key: "frontdesk", label: "Front Desk", path: "/frontdesk" },
      { key: "livegrid", label: "Live Grid", path: "/livegrid" },
      { key: "reservations", label: "Reservations", path: "/reservations" },
      { key: "folio", label: "Folios", path: "/folios" },
      { key: "housekeeping", label: "Housekeeping", path: "/housekeeping" },
      { key: "banquets", label: "Banquets & Events", path: "/banquets" },
    ],
  },
  {
    title: "Revenue",
    items: [
      { key: "revenue", label: "Revenue Manager", path: "/revenue" },
      { key: "channel", label: "Channel Manager", path: "/channel" },
      { key: "booking", label: "Booking Engine", path: "/booking" },
    ],
  },
  {
    title: "Restaurant",
    items: [
      { key: "pos", label: "Restaurant POS", path: "/pos" },
      { key: "inventory", label: "Inventory & Stock", path: "/inventory" },
      { key: "procurement", label: "Procurement", path: "/procurement" },
      { key: "recipes", label: "Recipes & BOM", path: "/recipes" },
    ],
  },
  {
    title: "Back office",
    items: [
      { key: "accounting", label: "Accounting", path: "/accounting" },
      { key: "tax", label: "Tax & GST", path: "/tax" },
      { key: "engineering", label: "Engineering", path: "/engineering" },
      { key: "hr", label: "HR & Staff", path: "/hr" },
      { key: "crm", label: "Guest CRM", path: "/crm" },
      { key: "notifications", label: "Notifications", path: "/notifications" },
      { key: "reports", label: "Reports", path: "/reports" },
      { key: "settings", label: "Settings", path: "/settings" },
    ],
  },
  {
    title: "Configuration",
    items: [
      { key: "roommaster", label: "Room Master", path: "/config/rooms" },
      { key: "menumaster", label: "Menu Master", path: "/config/menu" },
      { key: "tablemaster", label: "Table Master", path: "/config/tables" },
      { key: "roles", label: "Role Mapping", path: "/config/roles" },
    ],
  },
];
