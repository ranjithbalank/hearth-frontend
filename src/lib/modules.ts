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
  barpos: "restaurant",
  kds: "restaurant",
  online: "restaurant",
  // matreq (material requests) is a shared service — hotel-only properties
  // use it for housekeeping/front-office/maintenance indents too.
  inventory: "restaurant",
  procurement: "restaurant",
  pomanage: "restaurant",
  suppliers: "restaurant",
  recipes: "restaurant",
  tablemaster: "restaurant",
  menumaster: "restaurant",
  cateringmaster: "banquets",
};

export interface NavItem {
  key: string;
  label: string;
  path: string;
  /** RBAC/entitlement module if different from key (e.g. all Store screens gate on "inventory"). */
  module?: string;
}
export interface NavGroup {
  title: string;
  /** accent colour for this group's outline icons (reads on the dark sidebar) */
  color: string;
  items: NavItem[];
}

/** Nav groups, ordered. Visibility is filtered by role ∧ entitlement at render. */
export const NAV: NavGroup[] = [
  {
    title: "Executive",
    color: "#E0A23D",
    items: [{ key: "execdashboard", label: "Executive Overview", path: "/executive" }],
  },
  {
    // Cross-cutting, not a "Back office" thing — every department raises
    // its own indents (Chef, Housekeeping, Front Office, Cashier...) and a
    // different department head approves each one. A Chef's sidebar would
    // otherwise show this under a heading literally called "Back office",
    // which reads as management-only when it's actually their daily floor
    // work. Own top-level slot instead, same idea as "Executive" above.
    title: "Requests",
    color: "#B8A28C",
    items: [{ key: "matreq", label: "Material Requests", path: "/material-requests" }],
  },
  {
    title: "Rooms",
    color: "#7FC6B3",
    // Guest-lifecycle order: arrival & booking, then in-house tracking,
    // then departure, then the support ops that run alongside a stay.
    items: [
      { key: "dashboard", label: "Dashboard", path: "/dashboard" },
      { key: "frontdesk", label: "Front Desk", path: "/frontdesk" },
      { key: "reservations", label: "Reservations", path: "/reservations" },
      { key: "livegrid", label: "Live Grid", path: "/livegrid" },
      { key: "folio", label: "Folios", path: "/folios" },
      { key: "checkout", label: "Check-Out", path: "/checkout" },
      { key: "housekeeping", label: "Housekeeping", path: "/housekeeping" },
      { key: "banquets", label: "Banquets & Events", path: "/banquets" },
    ],
  },
  {
    title: "Revenue",
    color: "#E8B07A",
    items: [
      { key: "revenue", label: "Revenue Manager", path: "/revenue" },
      { key: "channel", label: "Channel Manager", path: "/channel" },
      { key: "booking", label: "Booking Engine", path: "/booking" },
    ],
  },
  {
    title: "Restaurant",
    color: "#E89B6C",
    items: [
      { key: "pos", label: "Restaurant POS", path: "/pos" },
      { key: "kds", label: "Kitchen Display", path: "/kds" },
      { key: "online", label: "Online Orders", path: "/online-orders" },
      { key: "procurement", label: "Procurement", path: "/procurement" },
    ],
  },
  {
    // Its own operation, separate from the restaurant floor — own tables, own login.
    title: "Bar",
    color: "#C77B5D",
    items: [
      { key: "barpos", label: "Bar POS", path: "/barpos" },
    ],
  },
  {
    // Store: the Restaurant Inventory spec's §6 tabs as separate screens.
    // Data → its setup → what's built from it → the ledger → daily tools.
    title: "Store",
    color: "#D4B483",
    items: [
      { key: "store-dashboard", module: "inventory", label: "Store Dashboard", path: "/store" },
      { key: "store-materials", module: "inventory", label: "Raw Material Master", path: "/store/materials" },
      { key: "store-masters", module: "inventory", label: "Categories & Units", path: "/store/categories-units" },
      { key: "recipes", label: "Recipes & BOM", path: "/recipes" },
      { key: "store-movements", module: "inventory", label: "Movements & Consumption", path: "/store/movements" },
      // Low stock, expiry, wastage, count and transfer live inside one screen.
      { key: "store-control", module: "inventory", label: "Stock Control", path: "/store/stock-control" },
    ],
  },
  {
    title: "Back office",
    color: "#9FB6D4",
    items: [
      { key: "accounting", label: "Accounting", path: "/accounting" },
      { key: "tax", label: "Tax & GST", path: "/tax" },
      // Finance's payables-oversight view of POs (approve/receive, no
      // create) — sits with its actual audience, not among directory masters.
      { key: "pomanage", label: "Purchase Orders", path: "/masters/purchase-orders" },
      { key: "engineering", label: "Engineering", path: "/engineering" },
      { key: "hr", label: "HR & Staff", path: "/hr" },
      { key: "crm", label: "Guest CRM", path: "/crm" },
      { key: "notifications", label: "Notifications", path: "/notifications" },
      { key: "reports", label: "Reports", path: "/reports" },
      { key: "settings", label: "Settings", path: "/settings" },
    ],
  },
  {
    title: "Masters",
    color: "#C7A8DA",
    // Pure directory / master data — no transactional workflows here.
    items: [
      { key: "customers", label: "Customers", path: "/masters/customers" },
      { key: "suppliers", label: "Suppliers", path: "/masters/suppliers" },
      { key: "vendors", label: "Vendors", path: "/masters/vendors" },
      { key: "employees", label: "Employees", path: "/masters/employees" },
    ],
  },
  {
    title: "Configuration",
    color: "#A9C5A2",
    items: [
      { key: "roommaster", label: "Room Master", path: "/config/rooms" },
      { key: "menumaster", label: "Menu Master", path: "/config/menu" },
      { key: "tablemaster", label: "Table Master", path: "/config/tables" },
      { key: "barpos", label: "Bar Table Master", path: "/config/bar-tables" },
      { key: "barpos", label: "Bar Menu Master", path: "/config/bar-menu" },
      { key: "cateringmaster", label: "Catering Prices", path: "/config/catering" },
      { key: "gstmaster", label: "GST Master", path: "/config/gst" },
      { key: "roles", label: "Role Mapping", path: "/config/roles" },
    ],
  },
];
