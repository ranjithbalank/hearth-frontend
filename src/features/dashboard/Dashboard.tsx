import { useState, type ReactNode } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlarmClock, ArrowRight, BedDouble, Bell, Building2, CalendarRange, CalendarX, ChartSpline, ChefHat, ClipboardList, DoorOpen, Download, LayoutDashboard, LayoutGrid, LogOut, PartyPopper, Percent, RefreshCw, Sparkles, Table2, TrendingUp, Users, UtensilsCrossed, Wallet, type LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Badge, Card, IconButton, PageHeader, Skeleton, Spinner, Stat, Tabs } from "../../design/ui";
import { LineChart } from "../../design/LineChart";
import { Donut } from "../../design/Donut";
import { RadialGauge } from "../../design/RadialGauge";
import { NavIcon } from "../../design/NavIcon";
import { SERIES, STREAM_COLORS } from "../../design/series";
import { api } from "../../lib/api";
import { useApp } from "../../lib/app-context";
import { fmtDate, greeting, isoOf, todayISO } from "../../lib/date";
import { SetupProgress } from "../auth/SetupProgress";
import { money, num, compactMoney, moneyKpi } from "../../lib/money";
import type { Reservation } from "../../lib/types";

interface DashboardData {
  view: Sector;
  /** False for Hotel/Restaurant Manager — their side is fixed by role, so the
   *  switch is hidden rather than shown and then overridden server-side. */
  can_switch_view?: boolean;
  rooms?: {
    occupancy_pct: number; adr: number; revpar: number; occupied: number;
    rooms_total: number; room_revenue: string; available: number; dirty: number; ooo: number;
    /** Occupancy over the SAME window as ADR/RevPAR, so the three reconcile.
     *  occupancy_pct stays the live snapshot the floor works from. */
    period_occupancy_pct?: number;
    nights?: number;
    rooms_sold?: number;
  };
  fnb?: { fnb_sales: string; order_count: number; by_mode: Record<string, string> };
  /** The third earning stream. Sent whenever the trend chart draws it — same
   *  gate, same rows — and only when there is revenue in the window, so a
   *  property that runs no events gets no empty slice. */
  banquets?: { revenue: string; events: number };
  receivables?: { total: string; corporate: string; corporate_accounts: number };
  trend?: {
    days: string[]; rooms?: number[]; fnb?: number[]; banquets?: number[];
    /** Room-nights sold per day, alongside the revenue. Three of the four KPI
     *  tiles want a sparkline and none of them is revenue — with this the
     *  client derives ADR, occupancy and RevPAR per day from series it has. */
    room_nights?: number[];
  };
  /** Which window the money KPIs cover. They used to be lifetime totals on a
   *  screen headed "today", so the numbers never moved. */
  period?: { from: string; to: string; label: string };
  /** The same figures over the equal-length window immediately before this
   *  one. Every headline was previously a bare number with nothing to say
   *  whether it was good — "ADR ₹4,200" tells a manager nothing that
   *  "ADR ₹4,200, down 6%" doesn't tell them better. */
  previous?: {
    from: string; to: string;
    rooms?: { room_revenue: string; adr: number; revpar: number; occupancy_pct: number };
    fnb?: { fnb_sales: string; order_count: number };
    banquets?: { revenue: string; events: number };
  };
  /** Live floor state — no date window; "right now" has no month-to-date. */
  floor?: {
    in_house: number; rooms_total: number; rooms_clean: number; clean_pct: number;
    open_tickets: number; kots_pending: number;
  };
  /** Commercial detail behind the F&B tile. Absent on the Hotel view. */
  money?: {
    payment_mix: { label: string; value: string }[];
    top_items: { label: string; qty: number }[];
    discount: string;
  };
  /** Next 7 nights on the books. Absent on the Restaurant view. */
  forward?: {
    days: string[]; occ_pct: number[]; on_books: number[];
    arrivals: number[]; departures: number[]; rooms_total: number;
  };
  /** One row per branch. Only sent when the caller can see more than one. */
  branches?: {
    id: number; code: string; name: string; occupancy_pct: number;
    occupied: number; rooms_total: number; room_revenue: string;
    adr: number; fnb_sales: string; covers: number;
  }[];
}

const pct = (v: number, total: number) => (total ? Math.round((v / total) * 100) : 0);

/** Percentage change against the previous window, or undefined when there is
 *  nothing worth comparing to. Same judgement as the week-on-week read below:
 *  a jump measured against a near-empty prior window isn't a trend, it's an
 *  artefact — a property that opened last Tuesday would read "up 4,200%" — and
 *  a tile is better carrying its figure alone than a number nobody can act on. */
function deltaPct(now: number, before?: number): number | undefined {
  if (!before || before <= 0) return undefined;
  if (now / before >= 10) return undefined;
  return Math.round(((now - before) / before) * 100);
}

/** Occupancy moves in percentage POINTS, not percent: 40% to 50% is ten points
 *  up, and calling that "+25%" is the kind of thing a hotelier notices
 *  immediately and stops trusting the screen over. */
function deltaPoints(now: number, before?: number): number | undefined {
  if (before === undefined) return undefined;
  const d = Math.round((now - before) * 10) / 10;
  return d === 0 ? undefined : d;
}

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
  // A comparison against a near-empty prior week isn't a trend, it's an
  // artefact — a property that opened last Tuesday would read "up 4,200%".
  // Show no delta rather than a number nobody can act on; the tile still
  // carries the figure itself.
  const comparable = prev7 > 0 && last7 / prev7 < 10;
  return {
    total: last7,
    delta: comparable ? Math.round(((last7 - prev7) / prev7) * 100) : undefined,
  };
}

const TITLES: Record<DashboardData["view"], { title: string; subtitle: string }> = {
  hotel: { title: "Hotel Dashboard", subtitle: "Live room performance" },
  restaurant: { title: "Restaurant Dashboard", subtitle: "Live restaurant performance" },
  combined: { title: "Dashboard", subtitle: "Live operational performance" },
};

type ViewMode = "analytical" | "data";
const VIEW_KEY = "hearth-dashboard-view";

function loadViewMode(): ViewMode {
  // Anything that isn't "data" — including "analyse", left behind by a
  // short-lived rename — falls back to the default view. Nobody chose that
  // value, so restoring it as a preference would strand them on a tab they
  // never picked.
  return localStorage.getItem(VIEW_KEY) === "data" ? "data" : "analytical";
}

/** Which side of the business the page covers. Distinct from ViewMode: that
 *  chooses how the numbers are drawn, this chooses which numbers exist. */
type Sector = "combined" | "hotel" | "restaurant";
const SECTOR_KEY = "hearth-dashboard-sector";

function loadSector(): Sector {
  const v = localStorage.getItem(SECTOR_KEY);
  return v === "hotel" || v === "restaurant" ? v : "combined";
}

/** Which window the money KPIs cover. Operational windows only — "today",
 *  "yesterday", "this month so far" are the questions a duty manager and a GM
 *  actually ask. Year-on-year and multi-year comparisons stay on the Executive
 *  Overview, which is the screen for steering the group rather than running
 *  the shift; this picker is not meant to turn one into the other. */
type PeriodKey = "today" | "yesterday" | "7d" | "mtd" | "lastmonth" | "custom";

const PERIODS: { value: PeriodKey; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "Last 7 days" },
  { value: "mtd", label: "Month to date" },
  { value: "lastmonth", label: "Last month" },
  { value: "custom", label: "Custom range…" },
];

const PERIOD_KEY = "hearth-dashboard-period";

/** Presets are relative, so they always resolve to something sensible on a
 *  later visit and are safe to remember. A custom range is a pair of absolute
 *  dates: restoring it silently would greet someone next month with figures
 *  from a window they set once and forgot, so it falls back to month-to-date. */
function loadPeriod(): PeriodKey {
  const v = localStorage.getItem(PERIOD_KEY) as PeriodKey | null;
  return v && v !== "custom" && PERIODS.some((p) => p.value === v) ? v : "mtd";
}

/** A preset as an explicit window, anchored on the property's business date.
 *  Month-to-date returns null: it is the server's own default, so the common
 *  case sends no dates and the two can't disagree about where the month
 *  starts. */
function resolvePeriod(key: PeriodKey, anchor: string): { from: string; to: string } | null {
  const at = (iso: string) => new Date(`${iso}T00:00:00`);
  const shift = (base: Date, days: number) => {
    const x = new Date(base);
    x.setDate(x.getDate() + days);
    return x;
  };
  const a = at(anchor);
  switch (key) {
    case "today":
      return { from: anchor, to: anchor };
    case "yesterday": {
      const y = isoOf(shift(a, -1));
      return { from: y, to: y };
    }
    case "7d":
      return { from: isoOf(shift(a, -6)), to: anchor };
    case "lastmonth": {
      // Last day of the previous month is the day before the 1st of this one —
      // which avoids every month-length and leap-year special case.
      const end = shift(new Date(a.getFullYear(), a.getMonth(), 1), -1);
      return { from: isoOf(new Date(end.getFullYear(), end.getMonth(), 1)), to: isoOf(end) };
    }
    default:
      return null;
  }
}

