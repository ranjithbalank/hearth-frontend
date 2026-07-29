import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight, Bell, CalendarRange, ChefHat, DoorOpen, LayoutDashboard, LogOut, PartyPopper, Percent, Receipt, Sparkles, TrendingUp, UtensilsCrossed, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Badge, Card, PageHeader, Spinner, Stat, Tabs } from "../../design/ui";
import { LineChart } from "../../design/LineChart";
import { Donut } from "../../design/Donut";
import { RadialGauge } from "../../design/RadialGauge";
import { NavIcon } from "../../design/NavIcon";
import { api } from "../../lib/api";
import { useApp } from "../../lib/app-context";
import { fmtDate, greeting } from "../../lib/date";
import { money, num, compactMoney } from "../../lib/money";
import type { Reservation } from "../../lib/types";

interface DashboardData {
  view: "hotel" | "restaurant" | "combined";
  rooms?: { occupancy_pct: number; adr: number; revpar: number; occupied: number; rooms_total: number; room_revenue: string; available: number; dirty: number; ooo: number };
  fnb?: { fnb_sales: string; order_count: number; by_mode: Record<string, string> };
  receivables?: { total: string; corporate: string; corporate_accounts: number };
  trend?: { days: string[]; rooms?: number[]; fnb?: number[]; banquets?: number[] };
}

const pct = (v: number, total: number) => (total ? Math.round((v / total) * 100) : 0);

/** Last-7-days revenue and the % change vs the previous 7, read straight off
 *  the daily trend series the dashboard already returns — so an owner sees
 *  momentum ("▲ 12% vs last week"), not just a running total. */
