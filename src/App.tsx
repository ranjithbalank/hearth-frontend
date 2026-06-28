import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./shell/AppShell";
import { RequireAccess } from "./shell/RequireAccess";
import { Spinner } from "./design/ui";
import { useApp } from "./lib/app-context";
import { Accounting } from "./features/accounting/Accounting";
import { Booking } from "./features/booking/Booking";
import { Channel } from "./features/channel/Channel";
import { Crm } from "./features/crm/Crm";
import { Dashboard } from "./features/dashboard/Dashboard";
import { Engineering } from "./features/engineering/Engineering";
import { Executive } from "./features/executive/Executive";
import { Folios } from "./features/folio/Folios";
import { Revenue } from "./features/revenue/Revenue";
import { FrontDesk } from "./features/frontdesk/FrontDesk";
import { Housekeeping } from "./features/housekeeping/Housekeeping";
import { LiveGrid } from "./features/livegrid/LiveGrid";
import { Login } from "./features/auth/Login";
import { Pos } from "./features/pos/Pos";
import { Reports } from "./features/reports/Reports";
import { Reservations } from "./features/reservations/Reservations";
import { Settings } from "./features/settings/Settings";
import { Setup } from "./features/auth/Setup";
import { TaxGst } from "./features/tax/TaxGst";

export default function App() {
  const { loading, property, user } = useApp();

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
        <Route path="/livegrid" element={<RequireAccess module="livegrid"><LiveGrid /></RequireAccess>} />
        <Route path="/reservations" element={<RequireAccess module="reservations"><Reservations /></RequireAccess>} />
        <Route path="/folios" element={<RequireAccess module="folio"><Folios /></RequireAccess>} />
        <Route path="/housekeeping" element={<RequireAccess module="housekeeping"><Housekeeping /></RequireAccess>} />
        <Route path="/revenue" element={<RequireAccess module="revenue"><Revenue /></RequireAccess>} />
        <Route path="/channel" element={<RequireAccess module="channel"><Channel /></RequireAccess>} />
        <Route path="/booking" element={<RequireAccess module="booking"><Booking /></RequireAccess>} />
        <Route path="/crm" element={<RequireAccess module="crm"><Crm /></RequireAccess>} />
        <Route path="/pos" element={<RequireAccess module="pos"><Pos /></RequireAccess>} />
        <Route path="/accounting" element={<RequireAccess module="accounting"><Accounting /></RequireAccess>} />
        <Route path="/tax" element={<RequireAccess module="tax"><TaxGst /></RequireAccess>} />
        <Route path="/engineering" element={<RequireAccess module="engineering"><Engineering /></RequireAccess>} />
        <Route path="/reports" element={<RequireAccess module="reports"><Reports /></RequireAccess>} />
        <Route path="/settings" element={<RequireAccess module="settings"><Settings /></RequireAccess>} />
        <Route path="*" element={<Navigate to={user.role === "Managing Director" ? "/executive" : "/dashboard"} replace />} />
      </Routes>
    </AppShell>
  );
}