const SECTOR_TABS = [
  { value: "combined" as const, label: "All", icon: <LayoutGrid size={14} /> },
  { value: "hotel" as const, label: "Hotel", icon: <BedDouble size={14} /> },
  { value: "restaurant" as const, label: "Restaurant", icon: <UtensilsCrossed size={14} /> },
];

const MODE_TABS = [
  { value: "analytical" as const, label: "Analytical", icon: <ChartSpline size={14} /> },
  { value: "data" as const, label: "Data", icon: <Table2 size={14} /> },
];

export function Dashboard() {
  const { user, property } = useApp();
  const qc = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>(loadViewMode);
  const [sector, setSector] = useState<Sector>(loadSector);
  const [period, setPeriod] = useState<PeriodKey>(loadPeriod);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Presets are anchored on the business date for the same reason the arrival
  // counts are: a property mid-night-audit is still trading yesterday, and
  // "Today" has to mean the day the folios are being posted to.
  const anchor = property?.business_date ?? todayISO();
  const range = period === "custom"
    ? (from && to ? { from, to } : null)
    : resolvePeriod(period, anchor);
  const qs = range ? `&from=${range.from}&to=${range.to}` : "";

  const { data, isLoading, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ["dashboard", sector, qs],
    queryFn: async () =>
      (await api.get<DashboardData>(`/reports/dashboard/?view=${sector}${qs}`)).data,
    // This page calls itself live — "right now", "this minute", "as of 14:32" —
    // and until now none of it moved until you navigated away and came back.
    // React Query pauses the interval while the tab is hidden, so a dashboard
    // left open on a second monitor costs nothing until it's looked at.
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  });
  function chooseView(mode: ViewMode) {
    setViewMode(mode);
    localStorage.setItem(VIEW_KEY, mode);
  }
  function chooseSector(s: Sector) {
    setSector(s);
    localStorage.setItem(SECTOR_KEY, s);
  }
  function choosePeriod(p: PeriodKey) {
    setPeriod(p);
    localStorage.setItem(PERIOD_KEY, p);
  }
  // Everything currently on screen, not just the KPI payload: the attention
  // bar, the alert list and the arrivals card are separate queries, and a
  // Refresh that quietly left three of them stale would be worse than none.
  const refreshAll = () => qc.invalidateQueries({ type: "active" });

  if (isLoading || !data) return <Spinner />;
  const { title } = TITLES[data.view];
  const rooms = data.rooms;
  const firstName = user?.name?.split(" ")[0];
  const asOf = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;
  // The window the money covers, said in the subtitle rather than in a row of
  // its own — these figures were lifetime totals under a "today" heading, so
  // they have to be labelled, but not at the cost of pushing the chart under
  // the fold. The comparison window is named here too, once, so the delta pill
  // on every tile can stay a bare "▲ 12%" instead of repeating "vs 27–31 Jul"
  // four times across one row.
  // The period label is deliberately NOT repeated here — the picker sitting
  // immediately to its left already says "Month to date". This line says what
  // that resolves to: the actual dates, and what else the reader needs to know
  // about the window. The comparison window is named here too, once, so the
  // delta pill on every tile can stay a bare "▲ 12%" instead of repeating
  // "vs 27–31 Jul" four times across one row.
  const subtitle = data.period
    ? `${fmtDate(data.period.from)} – ${fmtDate(data.period.to)}`
      // "room status live" only where there are rooms — the Restaurant view
      // was promising a live room count on a screen that has none.
      + `${rooms?.nights ? ` (${rooms.nights} nights)` : ""}${rooms ? " · room status live" : ""}`
      + `${data.previous ? ` · ▲▼ vs ${fmtDate(data.previous.from)} – ${fmtDate(data.previous.to)}` : ""}`
      + `${asOf ? ` · as of ${asOf}` : ""}`
    : `${greeting(firstName)} · ${fmtDate(todayISO())}${asOf ? ` · as of ${asOf}` : ""}`;

  // Sits in the subtitle line, immediately before the dates it produces —
  // the control and its result read as one sentence. It used to live in the
  // action row on the far right, a screen-width away from the text it governs.
  const periodPicker = (
    <>
      <span className="inline-flex items-center gap-1.5 rounded-pill bg-cream border border-hairline pl-2.5 pr-1 py-[3px] text-muted">
        <CalendarRange size={13} className="shrink-0" />
        <select
          value={period}
          onChange={(e) => choosePeriod(e.target.value as PeriodKey)}
          className="bg-transparent border-0 outline-none text-[13px] font-semibold text-ink pr-1 cursor-pointer focus:ring-0"
          aria-label="Reporting period"
        >
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </span>
      {period === "custom" && (
        <>
          <input type="date" value={from} max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
            className="input py-1 text-xs w-36" aria-label="Period from date" />
          <span className="text-xs text-muted">to</span>
          <input type="date" value={to} min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
            className="input py-1 text-xs w-36" aria-label="Period to date" />
        </>
      )}
    </>
  );

  return (
    <div>
      <PageHeader
        icon={<LayoutDashboard size={20} />}
        eyebrow="Operations"
        title={title}
        subtitle={<>{periodPicker}<span>{subtitle}</span></>}
        action={
          // ml-auto pins the controls to the right edge whether or not they
          // wrap below the title. Without it the row is justify-between, so a
          // long title ("Restaurant Dashboard" plus a longer subtitle) pushed
          // them onto their own line and hard left, and switching tabs made
          // them jump across the screen — the control moved out from under
          // the pointer that had just used it.
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {/* Which branch, which side of the business, then how to draw it.
                The sector tabs are hidden for a Hotel/Restaurant Manager,
                whose side is fixed by their role. Analytical/Data is
                icon-only: its two icons are unambiguous and the labels were
                the widest thing in a row that has to hold three controls. */}
            {/* No branch picker here: the app header carries one on every
                screen, and a second identical dropdown 130px below it reads
                as a duplicate rather than a convenience. Branch, sector and
                view mode all still drive this page — they are just not all
                drawn twice. */}
            {data.can_switch_view && (
              <Tabs value={sector} onChange={chooseSector} options={SECTOR_TABS} size="sm" />
            )}
            <div data-tour="landing-dashboard">
              <Tabs value={viewMode} onChange={chooseView} options={MODE_TABS} iconOnly size="sm" />
            </div>
            {/* The page polls itself every minute; this is for the moment you
                have just done something on another screen and want the answer
                now rather than in fifty seconds. */}
            <IconButton label="Refresh" onClick={refreshAll}>
              <RefreshCw size={15} className={isFetching ? "animate-spin" : ""} />
            </IconButton>
          </div>
        }
      />

      <SetupProgress />

      {viewMode === "analytical"
        ? <AnalyticalView data={data} sector={data.view} />
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
function RevenueTrendCard({ sector }: { sector: Sector }) {
  const [range, setRange] = useState("14");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const custom = range === "custom";
  const qs = custom
    ? `${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`
    : `&trend_days=${range}`;
  // The sector goes to the server as well as into the key: this endpoint is
  // separate from the dashboard's, so without it the chart would keep drawing
  // rooms revenue on a page the reader has switched to Restaurant.
  // keepPreviousData, so changing the range redraws the chart from the old
  // series to the new one instead of tearing it out. Without it the card fell
  // back to <Spinner/> — which is the whole-page skeleton, four KPI tiles and
  // all, rendered inside one card — every time someone clicked "1 yr".
  const { data: trend, isPlaceholderData } = useQuery({
    queryKey: ["revenue-trend", sector, custom ? `${from}|${to}` : range],
    queryFn: async () =>
      (await api.get<TrendData>(`/reports/revenue-trend/?_=1&view=${sector}${qs}`)).data,
    placeholderData: keepPreviousData,
  });

  // Period total for the selected range — a headline that follows the range
  // picker, so the chart answers "how much" before you read the shape.
  const sum = (xs?: number[]) => (xs ?? []).reduce((a, b) => a + b, 0);
  const grand = trend ? sum(trend.rooms) + sum(trend.fnb) + sum(trend.banquets) : 0;
  const rangeLabel = custom
    ? from && to ? `${fmtDate(from)} – ${fmtDate(to)}` : "custom range"
    : (TREND_RANGES.find((r) => r.key === range)?.label ?? `${range} days`);

  return (
    <Card accent className="h-full">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="font-semibold">Revenue trend</div>
        <div className="flex flex-wrap items-center gap-1">
          {TREND_RANGES.map((r) => (
            <button key={r.key} onClick={() => setRange(r.key)}
              className={`chip ${range === r.key ? "chip-on" : "chip-off"}`}>
              {r.label}
            </button>
          ))}
          <button onClick={() => setRange("custom")}
            className={`chip ${custom ? "chip-on" : "chip-off"}`}>
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
        // While the new range is in flight the old chart stays put, dimmed —
        // the shape you were reading doesn't vanish, and the fade says the
        // figures above it are still the previous window's.
        <div className={`transition-opacity duration-200 ${isPlaceholderData ? "opacity-40" : ""}`}>
          <LineChart
            height={210}
            days={trend.days}
            series={[
              ...(trend.rooms ? [{ name: "Rooms", color: SERIES.rooms, values: trend.rooms }] : []),
              ...(trend.fnb ? [{ name: "F&B", color: SERIES.fnb, values: trend.fnb }] : []),
              ...(trend.banquets ? [{ name: "Banquets", color: SERIES.banquets, values: trend.banquets }] : []),
            ]}
          />
        </div>
      ) : (
        // Only the genuine first load reaches here, and it gets a placeholder
        // the size and shape of the chart it replaces — not a page skeleton.
        <Skeleton className="h-[210px] rounded-card" />
      )}
    </Card>
  );
}

