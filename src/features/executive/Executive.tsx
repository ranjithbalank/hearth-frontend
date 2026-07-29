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
  channels?: { label: string; value: number }[];
  top_receivables?: { name: string; amount: string; type: string }[];
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
        eyebrow="Group performance"
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

/** Revenue-over-time hero: a 30-day line of whatever streams the trend carries
 *  (rooms / F&B / banquets), with a compact total and week-on-week momentum.
 *  Shared by the group view and the hotel/restaurant drill-downs. */
function TrajectoryCard({ trend }: { trend?: TrendData }) {
  const daily = trend ? combinedDaily(trend) : [];
  const trendTotal = daily.reduce((a, b) => a + b, 0);
  const wow = wowGrowth(daily);
  return (
    <Card accent>
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
      <div className="mt-4"><TrajectoryCard trend={data.trend} /></div>

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

      {/* Acquisition mix + credit concentration — where business comes from and
          who owes us, the analytical layer the operational dashboard never carries. */}
      <div className="grid md:grid-cols-2 gap-4 mt-4 items-start">
        <ChannelsCard channels={data.channels} />
        <TopReceivablesCard rows={data.top_receivables} />
      </div>
    </>
  );
}

const CHANNEL_COLORS = ["#2563EB", "#0891B2", "#D97706", "#7C3AED", "#DC2626"];

function ChannelsCard({ channels }: { channels?: { label: string; value: number }[] }) {
  if (!channels?.length) return null;
  const total = channels.reduce((a, c) => a + c.value, 0) || 1;
  return (
    <Card>
      <div className="font-semibold">Booking channels</div>
      <div className="text-xs text-muted mb-4">Share of confirmed bookings by source</div>
      <div className="space-y-3">
        {channels.map((c, i) => {
          const pct = Math.round((c.value / total) * 100);
          return (
            <div key={c.label}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-body">{c.label}</span>
                <span className="text-muted tabular-nums">{c.value} · {pct}%</span>
              </div>
              <div className="h-2 rounded-pill bg-hairline overflow-hidden">
                <div className="h-full rounded-pill" style={{ width: `${pct}%`, background: CHANNEL_COLORS[i % CHANNEL_COLORS.length] }} />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function TopReceivablesCard({ rows }: { rows?: { name: string; amount: string; type: string }[] }) {
  if (!rows?.length) return null;
  const max = Math.max(...rows.map((r) => num(r.amount)), 1);
  return (
    <Card>
      <div className="font-semibold">Top accounts receivable</div>
      <div className="text-xs text-muted mb-4">Largest balances owed to us</div>
      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={`${r.name}-${i}`} className="flex items-center gap-3">
            <span className="w-4 text-xs text-muted tabular-nums text-right shrink-0">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-ink truncate">{r.name}</span>
                <span className="text-sm font-semibold tabular-nums text-ink shrink-0">{money(r.amount)}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 rounded-pill bg-hairline overflow-hidden">
                  <div className="h-full rounded-pill bg-gradient-primary" style={{ width: `${Math.round((num(r.amount) / max) * 100)}%` }} />
                </div>
                <span className="text-[10px] uppercase tracking-wide text-muted shrink-0">{r.type}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat tone="dark" delayMs={0} label="Occupancy" value={`${rooms.occupancy_pct}%`} sub={`${rooms.occupied}/${rooms.rooms_total} rooms`} />
        <Stat delayMs={60} label="ADR" value={money(rooms.adr)} sub="Average daily rate" />
        <Stat delayMs={120} label="RevPAR" value={money(rooms.revpar)} sub="Revenue per available room" />
        <Stat delayMs={180} label="Available to sell" value={rooms.available} sub={`${rooms.dirty} dirty · ${rooms.ooo} OOO`} />
      </div>

      <div className="mt-4"><TrajectoryCard trend={data.trend} /></div>

      <div className="grid md:grid-cols-2 gap-4 mt-4 items-start">
        <ChannelsCard channels={data.channels} />
        <ForwardCard forward={data.forward} />
      </div>

      <div className="grid md:grid-cols-2 gap-4 mt-4 items-start">
        <ReceivablesCard rec={data.receivables_detail} fallback={data.kpis.receivables} />
        <TopReceivablesCard rows={data.top_receivables} />
      </div>
    </>
  );
}

const MODE_COLORS = ["#2563EB", "#D97706", "#0891B2", "#7C3AED", "#DC2626"];
const MODE_LABELS: Record<string, string> = {
  dinein: "Dine-in", takeaway: "Takeaway", delivery: "Delivery", room: "Room service",
};

function RestaurantView({ data }: { data: ExecData }) {
  const fnb = data.fnb;
  if (!fnb) return null;
  const aov = fnb.order_count ? num(fnb.fnb_sales) / fnb.order_count : 0;
  // Derive slices from every mode present (incl. room-service) and sort by size,
  // so the donut's parts reconcile with the F&B total in its centre.
  const modeSlices = Object.entries(fnb.by_mode)
    .map(([k, v]) => ({ label: MODE_LABELS[k] ?? k, value: num(v) }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value);
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat tone="dark" delayMs={0} label="F&B sales" value={money(fnb.fnb_sales)} sub={`${fnb.order_count} orders`} />
        <Stat delayMs={60} label="Orders" value={fnb.order_count} sub="Settled tickets" />
        <Stat delayMs={120} label="Average order value" value={money(aov)} sub="Per ticket" />
      </div>

      <div className="mt-4"><TrajectoryCard trend={data.trend} /></div>

      <Card className="mt-4">
        <div className="font-semibold">Sales by service mode</div>
        <div className="text-xs text-muted mb-4">Share of F&B revenue · {money(fnb.fnb_sales)} total</div>
        <div className="grid sm:grid-cols-2 gap-x-10 gap-y-4">
          {modeSlices.map((s, i) => {
            const pct = Math.round((s.value / (num(fnb.fnb_sales) || 1)) * 100);
            return (
              <div key={s.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-body">{s.label}</span>
                  <span className="text-muted tabular-nums">{money(s.value)} · {pct}%</span>
                </div>
                <div className="h-2 rounded-pill bg-hairline overflow-hidden">
                  <div className="h-full rounded-pill" style={{ width: `${pct}%`, background: MODE_COLORS[i % MODE_COLORS.length] }} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}
