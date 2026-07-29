import { useQuery } from "@tanstack/react-query";
import { BedDouble, Building2, DoorOpen, Gauge, PartyPopper, User } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Card, PageHeader, Spinner, Stat } from "../../design/ui";
import { LineChart } from "../../design/LineChart";
import { Donut } from "../../design/Donut";
import { api } from "../../lib/api";
import { useApp } from "../../lib/app-context";
import { fmtDate, greeting } from "../../lib/date";
import { compactMoney, money, num } from "../../lib/money";

type View = "all" | "hotel" | "restaurant";

interface TrendData { days: string[]; rooms?: number[]; fnb?: number[]; banquets?: number[] }
interface Forward { arrivals_7d: number; in_house: number; banquets_upcoming?: number; banquets_value?: string }
interface Receivables { total: string; corporate: string; corporate_accounts: number }

interface ExecData {
  view: View;
  kpis: Record<string, string | number>;
  revenue_mix?: { label: string; value: string }[];
  rooms?: { occupancy_pct: number; adr: number; revpar: number; occupied: number; rooms_total: number; available: number; dirty: number; ooo: number };
  fnb?: { fnb_sales: string; order_count: number; by_mode: Record<string, string> };
  trend?: TrendData;
  forward?: Forward;
  receivables_detail?: Receivables;
}

const TABS: { key: View; label: string }[] = [
  { key: "all", label: "All together" },
  { key: "hotel", label: "Hotel only" },
  { key: "restaurant", label: "Restaurant only" },
];

/** Rooms / F&B / Banquets — same hues as the dashboard trend legend. */
const MIX_COLORS = ["#2563EB", "#DC2626", "#D97706"];

export function Executive() {
  const { user } = useApp();
  const [view, setView] = useState<View>("all");
  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["executive", view],
    queryFn: async () => (await api.get<ExecData>(`/reports/executive/?view=${view}`)).data,
  });
  const asOf = dataUpdatedAt
    ? ` · as of ${new Date(dataUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    : "";

  return (
    <div>
      <PageHeader
        icon={<Gauge size={20} />}
        title="Executive Overview"
        subtitle={`${greeting(user?.name?.split(" ")[0])} · ${fmtDate(new Date().toISOString())}${asOf}`}
      />

      <div data-tour="landing-executive" className="flex gap-2 mb-4">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setView(t.key)}
            className={`pill ${view === t.key ? "bg-ink text-white" : "bg-hairline text-body"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {isLoading || !data ? <Spinner /> : (
        <>
          {view === "all" && <AllView data={data} />}
          {view === "hotel" && <HotelView data={data} />}
          {view === "restaurant" && <RestaurantView data={data} />}
        </>
      )}
    </div>
  );
}

/** Combined revenue per day across all licensed streams — the series a chief
 *  reads as "the business", from which momentum is derived. */
function combinedDaily(t: TrendData): number[] {
  const n = t.days.length;
  const out: number[] = [];
  for (let i = 0; i < n; i++)
    out.push((t.rooms?.[i] ?? 0) + (t.fnb?.[i] ?? 0) + (t.banquets?.[i] ?? 0));
  return out;
}

/** Week-on-week growth: last 7 days vs the 7 before. null when there isn't a
 *  full two weeks, or the prior week was zero (a % off zero is meaningless). */
function wowGrowth(daily: number[]): number | null {
  if (daily.length < 14) return null;
  const n = daily.length;
  const last7 = daily.slice(n - 7).reduce((a, b) => a + b, 0);
  const prev7 = daily.slice(n - 14, n - 7).reduce((a, b) => a + b, 0);
  return prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 100) : null;
}

