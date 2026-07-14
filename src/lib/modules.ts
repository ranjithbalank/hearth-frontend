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

/** Where each /notifications alert's `module` key deep-links to — shared by the
 * Notifications list page and the header bell's toast popups, so both stay in sync. */
export const ALERT_ROUTES: Record<string, string> = {
  inventory: "/inventory",
  engineering: "/engineering",
  channel: "/channel",
  procurement: "/procurement",
  banquets: "/banquets",
  reports: "/reports",
  recipes: "/recipes?tab=pending",
  housekeeping: "/housekeeping",
  livegrid: "/livegrid",
  frontdesk: "/frontdesk",
  barpos: "/barpos",
  matreq: "/material-requests",
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
  /** accent colour for this group (vestigial — the sidebar renders icons in
   *  white/primary; kept because RoleMatrix reads it for its group chips) */
  color: string;
  /** Section divider label (Operations / Food & beverage / Back office /
   *  Setup) — rendered once, above the first VISIBLE group in each zone
   *  (a role missing that zone's lead group still gets the divider ahead
   *  of whichever group of that zone it sees first). */
  zone: string;
  items: NavItem[];
}

/** Nav groups: eleven sections across four zones. Daily-work screens live in
 *  the first three zones; every config/master screen sits in the trailing
 *  "Setup" zone so operational groups stay uncluttered. Visibility is
 *  filtered by role ∧ entitlement at render regardless of grouping. */
const ZONE_OPS = "Operations";
const ZONE_FNB = "Food & beverage";
const ZONE_BACK_OFFICE = "Back office";
const ZONE_SETUP = "Setup";

export const NAV: NavGroup[] = [
  // --- Operations ---
  {
    title: "Home",
    color: "#60A5FA",
    zone: ZONE_OPS,
    items: [
      { key: "dashboard", label: "Dashboard", path: "/dashboard" },
      { key: "execdashboard", label: "Executive Overview", path: "/executive" },
      { key: "reports", label: "Reports", path: "/reports" },
      { key: "notifications", label: "Notifications", path: "/notifications" },
    ],
  },
  {
    title: "Front office",
    color: "#93C5FD",
    zone: ZONE_OPS,
    items: [
      { key: "reservations", label: "Reservations", path: "/reservations" },
      { key: "frontdesk", label: "Front Desk", path: "/frontdesk" },
      { key: "livegrid", label: "Live Grid", path: "/livegrid" },
      { key: "folio", label: "Folios", path: "/folios" },
      { key: "checkout", label: "Check-Out", path: "/checkout" },
    ],
  },
  {
    title: "Guests & events",
    color: "#7DD3FC",
    zone: ZONE_OPS,
    items: [
      { key: "crm", label: "Guest CRM", path: "/crm" },
      { key: "customers", label: "Customers", path: "/masters/customers" },
      { key: "banquets", label: "Banquets & Events", path: "/banquets" },
    ],
  },
  {
    title: "Housekeeping & maintenance",
    color: "#A5B4FC",
    zone: ZONE_OPS,
    items: [
      { key: "housekeeping", label: "Housekeeping", path: "/housekeeping" },
      { key: "engineering", label: "Engineering", path: "/engineering" },
    ],
  },
  // --- Food & beverage ---
  {
    title: "Restaurant & bar",
    color: "#60A5FA",
    zone: ZONE_FNB,
    items: [
      { key: "pos", label: "Restaurant POS", path: "/pos" },
      { key: "barpos", label: "Bar POS", path: "/barpos" },
      { key: "kds", label: "Kitchen Display", path: "/kds" },
      { key: "online", label: "Online Orders", path: "/online-orders" },
    ],
  },
  {
    title: "Store & inventory",
    color: "#93C5FD",
    zone: ZONE_FNB,
    items: [
      { key: "store-dashboard", module: "inventory", label: "Store Dashboard", path: "/store" },
      { key: "store-control", module: "inventory", label: "Stock Control", path: "/store/stock-control" },
      { key: "store-movements", module: "inventory", label: "Movements & Consumption", path: "/store/movements" },
      { key: "recipes", label: "Recipes & BOM", path: "/recipes" },
    ],
  },
  {
    title: "Purchasing",
    color: "#7DD3FC",
    zone: ZONE_FNB,
    items: [
      { key: "matreq", label: "Material Requests", path: "/material-requests" },
      { key: "procurement", label: "Procurement", path: "/procurement" },
      { key: "pomanage", label: "Purchase Orders", path: "/masters/purchase-orders" },
      { key: "suppliers", label: "Suppliers", path: "/masters/suppliers" },
      { key: "vendors", label: "Vendors", path: "/masters/vendors" },
    ],
  },
  // --- Back office ---
  {
    title: "Revenue & finance",
    color: "#60A5FA",
    zone: ZONE_BACK_OFFICE,
    items: [
      { key: "revenue", label: "Revenue Manager", path: "/revenue" },
      { key: "channel", label: "Channel Manager", path: "/channel" },
      { key: "booking", label: "Booking Engine", path: "/booking" },
      { key: "accounting", label: "Accounting", path: "/accounting" },
      { key: "tax", label: "Tax & GST", path: "/tax" },
    ],
  },
  {
    title: "HR & staff",
    color: "#93C5FD",
    zone: ZONE_BACK_OFFICE,
    items: [
      { key: "hr", label: "HR & Staff", path: "/hr" },
      { key: "leave", label: "Leave", path: "/leave" },
      { key: "employees", label: "Employees", path: "/masters/employees" },
    ],
  },
  // --- Setup ---
  {
    title: "Masters",
    color: "#60A5FA",
    zone: ZONE_SETUP,
    items: [
      { key: "roommaster", label: "Room Master", path: "/config/rooms" },
      { key: "tablemaster", label: "Table Master", path: "/config/tables" },
      { key: "menumaster", label: "Menu Master", path: "/config/menu" },
      { key: "barmenumaster", module: "barpos", label: "Bar Menu Master", path: "/config/bar-menu" },
      { key: "bartablemaster", module: "barpos", label: "Bar Table Master", path: "/config/bar-tables" },
      { key: "cateringmaster", label: "Catering Prices", path: "/config/catering" },
      { key: "store-materials", module: "inventory", label: "Raw Material Master", path: "/store/materials" },
      { key: "store-masters", module: "inventory", label: "Categories & Units", path: "/store/categories-units" },
      { key: "gstmaster", label: "GST Master", path: "/config/gst" },
    ],
  },
  {
    title: "Administration",
    color: "#93C5FD",
    zone: ZONE_SETUP,
    items: [
      { key: "branchmaster", label: "Branch Master", path: "/config/branches" },
      { key: "roles", label: "Role Mapping", path: "/config/roles" },
      { key: "settings", label: "Settings", path: "/settings" },
    ],
  },
];
