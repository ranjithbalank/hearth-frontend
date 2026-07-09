import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { Card, PageHeader, Spinner, Stat } from "../../design/ui";
import { NavIcon } from "../../design/NavIcon";
import { api } from "../../lib/api";
import { useApp } from "../../lib/app-context";
import { inr, num } from "../../lib/money";

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

type ViewMode = "analytical" | "data";
const VIEW_KEY = "hearth-dashboard-view";

function loadViewMode(): ViewMode {
  return localStorage.getItem(VIEW_KEY) === "data" ? "data" : "analytical";
}

export function Dashboard() {
  const nav = useNavigate();
  const { user } = useApp();
  const canApprove = MENU_APPROVER_ROLES.includes(user?.role ?? "");
  const [viewMode, setViewMode] = useState<ViewMode>(loadViewMode);
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => (await api.get<DashboardData>("/reports/dashboard/")).data,
  });
  const { data: pendingDishes } = useQuery({
    queryKey: ["recipe-pending"],
    queryFn: async () => (await api.get<unknown[]>("/recipes/pending_dishes/")).data,
    enabled: canApprove,
  });

  function chooseView(mode: ViewMode) {
    setViewMode(mode);
    localStorage.setItem(VIEW_KEY, mode);
  }

  if (isLoading || !data) return <Spinner />;
  const { title, subtitle } = TITLES[data.view];

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        action={
          <div className="flex gap-1 rounded-pill bg-hairline p-1">
            {(["analytical", "data"] as const).map((m) => (
              <button
                key={m}
                onClick={() => chooseView(m)}
                className={`pill ${viewMode === m ? "bg-ink text-white" : "bg-transparent text-body"}`}
              >
                {m === "analytical" ? "Analytical view" : "Data view"}
              </button>
            ))}
          </div>
        }
      />

      {viewMode === "analytical" ? <AnalyticalView data={data} /> : <DataView data={data} />}

      {(data.receivables || canApprove) && (
        <div className="grid grid-cols-2 gap-4 mt-4">
          {data.receivables && (
            <button
              onClick={() => nav("/crm")}
              className="card p-5 text-left hover:bg-cream w-full flex items-center justify-between"
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
              className="card p-5 text-left hover:bg-cream w-full flex items-center justify-between"
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

function ProportionRow({ label, display, pct, fill }: { label: string; display: string; pct: number; fill: string }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span className="text-muted tabular-nums">{display} · {pct}%</span>
      </div>
      <div className="h-2 rounded-pill bg-hairline overflow-hidden">
        <div className={`h-full ${fill}`} style={{ width: `${pct > 0 ? Math.max(pct, 2) : 0}%` }} />
      </div>
    </div>
  );
}

function AnalyticalView({ data }: { data: DashboardData }) {
  const rooms = data.rooms;
  const fnb = data.fnb;
  const roomsTotal = rooms?.rooms_total || 0;
  const revenueMixTotal = rooms && fnb ? num(rooms.room_revenue) + num(fnb.fnb_sales) : 0;
  const fnbTotal = fnb ? Object.values(fnb.by_mode).reduce((s, v) => s + num(v), 0) : 0;

  return (
    <>
      <div className="grid grid-cols-4 gap-4">
        {rooms && (
          <>
            <Stat tone="dark" label="Occupancy" value={`${rooms.occupancy_pct}%`} sub={`${rooms.occupied}/${rooms.rooms_total} rooms`} />
            <Stat label="ADR" value={inr(rooms.adr)} sub="Average daily rate" />
            <Stat label="RevPAR" value={inr(rooms.revpar)} sub="Revenue per available room" />
          </>
        )}
        {fnb && (
          <Stat tone={rooms ? undefined : "dark"} label="F&B sales" value={inr(fnb.fnb_sales)} sub={`${fnb.order_count} orders`} />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4 items-start">
        {rooms && roomsTotal > 0 && (
          <Card>
            <div className="font-semibold mb-4">Room status mix</div>
            <div className="space-y-3">
              <ProportionRow label="Occupied" display={`${rooms.occupied} rooms`} pct={Math.round((rooms.occupied / roomsTotal) * 100)} fill="bg-pine" />
              <ProportionRow label="Available to sell" display={`${rooms.available} rooms`} pct={Math.round((rooms.available / roomsTotal) * 100)} fill="bg-info" />
              <ProportionRow label="Dirty / out of order" display={`${rooms.dirty + rooms.ooo} rooms`} pct={Math.round(((rooms.dirty + rooms.ooo) / roomsTotal) * 100)} fill="bg-amber" />
            </div>
          </Card>
        )}

        {rooms && fnb && revenueMixTotal > 0 && (
          <Card>
            <div className="font-semibold mb-4">Revenue mix</div>
            <div className="space-y-3">
              <ProportionRow label="Rooms" display={inr(rooms.room_revenue)} pct={Math.round((num(rooms.room_revenue) / revenueMixTotal) * 100)} fill="bg-pine" />
              <ProportionRow label="F&B" display={inr(fnb.fnb_sales)} pct={Math.round((num(fnb.fnb_sales) / revenueMixTotal) * 100)} fill="bg-clay" />
            </div>
          </Card>
        )}

        {fnb && fnbTotal > 0 && (
          <Card className="lg:col-span-2">
            <div className="font-semibold mb-4">F&amp;B sales by mode</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-3">
              {(["dinein", "takeaway", "delivery"] as const).map((m) => (
                <ProportionRow
                  key={m}
                  label={m === "dinein" ? "Dine-in" : m === "takeaway" ? "Takeaway" : "Delivery"}
                  display={inr(fnb.by_mode[m] ?? 0)}
                  pct={Math.round((num(fnb.by_mode[m] ?? 0) / fnbTotal) * 100)}
                  fill="bg-pine"
                />
              ))}
            </div>
          </Card>
        )}
      </div>
    </>
  );
}

const SECTION_STYLE: Record<string, { icon: string; text: string; chip: string; accent: string }> = {
  Rooms: { icon: "roommaster", text: "text-pine", chip: "bg-pine-50 text-pine", accent: "border-pine" },
  "F&B": { icon: "pos", text: "text-clay", chip: "bg-clay-50 text-clay", accent: "border-clay" },
  Receivables: { icon: "accounting", text: "text-amber-600", chip: "bg-amber-50 text-amber-600", accent: "border-amber" },
};

function LedgerSection({
  title,
  headline,
  rows,
}: {
  title: string;
  headline: { label: string; value: string };
  rows: { label: string; value: string }[];
}) {
  const s = SECTION_STYLE[title];
  return (
    <div className={`border-l-4 ${s.accent} pl-4 py-4 first:pt-0`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full ${s.chip}`}>
          <NavIcon name={s.icon} />
        </span>
        <span className={`text-xs font-bold uppercase tracking-wide ${s.text}`}>{title}</span>
      </div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-sm text-muted">{headline.label}</span>
        <span className="stat-num text-3xl tabular-nums">{headline.value}</span>
      </div>
      <div>
        {rows.map((r, i) => (
          <div
            key={r.label}
            className={`flex items-center justify-between py-1.5 px-2 -mx-2 rounded ${i % 2 === 1 ? "bg-cream/70" : ""}`}
          >
            <span className="text-sm text-muted">{r.label}</span>
            <span className="text-sm font-semibold tabular-nums">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DataView({ data }: { data: DashboardData }) {
  const rooms = data.rooms;
  const fnb = data.fnb;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
      {rooms && (
        <Card>
          <LedgerSection
            title="Rooms"
            headline={{ label: "Occupancy", value: `${rooms.occupancy_pct}%` }}
            rows={[
              { label: "Occupied", value: String(rooms.occupied) },
              { label: "Total rooms", value: String(rooms.rooms_total) },
              { label: "Available to sell", value: String(rooms.available) },
              { label: "Dirty", value: String(rooms.dirty) },
              { label: "Out of order", value: String(rooms.ooo) },
              { label: "ADR", value: inr(rooms.adr) },
              { label: "RevPAR", value: inr(rooms.revpar) },
              { label: "Room revenue", value: inr(rooms.room_revenue) },
            ]}
          />
        </Card>
      )}
      {fnb && (
        <Card>
          <LedgerSection
            title="F&B"
            headline={{ label: "Total sales", value: inr(fnb.fnb_sales) }}
            rows={[
              { label: "Orders", value: String(fnb.order_count) },
              { label: "Average order value", value: inr(fnb.order_count ? num(fnb.fnb_sales) / fnb.order_count : 0) },
              { label: "Dine-in", value: inr(fnb.by_mode.dinein ?? 0) },
              { label: "Takeaway", value: inr(fnb.by_mode.takeaway ?? 0) },
              { label: "Delivery", value: inr(fnb.by_mode.delivery ?? 0) },
            ]}
          />
        </Card>
      )}
      {data.receivables && (
        <Card>
          <LedgerSection
            title="Receivables"
            headline={{ label: "Total outstanding", value: inr(data.receivables.total) }}
            rows={[
              { label: "Bill-to-company", value: inr(data.receivables.corporate) },
              { label: "Corporate accounts", value: String(data.receivables.corporate_accounts) },
            ]}
          />
        </Card>
      )}
    </div>
  );
}