function GrowthPill({ pct }: { pct: number }) {
  const cls = pct > 0 ? "bg-success-50 text-success" : pct < 0 ? "bg-clay-50 text-clay" : "bg-hairline text-muted";
  const arrow = pct > 0 ? "▲" : pct < 0 ? "▼" : "–";
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-pill ${cls}`}>
      {arrow} {Math.abs(pct) > 999 ? ">999" : Math.abs(pct)}%
    </span>
  );
}

/** Icon · label · figure line for the briefing panels (on the books, AR). */
function BriefRow({ icon, label, sub, value, tone }: {
  icon: ReactNode; label: string; sub?: string; value: ReactNode; tone?: "default" | "warn";
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${
        tone === "warn" ? "bg-clay-50 text-clay" : "bg-pine-50 text-pine"}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-ink truncate">{label}</div>
        {sub && <div className="text-xs text-muted truncate">{sub}</div>}
      </div>
      <div className="text-right font-semibold tabular-nums text-ink">{value}</div>
    </div>
  );
}

function AllView({ data }: { data: ExecData }) {
  const total = num(data.kpis.revenue) || 1;
  const trend = data.trend;
  const daily = trend ? combinedDaily(trend) : [];
  const trendTotal = daily.reduce((a, b) => a + b, 0);
  const wow = wowGrowth(daily);

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat tone="dark" delayMs={0} label="Total revenue" value={money(data.kpis.revenue)} sub="Rooms + F&B, to date" />
        <Stat delayMs={60} label="Occupancy" value={`${data.kpis.occupancy_pct}%`}
          sub={data.rooms ? `${data.rooms.occupied}/${data.rooms.rooms_total} rooms` : undefined} />
        <Stat delayMs={120} label="Room revenue" value={money(data.kpis.room_revenue)} sub="Front office" />
        <Stat delayMs={180} label="F&B revenue" value={money(data.kpis.fnb_revenue ?? 0)} sub="Restaurant & bar" />
      </div>

      {/* Hero: are we growing? 30-day trajectory + week-on-week momentum. */}
      <Card accent className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <div className="font-semibold">Revenue trajectory</div>
          <span className="text-xs text-muted">last 30 days</span>
        </div>
        <div className="flex items-baseline flex-wrap gap-2 mb-3">
          <span className="font-display text-2xl text-ink tabular-nums">{compactMoney(trendTotal)}</span>
          {wow !== null && <GrowthPill pct={wow} />}
          <span className="text-xs text-muted">week-on-week</span>
        </div>
        {trend ? (
          <LineChart
            days={trend.days}
            series={[
              ...(trend.rooms ? [{ name: "Rooms", color: MIX_COLORS[0], values: trend.rooms }] : []),
              ...(trend.fnb ? [{ name: "F&B", color: MIX_COLORS[1], values: trend.fnb }] : []),
              ...(trend.banquets ? [{ name: "Banquets", color: MIX_COLORS[2], values: trend.banquets }] : []),
            ]}
          />
        ) : <Spinner />}
      </Card>

      {/* Composition · forward demand · cash owed — the rest of the C-suite read. */}
      <div className="grid md:grid-cols-3 gap-4 mt-4 items-start">
        <Card>
          <div className="font-semibold mb-3">Revenue mix</div>
          <Donut
            size={128}
            slices={(data.revenue_mix ?? []).map((r, i) => ({
              label: r.label, value: num(r.value),
              color: MIX_COLORS[i % MIX_COLORS.length], display: money(r.value),
            }))}
            centerValue={compactMoney(total)}
            centerLabel="revenue"
          />
        </Card>

        <ForwardCard forward={data.forward} />
        <ReceivablesCard rec={data.receivables_detail} fallback={data.kpis.receivables} />
      </div>
    </>
  );
}

function ForwardCard({ forward }: { forward?: Forward }) {
  if (!forward) return null;
  return (
    <Card>
      <div className="font-semibold">On the books</div>
      <div className="text-xs text-muted mb-4">Confirmed demand ahead</div>
      <div className="space-y-4">
        <BriefRow icon={<DoorOpen size={17} />} label="Arrivals" sub="Next 7 days" value={forward.arrivals_7d} />
        <BriefRow icon={<BedDouble size={17} />} label="In-house now" sub="Occupied rooms" value={forward.in_house} />
        {forward.banquets_upcoming !== undefined && (
          <BriefRow icon={<PartyPopper size={17} />} label="Banquets ahead"
            sub={forward.banquets_value ? `${money(forward.banquets_value)} contracted` : undefined}
            value={forward.banquets_upcoming} />
        )}
      </div>
    </Card>
  );
}

function ReceivablesCard({ rec, fallback }: { rec?: Receivables; fallback?: string | number }) {
  const total = rec?.total ?? fallback ?? 0;
  const other = rec ? num(total) - num(rec.corporate) : 0;
  return (
    <Card>
      <div className="font-semibold">Receivables</div>
      <div className="text-xs text-muted mb-3">Outstanding owed to us</div>
      <div className="font-display text-3xl text-ink tabular-nums mb-4">{money(total)}</div>
      {rec && (
        <div className="space-y-4">
          <BriefRow icon={<Building2 size={17} />} label="Corporate (BTC)"
            sub={`${rec.corporate_accounts} account${rec.corporate_accounts === 1 ? "" : "s"}`}
            value={money(rec.corporate)} />
          <BriefRow icon={<User size={17} />} label="Guest & other" sub="Direct settlements due"
            value={money(other)} />
        </div>
      )}
    </Card>
  );
}

function HotelView({ data }: { data: ExecData }) {
  const rooms = data.rooms;
  if (!rooms) return null;
  return (
    <>
      <div className="grid grid-cols-4 gap-4">
        <Stat tone="dark" delayMs={0} label="Occupancy" value={`${rooms.occupancy_pct}%`} sub={`${rooms.occupied}/${rooms.rooms_total} rooms`} />
        <Stat delayMs={60} label="ADR" value={money(rooms.adr)} sub="Average daily rate" />
        <Stat delayMs={120} label="RevPAR" value={money(rooms.revpar)} sub="Revenue per available room" />
        <Stat delayMs={180} label="Receivables" value={money(data.kpis.receivables)} sub="City ledger / AR" />
      </div>
      <div className="grid grid-cols-4 gap-4 mt-4">
        <Stat delayMs={0} label="Total rooms" value={rooms.rooms_total} />
        <Stat delayMs={60} label="Occupied" value={rooms.occupied} sub="In-house" />
        <Stat delayMs={120} label="Available to sell" value={rooms.available} sub="Clean & inspected" />
        <Stat delayMs={180} label="Dirty / OOO" value={`${rooms.dirty} / ${rooms.ooo}`} sub="Being cleaned / out of order" />
      </div>
    </>
  );
}

function RestaurantView({ data }: { data: ExecData }) {
  const fnb = data.fnb;
  if (!fnb) return null;
  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        <Stat tone="dark" delayMs={0} label="F&B sales" value={money(fnb.fnb_sales)} sub={`${fnb.order_count} orders`} />
        <Stat delayMs={60} label="Orders" value={fnb.order_count} />
        <Stat delayMs={120} label="Average order value" value={money(fnb.order_count ? num(fnb.fnb_sales) / fnb.order_count : 0)} />
      </div>
      <div className="grid grid-cols-3 gap-4 mt-4">
        {(["dinein", "takeaway", "delivery"] as const).map((m, i) => (
          <Stat key={m} delayMs={i * 60}
            label={{ dinein: "Dine-in", takeaway: "Takeaway", delivery: "Delivery" }[m]}
            value={money(fnb.by_mode[m] ?? 0)} />
        ))}
      </div>
    </>
  );
}
