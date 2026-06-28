import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Badge, Card, EmptyState, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { inr, num } from "../../lib/money";

interface Rec {
  id: number; room_type: string; name: string; current_rate: string;
  recommended_rate: string; reason: string; demand_index: number;
}
interface Forecast { date: string; demand_index: number; weekend: boolean }

export function Revenue() {
  const qc = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);

  const { data: recs, isLoading } = useQuery({
    queryKey: ["recs"],
    queryFn: async () => (await api.get<Rec[]>("/revenue/")).data,
  });
  const { data: forecast } = useQuery({
    queryKey: ["forecast"],
    queryFn: async () => (await api.get<Forecast[]>("/revenue/forecast/")).data,
  });

  const accept = useMutation({
    mutationFn: async (r: Rec) => (await api.post(`/revenue/${r.id}/accept/`)).data,
    onSuccess: (d, r) => {
      setMsg(`Accepted ${r.room_type} → ${inr(r.recommended_rate)} · pushed to ${d.channels_pushed} channels`);
      qc.invalidateQueries({ queryKey: ["recs"] });
    },
  });
  const dismiss = useMutation({
    mutationFn: async (r: Rec) => (await api.post(`/revenue/${r.id}/dismiss/`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recs"] }),
  });

  if (isLoading) return <Spinner />;

  return (
    <div>
      <PageHeader title="Revenue Manager" subtitle="Rate recommendations &amp; demand forecast" />
      {msg && <div className="card p-3 mb-4 bg-pine-50 text-pine font-medium">{msg}</div>}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-sm font-semibold mb-2">Pricing recommendations</div>
          {!recs?.length ? (
            <EmptyState title="No open recommendations" hint="All caught up." />
          ) : (
            <div className="space-y-3">
              {recs.map((r) => {
                const up = num(r.recommended_rate) >= num(r.current_rate);
                return (
                  <Card key={r.id}>
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{r.name}</div>
                      <Badge tone={r.demand_index >= 60 ? "clay" : "info"}>
                        Demand {r.demand_index}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted mt-1">{r.reason}</div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-muted line-through">{inr(r.current_rate)}</span>
                      <span className={`font-display text-xl ${up ? "text-pine" : "text-clay"}`}>
                        {inr(r.recommended_rate)}
                      </span>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button className="btn-primary flex-1" onClick={() => accept.mutate(r)}>
                        Accept &amp; push
                      </button>
                      <button className="btn-ghost" onClick={() => dismiss.mutate(r)}>Dismiss</button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <div className="text-sm font-semibold mb-2">14-day demand forecast</div>
          <Card>
            <div className="flex items-end gap-1.5 h-48">
              {forecast?.map((f) => (
                <div key={f.date} className="flex-1 flex flex-col items-center justify-end h-full" title={`${f.date}: ${f.demand_index}`}>
                  <div
                    className={`w-full rounded-t ${f.weekend ? "bg-clay" : "bg-pine"}`}
                    style={{ height: `${f.demand_index}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-3 text-xs text-muted">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-pine inline-block" /> Weekday</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-clay inline-block" /> Weekend</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
