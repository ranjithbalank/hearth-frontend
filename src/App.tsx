import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import { AppShell } from "./shell/AppShell";
import { RequireAccess } from "./shell/RequireAccess";
import { Spinner } from "./design/ui";
import { useApp } from "./lib/app-context";
import { Accounting } from "./features/accounting/Accounting";
import { Banquets } from "./features/banquets/Banquets";
import { BarMenu } from "./features/barpos/BarMenu";
import { BarPos } from "./features/barpos/BarPos";
import { BarTableMaster } from "./features/barpos/BarTableMaster";
import { Booking } from "./features/booking/Booking";
import { Channel } from "./features/channel/Channel";
import { CateringPrices } from "./features/config/CateringPrices";
import { GstMaster } from "./features/config/GstMaster";
import { MenuMaster } from "./features/config/MenuMaster";
import { RoleMatrix } from "./features/config/RoleMatrix";
import { RoomMaster } from "./features/config/RoomMaster";
import { TableMaster } from "./features/config/TableMaster";
import { Crm } from "./features/crm/Crm";
import { Customers } from "./features/masters/Customers";
import { Employees } from "./features/masters/Employees";
import { PurchaseOrders } from "./features/masters/PurchaseOrders";
import { Suppliers } from "./features/masters/Suppliers";
import { Vendors } from "./features/masters/Vendors";
import { Dashboard } from "./features/dashboard/Dashboard";
import { Engineering } from "./features/engineering/Engineering";
import { Executive } from "./features/executive/Executive";
import { Folios } from "./features/folio/Folios";
import { Hr } from "./features/hr/Hr";
import { Inventory } from "./features/inventory/Inventory";
import { NewRawMaterial } from "./features/inventory/NewRawMaterial";
import { Kds } from "./features/kds/Kds";
import { MaterialRequests } from "./features/matreq/MaterialRequests";
import { Notifications } from "./features/notifications/Notifications";
import { OnlineOrders } from "./features/online/OnlineOrders";
import { Procurement } from "./features/procurement/Procurement";
import { NewRecipe } from "./features/recipes/NewRecipe";
import { Recipes } from "./features/recipes/Recipes";
import { Revenue } from "./features/revenue/Revenue";
import { CheckIn } from "./features/frontdesk/CheckIn";
import { CheckOut } from "./features/frontdesk/CheckOut";
import { FrontDesk } from "./features/frontdesk/FrontDesk";
import { Housekeeping } from "./features/housekeeping/Housekeeping";
import { LiveGrid } from "./features/livegrid/LiveGrid";
import { Login } from "./features/auth/Login";
import { Pos } from "./features/pos/Pos";
import { TokenBoard } from "./features/pos/TokenBoard";
import { Reconciliation } from "./features/pos/Reconciliation";
import { FeedbackPage, OrderStatusPage, PreCheckinPage, QrOrderPage } from "./features/public/GuestPages";
import { Reports } from "./features/reports/Reports";
import { Reservations } from "./features/reservations/Reservations";
import { Settings } from "./features/settings/Settings";
import { Setup } from "./features/auth/Setup";
import { TaxGst } from "./features/tax/TaxGst";

