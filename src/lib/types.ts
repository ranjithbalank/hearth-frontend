export type Role =
  | "Managing Director"
  | "General Manager"
  | "Front Office"
  | "F&B Cashier"
  | "Housekeeping";

export interface User {
  id: number;
  username: string;
  name: string;
  role: Role;
  email: string;
  allowed_modules: string[] | "*";
  mfa_enabled?: boolean;
}

export interface Entitlement {
  hms: boolean;
  restaurant: boolean;
  banquets: boolean;
  rms: boolean;
}

export interface Property {
  id: number;
  name: string;
  edition: "" | "hotel" | "restaurant" | "both";
  setup_done: boolean;
  business_date: string | null;
  gstin: string;
  currency: string;
  entitlement: Entitlement;
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
  is_sellable: boolean;
}

export interface Reservation {
  id: number;
  guest_name: string;
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
}

export interface Order {
  id: number;
  mode: string;
  table: number | null;
  table_name: string | null;
  status: string;
  status_label: string;
  folio: number | null;
  kot_no: string;
  lines: OrderLine[];
  totals: { taxable: string; cgst: string; sgst: string; tax: string; total: string };
}
