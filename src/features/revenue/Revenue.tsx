import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { usePrompt } from "../../design/Prompt";
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
  const ask = usePrompt();
  const [msg, setMsg] = useState<string | null>(null);

  const { data: recs, isLoading } = useQuery({
    queryKey: ["recs"],
    queryFn: async () => (await api.get<Rec[]>("/revenue/")).data,
  });
  const { data: forecast } = useQuery({
    queryKey: ["forecast"],
    queryFn: async () => (await api.get<Forecast[]>("/revenue/forecast/")).data,
  });
  const { data: restrictions } = useQuery({
    queryKey: ["restrictions"],
    queryFn: async () => (await api.get("/revenue/restrictions/")).data as {
      room_type: string; name: string; min_los: number; cta: boolean; ctd: boolean; stop_sell: boolean;
    }[],
  });

  const setRestriction = useMutation({
    mutationFn: async (body: object) => (await api.post("/revenue/restrictions/", body)).data,
    onSuccess: () => { setMsg("Restriction pushed to channels"); qc.invalidateQueries({ queryKey: ["restrictions"] }); },
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

          <div className="text-sm font-semibold mt-4 mb-2">Rate restrictions</div>
          <Card>
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm text-muted">MLOS · CTA/CTD · stop-sell — pushed to channels</span>
              <button
                className="btn-outline text-xs py-1"
                onClick={async () => {
                  const code = await ask({ title: "Set restriction", label: "Room type code", defaultValue: "STD", placeholder: "STD / DLX / STE" });
                  if (!code) return;
                  const mlos = Number(await ask({ title: "Minimum length of stay", label: "Nights", defaultValue: "2" })) || 1;
                  setRestriction.mutate({ room_type: code.toUpperCase(), min_los: mlos });
                }}
              >
                Set MLOS
              </button>
            </div>
            {restrictions?.length ? restrictions.map((r) => (
              <div key={r.room_type} className="flex items-center justify-between py-2 border-t border-line text-sm">
                <span>{r.name}</span>
                <span className="flex items-center gap-2">
                  <span className="text-muted text-xs">MLOS {r.min_los}{r.cta ? " · CTA" : ""}{r.stop_sell ? " · STOP" : ""}</span>
                  <button
                    className={`pill text-xs ${r.stop_sell ? "bg-clay text-white" : "bg-hairline text-muted"}`}
                    onClick={() => setRestriction.mutate({ room_type: r.room_type, stop_sell: !r.stop_sell })}
                  >
                    {r.stop_sell ? "Stop-sell ON" : "Stop-sell"}
                  </button>
                </span>
              </div>
            )) : <div className="text-sm text-muted py-2">No restrictions set.</div>}
          </Card>
        </div>
      </div>
    </div>
  );
}
