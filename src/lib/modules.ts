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
  /** Section divider label (Daily operations / Food, beverage and supply /
   *  Back office and admin) — rendered once, above the first VISIBLE group
   *  in each zone (a role missing that zone's lead group still gets the
   *  divider ahead of whichever group of that zone it sees first). */
  zone: string;
  items: NavItem[];
}

/** Nav groups, ordered per the Hearth Grand sidebar reorder: fourteen
 *  sections across three zones (Daily operations, Food/beverage/supply,
 *  Back office & admin). Visibility is filtered by role ∧ entitlement at
 *  render regardless of grouping. */
const ZONE_DAILY = "Daily operations";
const ZONE_SUPPLY = "Food, beverage and supply";
const ZONE_BACK_OFFICE = "Back office and admin";

export const NAV: NavGroup[] = [
  // --- Daily operations ---
  {
    title: "Home",
    color: "#E0A23D",
    zone: ZONE_DAILY,
    items: [
      { key: "dashboard", label: "Dashboard", path: "/dashboard" },
      { key: "notifications", label: "Notifications", path: "/notifications" },
    ],
  },
  {
    title: "Front office",
    color: "#7FC6B3",
    zone: ZONE_DAILY,
    items: [
      { key: "reservations", label: "Reservations", path: "/reservations" },
      { key: "frontdesk", label: "Front Desk", path: "/frontdesk" },
      { key: "livegrid", label: "Live Grid", path: "/livegrid" },
      { key: "folio", label: "Folios", path: "/folios" },
      { key: "checkout", label: "Check-Out", path: "/checkout" },
      { key: "roommaster", label: "Room Master", path: "/config/rooms" },
    ],
  },
  {
    title: "Housekeeping & maintenance",
    color: "#8FB3A3",
    zone: ZONE_DAILY,
    items: [
      { key: "housekeeping", label: "Housekeeping", path: "/housekeeping" },
      { key: "engineering", label: "Engineering", path: "/engineering" },
    ],
  },
  {
    title: "Guests & CRM",
    color: "#C9A66B",
    zone: ZONE_DAILY,
    items: [
      { key: "crm", label: "Guest CRM", path: "/crm" },
      { key: "customers", label: "Customers", path: "/masters/customers" },
    ],
  },
  {
    title: "Banquets & events",
    color: "#B98FAE",
    zone: ZONE_DAILY,
    items: [
      { key: "banquets", label: "Banquets & Events", path: "/banquets" },
      { key: "cateringmaster", label: "Catering Prices", path: "/config/catering" },
    ],
  },
  // --- Food, beverage and supply ---
  {
    title: "Restaurant",
    color: "#E89B6C",
    zone: ZONE_SUPPLY,
    items: [
      { key: "pos", label: "Restaurant POS", path: "/pos" },
      { key: "kds", label: "Kitchen Display", path: "/kds" },
      { key: "online", label: "Online Orders", path: "/online-orders" },
      { key: "menumaster", label: "Menu Master", path: "/config/menu" },
      { key: "tablemaster", label: "Table Master", path: "/config/tables" },
    ],
  },
  {
    // Its own operation, separate from the restaurant floor — own tables, own login.
    title: "Bar",
    color: "#C77B5D",
    zone: ZONE_SUPPLY,
    items: [
      { key: "barpos", label: "Bar POS", path: "/barpos" },
      { key: "barmenumaster", module: "barpos", label: "Bar Menu Master", path: "/config/bar-menu" },
      { key: "bartablemaster", module: "barpos", label: "Bar Table Master", path: "/config/bar-tables" },
    ],
  },
  {
    title: "Store & inventory",
    color: "#D4B483",
    zone: ZONE_SUPPLY,
    items: [
      { key: "store-dashboard", module: "inventory", label: "Store Dashboard", path: "/store" },
      { key: "store-control", module: "inventory", label: "Stock Control", path: "/store/stock-control" },
      { key: "store-movements", module: "inventory", label: "Movements & Consumption", path: "/store/movements" },
      { key: "recipes", label: "Recipes & BOM", path: "/recipes" },
      { key: "store-materials", module: "inventory", label: "Raw Material Master", path: "/store/materials" },
      { key: "store-masters", module: "inventory", label: "Categories & Units", path: "/store/categories-units" },
    ],
  },
  {
    title: "Purchasing",
    color: "#A3B08C",
    zone: ZONE_SUPPLY,
    items: [
      { key: "matreq", label: "Material Requests", path: "/material-requests" },
      { key: "procurement", label: "Procurement", path: "/procurement" },
      { key: "pomanage", label: "Purchase Orders", path: "/masters/purchase-orders" },
      { key: "suppliers", label: "Suppliers", path: "/masters/suppliers" },
      { key: "vendors", label: "Vendors", path: "/masters/vendors" },
    ],
  },
  // --- Back office and admin ---
  {
    title: "Revenue & distribution",
    color: "#E8B07A",
    zone: ZONE_BACK_OFFICE,
    items: [
      { key: "revenue", label: "Revenue Manager", path: "/revenue" },
      { key: "channel", label: "Channel Manager", path: "/channel" },
      { key: "booking", label: "Booking Engine", path: "/booking" },
    ],
  },
  {
    title: "Finance",
    color: "#9FB6D4",
    zone: ZONE_BACK_OFFICE,
    items: [
      { key: "accounting", label: "Accounting", path: "/accounting" },
      { key: "tax", label: "Tax & GST", path: "/tax" },
      { key: "gstmaster", label: "GST Master", path: "/config/gst" },
    ],
  },
  {
    title: "HR & staff",
    color: "#B8A28C",
    zone: ZONE_BACK_OFFICE,
    items: [
      { key: "hr", label: "HR & Staff", path: "/hr" },
      { key: "employees", label: "Employees", path: "/masters/employees" },
    ],
  },
  {
    title: "Reports & insights",
    color: "#C7A8DA",
    zone: ZONE_BACK_OFFICE,
    items: [
      { key: "execdashboard", label: "Executive Overview", path: "/executive" },
      { key: "reports", label: "Reports", path: "/reports" },
    ],
  },
  {
    title: "Administration",
    color: "#A9C5A2",
    zone: ZONE_BACK_OFFICE,
    items: [
      { key: "branchmaster", label: "Branch Master", path: "/config/branches" },
      { key: "roles", label: "Role Mapping", path: "/config/roles" },
      { key: "settings", label: "Settings", path: "/settings" },
    ],
  },
];