function weekOnWeek(trend?: DashboardData["trend"]) {
  if (!trend?.days?.length) return { total: 0, delta: undefined as number | undefined };
  const series = [trend.rooms, trend.fnb, trend.banquets].filter(Boolean) as number[][];
  const n = trend.days.length;
  const sum = (a: number, b: number) =>
    series.reduce((s, arr) => s + arr.slice(a, b).reduce((x, v) => x + (v || 0), 0), 0);
  const last7 = sum(Math.max(0, n - 7), n);
  const prev7 = sum(Math.max(0, n - 14), Math.max(0, n - 7));
  return { total: last7, delta: prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 100) : undefined };
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

      {viewMode === "analytical"
        ? <AnalyticalView data={data} pendingDishes={pendingDishes} canApprove={canApprove} />
        : <DataView data={data} />}
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

  // Period total for the selected range — a headline that follows the range
  // picker, so the chart answers "how much" before you read the shape.
  const sum = (xs?: number[]) => (xs ?? []).reduce((a, b) => a + b, 0);
  const grand = trend ? sum(trend.rooms) + sum(trend.fnb) + sum(trend.banquets) : 0;
  const rangeLabel = custom
    ? from && to ? `${fmtDate(from)} – ${fmtDate(to)}` : "custom range"
    : (TREND_RANGES.find((r) => r.key === range)?.label ?? `${range} days`);

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
      {trend && (
        <div className="flex items-baseline gap-2 mb-3 -mt-0.5">
          <span className="font-display text-2xl text-ink tabular-nums">{compactMoney(grand)}</span>
          <span className="text-xs text-muted">total revenue · {rangeLabel}</span>
        </div>
      )}
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
function TodayPanel({
  hasRooms,
  receivables,
  pendingDishes,
  canApprove,
}: {
  hasRooms: boolean;
  receivables?: DashboardData["receivables"];
  pendingDishes?: unknown[];
  canApprove?: boolean;
}) {
  const nav = useNavigate();
  const { canAccess } = useApp();
  const showNotif = canAccess("notifications");
  const arReceivable = receivables && Number(receivables.total) > 0;
  const dishCount = pendingDishes?.length ?? 0;
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
  // Due-out (departures) — same source Front Desk uses: in-house stays whose
  // checkout date has arrived.
  const { data: allRes } = useQuery({
    queryKey: ["reservations"],
    queryFn: async () => (await api.get<Reservation[]>("/reservations/")).data,
    enabled: hasRooms,
  });
  const showBanquets = canAccess("banquets");
  const { data: banq } = useQuery({
    queryKey: ["banquets"],
    queryFn: async () => (await api.get<{ events: { event_date: string; status: string }[] }>("/banquets/")).data,
    enabled: showBanquets,
  });

  if (!hasRooms && !showNotif) return null;

  const today = new Date().toISOString().slice(0, 10);
  const todaysArrivals = (arrivals ?? []).filter((a) => a.checkin_date <= today);
  const dueOut = (allRes ?? []).filter((r) => r.status === "in_house" && r.checkout_date <= today).length;
  const banquetsToday = (banq?.events ?? []).filter((e) => e.event_date === today).length;

  return (
    <Card className="h-full flex flex-col gap-4">
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

      {hasRooms && (
        <button onClick={() => nav("/folios")} className="text-left group border-t border-hairline pt-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <LogOut size={15} className={dueOut ? "text-info shrink-0" : "text-muted shrink-0"} /> Due out today
          </div>
          <Badge tone={dueOut ? "info" : "muted"}>{dueOut}</Badge>
        </button>
      )}

      {showBanquets && (
        <button onClick={() => nav("/banquets")} className="text-left group border-t border-hairline pt-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <PartyPopper size={15} className={banquetsToday ? "text-gold-700 shrink-0" : "text-muted shrink-0"} /> Banquets today
          </div>
          <Badge tone={banquetsToday ? "gold" : "muted"}>{banquetsToday}</Badge>
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

      {receivables && (
        <button onClick={() => nav("/crm")} className="text-left group border-t border-hairline pt-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Receipt size={15} className={arReceivable ? "text-clay shrink-0" : "text-muted shrink-0"} /> Receivables
          </div>
          <span className={`stat-num text-sm ${arReceivable ? "text-clay" : "text-muted"}`}>{money(receivables.total)}</span>
        </button>
      )}

      {canApprove && (
        <button onClick={() => nav("/recipes?tab=pending")} className="text-left group border-t border-hairline pt-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ChefHat size={15} className={dishCount ? "text-amber-600 shrink-0" : "text-muted shrink-0"} /> Dish approvals
          </div>
          <Badge tone={dishCount ? "amber" : "muted"}>{dishCount} pending</Badge>
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

/** Compact secondary stat — lighter than the headline KPI tiles, with an
 *  optional week-on-week delta pill. */
function MiniStat({ label, value, sub, delta }: { label: string; value: string; sub?: string; delta?: number }) {
  return (
    <Card className="!p-4 animate-fade-in-up">
      <div className="flex items-baseline gap-2 flex-wrap">
        <div className="stat-num text-xl">{value}</div>
        {delta !== undefined && (
          <span className={`pill text-[10px] gap-0.5 ${
            delta > 0 ? "bg-success-50 text-success" : delta < 0 ? "bg-clay-50 text-clay" : "bg-hairline text-muted"
          }`}>
            {delta > 0 ? "▲" : delta < 0 ? "▼" : "–"} {Math.abs(delta) > 999 ? ">999" : Math.abs(delta)}%
          </span>
        )}
      </div>
      <div className="text-xs text-muted mt-1">{label}</div>
      {sub && <div className="text-[11px] text-muted mt-0.5">{sub}</div>}
    </Card>
  );
}

function AnalyticalView({
  data,
  pendingDishes,
  canApprove,
}: {
  data: DashboardData;
  pendingDishes?: unknown[];
  canApprove?: boolean;
}) {
  const nav = useNavigate();
  const rooms = data.rooms;
  const fnb = data.fnb;
  const roomsTotal = rooms?.rooms_total || 0;
  const fnbRev = fnb ? num(fnb.fnb_sales) : 0;
  const covers = fnb?.order_count ?? 0;
  const aov = covers ? fnbRev / covers : 0;
  const wow = weekOnWeek(data.trend);

  const miniStats = [
    { label: "Revenue · last 7 days", value: money(wow.total), delta: wow.delta },
    fnb && { label: "Covers", value: String(covers), sub: `avg check ${money(aov)}` },
    rooms && { label: "Available to sell", value: String(rooms.available), sub: `of ${roomsTotal} rooms` },
    rooms && { label: "Needs cleaning", value: String(rooms.dirty + rooms.ooo), sub: "dirty / out of order" },
  ].filter(Boolean) as { label: string; value: string; sub?: string; delta?: number }[];

  return (
    <>
      {/* Fast actions first — a manager reaches these in one tap, no scroll. */}
      <QuickActions hasRooms={!!rooms} hasFnb={!!fnb} />

      {/* Drill-through KPI row — tap a metric to jump to where you act on it. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
        {rooms && (
          <>
            <button
              onClick={() => nav("/livegrid")}
              className="relative overflow-hidden rounded-card p-5 bg-gradient-ink text-white shadow-md animate-fade-in-up flex items-center justify-between gap-2 text-left cursor-pointer transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="pointer-events-none absolute -right-6 -top-10 w-32 h-32 rounded-full bg-pine-400/20 blur-2xl" aria-hidden />
              <div className="relative">
                <div className="stat-num text-3xl text-white">{rooms.occupancy_pct}%</div>
                <div className="text-xs mt-1 text-white/60">Occupancy</div>
                <div className="text-xs mt-2 text-white/60">{rooms.occupied}/{rooms.rooms_total} rooms</div>
              </div>
              <RadialGauge pct={rooms.occupancy_pct} size={72} thickness={8}>
                <Percent size={15} className="text-white/70" />
              </RadialGauge>
            </button>
            <Stat delayMs={60} onClick={() => nav("/reports")} icon={<Wallet size={16} />} label="ADR" value={money(rooms.adr)} sub="Average daily rate" />
            <Stat delayMs={120} onClick={() => nav("/reports")} icon={<TrendingUp size={16} />} label="RevPAR" value={money(rooms.revpar)} sub="Revenue per available room" />
          </>
        )}
        {fnb && (
          <Stat tone={rooms ? undefined : "dark"} delayMs={rooms ? 180 : 0} onClick={() => nav("/pos")} icon={<UtensilsCrossed size={16} />} label="F&B sales" value={money(fnb.fnb_sales)} sub={`${fnb.order_count} orders`} />
        )}
      </div>

      {/* Secondary metrics band — the numbers an owner scans after the headline KPIs. */}
      {miniStats.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          {miniStats.map((m, i) => (
            <MiniStat key={i} {...m} />
          ))}
        </div>
      )}

      {/* Left column stacks the wide content (revenue chart + breakdown); the
          tall attention hub runs full-height alongside it — no dead space, and
          the breakdown isn't stranded full-width. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4 items-start">
        <div className="lg:col-span-2 flex flex-col gap-4">
          <RevenueTrendCard />
          <BreakdownCard data={data} />
        </div>
        <TodayPanel
          hasRooms={!!(rooms && roomsTotal > 0)}
          receivables={data.receivables}
          pendingDishes={pendingDishes}
          canApprove={canApprove}
        />
      </div>
    </>
  );
}

/** The three "mix" views (room status / revenue / F&B mode) collapsed into one
 *  card with a segmented control — swap the view instead of stacking three. */
function BreakdownCard({ data }: { data: DashboardData }) {
  const rooms = data.rooms;
  const fnb = data.fnb;
  const roomsTotal = rooms?.rooms_total || 0;
  const revenueMixTotal = rooms && fnb ? num(rooms.room_revenue) + num(fnb.fnb_sales) : 0;
  const fnbTotal = fnb ? Object.values(fnb.by_mode).reduce((s, v) => s + num(v), 0) : 0;

  const tabs: { value: string; label: string }[] = [];
  if (rooms && roomsTotal > 0) tabs.push({ value: "rooms", label: "Room status" });
  if (rooms && fnb && revenueMixTotal > 0) tabs.push({ value: "revenue", label: "Revenue" });
  if (fnb && fnbTotal > 0) tabs.push({ value: "fnb", label: "F&B by mode" });
  const [tab, setTab] = useState(tabs[0]?.value ?? "rooms");
  if (!tabs.length) return null;
  const active = tabs.some((t) => t.value === tab) ? tab : tabs[0].value;

  return (
    <Card className="h-full">
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <div className="font-semibold">Breakdown</div>
        {tabs.length > 1 && <Tabs value={active} onChange={setTab} options={tabs} />}
      </div>
      {active === "rooms" && rooms && (
        <div className="grid md:grid-cols-2 gap-x-8 gap-y-5 items-center">
          <Donut
            centerLabel="rooms"
            slices={[
              { label: "Occupied", value: rooms.occupied, color: "#2563EB", display: `${rooms.occupied} rms` },
              { label: "Available", value: rooms.available, color: "#16A34A", display: `${rooms.available} rms` },
              { label: "Dirty / OOO", value: rooms.dirty + rooms.ooo, color: "#D97706", display: `${rooms.dirty + rooms.ooo} rms` },
            ]}
          />
          <div className="space-y-3">
            <ProportionRow label="Occupied" display={`${rooms.occupied} rms`} pct={pct(rooms.occupied, roomsTotal)} fill="bg-pine" />
            <ProportionRow label="Available to sell" display={`${rooms.available} rms`} pct={pct(rooms.available, roomsTotal)} fill="bg-success" />
            <ProportionRow label="Dirty / out of order" display={`${rooms.dirty + rooms.ooo} rms`} pct={pct(rooms.dirty + rooms.ooo, roomsTotal)} fill="bg-amber" />
          </div>
        </div>
      )}
      {active === "revenue" && rooms && fnb && (
        <div className="grid md:grid-cols-2 gap-x-8 gap-y-5 items-center">
          <Donut
            centerLabel="revenue"
            centerValue={money(revenueMixTotal)}
            slices={[
              { label: "Rooms", value: num(rooms.room_revenue), color: "#2563EB", display: money(rooms.room_revenue) },
              { label: "F&B", value: num(fnb.fnb_sales), color: "#DC2626", display: money(fnb.fnb_sales) },
            ]}
          />
          <div className="space-y-3">
            <ProportionRow label="Rooms" display={money(rooms.room_revenue)} pct={pct(num(rooms.room_revenue), revenueMixTotal)} fill="bg-pine" />
            <ProportionRow label="F&B" display={money(fnb.fnb_sales)} pct={pct(num(fnb.fnb_sales), revenueMixTotal)} fill="bg-clay" />
          </div>
        </div>
      )}
      {active === "fnb" && fnb && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-3 pt-1">
          {(["dinein", "takeaway", "delivery"] as const).map((m) => (
            <ProportionRow
              key={m}
              label={m === "dinein" ? "Dine-in" : m === "takeaway" ? "Takeaway" : "Delivery"}
              display={money(fnb.by_mode[m] ?? 0)}
              pct={pct(num(fnb.by_mode[m] ?? 0), fnbTotal)}
              fill="bg-pine"
            />
          ))}
        </div>
      )}
    </Card>
  );
}

/** Fast one-tap jumps — a compact horizontal bar at the TOP of the dashboard,
 *  so the screens a manager reaches for are a single click away, not a scroll. */
function QuickActions({ hasRooms, hasFnb }: { hasRooms: boolean; hasFnb: boolean }) {
  const nav = useNavigate();
  const { canAccess } = useApp();
  const actions = [
    hasRooms && canAccess("frontdesk") && { icon: DoorOpen, label: "Front Desk", to: "/frontdesk", chip: "bg-pine-50 text-pine" },
    hasRooms && canAccess("reservations") && { icon: CalendarRange, label: "Reservations", to: "/reservations", chip: "bg-info-50 text-info" },
    hasRooms && canAccess("livegrid") && { icon: LayoutDashboard, label: "Live Grid", to: "/livegrid", chip: "bg-pine-50 text-pine" },
    hasFnb && canAccess("pos") && { icon: UtensilsCrossed, label: "Restaurant POS", to: "/pos", chip: "bg-clay-50 text-clay" },
    hasFnb && canAccess("kds") && { icon: ChefHat, label: "Kitchen", to: "/kds", chip: "bg-amber-50 text-amber-600" },
    hasRooms && canAccess("housekeeping") && { icon: Sparkles, label: "Housekeeping", to: "/housekeeping", chip: "bg-gold-50 text-gold-700" },
  ].filter(Boolean) as { icon: typeof DoorOpen; label: string; to: string; chip: string }[];
  if (!actions.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.map((a) => (
        <button
          key={a.to}
          onClick={() => nav(a.to)}
          className="group flex items-center gap-2 rounded-xl border border-hairline bg-surface px-3.5 py-2 text-sm font-medium transition-all duration-150 hover:border-pine-200 hover:bg-cream hover:-translate-y-0.5 active:translate-y-0"
        >
          <span className={`shrink-0 grid place-items-center w-7 h-7 rounded-lg ${a.chip}`}>
            <a.icon size={15} />
          </span>
          {a.label}
        </button>
      ))}
    </div>
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