interface Alert { severity: string; module: string; title: string; detail: string }

/** The live operational picture, fetched once and shared by the strip at the
 *  top and the cards at the bottom. Every query here is one the app already
 *  polls elsewhere (Front Desk, the header bell), and React Query dedupes by
 *  key — the dashboard adds no backend surface of its own. */
function useTodayWork({ hasRooms, sector }: {
  hasRooms: boolean; sector: Sector;
}) {
  const { canAccess, property } = useApp();
  const showNotif = canAccess("notifications");
  const showBanquets = canAccess("banquets");

  const { data: arrivals } = useQuery({
    queryKey: ["arrivals"],
    queryFn: async () => (await api.get<Reservation[]>("/reservations/arrivals/")).data,
    enabled: hasRooms,
  });
  // Due-out (departures) — same source Front Desk uses: in-house stays whose
  // checkout date has arrived.
  const { data: allRes } = useQuery({
    queryKey: ["reservations"],
    queryFn: async () => (await api.get<Reservation[]>("/reservations/")).data,
    enabled: hasRooms,
  });
  // ?view= so the alert list agrees with the sector tabs: without it the
  // Hotel tab lists "Low stock: Butter" and the Restaurant tab lists
  // "Room 101 out of order" — each reporting the other half's exceptions.
  const { data: notif } = useQuery({
    queryKey: ["notif-count", sector],
    queryFn: async () =>
      (await api.get<{ count: number; alerts: Alert[] }>(
        `/notifications/?view=${sector}`)).data,
    enabled: showNotif,
  });
  const { data: banq } = useQuery({
    queryKey: ["banquets"],
    queryFn: async () => (await api.get<{ events: { event_date: string; status: string }[] }>("/banquets/")).data,
    enabled: showBanquets,
  });
  // The property's business date, exactly as Front Desk reads it — these three
  // counts are the same lists that screen works, and the two have to agree.
  // This was the UTC calendar date, so between midnight and 05:30 IST it asked
  // for yesterday: the attention bar showed the night team the previous day's
  // arrivals and due-outs while Front Desk, one click away, showed today's. A
  // property mid-night-audit is still trading yesterday, and the business date
  // is the only thing that knows that.
  const today = property?.business_date ?? todayISO();

  // Both of these used to be a single `<= today` bucket, which quietly folded
  // two different jobs into one number.
  //
  // `/reservations/arrivals/` returns EVERY reservation still in BOOKED, with
  // no date bound at all — so "Arrivals today: 5" could be two guests due at
  // 2pm and three bookings from last week that nobody ever processed. Those
  // three need no-showing or chasing, not welcoming, and burying them in the
  // arrivals count is why they stay unprocessed. Front Desk has always drawn
  // them separately, badged "Overdue"; this screen just added them in.
  //
  // Same shape on the way out: a stay whose checkout date has already passed
  // is an overstay — the guest is late, and the room may be sold tonight —
  // which is a different conversation from a guest due out this morning.
  const booked = (arrivals ?? []).filter((a) => a.checkin_date <= today);
  const inHouse = (allRes ?? []).filter((r) => r.status === "in_house");
  return {
    showNotif,
    showBanquets,
    arrivals: booked.filter((a) => a.checkin_date === today),
    overdueArrivals: booked.filter((a) => a.checkin_date < today),
    dueOut: inHouse.filter((r) => r.checkout_date === today).length,
    overstays: inHouse.filter((r) => r.checkout_date < today).length,
    banquetsToday: (banq?.events ?? []).filter((e) => e.event_date === today).length,
    alerts: notif?.alerts ?? [],
    alertCount: notif?.count ?? 0,
  };
}

interface WorkItem {
  icon: LucideIcon;
  label: string;
  count: number;
  to: string;
  tone: keyof typeof WORK_TONE;
}

/** Column track for a strip of `n` equal cells. The Hotel and Restaurant views
 *  drop whole groups of tiles, and a fixed track left the row half empty —
 *  which is the same dead space this rebuild set out to remove. Written as
 *  whole class strings because Tailwind scans source text, not expressions. */
function trackFor(n: number) {
  const wide = ["lg:grid-cols-1", "lg:grid-cols-2", "lg:grid-cols-3",
                "lg:grid-cols-4", "lg:grid-cols-5", "lg:grid-cols-6"][Math.min(n, 6) - 1];
  return `${n === 1 ? "grid-cols-1" : "grid-cols-2"} ${n >= 3 ? "sm:grid-cols-3" : ""} ${wide}`;
}

const WORK_TONE = {
  pine: { text: "text-pine", chip: "bg-pine-50 text-pine" },
  info: { text: "text-info", chip: "bg-info-50 text-info" },
  amber: { text: "text-amber-600", chip: "bg-amber-50 text-amber-600" },
  gold: { text: "text-gold-700", chip: "bg-gold-50 text-gold-700" },
  clay: { text: "text-clay", chip: "bg-clay-50 text-clay" },
};

/** What needs a manager this shift — live counts that are also the jump to the
 *  screen where you clear them.
 *
 *  This row used to be six plain nav buttons (Front Desk, Reservations, Live
 *  Grid, POS, Kitchen, Housekeeping) — every one of them a permanent item in
 *  the sidebar a couple of inches to the left. A second copy of the navigation,
 *  occupying the most valuable strip on the page and saying nothing you didn't
 *  already know. The destinations survive, and so does the one-tap reach, but
 *  each cell now answers "is there anything there for me?" before you spend the
 *  click. Zero counts stay grey, so the coloured ones are the entire read. */
function AttentionBar({ items }: { items: WorkItem[] }) {
  const nav = useNavigate();
  if (!items.length) return null;
  return (
    <Card className="!p-0 overflow-hidden animate-fade-in-up">
      {/* Hairlines between cells without per-breakpoint border maths: every cell
          carries a top+left rule and the grid is pulled 1px up/left, so the
          outer ones land under the card's own border and are clipped away. */}
      <div className={`grid ${trackFor(items.length)} -mt-px -ml-px`}>
        {items.map((it) => {
          const live = it.count > 0;
          const tone = WORK_TONE[it.tone];
          return (
            <button
              // Keyed on the label, not the destination: two cells can
              // legitimately lead to the same screen (arrivals and due-out are
              // both Front Desk's work), and the route stopped being unique.
              key={it.label}
              onClick={() => nav(it.to)}
              className="group flex items-center gap-2.5 border-t border-l border-hairline px-4 py-3
                text-left transition-colors duration-150 hover:bg-cream"
            >
              <span
                className={`shrink-0 grid place-items-center w-8 h-8 rounded-lg transition-colors ${
                  live ? tone.chip : "bg-hairline/60 text-muted"
                }`}
              >
                <it.icon size={15} />
              </span>
              <span className="min-w-0">
                <span className={`block stat-num text-lg leading-none ${live ? tone.text : "text-muted"}`}>
                  {it.count}
                </span>
                <span className="block text-[11px] text-muted mt-1 truncate">{it.label}</span>
              </span>
              <ArrowRight
                size={13}
                className="ml-auto shrink-0 text-muted opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5"
              />
            </button>
          );
        })}
      </div>
    </Card>
  );
}

/** Who is walking through the door today — the one thing on this page the
 *  counts above can't tell you, because it's names rather than a number. */