export default function App() {
  const { loading, property, user, landing } = useApp();
  const { pathname } = useLocation();

  // Guest-facing pages (table QR ordering, bill QR links, pre-arrival check-in)
  // — no login, no shell.
  if (pathname.startsWith("/feedback") || pathname.startsWith("/order-status")
      || pathname.startsWith("/pre-checkin") || pathname.startsWith("/qr")) {
    return (
      <Routes>
        <Route path="/feedback" element={<FeedbackPage />} />
        <Route path="/order-status" element={<OrderStatusPage />} />
        <Route path="/pre-checkin" element={<PreCheckinPage />} />
        <Route path="/qr" element={<QrOrderPage />} />
      </Routes>
    );
  }

  if (loading) return <Spinner />;

  // One-time property setup gate.
  if (!property?.setup_done) return <Setup />;

  // Auth gate.
  if (!user) return <Login />;

  return (
    <AppShell>
      <Routes>
        <Route path="/executive" element={<RequireAccess module="execdashboard"><Executive /></RequireAccess>} />
        <Route path="/dashboard" element={<RequireAccess module="dashboard"><Dashboard /></RequireAccess>} />
        <Route path="/frontdesk" element={<RequireAccess module="frontdesk"><FrontDesk /></RequireAccess>} />
        <Route path="/checkin" element={<RequireAccess module="checkin"><CheckIn /></RequireAccess>} />
        <Route path="/checkout" element={<RequireAccess module="checkout"><CheckOut /></RequireAccess>} />
        <Route path="/masters/customers" element={<RequireAccess module="customers"><Customers /></RequireAccess>} />
        <Route path="/masters/suppliers" element={<RequireAccess module="suppliers"><Suppliers /></RequireAccess>} />
        <Route path="/masters/vendors" element={<RequireAccess module="vendors"><Vendors /></RequireAccess>} />
        <Route path="/masters/employees" element={<RequireAccess module="employees"><Employees /></RequireAccess>} />
        <Route path="/masters/purchase-orders" element={<RequireAccess module="pomanage"><PurchaseOrders /></RequireAccess>} />
        <Route path="/config/gst" element={<RequireAccess module="gstmaster"><GstMaster /></RequireAccess>} />
        <Route path="/livegrid" element={<RequireAccess module="livegrid"><LiveGrid /></RequireAccess>} />
        <Route path="/reservations" element={<RequireAccess module="reservations"><Reservations /></RequireAccess>} />
        <Route path="/folios" element={<RequireAccess module="folio"><Folios /></RequireAccess>} />
        <Route path="/housekeeping" element={<RequireAccess module="housekeeping"><Housekeeping /></RequireAccess>} />
        <Route path="/revenue" element={<RequireAccess module="revenue"><Revenue /></RequireAccess>} />
        <Route path="/channel" element={<RequireAccess module="channel"><Channel /></RequireAccess>} />
        <Route path="/booking" element={<RequireAccess module="booking"><Booking /></RequireAccess>} />
        <Route path="/crm" element={<RequireAccess module="crm"><Crm /></RequireAccess>} />
        <Route path="/notifications" element={<RequireAccess module="notifications"><Notifications /></RequireAccess>} />
        <Route path="/pos" element={<RequireAccess module="pos"><Pos /></RequireAccess>} />
        <Route path="/tokens" element={<RequireAccess module="pos"><TokenBoard /></RequireAccess>} />
        <Route path="/reconciliation" element={<RequireAccess module="pos"><Reconciliation /></RequireAccess>} />
        <Route path="/kds" element={<RequireAccess module="kds"><Kds /></RequireAccess>} />
        <Route path="/online-orders" element={<RequireAccess module="online"><OnlineOrders /></RequireAccess>} />
        {/* Bar: its own operation, separate from the restaurant floor. */}
        <Route path="/barpos" element={<RequireAccess module="barpos"><BarPos /></RequireAccess>} />
        <Route path="/config/bar-tables" element={<RequireAccess module="barpos"><BarTableMaster /></RequireAccess>} />
        <Route path="/config/bar-menu" element={<RequireAccess module="barpos"><BarMenu /></RequireAccess>} />
        {/* Store: the Restaurant Inventory spec's §6 screens, each standalone.
            /inventory stays as the all-tabs view for old links. */}
        <Route path="/inventory" element={<RequireAccess module="inventory"><Inventory /></RequireAccess>} />
        <Route path="/store" element={<RequireAccess module="inventory"><Inventory fixedTab="dashboard" /></RequireAccess>} />
        <Route path="/store/materials" element={<RequireAccess module="inventory"><Inventory fixedTab="materials" /></RequireAccess>} />
        <Route path="/store/materials/new" element={<RequireAccess module="inventory"><NewRawMaterial /></RequireAccess>} />
        <Route path="/store/categories-units" element={<RequireAccess module="inventory"><Inventory fixedTab="masters" /></RequireAccess>} />
        <Route path="/store/consumption" element={<RequireAccess module="inventory"><Inventory fixedTab="movements" /></RequireAccess>} />
        <Route path="/store/movements" element={<RequireAccess module="inventory"><Inventory fixedTab="movements" /></RequireAccess>} />
        {/* Stock Control bundles low stock, expiry, wastage, count & transfer;
            the old individual paths land on the same screen. */}
        {["/store/stock-control", "/store/transfer", "/store/wastage", "/store/count",
          "/store/low-stock", "/store/expiry"].map((p) => (
          <Route key={p} path={p} element={
            <RequireAccess module="inventory">
              <Inventory title="Stock Control"
                tabGroup={["lowstock", "expiry", "wastage", "stockcount", "transfer"]} />
            </RequireAccess>
          } />
        ))}
        <Route path="/procurement" element={<RequireAccess module="procurement"><Procurement /></RequireAccess>} />
        <Route path="/material-requests" element={<RequireAccess module="matreq"><MaterialRequests /></RequireAccess>} />
        <Route path="/recipes" element={<RequireAccess module="recipes"><Recipes /></RequireAccess>} />
        <Route path="/recipes/new" element={<RequireAccess module="recipes"><NewRecipe /></RequireAccess>} />
        <Route path="/banquets" element={<RequireAccess module="banquets"><Banquets /></RequireAccess>} />
        <Route path="/hr" element={<RequireAccess module="hr"><Hr /></RequireAccess>} />
        <Route path="/accounting" element={<RequireAccess module="accounting"><Accounting /></RequireAccess>} />
        <Route path="/tax" element={<RequireAccess module="tax"><TaxGst /></RequireAccess>} />
        <Route path="/engineering" element={<RequireAccess module="engineering"><Engineering /></RequireAccess>} />
        <Route path="/reports" element={<RequireAccess module="reports"><Reports /></RequireAccess>} />
        <Route path="/settings" element={<RequireAccess module="settings"><Settings /></RequireAccess>} />
        <Route path="/config/rooms" element={<RequireAccess module="roommaster"><RoomMaster /></RequireAccess>} />
        <Route path="/config/menu" element={<RequireAccess module="menumaster"><MenuMaster /></RequireAccess>} />
        <Route path="/config/tables" element={<RequireAccess module="tablemaster"><TableMaster /></RequireAccess>} />
        <Route path="/config/catering" element={<RequireAccess module="cateringmaster"><CateringPrices /></RequireAccess>} />
        <Route path="/config/roles" element={<RequireAccess module="roles"><RoleMatrix /></RequireAccess>} />
        <Route path="*" element={<Navigate to={landing()} replace />} />
      </Routes>
    </AppShell>
  );
}
