export type Role =
  | "Super Admin"
  | "Admin"
  | "Managing Director"
  | "CEO"
  | "General Manager"
  | "Finance"
  | "Restaurant Manager"
  | "Hotel Manager"
  | "Front Office"
  | "F&B Cashier"
  | "Captain"
  | "Housekeeping"
  | "Chef / Kitchen"
  | "Store Keeper"
  | "Bar Captain"
  | "Bar Cashier";

export interface User {
  id: number;
  username: string;
  name: string;
  role: Role;
  email: string;
  allowed_modules: string[] | "*";
  mfa_enabled?: boolean;
  passcode?: string;
  discount_cap_type?: string;
  discount_cap_value?: string;
  is_active?: boolean;
}

export interface Entitlement {
  hms: boolean;
  restaurant: boolean;
  banquets: boolean;
  rms: boolean;
  bar_mode: "separate" | "combined";
}

export interface Property {
  id: number;
  name: string;
  edition: "" | "hotel" | "restaurant" | "both";
  setup_done: boolean;
  business_date: string | null;
  gstin: string;
  address: string;
  phone: string;
  logo: string;
  doc_header: string;
  doc_footer: string;
  currency: string;
  entitlement: Entitlement;
  gst_billing_mode: string;
  zomato_commission_pct: string;
  swiggy_commission_pct: string;
}

export interface Room {
  id: number;
  number: string;
  branch: string;
  room_type_name: string;
  room_type_code: string;
  floor: number;
  status: string;
  status_label: string;
  cleaning_requested: boolean;
  cleaning_note: string;
  is_sellable: boolean;
}

export interface Reservation {
  id: number;
  guest_name: string;
  guest_mobile: string;
  room_type_code: string;
  room_number: string | null;
  checkin_date: string;
  checkout_date: string;
  nights: number;
  source: string;
  source_label: string;
  status: string;
  status_label: string;
  rate: string;
  deposit: string;
  prepaid: boolean;
  precheckin?: { mobile?: string; email?: string; id_type?: string; id_number?: string; eta?: string; note?: string };
  precheckin_done?: boolean;
}

export interface FolioLine {
  id: number;
  kind: string;
  kind_label: string;
  description: string;
  taxable: string;
  cgst: string;
  sgst: string;
  total: string;
  gst_rate: string;
}

export interface Folio {
  id: number;
  guest_name: string;
  room_number: string | null;
  status: string;
  invoice_no: string;
  lines: FolioLine[];
  settlements: { id: number; tender: string; amount: string; reference: string }[];
  charges_total: string;
  paid_total: string;
  balance: string;
  routing: string;
  guest_type: string;
  company_name: string;
  billing_mode: string;
  effective_billing_mode: string;
  /** Room nights that post at check-out — preview so the bill isn't ₹0 pre-audit. */
  pending_charges: { description: string; total: string }[];
  projected_balance: string;
}

export interface Variant {
  id: number;
  name: string;
  price: string;
  short_code: string;
}
export interface AddOn {
  id: number;
  name: string;
  price: string;
}
export interface AddOnGroup {
  id: number;
  name: string;
  min_select: number;
  max_select: number;
  options: AddOn[];
}
export interface MenuItem {
  id: number;
  name: string;
  short_code: string;
  category: number;
  category_name: string;
  price: string;
  gst_rate: string;
  diet: string;
  available: boolean;
  image: string;
  station: string;
  bar_menu: boolean;
  variants?: Variant[];
  addon_groups?: AddOnGroup[];
}

export interface Table {
  id: number;
  name: string;
  section: string;
  seats: number;
  status: string;
  status_label: string;
}

export interface OrderLine {
  id: number;
  menu_item: number;
  name: string;
  qty: number;
  unit_price: string;
  note: string;
  kot_fired: boolean;
  kot_no: string | null;
}

export interface Order {
  id: number;
  mode: string;
  department: string;
  table: number | null;
  table_name: string | null;
  bar_table: number | null;
  bar_table_name: string | null;
  status: string;
  status_label: string;
  folio: number | null;
  kot_no: string;
  lines: OrderLine[];
  coupon_code: string | null;
  discount_kind: string;
  source_platform: string;
  online_status: string;
  prepaid: boolean;
  brand: string;
  token_no: number | null;
  client_uuid: string;
  totals: {
    subtotal: string; discount: string; taxable: string;
    cgst: string; sgst: string; tax: string; total: string;
  };
}
