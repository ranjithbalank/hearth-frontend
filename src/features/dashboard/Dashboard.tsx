import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { PageHeader, Spinner, Stat } from "../../design/ui";
import { api } from "../../lib/api";
import { inr } from "../../lib/money";

interface DashboardData {
  rooms: { occupancy_pct: number; adr: number; revpar: number; occupied: number; rooms_total: number; room_revenue: string };
  fnb: { fnb_sales: string; order_count: number; by_mode: Record<string, string> };
  receivables: { total: string; corporate: string; corporate_accounts: number };
}

export function Dashboard() {
  const nav = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => (await api.get<DashboardData>("/reports/dashboard/")).data,
  });

  if (isLoading || !data) return <Spinner />;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Live operational performance" />
      <div className="grid grid-cols-4 gap-4">
        <Stat tone="dark" label="Occupancy" value={`${data.rooms.occupancy_pct}%`} sub={`${data.rooms.occupied}/${data.rooms.rooms_total} rooms`} />
        <Stat label="ADR" value={inr(data.rooms.adr)} sub="Average daily rate" />
        <Stat label="RevPAR" value={inr(data.rooms.revpar)} sub="Revenue per available room" />
        <Stat label="F&B sales" value={inr(data.fnb.fnb_sales)} sub={`${data.fnb.order_count} orders`} />
      </div>

      <button
        onClick={() => nav("/crm")}
        className="card p-5 text-left hover:bg-cream mt-4 w-full flex items-center justify-between"
      >
        <div>
          <div className="text-xs uppercase tracking-wide text-muted">Accounts receivable</div>
          <div className={`stat-num text-2xl mt-1 ${Number(data.receivables.total) > 0 ? "text-clay" : "text-pine"}`}>
            {inr(data.receivables.total)}
          </div>
          <div className="text-sm text-muted mt-1">
            {data.receivables.corporate_accounts} corporate account(s) · {inr(data.receivables.corporate)} bill-to-company
          </div>
        </div>
        <span className="text-pine text-sm">View ledger →</span>
      </button>

      <div className="grid grid-cols-3 gap-4 mt-4">
        {(["dinein", "takeaway", "delivery"] as const).map((m) => (
          <div key={m} className="card p-5">
            <div className="text-xs uppercase tracking-wide text-muted">{m}</div>
            <div className="stat-num text-2xl mt-1">{inr(data.fnb.by_mode[m] ?? 0)}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4 mt-4">
        <button className="card p-5 text-left hover:bg-cream" onClick={() => nav("/frontdesk")}>
          <div className="font-semibold">Front Desk →</div>
          <div className="text-sm text-muted mt-1">Check in arrivals, manage folios</div>
        </button>
        <button className="card p-5 text-left hover:bg-cream" onClick={() => nav("/pos")}>
          <div className="font-semibold">Restaurant POS →</div>
          <div className="text-sm text-muted mt-1">Take orders, fire KOTs, settle</div>
        </button>
        <button className="card p-5 text-left hover:bg-cream" onClick={() => nav("/housekeeping")}>
          <div className="font-semibold">Housekeeping →</div>
          <div className="text-sm text-muted mt-1">Room status &amp; turnaround</div>
        </button>
      </div>
    </div>
  );
}
