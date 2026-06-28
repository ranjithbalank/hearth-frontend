import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Badge, Card, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { inr } from "../../lib/money";

interface Space { id: number; name: string; capacity: number }
interface Event {
  id: number; title: string; host: string; space: string; event_date: string;
  covers: number; package_amount: string; status: string; billed: boolean;
}

const TONE: Record<string, "amber" | "info" | "pine"> = {
  tentative: "amber",
  confirmed: "info",
  completed: "pine",
};

export function Banquets() {
  const qc = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["banquets"],
    queryFn: async () => (await api.get<{ spaces: Space[]; events: Event[] }>("/banquets/")).data,
  });

  const confirm = useMutation({
    mutationFn: async (e: Event) => (await api.post(`/banquets/${e.id}/confirm/`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["banquets"] }),
  });
  const bill = useMutation({
    mutationFn: async (e: Event) => (await api.post(`/banquets/${e.id}/bill/`)).data,
    onSuccess: (d) => {
      setMsg(`Event billed · total ${inr(d.tax.total)} (incl. 18% GST ${inr(d.tax.tax)})`);
      qc.invalidateQueries({ queryKey: ["banquets"] });
    },
  });

  if (isLoading || !data) return <Spinner />;

  return (
    <div>
      <PageHeader title="Banquets & Events" subtitle="Function space &amp; BEOs" />
      {msg && <div className="card p-3 mb-4 bg-pine-50 text-pine font-medium">{msg}</div>}

      <div className="flex flex-wrap gap-2 mb-5">
        {data.spaces.map((s) => (
          <Badge key={s.id} tone="info">{s.name} · {s.capacity} pax</Badge>
        ))}
      </div>

      <div className="space-y-3">
        {data.events.map((e) => (
          <Card key={e.id} className="flex items-center gap-4">
            <div className="flex-1">
              <div className="font-semibold">{e.title}</div>
              <div className="text-sm text-muted">
                {e.space} · {e.event_date} · {e.covers} covers · {e.host}
              </div>
            </div>
            <div className="font-medium">{inr(e.package_amount)}</div>
            <Badge tone={TONE[e.status] ?? "muted"}>{e.status}</Badge>
            {e.status === "tentative" && (
              <button className="btn-outline" onClick={() => confirm.mutate(e)}>Confirm</button>
            )}
            {e.status === "confirmed" && !e.billed && (
              <button className="btn-primary" onClick={() => bill.mutate(e)}>Bill event</button>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
