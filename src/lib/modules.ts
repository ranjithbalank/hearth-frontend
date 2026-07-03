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
  kds: "restaurant",
  online: "restaurant",
  matreq: "restaurant",
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
    title: "Rooms",
    color: "#7FC6B3",
    items: [
      { key: "dashboard", label: "Dashboard", path: "/dashboard" },
      { key: "frontdesk", label: "Front Desk", path: "/frontdesk" },
      { key: "checkout", label: "Check-Out", path: "/checkout" },
      { key: "livegrid", label: "Live Grid", path: "/livegrid" },
      { key: "reservations", label: "Reservations", path: "/reservations" },
      { key: "folio", label: "Folios", path: "/folios" },
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
      { key: "matreq", label: "Material Requests", path: "/material-requests" },
    ],
  },
  {
    // Store: the Restaurant Inventory spec's §6 tabs as separate screens.
    // Raw materials → recipes → consumption sit together: that's the flow.
    title: "Store",
    color: "#D4B483",
    items: [
      { key: "store-dashboard", module: "inventory", label: "Store Dashboard", path: "/store" },
      { key: "store-materials", module: "inventory", label: "Raw Material Master", path: "/store/materials" },
      { key: "store-masters", module: "inventory", label: "Categories & Units", path: "/store/categories-units" },
      { key: "recipes", label: "Recipes & BOM", path: "/recipes" },
      { key: "store-consumption", module: "inventory", label: "Consumption Register", path: "/store/consumption" },
      { key: "store-movements", module: "inventory", label: "Inventory Movements", path: "/store/movements" },
      { key: "store-transfer", module: "inventory", label: "Stock Transfer", path: "/store/transfer" },
      { key: "store-wastage", module: "inventory", label: "Wastage Entry", path: "/store/wastage" },
      { key: "store-count", module: "inventory", label: "Physical Count", path: "/store/count" },
      { key: "store-lowstock", module: "inventory", label: "Low Stock / Reorder", path: "/store/low-stock" },
      { key: "store-expiry", module: "inventory", label: "Expiry Tracking", path: "/store/expiry" },
    ],
  },
  {
    title: "Back office",
    color: "#9FB6D4",
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
    title: "Masters",
    color: "#C7A8DA",
    items: [
      { key: "customers", label: "Customers", path: "/masters/customers" },
      { key: "suppliers", label: "Suppliers", path: "/masters/suppliers" },
      { key: "vendors", label: "Vendors", path: "/masters/vendors" },
      { key: "employees", label: "Employees", path: "/masters/employees" },
      { key: "pomanage", label: "Purchase Orders", path: "/masters/purchase-orders" },
    ],
  },
  {
    title: "Configuration",
    color: "#A9C5A2",
    items: [
      { key: "roommaster", label: "Room Master", path: "/config/rooms" },
      { key: "menumaster", label: "Menu Master", path: "/config/menu" },
      { key: "tablemaster", label: "Table Master", path: "/config/tables" },
      { key: "cateringmaster", label: "Catering Prices", path: "/config/catering" },
      { key: "gstmaster", label: "GST Master", path: "/config/gst" },
      { key: "roles", label: "Role Mapping", path: "/config/roles" },
    ],
  },
];
