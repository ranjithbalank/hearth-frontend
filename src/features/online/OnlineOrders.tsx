import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Badge, Card, EmptyState, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { inr } from "../../lib/money";
import type { MenuItem, Order } from "../../lib/types";

const NEXT: Record<string, { status: string; label: string }> = {
  received: { status: "accepted", label: "Accept" },
  accepted: { status: "ready", label: "Mark ready" },
  ready: { status: "dispatched", label: "Dispatch" },
};
const PLATFORM_TONE: Record<string, "clay" | "amber" | "info"> = {
  zomato: "clay",
  swiggy: "amber",
  website: "info",
  qr: "info",
};

export function OnlineOrders() {
  const qc = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["online-orders"],
    queryFn: async () => (await api.get<Order[]>("/pos/orders/online/")).data,
    refetchInterval: 5000,
  });
  const { data: menu } = useQuery({
    queryKey: ["menu"],
    queryFn: async () => (await api.get<MenuItem[]>("/pos/menu-items/")).data,
  });

  const advance = useMutation({
    mutationFn: async ({ o, status }: { o: Order; status: string }) =>
      (await api.post(`/pos/orders/${o.id}/online_status/`, { status })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["online-orders"] }),
  });

  const simulate = useMutation({
    mutationFn: async (platform: string) =>
      (await api.post("/pos/orders/aggregator/", {
        platform,
        external_id: `${platform.toUpperCase()}-${Math.floor(Math.random() * 100000)}`,
        prepaid: true,
        customer: { mobile: "9" + Math.floor(Math.random() * 1e9), name: "Online Guest" },
        items: (menu ?? []).slice(0, 2).map((m) => ({ menu_item: m.id, qty: 1 })),
      })).data,
    onSuccess: () => { setMsg("Aggregator order received"); qc.invalidateQueries({ queryKey: ["online-orders"] }); },
  });

  if (isLoading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Online Orders"
        subtitle="Aggregators & direct online · auto-refresh"
        action={
          <div className="flex gap-2">
            <button className="btn-outline text-xs" onClick={() => simulate.mutate("zomato")}>+ Zomato</button>
            <button className="btn-outline text-xs" onClick={() => simulate.mutate("swiggy")}>+ Swiggy</button>
          </div>
        }
      />
      {msg && <div className="card p-3 mb-4 bg-pine-50 text-pine font-medium">{msg}</div>}

      {!data?.length ? (
        <EmptyState title="No live online orders" hint="Use +Zomato / +Swiggy to simulate an incoming order." />
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {data.map((o) => {
            const next = NEXT[o.online_status];
            return (
              <Card key={o.id}>
                <div className="flex items-center justify-between mb-2">
                  <span className="flex items-center gap-1">
                    <Badge tone={PLATFORM_TONE[o.source_platform] ?? "info"}>{o.source_platform}</Badge>
                    {o.brand && <Badge tone="muted">{o.brand}</Badge>}
                  </span>
                  <span className="text-xs text-muted">{o.kot_no}</span>
                </div>
                <div className="text-sm space-y-0.5 mb-2">
                  {o.lines.map((l) => (
                    <div key={l.id} className="flex justify-between">
                      <span>{l.qty}× {l.name}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center text-sm border-t border-line pt-2">
                  <span className="font-semibold">{inr(o.totals.total)}</span>
                  {o.prepaid && <Badge tone="pine">prepaid</Badge>}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Badge tone="muted">{o.online_status}</Badge>
                  {next && (
                    <button className="btn-primary text-xs py-1 ml-auto"
                      onClick={() => advance.mutate({ o, status: next.status })}>
                      {next.label}
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
