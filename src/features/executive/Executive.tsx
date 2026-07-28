import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Gauge } from "lucide-react";
import { useState } from "react";

import { Card, PageHeader, Spinner, Stat } from "../../design/ui";
import { api } from "../../lib/api";
import { useApp } from "../../lib/app-context";
import { fmtDate, greeting } from "../../lib/date";
import { money, num } from "../../lib/money";

type View = "all" | "hotel" | "restaurant";

interface ExecData {
  view: View;
  kpis: Record<string, string | number>;
  revenue_mix?: { label: string; value: string }[];
  rooms?: { occupancy_pct: number; adr: number; revpar: number; occupied: number; rooms_total: number; available: number; dirty: number; ooo: number };
  fnb?: { fnb_sales: string; order_count: number; by_mode: Record<string, string> };
}

const TABS: { key: View; label: string }[] = [
  { key: "all", label: "All together" },
  { key: "hotel", label: "Hotel only" },
  { key: "restaurant", label: "Restaurant only" },
];

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

function AllView({ data }: { data: ExecData }) {
  const total = num(data.kpis.revenue) || 1;
  return (
    <>
      <div className="grid grid-cols-4 gap-4">
        <Stat tone="dark" delayMs={0} label="Total revenue" value={money(data.kpis.revenue)} />
        <Stat delayMs={60} label="Occupancy" value={`${data.kpis.occupancy_pct}%`} />
        <Stat delayMs={120} label="Room revenue" value={money(data.kpis.room_revenue)} />
        <Stat delayMs={180} label="Receivables" value={money(data.kpis.receivables)} sub="City ledger / AR" />
      </div>

      <Card accent className="mt-4">
        <div className="font-semibold mb-4">Revenue mix</div>
        <div className="space-y-3">
          {data.revenue_mix?.map((r) => {
            const pct = Math.round((num(r.value) / total) * 100);
            return (
              <div key={r.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{r.label}</span>
                  <span className="text-muted tabular-nums">{money(r.value)} · {pct}%</span>
                </div>
                <div className="h-2 rounded-pill bg-hairline overflow-hidden">
                  <motion.div
                    className="h-full rounded-pill bg-gradient-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </>
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
