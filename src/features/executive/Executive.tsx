import { useQuery } from "@tanstack/react-query";

import { Card, PageHeader, Spinner, Stat } from "../../design/ui";
import { api } from "../../lib/api";
import { inr, num } from "../../lib/money";

interface ExecData {
  kpis: { revenue: string; occupancy_pct: number; room_revenue: string; fnb_revenue: string; receivables: string };
  revenue_mix: { label: string; value: string }[];
}

export function Executive() {
  const { data, isLoading } = useQuery({
    queryKey: ["executive"],
    queryFn: async () => (await api.get<ExecData>("/reports/executive/")).data,
  });

  if (isLoading || !data) return <Spinner />;
  const total = num(data.kpis.revenue) || 1;

  return (
    <div>
      <PageHeader title="Executive Overview" subtitle="Group performance at a glance" />
      <div className="grid grid-cols-4 gap-4">
        <Stat tone="dark" label="Total revenue" value={inr(data.kpis.revenue)} />
        <Stat label="Occupancy" value={`${data.kpis.occupancy_pct}%`} />
        <Stat label="Room revenue" value={inr(data.kpis.room_revenue)} />
        <Stat label="Receivables" value={inr(data.kpis.receivables)} sub="City ledger / AR" />
      </div>

      <Card className="mt-4">
        <div className="font-semibold mb-4">Revenue mix</div>
        <div className="space-y-3">
          {data.revenue_mix.map((r) => {
            const pct = Math.round((num(r.value) / total) * 100);
            return (
              <div key={r.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{r.label}</span>
                  <span className="text-muted">{inr(r.value)} · {pct}%</span>
                </div>
                <div className="h-2 rounded-pill bg-hairline overflow-hidden">
                  <div className="h-full bg-pine" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
