import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight, Bell, DoorOpen, LayoutDashboard, Percent, Sparkles, TrendingUp, UtensilsCrossed, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Badge, Card, PageHeader, Spinner, Stat, Tabs } from "../../design/ui";
import { LineChart } from "../../design/LineChart";
import { Donut } from "../../design/Donut";
import { RadialGauge } from "../../design/RadialGauge";
import { NavIcon } from "../../design/NavIcon";
import { api } from "../../lib/api";
import { useApp } from "../../lib/app-context";
import { fmtDate, greeting } from "../../lib/date";
import { money, num } from "../../lib/money";
import type { Reservation } from "../../lib/types";

interface DashboardData {
  view: "hotel" | "restaurant" | "combined";
  rooms?: { occupancy_pct: number; adr: number; revpar: number; occupied: number; rooms_total: number; room_revenue: string; available: number; dirty: number; ooo: number };
  fnb?: { fnb_sales: string; order_count: number; by_mode: Record<string, string> };
  receivables?: { total: string; corporate: string; corporate_accounts: number };
  trend?: { days: string[]; rooms?: number[]; fnb?: number[] };
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
  const { data, isLoading, dataUpdatedAt } = useQuery({
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
  const { title } = TITLES[data.view];
  const firstName = user?.name?.split(" ")[0];
  const asOf = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div>
      <PageHeader
        icon={<LayoutDashboard size={20} />}
        title={title}
        subtitle={`${greeting(firstName)} · ${fmtDate(new Date().toISOString())}${asOf ? ` · as of ${asOf}` : ""}`}
        action={
          <div data-tour="landing-dashboard">
            <Tabs
              value={viewMode}
              onChange={chooseView}
              options={[
                { value: "analytical", label: "Analytical view" },
                { value: "data", label: "Data view" },
              ]}
            />
          </div>
        }
      />

      {viewMode === "analytical" ? <AnalyticalView data={data} /> : <DataView data={data} />}

      {(data.receivables || canApprove) && (
        <div className="grid grid-cols-2 gap-4 mt-4">
          {data.receivables && (
            <button
              onClick={() => nav("/crm")}
              className="card-interactive group p-5 text-left w-full flex items-center justify-between"
            >
              <div>
                <div className="text-xs uppercase tracking-wide text-muted">Accounts receivable</div>
                <div className={`stat-num text-2xl mt-1 ${Number(data.receivables.total) > 0 ? "text-clay" : "text-pine"}`}>
                  {money(data.receivables.total)}
                </div>
                <div className="text-sm text-muted mt-1">
                  {data.receivables.corporate_accounts} corporate account(s) · {money(data.receivables.corporate)} bill-to-company
                </div>
              </div>
              <span className="text-pine text-sm font-medium flex items-center gap-1 shrink-0">
                View ledger <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
              </span>
            </button>
          )}

          {canApprove && (
            <button
              onClick={() => nav("/recipes?tab=pending")}
              className="card-interactive group p-5 text-left w-full flex items-center justify-between"
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
              <span className="text-pine text-sm font-medium flex items-center gap-1 shrink-0">
                Review <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
              </span>
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mt-4">
        {data.rooms && (
          <button className="card-interactive group p-5 text-left flex items-start gap-3" onClick={() => nav("/frontdesk")}>
            <span className="shrink-0 grid place-items-center w-10 h-10 rounded-xl bg-pine-50 text-pine">
              <DoorOpen size={18} />
            </span>
            <div className="min-w-0">
              <div className="font-semibold flex items-center gap-1">
                Front Desk <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
              </div>
              <div className="text-sm text-muted mt-1">Check in arrivals, manage folios</div>
            </div>
          </button>
        )}
        {data.fnb && (
          <button className="card-interactive group p-5 text-left flex items-start gap-3" onClick={() => nav("/pos")}>
            <span className="shrink-0 grid place-items-center w-10 h-10 rounded-xl bg-clay-50 text-clay">
              <UtensilsCrossed size={18} />
            </span>
            <div className="min-w-0">
              <div className="font-semibold flex items-center gap-1">
                Restaurant POS <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
              </div>
              <div className="text-sm text-muted mt-1">Take orders, fire KOTs, settle</div>
            </div>
          </button>
        )}
        {data.rooms && (
          <button className="card-interactive group p-5 text-left flex items-start gap-3" onClick={() => nav("/housekeeping")}>
            <span className="shrink-0 grid place-items-center w-10 h-10 rounded-xl bg-gold-50 text-gold-700">
              <Sparkles size={18} />
            </span>
            <div className="min-w-0">
              <div className="font-semibold flex items-center gap-1">
                Housekeeping <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
              </div>
              <div className="text-sm text-muted mt-1">Room status &amp; turnaround</div>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}

interface TrendData { days: string[]; rooms?: number[]; fnb?: number[]; banquets?: number[] }

const TREND_RANGES = [
  { key: "14", label: "14 days" },
  { key: "90", label: "3 mo" },
  { key: "180", label: "6 mo" },
  { key: "365", label: "1 yr" },
];

/** Revenue trend with its own range picker — presets or a custom window.
 *  Series follow role/entitlement scoping server-side. */
function RevenueTrendCard() {
  const [range, setRange] = useState("14");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const custom = range === "custom";
  const qs = custom
    ? `${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`
    : `&trend_days=${range}`;
  const { data: trend } = useQuery({
    queryKey: ["revenue-trend", custom ? `${from}|${to}` : range],
    queryFn: async () =>
      (await api.get<TrendData>(`/reports/revenue-trend/?_=1${qs}`)).data,
  });

  return (
    <Card accent>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="font-semibold">Revenue trend</div>
        <div className="flex flex-wrap items-center gap-1">
          {TREND_RANGES.map((r) => (
            <button key={r.key} onClick={() => setRange(r.key)}
              className={`pill text-xs px-2.5 py-0.5 ${
                range === r.key ? "bg-ink text-white" : "bg-hairline text-body"}`}>
              {r.label}
            </button>
          ))}
          <button onClick={() => setRange("custom")}
            className={`pill text-xs px-2.5 py-0.5 ${
              custom ? "bg-ink text-white" : "bg-hairline text-body"}`}>
            Custom
          </button>
        </div>
      </div>
      {custom && (
        <div className="flex items-center gap-2 mb-3">
          <input type="date" value={from} max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
            className="input py-1 text-xs w-36" aria-label="Trend from date" />
          <span className="text-xs text-muted">to</span>
          <input type="date" value={to} min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
            className="input py-1 text-xs w-36" aria-label="Trend to date" />
        </div>
      )}
      {trend ? (
        <LineChart
          days={trend.days}
          series={[
            ...(trend.rooms ? [{ name: "Rooms", color: "#2563EB", values: trend.rooms }] : []),
            ...(trend.fnb ? [{ name: "F&B", color: "#DC2626", values: trend.fnb }] : []),
            ...(trend.banquets ? [{ name: "Banquets", color: "#D97706", values: trend.banquets }] : []),
          ]}
        />
      ) : <Spinner />}
    </Card>
  );
}

interface Alert { severity: string; module: string; title: string; detail: string }

/** Sidebar companion to the revenue chart — the two things a GM checks the
 *  dashboard for beyond the numbers: who's arriving today, and what needs
 *  attention right now. Both reuse the same endpoints Front Desk and the
 *  header bell already poll, so there's no new backend surface here. */
function TodayPanel({ hasRooms }: { hasRooms: boolean }) {
  const nav = useNavigate();
  const { canAccess } = useApp();
  const showNotif = canAccess("notifications");
  const { data: arrivals } = useQuery({
    queryKey: ["arrivals"],
    queryFn: async () => (await api.get<Reservation[]>("/reservations/arrivals/")).data,
    enabled: hasRooms,
  });
  const { data: notif } = useQuery({
    queryKey: ["notif-count"],
    queryFn: async () => (await api.get<{ count: number; alerts: Alert[] }>("/notifications/")).data,
    enabled: showNotif,
  });

  if (!hasRooms && !showNotif) return null;

  const today = new Date().toISOString().slice(0, 10);
  const todaysArrivals = (arrivals ?? []).filter((a) => a.checkin_date <= today);

  return (
    <Card className="h-full flex flex-col gap-5">
      <div className="font-semibold">Today at a glance</div>

      {hasRooms && (
        <button onClick={() => nav("/frontdesk")} className="text-left group">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <DoorOpen size={15} className="text-pine shrink-0" /> Arrivals today
            </div>
            <Badge tone={todaysArrivals.length ? "pine" : "muted"}>{todaysArrivals.length}</Badge>
          </div>
          {todaysArrivals.length ? (
            <div className="space-y-1.5">
              {todaysArrivals.slice(0, 3).map((a) => (
                <div key={a.id} className="text-xs text-muted truncate">
                  {a.guest_name} · {a.room_type_name || a.room_type_code}
                </div>
              ))}
              {todaysArrivals.length > 3 && (
                <div className="text-xs text-pine font-medium flex items-center gap-1">
                  +{todaysArrivals.length - 3} more <ArrowRight size={11} className="transition-transform group-hover:translate-x-1" />
                </div>
              )}
            </div>
          ) : <div className="text-xs text-muted">No arrivals due today</div>}
        </button>
      )}

      {showNotif && (
        <button onClick={() => nav("/notifications")} className={`text-left group ${hasRooms ? "border-t border-hairline pt-4" : ""}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Bell size={15} className="text-amber-600 shrink-0" /> Needs attention
            </div>
            <Badge tone={notif?.count ? "clay" : "muted"}>{notif?.count ?? 0}</Badge>
          </div>
          {notif?.alerts?.length ? (
            <div className="space-y-1.5">
              {notif.alerts.slice(0, 3).map((a, i) => (
                <div key={i} className="text-xs text-muted truncate">{a.title}</div>
              ))}
            </div>
          ) : <div className="text-xs text-muted">All clear — nothing waiting</div>}
        </button>
      )}
    </Card>
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
        <motion.div
          className={`h-full rounded-pill ${fill}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct > 0 ? Math.max(pct, 2) : 0}%` }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        />
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
            {/* Bespoke hero tile: occupancy magnitude as a ring + the exact number. */}
            <div className="relative overflow-hidden rounded-card p-5 bg-gradient-ink text-white shadow-md animate-fade-in-up flex items-center justify-between gap-2">
              <div className="pointer-events-none absolute -right-6 -top-10 w-32 h-32 rounded-full bg-pine-400/20 blur-2xl" aria-hidden />
              <div className="relative">
                <div className="stat-num text-3xl text-white">{rooms.occupancy_pct}%</div>
                <div className="text-xs mt-1 text-white/60">Occupancy</div>
                <div className="text-xs mt-2 text-white/60">{rooms.occupied}/{rooms.rooms_total} rooms</div>
              </div>
              <RadialGauge pct={rooms.occupancy_pct} size={72} thickness={8}>
                <Percent size={15} className="text-white/70" />
              </RadialGauge>
            </div>
            <Stat delayMs={60} icon={<Wallet size={16} />} label="ADR" value={money(rooms.adr)} sub="Average daily rate" />
            <Stat delayMs={120} icon={<TrendingUp size={16} />} label="RevPAR" value={money(rooms.revpar)} sub="Revenue per available room" />
          </>
        )}
        {fnb && (
          <Stat tone={rooms ? undefined : "dark"} delayMs={rooms ? 180 : 0} icon={<UtensilsCrossed size={16} />} label="F&B sales" value={money(fnb.fnb_sales)} sub={`${fnb.order_count} orders`} />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4 items-stretch">
        <div className="lg:col-span-2">
          <RevenueTrendCard />
        </div>
        <TodayPanel hasRooms={!!(rooms && roomsTotal > 0)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 items-start">
        {rooms && roomsTotal > 0 && (
          <Card>
            <div className="font-semibold mb-4">Room status mix</div>
            <Donut
              centerLabel="rooms"
              slices={[
                { label: "Occupied", value: rooms.occupied, color: "#2563EB", display: `${rooms.occupied} rms` },
                { label: "Available", value: rooms.available, color: "#16A34A", display: `${rooms.available} rms` },
                { label: "Dirty / OOO", value: rooms.dirty + rooms.ooo, color: "#D97706", display: `${rooms.dirty + rooms.ooo} rms` },
              ]}
            />
          </Card>
        )}

        {rooms && fnb && revenueMixTotal > 0 && (
          <Card>
            <div className="font-semibold mb-4">Revenue mix</div>
            <Donut
              centerLabel="revenue"
              centerValue={money(revenueMixTotal)}
              slices={[
                { label: "Rooms", value: num(rooms.room_revenue), color: "#2563EB", display: money(rooms.room_revenue) },
                { label: "F&B", value: num(fnb.fnb_sales), color: "#DC2626", display: money(fnb.fnb_sales) },
              ]}
            />
          </Card>
        )}

        {fnb && fnbTotal > 0 && (
          <Card className={rooms && roomsTotal > 0 && revenueMixTotal > 0 ? "" : "md:col-span-2"}>
            <div className="font-semibold mb-4">F&amp;B sales by mode</div>
            <div className="grid grid-cols-1 gap-y-3">
              {(["dinein", "takeaway", "delivery"] as const).map((m) => (
                <ProportionRow
                  key={m}
                  label={m === "dinein" ? "Dine-in" : m === "takeaway" ? "Takeaway" : "Delivery"}
                  display={money(fnb.by_mode[m] ?? 0)}
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
              { label: "ADR", value: money(rooms.adr) },
              { label: "RevPAR", value: money(rooms.revpar) },
              { label: "Room revenue", value: money(rooms.room_revenue) },
            ]}
          />
        </Card>
      )}
      {fnb && (
        <Card>
          <LedgerSection
            title="F&B"
            headline={{ label: "Total sales", value: money(fnb.fnb_sales) }}
            rows={[
              { label: "Orders", value: String(fnb.order_count) },
              { label: "Average order value", value: money(fnb.order_count ? num(fnb.fnb_sales) / fnb.order_count : 0) },
              { label: "Dine-in", value: money(fnb.by_mode.dinein ?? 0) },
              { label: "Takeaway", value: money(fnb.by_mode.takeaway ?? 0) },
              { label: "Delivery", value: money(fnb.by_mode.delivery ?? 0) },
            ]}
          />
        </Card>
      )}
      {data.receivables && (
        <Card>
          <LedgerSection
            title="Receivables"
            headline={{ label: "Total outstanding", value: money(data.receivables.total) }}
            rows={[
              { label: "Bill-to-company", value: money(data.receivables.corporate) },
              { label: "Corporate accounts", value: String(data.receivables.corporate_accounts) },
            ]}
          />
        </Card>
      )}
    </div>
  );
}