function ArrivalsCard({ arrivals }: { arrivals: Reservation[] }) {
  const nav = useNavigate();
  return (
    <Card className="h-full flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="font-semibold">Arrivals today</div>
        <Badge tone={arrivals.length ? "pine" : "muted"}>{arrivals.length}</Badge>
      </div>
      {arrivals.length ? (
        <div className="flex-1 space-y-2.5">
          {arrivals.slice(0, 6).map((a) => (
            <div key={a.id} className="flex items-baseline justify-between gap-3">
              <span className="text-sm truncate">{a.guest_name}</span>
              <span className="text-xs text-muted shrink-0">{a.room_type_name || a.room_type_code}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 text-sm text-muted">No arrivals due today.</div>
      )}
      <button
        onClick={() => nav("/frontdesk")}
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-pine hover:gap-2.5 transition-all self-start"
      >
        {arrivals.length > 6 ? `+${arrivals.length - 6} more in Front Desk` : "Open Front Desk"}
        <ArrowRight size={14} />
      </button>
    </Card>
  );
}

/** Alert modules the attention bar already renders as their own tile, with
 *  their own count and their own jump. Listing one here says "the bar owns
 *  this" — the alert list drops it rather than reporting it a second time. */
const BAR_OWNED_ALERT_MODULES = new Set(["housekeeping"]);

const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-clay",
  warning: "bg-amber",
  info: "bg-info",
};

/** The exceptions themselves, not just how many there are. */
function AlertsCard({ alerts, count, max = 6 }: { alerts: Alert[]; count: number; max?: number }) {
  const nav = useNavigate();
  return (
    <Card className="h-full flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="font-semibold">Needs attention</div>
        <Badge tone={count ? "clay" : "muted"}>{count}</Badge>
      </div>
      {alerts.length ? (
        <div className="flex-1 space-y-2.5">
          {alerts.slice(0, max).map((a, i) => (
            <div key={i} className="flex items-baseline gap-2">
              <span
                className={`shrink-0 w-1.5 h-1.5 rounded-full mt-1.5 ${SEVERITY_DOT[a.severity] ?? "bg-muted"}`}
                aria-hidden
              />
              <span className="text-sm truncate">{a.title}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 text-sm text-muted">All clear — nothing waiting.</div>
      )}
      <button
        onClick={() => nav("/notifications")}
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-pine hover:gap-2.5 transition-all self-start"
      >
        {alerts.length > max ? `+${alerts.length - max} more alerts` : "Open Notifications"}
        <ArrowRight size={14} />
      </button>
    </Card>
  );
}

/** Which F&B channel is carrying the day, in a sentence. */
function leadingMode(fnb: NonNullable<DashboardData["fnb"]>, total: number) {
  const modes = [
    ["Dine-in", num(fnb.by_mode.dinein ?? 0)],
    ["Takeaway", num(fnb.by_mode.takeaway ?? 0)],
    ["Delivery", num(fnb.by_mode.delivery ?? 0)],
  ] as [string, number][];
  const [name, value] = modes.reduce((a, b) => (b[1] > a[1] ? b : a));
  if (!total) return "No F&B sales recorded yet today.";
  return `${name} is leading today at ${pct(value, total)}% of F&B sales.`;
}

/** The revenue mix in a sentence, biggest stream first, and named for the
 *  window it actually covers — it used to read "% of today's revenue" under
 *  figures that are month-to-date, and to hard-code two streams. */
function mixNote(
  streams: { label: string; value: number }[],
  total: number,
  period?: string,
) {
  const window = period || "This period";
  const parts = [...streams]
    .sort((a, b) => b.value - a.value)
    .map((s) => `${s.label} ${pct(s.value, total)}%`);
  return `${window}: ${parts.join(", ")}.`;
}

/** Donut on the left, a plain-language read and the screen you'd act on next
 *  on the right — so the second column carries something the donut doesn't. */
function BreakdownBody({
  donut,
  note,
  action,
}: {
  donut: ReactNode;
  note: string;
  action: { label: string; to: string };
}) {
  const nav = useNavigate();
  return (
    <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,14rem)] gap-x-8 gap-y-4 items-center">
      {donut}
      <div className="md:border-l md:border-hairline md:pl-6">
        <p className="text-sm text-body leading-relaxed">{note}</p>
        <button
          onClick={() => nav(action.to)}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-pine hover:gap-2.5 transition-all"
        >
          {action.label} <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

/** The supporting figures, as one quiet strip rather than four more cards.
 *
 *  These used to be a second row of Cards sitting under the KPI tiles at a
 *  different size and padding, with no icons — two visual languages stacked,
 *  each card half empty. One bordered strip with hairline dividers reads as
 *  deliberately secondary, aligns to the same grid as the row above, and
 *  removes the dead space. */
function SupportingStrip({ items }: { items: { label: string; value: string; sub?: string; delta?: number }[] }) {
  if (!items.length) return null;
  // Same clipped top/left rule as the attention bar, so the dividers stay
  // right whatever the count.
  return (
    <Card className="!p-0 animate-fade-in-up overflow-hidden">
      <div className={`grid ${trackFor(items.length)} -mt-px -ml-px`}>
        {items.map((m) => (
          <div key={m.label} className="px-5 py-3 border-t border-l border-hairline">
            <div className="text-xs text-muted">{m.label}</div>
            <div className="flex items-baseline gap-2 flex-wrap mt-1">
              <div className="stat-num text-xl leading-none">{m.value}</div>
              {m.delta !== undefined && (
                <span className={`pill text-[10px] gap-0.5 ${
                  m.delta > 0 ? "bg-success-50 text-success"
                    : m.delta < 0 ? "bg-clay-50 text-clay" : "bg-hairline text-muted"
                }`}>
                  {m.delta > 0 ? "▲" : m.delta < 0 ? "▼" : "–"} {Math.abs(m.delta)}%
                </span>
              )}
            </div>
            {m.sub && <div className="text-[11px] text-muted mt-1">{m.sub}</div>}
          </div>
        ))}
      </div>
    </Card>
  );
}

/** Right now, on the floor. Sits under the money KPIs because it answers a
 *  different question: those say how the month is going, this says what the
 *  building is doing this minute. */
function FloorStrip({ floor, hasRooms, hasFnb }: {
  floor: NonNullable<DashboardData["floor"]>;
  hasRooms: boolean;
  hasFnb: boolean;
}) {
  const nav = useNavigate();
  const cells = [
    hasRooms && { icon: Users, label: "In house", value: String(floor.in_house),
                  sub: `of ${floor.rooms_total} rooms`, to: "/livegrid" },
    hasFnb && { icon: ClipboardList, label: "Open tickets", value: String(floor.open_tickets),
                sub: "taken, not yet settled", to: "/pos" },
    hasFnb && { icon: ChefHat, label: "KOTs in the kitchen", value: String(floor.kots_pending),
                sub: "fired, awaiting the pass", to: "/kds" },
    hasRooms && { icon: Sparkles, label: "Rooms clean", value: `${floor.clean_pct}%`,
                  sub: `${floor.rooms_clean} of ${floor.rooms_total} ready`, to: "/housekeeping",
                  bar: floor.clean_pct },
  ].filter(Boolean) as { icon: LucideIcon; label: string; value: string; sub: string;
                         to: string; bar?: number }[];
  if (!cells.length) return null;
  return (
    <Card className="!p-0 overflow-hidden animate-fade-in-up">
      <div className={`grid ${trackFor(cells.length)} -mt-px -ml-px`}>
        {cells.map((c) => (
          <button key={c.to} onClick={() => nav(c.to)}
            className="group text-left border-t border-l border-hairline px-5 py-3.5
              transition-colors duration-150 hover:bg-cream">
            <span className="flex items-center gap-2 text-xs text-muted">
              <c.icon size={13} className="shrink-0" /> {c.label}
            </span>
            <span className="block stat-num text-2xl leading-none mt-1.5">{c.value}</span>
            {c.bar !== undefined ? (
              <span className="block mt-2 h-1.5 rounded-pill bg-hairline overflow-hidden">
                <span className="block h-full rounded-pill bg-pine transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, c.bar))}%` }} />
              </span>
            ) : null}
            <span className="block text-[11px] text-muted mt-1.5">{c.sub}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}

/** A labelled proportion bar — used for the tender split, where the share
 *  matters more than the rupee figure. */
function ShareRow({ label, value, total, color }: {
  label: string; value: number; total: number; color: string;
}) {
  const pctOf = total ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="truncate">{label}</span>
        <span className="text-muted tabular-nums shrink-0">
          {moneyKpi(value)} <span className="text-xs">· {pctOf}%</span>
        </span>
      </div>
      <div className="mt-1 h-1.5 rounded-pill bg-hairline overflow-hidden">
        <div className="h-full rounded-pill transition-all duration-500"
          style={{ width: `${pctOf}%`, background: color }} />
      </div>
    </div>
  );
}

/** How guests actually paid, and what they actually ordered. */
function MoneyCard({ money }: { money: NonNullable<DashboardData["money"]> }) {
  const nav = useNavigate();
  const mix = money.payment_mix.map((m) => ({ ...m, n: num(m.value) }));
  const total = mix.reduce((s, m) => s + m.n, 0);
  const discount = num(money.discount);
  return (
    <Card className="h-full flex flex-col">
      <div className="font-semibold mb-4">Payments &amp; what sold</div>
      <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5 flex-1">
        <div className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-wide text-muted">Tender mix</div>
          {mix.length ? mix.slice(0, 5).map((m, i) => (
            <ShareRow key={m.label} label={m.label} value={m.n} total={total}
              color={STREAM_COLORS[i % STREAM_COLORS.length]} />
          )) : <div className="text-sm text-muted">Nothing settled in this period.</div>}
        </div>
        <div className="space-y-2 sm:border-l sm:border-hairline sm:pl-6">
          <div className="text-xs font-bold uppercase tracking-wide text-muted">Top sellers</div>
          {money.top_items.length ? money.top_items.map((it, i) => (
            <div key={it.label} className="flex items-baseline justify-between gap-3">
              <span className="text-sm truncate">
                <span className="text-muted tabular-nums mr-1.5">{i + 1}.</span>{it.label}
              </span>
              <span className="text-sm text-muted tabular-nums shrink-0">{it.qty}</span>
            </div>
          )) : <div className="text-sm text-muted">No items sold yet.</div>}
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-hairline flex items-center justify-between gap-3">
        <span className="text-sm text-muted">
          Discount given · <span className={discount ? "text-clay font-semibold" : ""}>{moneyKpi(discount)}</span>
        </span>
        <button onClick={() => nav("/reports")}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-pine hover:gap-2.5 transition-all">
          Open Reports <ArrowRight size={14} />
        </button>
      </div>
    </Card>
  );
}

/** The next seven nights already on the books — the one part of this page that
 *  looks forward rather than at what has already happened. */
function ForwardCard({ forward }: { forward: NonNullable<DashboardData["forward"]> }) {
  const nav = useNavigate();
  const peak = Math.max(1, ...forward.occ_pct);
  const totalArr = forward.arrivals.reduce((a, b) => a + b, 0);
  return (
    <Card className="h-full flex flex-col">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <div className="font-semibold">On the books</div>
        <span className="text-xs text-muted">next 7 nights</span>
      </div>
      <div className="text-xs text-muted mb-4">
        {totalArr} arrival{totalArr === 1 ? "" : "s"} expected · {forward.rooms_total} rooms
      </div>
      {/* The bar column is flex-1 rather than a fixed height, so the chart
          grows into whatever height the card is stretched to by its neighbour
          instead of sitting in the bottom third under a band of white. */}
      <div className="flex-1 min-h-[9rem] grid grid-cols-7 gap-1.5 items-stretch">
        {forward.days.map((d, i) => (
          <div key={d} className="flex flex-col items-center gap-1.5 min-w-0">
            <span className="text-[11px] text-muted tabular-nums">{forward.occ_pct[i]}%</span>
            <div className="w-full flex-1 flex items-end">
              <div className="w-full rounded-t-md bg-gradient-to-t from-pine-200 to-pine
                  transition-all duration-500 min-h-[2px]"
                style={{ height: `${(forward.occ_pct[i] / peak) * 100}%` }}
                title={`${forward.on_books[i]} room(s) on the books`} />
            </div>
            <span className="text-[10px] text-muted truncate w-full text-center">{d.split(" ")[0]}</span>
            {/* A quiet day reads "0", not "+0 / −0" — the signs are there to
                mark direction, and there is no direction to mark. */}
            <span className="text-[10px] tabular-nums text-center">
              {forward.arrivals[i] || forward.departures[i] ? (
                <>
                  <span className={forward.arrivals[i] ? "text-pine" : "text-muted"}>
                    +{forward.arrivals[i]}
                  </span>
                  <span className="text-muted"> / </span>
                  <span className={forward.departures[i] ? "text-clay" : "text-muted"}>
                    −{forward.departures[i]}
                  </span>
                </>
              ) : <span className="text-muted">·</span>}
            </span>
          </div>
        ))}
      </div>
      <button onClick={() => nav("/reservations")}
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-pine hover:gap-2.5 transition-all self-start">
        Open Reservations <ArrowRight size={14} />
      </button>
    </Card>
  );
}

/** Every branch at once. The switcher in the header answers "how is this one
 *  doing"; it can't answer "which one is behind", because it holds one branch
 *  at a time. Clicking a row switches the whole page to that branch. */
function BranchTable({ rows, activeBranch, onPick }: {
  rows: NonNullable<DashboardData["branches"]>;
  activeBranch: number | null;
  onPick: (id: number | null) => void;
}) {
  const totals = rows.reduce(
    (a, r) => ({
      occupied: a.occupied + r.occupied,
      rooms: a.rooms + r.rooms_total,
      room_revenue: a.room_revenue + num(r.room_revenue),
      fnb: a.fnb + num(r.fnb_sales),
      covers: a.covers + r.covers,
    }),
    { occupied: 0, rooms: 0, room_revenue: 0, fnb: 0, covers: 0 },
  );
  return (
    <Card className="!p-0 overflow-hidden">
      <div className="flex items-baseline justify-between gap-2 px-5 pt-5 pb-3">
        <div className="font-semibold flex items-center gap-2">
          <Building2 size={15} className="text-pine" /> By branch
        </div>
        <span className="text-xs text-muted">click a row to focus that branch</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[40rem]">
          <thead>
            <tr className="text-xs text-muted border-y border-hairline bg-cream/60">
              <th className="text-left font-medium px-5 py-2">Branch</th>
              <th className="text-right font-medium px-3 py-2">Occupancy</th>
              <th className="text-right font-medium px-3 py-2">Rooms</th>
              <th className="text-right font-medium px-3 py-2">Room revenue</th>
              <th className="text-right font-medium px-3 py-2">ADR</th>
              <th className="text-right font-medium px-3 py-2">F&amp;B</th>
              <th className="text-right font-medium px-5 py-2">Covers</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} onClick={() => onPick(activeBranch === r.id ? null : r.id)}
                className={`border-b border-hairline cursor-pointer transition-colors ${
                  activeBranch === r.id ? "bg-pine-50" : "hover:bg-cream"}`}>
                <td className="px-5 py-2.5">
                  <span className="font-medium">{r.name}</span>
                  <span className="text-xs text-muted ml-2">{r.code}</span>
                </td>
                <td className="text-right px-3 py-2.5 tabular-nums">{r.occupancy_pct}%</td>
                <td className="text-right px-3 py-2.5 tabular-nums text-muted">
                  {r.occupied}/{r.rooms_total}
                </td>
                <td className="text-right px-3 py-2.5 tabular-nums">{moneyKpi(r.room_revenue)}</td>
                <td className="text-right px-3 py-2.5 tabular-nums text-muted">{moneyKpi(r.adr)}</td>
                <td className="text-right px-3 py-2.5 tabular-nums">{moneyKpi(r.fnb_sales)}</td>
                <td className="text-right px-5 py-2.5 tabular-nums text-muted">{r.covers}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {/* The group line is the check that the rows above are a partition
                of it and not an overlapping set. */}
            <tr className="text-sm font-semibold bg-cream/60">
              <td className="px-5 py-2.5">Group</td>
              <td className="text-right px-3 py-2.5 tabular-nums">
                {totals.rooms ? Math.round((totals.occupied / totals.rooms) * 1000) / 10 : 0}%
              </td>
              <td className="text-right px-3 py-2.5 tabular-nums">
                {totals.occupied}/{totals.rooms}
              </td>
              <td className="text-right px-3 py-2.5 tabular-nums">{moneyKpi(totals.room_revenue)}</td>
              <td className="text-right px-3 py-2.5 tabular-nums text-muted">—</td>
              <td className="text-right px-3 py-2.5 tabular-nums">{moneyKpi(totals.fnb)}</td>
              <td className="text-right px-5 py-2.5 tabular-nums">{totals.covers}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

function AnalyticalView({
  data,
  sector,
}: {
  data: DashboardData;
  /** Server's answer, not the local pick — a locked role gets its own side. */
  sector: Sector;
}) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { canAccess, activeBranch, setBranch } = useApp();
  const rooms = data.rooms;
  const fnb = data.fnb;
  const roomsTotal = rooms?.rooms_total || 0;
  const hasRooms = !!(rooms && roomsTotal > 0);
  const fnbRev = fnb ? num(fnb.fnb_sales) : 0;
  const covers = fnb?.order_count ?? 0;
  const aov = covers ? fnbRev / covers : 0;
  const wow = weekOnWeek(data.trend);
  const work = useTodayWork({ hasRooms, sector });
  const receivables = data.receivables;
  // The alert list drops anything the bar above it already draws as a tile.
  // Housekeeping raises "N room(s) awaiting cleaning" and "Room X out of
  // order" — which is precisely the "Rooms to clean" count two rows up, so the
  // page was stating the same rooms twice and inviting a manager to work them
  // twice. The bell in the app header keeps the unfiltered set; the rule that
  // holds on THIS page is that every fact appears exactly once.
  const alerts = work.alerts.filter((a) => !BAR_OWNED_ALERT_MODULES.has(a.module));
  // How the same window did last time round. The subtitle names the dates, so
  // each pill can stay a bare percentage.
  const prev = data.previous;

  // Work you dispatch — not conditions you resolve. Those are the alert list's,
  // and anything appearing in both was being counted twice on one screen.
  const workItems = [
    hasRooms && canAccess("frontdesk") &&
      { icon: DoorOpen, label: "Arrivals today", count: work.arrivals.length, to: "/frontdesk", tone: "pine" },
    // Only when there are any. An overdue arrival is an exception, not a daily
    // rhythm: "0 overdue" is not a fact anyone needs, and a permanently grey
    // cell would dilute the coloured ones that are the whole read.
    hasRooms && canAccess("frontdesk") && work.overdueArrivals.length > 0 &&
      { icon: CalendarX, label: "Overdue arrivals", count: work.overdueArrivals.length, to: "/frontdesk", tone: "clay" },
    // Front Desk, not Folios: this count is computed from exactly the list in
    // that screen's "Departures — due out" section, and every other tile in
    // this bar leads to the screen its own list lives on. Guarded like the
    // arrivals tile beside it, so nobody is offered a jump they'd be 403'd on.
    hasRooms && canAccess("frontdesk") &&
      { icon: LogOut, label: "Due out today", count: work.dueOut, to: "/frontdesk", tone: "info" },
    // Same rule as overdue arrivals — and the sharper one of the two: an
    // overstay is a room that may already be sold to someone arriving tonight.
    hasRooms && canAccess("frontdesk") && work.overstays > 0 &&
      { icon: AlarmClock, label: "Overstays", count: work.overstays, to: "/frontdesk", tone: "clay" },
    // Dirty only — out-of-order rooms are deliberately NOT added in. An OOO
    // room doesn't need cleaning, it needs fixing, and this cell jumps to
    // Housekeeping, who can do nothing with it. It already has an owner: the
    // "Room N out of order" alert, which is an engineering alert and links
    // there. Folding the two together both misdirected the manager and counted
    // the same room twice on one screen.
    hasRooms && canAccess("housekeeping") && rooms &&
      { icon: Sparkles, label: "Rooms to clean", count: rooms.dirty, to: "/housekeeping", tone: "amber" },
    work.showBanquets &&
      { icon: PartyPopper, label: "Banquets today", count: work.banquetsToday, to: "/banquets", tone: "gold" },
    // No "Dish approvals" cell. A Chef-proposed dish already raises a warning
    // alert (notifications/views.py) that deep-links to this very route, and
    // that alert is counted in "Needs attention" alongside — so the bar was
    // reporting the same two dishes twice, in two different cells, as if they
    // were two different jobs. The Approvals inbox is the queue's home.
    work.showNotif &&
      { icon: Bell, label: "Needs attention", count: alerts.length, to: "/notifications", tone: "clay" },
  ].filter(Boolean) as WorkItem[];

  const miniStats = [
    { label: "Revenue · last 7 days", value: moneyKpi(wow.total), delta: wow.delta },
    // "Covers today" was wrong twice over: the figure was lifetime, and covers
    // is the order count for the period the rest of the band covers.
    fnb && {
      label: "Covers", value: String(covers), sub: `avg check ${moneyKpi(aov)}`,
      delta: deltaPct(covers, prev?.fnb?.order_count),
    },
    rooms && { label: "Available to sell", value: String(rooms.available), sub: `of ${roomsTotal} rooms` },
    // Receivables moved down here from the old right rail: it's a figure you
    // read, not a queue you work, so it belongs with the other supporting
    // numbers rather than among the live counts up top.
    receivables && {
      label: "Receivables",
      value: moneyKpi(receivables.total),
      sub: `${moneyKpi(receivables.corporate)} bill-to-company`,
    },
  ].filter(Boolean) as { label: string; value: string; sub?: string; delta?: number }[];

  return (
    <>
      {/* What needs you, before how you're doing. */}
      <AttentionBar items={workItems} />

      {/* KPI row — Occupancy and F&B drill through to where you act on them;
          ADR / RevPAR are computed rates with no single screen to act on, so
          they're display-only (no false affordance). Three rooms tiles plus
          F&B when both sides are in view; the track follows whichever survive
          the sector filter. */}
      <div className={`grid ${trackFor((rooms ? 3 : 0) + (fnb ? 1 : 0))} gap-3 mt-3`}>
        {rooms && (
          <>
            <button
              onClick={() => nav("/livegrid")}
              className="relative overflow-hidden rounded-card p-4 bg-gradient-ink text-white shadow-md animate-fade-in-up flex items-center justify-between gap-2 text-left cursor-pointer transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="pointer-events-none absolute -right-6 -top-10 w-32 h-32 rounded-full bg-pine-400/20 blur-2xl" aria-hidden />
              <div className="relative">
                <div className="stat-num text-2xl text-white">{rooms.occupancy_pct}%</div>
                <div className="text-xs mt-1 text-white/60">Occupancy · right now</div>
                <div className="text-xs mt-2 text-white/60">{rooms.occupied} of {rooms.rooms_total} rooms</div>
                {/* The comparison hangs off the PERIOD line, not the big
                    number: that one is a live snapshot of this minute, and a
                    snapshot has no counterpart in a window that has closed.
                    Points rather than percent — see deltaPoints. */}
                {rooms.period_occupancy_pct !== undefined && (
                  <div className="text-xs mt-1 text-white/45">
                    {rooms.period_occupancy_pct}% this period
                    {(() => {
                      const d = deltaPoints(rooms.period_occupancy_pct, prev?.rooms?.occupancy_pct);
                      return d === undefined ? null : (
                        <span className="ml-1.5 text-white/70">
                          {d > 0 ? "▲" : "▼"} {Math.abs(d)} pts
                        </span>
                      );
                    })()}
                  </div>
                )}
              </div>
              <RadialGauge pct={rooms.occupancy_pct} size={62} thickness={7}>
                <Percent size={15} className="text-white/70" />
              </RadialGauge>
            </button>
            <Stat compact delayMs={60} icon={<Wallet size={16} />} label="ADR"
              value={moneyKpi(rooms.adr)}
              delta={deltaPct(rooms.adr, prev?.rooms?.adr)}
              sub={rooms.rooms_sold ? `across ${rooms.rooms_sold} room nights sold` : "average daily rate"} />
            {/* RevPAR sits beside ADR, so the relationship between them has to
                read correctly: it is revenue per available room PER NIGHT, and
                it can never exceed ADR. It used to, because the denominator
                omitted the nights. */}
            <Stat compact delayMs={120} icon={<TrendingUp size={16} />} label="RevPAR"
              value={moneyKpi(rooms.revpar)}
              delta={deltaPct(rooms.revpar, prev?.rooms?.revpar)}
              sub={`per available room · ${rooms.nights ?? 1} night${(rooms.nights ?? 1) === 1 ? "" : "s"}`} />
          </>
        )}
        {fnb && (
          // Sub reads avg check, not the order count — that number is already
          // the "Covers" figure in the strip below, and printing it twice
          // made the band look padded.
          <Stat compact tone={rooms ? undefined : "dark"} delayMs={rooms ? 180 : 0} onClick={() => nav("/pos")} icon={<UtensilsCrossed size={16} />} label="F&B sales" value={moneyKpi(fnb.fnb_sales)} delta={deltaPct(fnbRev, num(prev?.fnb?.fnb_sales ?? 0))} sub={`avg check ${moneyKpi(aov)}`} />
        )}
      </div>

      {/* Two paired rows rather than one long column beside a rail. The old
          layout stacked chart + strip + breakdown in a 2/3 column next to a
          right rail that ran out of content two thirds of the way down, and
          left a tall block of empty card at the bottom right. Here each wide
          card is matched with a list of its own, and both lists push their
          footer link to the bottom, so a height difference reads as a card
          anchored to its neighbour rather than as content that ran out. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-3 items-stretch">
        {/* Each wide card takes the whole row when its companion is entitled
            away, rather than leaving a third of the row blank. */}
        <div className={work.showNotif ? "lg:col-span-2" : "lg:col-span-3"}>
          <RevenueTrendCard sector={sector} />
        </div>
        {/* The alert list is the long one, so it pairs with the tall card and
            the short arrivals list pairs with the shorter breakdown — the two
            rows come out level without anything being padded to fit. */}
        {work.showNotif && <AlertsCard alerts={alerts} count={alerts.length} max={10} />}
      </div>

      {/* Both figure strips sit AFTER the chart, for the same reason: they are
          what an owner scans once the trend has been read, and every band above
          the chart pushes it under the fold. The floor strip started out above
          it and cost the chart about a hundred pixels — on a laptop that was
          the difference between reading the shape and having to scroll for it. */}
      {data.floor && (
        <div className="mt-3">
          <FloorStrip floor={data.floor} hasRooms={hasRooms} hasFnb={!!fnb} />
        </div>
      )}

      <div className="mt-3">
        <SupportingStrip items={miniStats} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-3 items-stretch">
        <div className={hasRooms ? "lg:col-span-2" : "lg:col-span-3"}>
          <BreakdownCard data={data} />
        </div>
        {hasRooms && <ArrivalsCard arrivals={work.arrivals} />}
      </div>

      {/* The commercial and forward layers. Each is gated server-side on the
          sector, so the Hotel tab carries no tender mix and the Restaurant tab
          carries no pickup curve — and whichever survives alone takes the full
          width rather than leaving half a row blank. */}
      {(data.money || data.forward) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-3 items-stretch">
          {data.money && (
            <div className={data.forward ? "" : "lg:col-span-2"}>
              <MoneyCard money={data.money} />
            </div>
          )}
          {data.forward && (
            <div className={data.money ? "" : "lg:col-span-2"}>
              <ForwardCard forward={data.forward} />
            </div>
          )}
        </div>
      )}

      {data.branches && data.branches.length > 1 && (
        <div className="mt-3">
          <BranchTable
            rows={data.branches}
            activeBranch={activeBranch}
            onPick={(id) => {
              setBranch(id);
              // setBranch only swaps the X-Branch-Id header; the shell's own
              // switcher invalidates separately, so a row click has to do it
              // too or the page keeps rendering the previous branch's cache.
              qc.invalidateQueries();
            }}
          />
        </div>
      )}
    </>
  );
}

/** The three "mix" views (room status / revenue / F&B mode) collapsed into one
 *  card with a segmented control — swap the view instead of stacking three. */
function BreakdownCard({ data }: { data: DashboardData }) {
  const rooms = data.rooms;
  const fnb = data.fnb;
  const roomsTotal = rooms?.rooms_total || 0;
  // The mix is whatever streams this caller actually earns from, not a fixed
  // rooms-versus-F&B pair. Banquets were drawn in the trend chart above and in
  // the "last 7 days" figure below, but left out of this donut — so on a
  // property running events the mix didn't add up to either of its neighbours.
  const streams = [
    rooms && { label: "Rooms", value: num(rooms.room_revenue), color: SERIES.rooms },
    fnb && { label: "F&B", value: num(fnb.fnb_sales), color: SERIES.fnb },
    data.banquets && { label: "Banquets", value: num(data.banquets.revenue), color: SERIES.banquets },
  ].filter(Boolean) as { label: string; value: number; color: string }[];
  const revenueMixTotal = streams.reduce((s, x) => s + x.value, 0);
  const fnbTotal = fnb ? Object.values(fnb.by_mode).reduce((s, v) => s + num(v), 0) : 0;

  const tabs: { value: string; label: string }[] = [];
  if (rooms && roomsTotal > 0) tabs.push({ value: "rooms", label: "Room status" });
  // One stream is not a mix — it would be a donut of a single 100% slice.
  if (streams.length > 1 && revenueMixTotal > 0) tabs.push({ value: "revenue", label: "Revenue" });
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
      {/* The donut's own legend already carries label, value and share for every
          slice. A column of bars beside it repeated all three verbatim — the
          same numbers twice, side by side, which read as filler. The second
          column now answers "so what do I do about it" instead. */}
      {active === "rooms" && rooms && (
        <BreakdownBody
          donut={
            <Donut
              centerLabel="rooms"
              slices={[
                { label: "Occupied", value: rooms.occupied, color: "#2563EB", display: `${rooms.occupied} rms` },
                { label: "Available", value: rooms.available, color: "#16A34A", display: `${rooms.available} rms` },
                { label: "Dirty / OOO", value: rooms.dirty + rooms.ooo, color: "#D97706", display: `${rooms.dirty + rooms.ooo} rms` },
              ]}
            />
          }
          note={rooms.dirty + rooms.ooo > 0
            ? `${rooms.dirty + rooms.ooo} of ${roomsTotal} rooms aren't sellable right now — ${pct(rooms.dirty + rooms.ooo, roomsTotal)}% of the property.`
            : `All ${roomsTotal} rooms are clean and sellable.`}
          action={{ label: "Open Housekeeping", to: "/housekeeping" }}
        />
      )}
      {active === "revenue" && streams.length > 1 && (
        <BreakdownBody
          donut={
            <Donut
              centerLabel="revenue"
              centerValue={moneyKpi(revenueMixTotal)}
              slices={streams.map((s) => ({
                label: s.label, value: s.value, color: s.color, display: moneyKpi(s.value),
              }))}
            />
          }
          note={mixNote(streams, revenueMixTotal, data.period?.label)}
          action={{ label: "Open Reports", to: "/reports" }}
        />
      )}
      {active === "fnb" && fnb && (
        <BreakdownBody
          donut={
            <Donut
              centerLabel="F&B"
              centerValue={moneyKpi(fnbTotal)}
              slices={(["dinein", "takeaway", "delivery"] as const).map((m, i) => ({
                label: m === "dinein" ? "Dine-in" : m === "takeaway" ? "Takeaway" : "Delivery",
                value: num(fnb.by_mode[m] ?? 0),
                color: STREAM_COLORS[i],
                display: moneyKpi(fnb.by_mode[m] ?? 0),
              }))}
            />
          }
          note={leadingMode(fnb, fnbTotal)}
          action={{ label: "Open Restaurant POS", to: "/pos" }}
        />
      )}
    </Card>
  );
}

const SECTION_STYLE: Record<string, { icon: string; text: string; chip: string; accent: string }> = {
  Rooms: { icon: "roommaster", text: "text-pine", chip: "bg-pine-50 text-pine", accent: "border-pine" },
  "F&B": { icon: "pos", text: "text-clay", chip: "bg-clay-50 text-clay", accent: "border-clay" },
  Receivables: { icon: "accounting", text: "text-amber-600", chip: "bg-amber-50 text-amber-600", accent: "border-amber" },
  Banquets: { icon: "banquets", text: "text-gold-700", chip: "bg-gold-50 text-gold-700", accent: "border-gold" },
  "On the floor": { icon: "livegrid", text: "text-info", chip: "bg-info-50 text-info", accent: "border-info" },
  Payments: { icon: "revenue", text: "text-pine", chip: "bg-pine-50 text-pine", accent: "border-pine" },
};

interface LedgerRow {
  label: string;
  value: string;
  /** The same figure last period. Rendered as a number rather than an arrow
   *  pill: this is the view people switch to when they want the actual
   *  quantity, and "▲ 12%" is precisely what it isn't for. */
  prev?: string;
}

function LedgerSection({
  title,
  headline,
  rows,
  showPrev,
}: {
  title: string;
  headline: { label: string; value: string };
  rows: LedgerRow[];
  showPrev?: boolean;
}) {
  const s = SECTION_STYLE[title];
  return (
    <div className={`border-l-4 ${s.accent} pl-4 py-4 first:pt-0 h-full`}>
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
      {showPrev && (
        <div className="flex items-center justify-end gap-4 text-[10px] uppercase tracking-wide text-muted border-b border-hairline pb-1 mb-1">
          <span className="w-24 text-right">This period</span>
          <span className="w-24 text-right">Previous</span>
        </div>
      )}
      <div>
        {rows.map((r, i) => (
          <div
            key={r.label}
            className={`flex items-center justify-between gap-3 py-1.5 px-2 -mx-2 rounded ${i % 2 === 1 ? "bg-cream/70" : ""}`}
          >
            {/* Wraps rather than truncates. This is the view people come to
                for exact figures, and "Room rev…" against ₹4,22,100 is not a
                figure you can read — an uneven row height costs less than an
                unreadable label. */}
            <span className="text-sm text-muted min-w-0">{r.label}</span>
            <span className="flex items-center gap-4 shrink-0">
              <span className={`text-sm font-semibold tabular-nums text-right ${showPrev ? "w-24" : ""}`}>
                {r.value}
              </span>
              {/* An em dash where there is no counterpart, so the column stays
                  a column — a blank cell reads as a missing figure. */}
              {showPrev && (
                <span className="w-24 text-right text-sm tabular-nums text-muted">{r.prev ?? "—"}</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface LedgerBlock {
  title: string;
  headline: { label: string; value: string };
  rows: LedgerRow[];
  /** Whether this block has a period before it to sit beside. The floor state
   *  never does — "how many are in the house right now" has no last-month. */
  showPrev?: boolean;
}

/** Every figure on this screen, as one CSV. Built from the payload the page is
 *  already holding rather than a second endpoint, so what downloads is exactly
 *  what is on screen — including the branch rows and the pickup curve. */
function exportCsv(data: DashboardData, blocks: LedgerBlock[]) {
  const q = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`;
  const lines: string[] = [];
  const p = data.period;
  lines.push(["Section", "Metric", "Value", "Previous period"].map(q).join(","));
  if (p) lines.push([q("Period"), q(p.label), q(`${p.from} to ${p.to}`), q(
    data.previous ? `${data.previous.from} to ${data.previous.to}` : "")].join(","));
  for (const b of blocks) {
    lines.push([q(b.title), q(b.headline.label), q(b.headline.value), q("")].join(","));
    for (const r of b.rows) lines.push([q(b.title), q(r.label), q(r.value), q(r.prev ?? "")].join(","));
  }
  for (const br of data.branches ?? []) {
    lines.push([q("By branch"), q(`${br.name} (${br.code}) occupancy`), q(`${br.occupancy_pct}%`), q("")].join(","));
    lines.push([q("By branch"), q(`${br.name} (${br.code}) rooms`), q(`${br.occupied}/${br.rooms_total}`), q("")].join(","));
    lines.push([q("By branch"), q(`${br.name} (${br.code}) room revenue`), q(br.room_revenue), q("")].join(","));
    lines.push([q("By branch"), q(`${br.name} (${br.code}) ADR`), q(br.adr), q("")].join(","));
    lines.push([q("By branch"), q(`${br.name} (${br.code}) F&B`), q(br.fnb_sales), q("")].join(","));
    lines.push([q("By branch"), q(`${br.name} (${br.code}) covers`), q(br.covers), q("")].join(","));
  }
  const f = data.forward;
  if (f) {
    f.days.forEach((d, i) => {
      lines.push([q("On the books"), q(`${d} occupancy`), q(`${f.occ_pct[i]}%`), q("")].join(","));
      lines.push([q("On the books"), q(`${d} rooms on books`), q(f.on_books[i]), q("")].join(","));
      lines.push([q("On the books"), q(`${d} arrivals / departures`),
                  q(`${f.arrivals[i]} / ${f.departures[i]}`), q("")].join(","));
    });
  }
  const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `dashboard-${p ? `${p.from}_${p.to}` : todayISO()}.csv`;
  a.click();
  // Revoked on the next tick, not inline: the download is handed off
  // asynchronously, and tearing the URL down in the same statement as the
  // click is a race that ends in an empty file often enough to matter.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** The same picture as the analytical view, as numbers.
 *
 *  It used to be three ledger cards — rooms, F&B, receivables — against the
 *  other view's dozen blocks, which made "Data" a worse version of the page
 *  rather than a different reading of it. Everything the payload carries is
 *  here now, each figure beside what it was last period, and the whole lot
 *  downloads as a CSV: the reason to switch to this view is to get the
 *  quantities out, and it had no way to do that. */
function DataView({ data }: { data: DashboardData }) {
  const rooms = data.rooms;
  const fnb = data.fnb;
  const floor = data.floor;
  const money_ = data.money;
  const prev = data.previous;
  const qc = useQueryClient();
  const { activeBranch, setBranch } = useApp();

  const blocks: LedgerBlock[] = [];
  if (rooms) {
    blocks.push({
      title: "Rooms",
      headline: { label: "Occupancy · now", value: `${rooms.occupancy_pct}%` },
      showPrev: !!prev?.rooms,
      rows: [
        { label: "Occupied", value: String(rooms.occupied) },
        { label: "Total rooms", value: String(rooms.rooms_total) },
        { label: "Available to sell", value: String(rooms.available) },
        { label: "Dirty", value: String(rooms.dirty) },
        { label: "Out of order", value: String(rooms.ooo) },
        // The period figures are the ones with a counterpart; the room-status
        // counts above are a live snapshot and deliberately have none.
        {
          label: "Occupancy · period", value: `${rooms.period_occupancy_pct ?? 0}%`,
          prev: prev?.rooms ? `${prev.rooms.occupancy_pct}%` : undefined,
        },
        { label: "Room nights sold", value: String(rooms.rooms_sold ?? 0) },
        { label: "ADR", value: money(rooms.adr), prev: prev?.rooms ? money(prev.rooms.adr) : undefined },
        { label: "RevPAR", value: money(rooms.revpar), prev: prev?.rooms ? money(prev.rooms.revpar) : undefined },
        {
          label: "Room revenue", value: money(rooms.room_revenue),
          prev: prev?.rooms ? money(prev.rooms.room_revenue) : undefined,
        },
      ],
    });
  }
  if (fnb) {
    blocks.push({
      title: "F&B",
      headline: { label: "Total sales", value: money(fnb.fnb_sales) },
      showPrev: !!prev?.fnb,
      rows: [
        {
          label: "Total sales", value: money(fnb.fnb_sales),
          prev: prev?.fnb ? money(prev.fnb.fnb_sales) : undefined,
        },
        {
          label: "Orders", value: String(fnb.order_count),
          prev: prev?.fnb ? String(prev.fnb.order_count) : undefined,
        },
        { label: "Average order value", value: money(fnb.order_count ? num(fnb.fnb_sales) / fnb.order_count : 0) },
        { label: "Dine-in", value: money(fnb.by_mode.dinein ?? 0) },
        { label: "Takeaway", value: money(fnb.by_mode.takeaway ?? 0) },
        { label: "Delivery", value: money(fnb.by_mode.delivery ?? 0) },
      ],
    });
  }
  if (data.banquets) {
    blocks.push({
      title: "Banquets",
      headline: { label: "Event revenue", value: money(data.banquets.revenue) },
      showPrev: !!prev?.banquets,
      rows: [
        {
          label: "Events", value: String(data.banquets.events),
          prev: prev?.banquets ? String(prev.banquets.events) : undefined,
        },
        {
          label: "Revenue", value: money(data.banquets.revenue),
          prev: prev?.banquets ? money(prev.banquets.revenue) : undefined,
        },
        {
          label: "Average per event",
          value: money(data.banquets.events ? num(data.banquets.revenue) / data.banquets.events : 0),
        },
      ],
    });
  }
  if (data.receivables) {
    blocks.push({
      title: "Receivables",
      headline: { label: "Total outstanding", value: money(data.receivables.total) },
      rows: [
        { label: "Bill-to-company", value: money(data.receivables.corporate) },
        // Derived, not a new endpoint: what's left after the corporate
        // ledger is guest and walk-in debt, which is the half a manager
        // can actually chase today.
        { label: "Guest & walk-in", value: money(Math.max(0, num(data.receivables.total) - num(data.receivables.corporate))) },
        { label: "Corporate accounts", value: String(data.receivables.corporate_accounts) },
        { label: "Average per account", value: money(data.receivables.corporate_accounts
            ? num(data.receivables.corporate) / data.receivables.corporate_accounts : 0) },
      ],
    });
  }
  if (floor) {
    blocks.push({
      title: "On the floor",
      headline: { label: "In house", value: String(floor.in_house) },
      rows: [
        { label: "Rooms clean", value: `${floor.rooms_clean} of ${floor.rooms_total}` },
        { label: "Clean / sellable", value: `${floor.clean_pct}%` },
        { label: "Open tickets", value: String(floor.open_tickets) },
        { label: "KOTs in the kitchen", value: String(floor.kots_pending) },
      ],
    });
  }
  if (money_) {
    const mix = money_.payment_mix.map((m) => ({ ...m, n: num(m.value) }));
    const tendered = mix.reduce((s, m) => s + m.n, 0);
    blocks.push({
      title: "Payments",
      headline: { label: "Settled", value: money(tendered) },
      rows: [
        ...mix.map((m) => ({ label: m.label, value: money(m.value) })),
        { label: "Discount given", value: money(money_.discount) },
        ...money_.top_items.slice(0, 5).map((it, i) => ({
          label: `Top seller ${i + 1} · ${it.label}`, value: `${it.qty} sold`,
        })),
      ],
    });
  }

  const forward = data.forward;
  return (
    <>
      <div className="flex items-center justify-end mb-3">
        <button onClick={() => exportCsv(data, blocks)} className="btn-ghost text-sm inline-flex items-center gap-1.5">
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Two columns, not three: each block now carries a "previous period"
          column beside its values, and three cards to a row left the labels
          with about 90px and truncating mid-word. Stretching aligns the bottom
          edges — items-start left cards of 10 and 3 rows ending at different
          heights and the row read as broken. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch mt-4">
        {blocks.map((b) => (
          <Card key={b.title}>
            <LedgerSection title={b.title} headline={b.headline} rows={b.rows} showPrev={b.showPrev} />
          </Card>
        ))}
      </div>

      {forward && (
        <Card className="!p-0 overflow-hidden mt-4">
          <div className="px-5 pt-5 pb-3 font-semibold">On the books · next 7 nights</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[32rem]">
              <thead>
                <tr className="text-xs text-muted border-y border-hairline bg-cream/60">
                  <th className="text-left font-medium px-5 py-2">Night</th>
                  <th className="text-right font-medium px-3 py-2">Occupancy</th>
                  <th className="text-right font-medium px-3 py-2">On the books</th>
                  <th className="text-right font-medium px-3 py-2">Arrivals</th>
                  <th className="text-right font-medium px-5 py-2">Departures</th>
                </tr>
              </thead>
              <tbody>
                {forward.days.map((d, i) => (
                  <tr key={d} className="border-b border-hairline last:border-0">
                    <td className="px-5 py-2">{d}</td>
                    <td className="text-right px-3 py-2 tabular-nums">{forward.occ_pct[i]}%</td>
                    <td className="text-right px-3 py-2 tabular-nums text-muted">
                      {forward.on_books[i]} / {forward.rooms_total}
                    </td>
                    <td className="text-right px-3 py-2 tabular-nums">{forward.arrivals[i]}</td>
                    <td className="text-right px-5 py-2 tabular-nums">{forward.departures[i]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {data.branches && data.branches.length > 1 && (
        <div className="mt-4">
          <BranchTable
            rows={data.branches}
            activeBranch={activeBranch}
            onPick={(id) => { setBranch(id); qc.invalidateQueries(); }}
          />
        </div>
      )}
    </>
  );
}
