import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { PageHeader, Spinner, Stat } from "../../design/ui";
import { api } from "../../lib/api";
import { useApp } from "../../lib/app-context";
import { inr } from "../../lib/money";

interface DashboardData {
  view: "hotel" | "restaurant" | "combined";
  rooms?: { occupancy_pct: number; adr: number; revpar: number; occupied: number; rooms_total: number; room_revenue: string; available: number; dirty: number; ooo: number };
  fnb?: { fnb_sales: string; order_count: number; by_mode: Record<string, string> };
  receivables?: { total: string; corporate: string; corporate_accounts: number };
}

// Whoever can sign off a Chef-proposed dish gets a standing reminder here —
// not just a one-off notification they might miss.
const MENU_APPROVER_ROLES = ["Super Admin", "Managing Director", "General Manager", "Restaurant Manager"];

const TITLES: Record<DashboardData["view"], { title: string; subtitle: string }> = {
  hotel: { title: "Hotel Dashboard", subtitle: "Live room performance" },
  restaurant: { title: "Restaurant Dashboard", subtitle: "Live restaurant performance" },
  combined: { title: "Dashboard", subtitle: "Live operational performance" },
};

export function Dashboard() {
  const nav = useNavigate();
  const { user } = useApp();
  const canApprove = MENU_APPROVER_ROLES.includes(user?.role ?? "");
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => (await api.get<DashboardData>("/reports/dashboard/")).data,
  });
  const { data: pendingDishes } = useQuery({
    queryKey: ["recipe-pending"],
    queryFn: async () => (await api.get<unknown[]>("/recipes/pending_dishes/")).data,
    enabled: canApprove,
  });

  if (isLoading || !data) return <Spinner />;
  const { title, subtitle } = TITLES[data.view];

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} />

      <div className="grid grid-cols-4 gap-4">
        {data.rooms && (
          <>
            <Stat tone="dark" label="Occupancy" value={`${data.rooms.occupancy_pct}%`} sub={`${data.rooms.occupied}/${data.rooms.rooms_total} rooms`} />
            <Stat label="ADR" value={inr(data.rooms.adr)} sub="Average daily rate" />
            <Stat label="RevPAR" value={inr(data.rooms.revpar)} sub="Revenue per available room" />
          </>
        )}
        {data.fnb && (
          <Stat tone={data.rooms ? undefined : "dark"} label="F&B sales" value={inr(data.fnb.fnb_sales)} sub={`${data.fnb.order_count} orders`} />
        )}
      </div>

      {/* Room status breakdown */}
      {data.rooms && (
        <div className="grid grid-cols-4 gap-4 mt-4">
          <Stat label="Total rooms" value={data.rooms.rooms_total} />
          <Stat label="Occupied" value={data.rooms.occupied} sub="In-house" />
          <Stat label="Available to sell" value={data.rooms.available} sub="Clean & inspected" />
          <Stat label="Dirty / OOO" value={`${data.rooms.dirty} / ${data.rooms.ooo}`} sub="Being cleaned / out of order" />
        </div>
      )}

      {data.receivables && (
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
      )}

      {canApprove && (
        <button
          onClick={() => nav("/recipes?tab=pending")}
          className="card p-5 text-left hover:bg-cream mt-4 w-full flex items-center justify-between"
        >
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">Dish approvals</div>
            <div className={`stat-num text-2xl mt-1 ${(pendingDishes?.length ?? 0) > 0 ? "text-clay" : "text-pine"}`}>
              {pendingDishes?.length ?? 0} pending
            </div>
            <div className="text-sm text-muted mt-1">
              {(pendingDishes?.length ?? 0) > 0
                ? "New dish(es) proposed by Chef — waiting on your sign-off"
                : "All caught up — no new dishes waiting"}
            </div>
          </div>
          <span className="text-pine text-sm">Review →</span>
        </button>
      )}

      {data.fnb && (
        <div className="grid grid-cols-3 gap-4 mt-4">
          {(["dinein", "takeaway", "delivery"] as const).map((m) => (
            <div key={m} className="card p-5">
              <div className="text-xs uppercase tracking-wide text-muted">{m}</div>
              <div className="stat-num text-2xl mt-1">{inr(data.fnb!.by_mode[m] ?? 0)}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mt-4">
        {data.rooms && (
          <button className="card p-5 text-left hover:bg-cream" onClick={() => nav("/frontdesk")}>
            <div className="font-semibold">Front Desk →</div>
            <div className="text-sm text-muted mt-1">Check in arrivals, manage folios</div>
          </button>
        )}
        {data.fnb && (
          <button className="card p-5 text-left hover:bg-cream" onClick={() => nav("/pos")}>
            <div className="font-semibold">Restaurant POS →</div>
            <div className="text-sm text-muted mt-1">Take orders, fire KOTs, settle</div>
          </button>
        )}
        {data.rooms && (
          <button className="card p-5 text-left hover:bg-cream" onClick={() => nav("/housekeeping")}>
            <div className="font-semibold">Housekeeping →</div>
            <div className="text-sm text-muted mt-1">Room status &amp; turnaround</div>
          </button>
        )}
      </div>
    </div>
  );
}
