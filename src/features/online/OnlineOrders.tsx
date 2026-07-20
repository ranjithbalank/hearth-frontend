import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Badge, Card, EmptyState, PageHeader, Spinner } from "../../design/ui";
import { usePrompt } from "../../design/Prompt";
import { api } from "../../lib/api";
import { money } from "../../lib/money";
import type { MenuItem, Order } from "../../lib/types";

// The counter only accepts and dispatches — "ready" is the kitchen's call
// (the chef bumps the ticket on the KDS, which advances the board here).
const NEXT: Record<string, { status: string; label: string } | undefined> = {
  received: { status: "accepted", label: "Accept + push to kitchen" },
  accepted: undefined,
  ready: { status: "dispatched", label: "Dispatch" },
};
const PLATFORM_TONE: Record<string, "clay" | "amber" | "info"> = {
  zomato: "clay",
  swiggy: "amber",
  website: "info",
  qr: "info",
};

// Aggregators penalize slow acceptance — a much tighter SLA than a dine-in
// table, so the thresholds here are minutes, not the floor view's half-hour.
const AMBER_MIN = 3;
const RED_MIN = 5;
function elapsedMins(o: Order): number {
  return Math.max(0, (Date.now() - new Date(o.created_at).getTime()) / 60000);
}
function urgencyOf(mins: number): "on-track" | "approaching" | "delayed" {
  return mins >= RED_MIN ? "delayed" : mins >= AMBER_MIN ? "approaching" : "on-track";
}
const URGENCY_BORDER: Record<string, string> = {
  "on-track": "border-l-pine", approaching: "border-l-amber", delayed: "border-l-clay",
};
const URGENCY_BADGE: Record<string, string> = {
  "on-track": "bg-pine text-white", approaching: "bg-amber text-white", delayed: "bg-clay text-white",
};

export function OnlineOrders() {
  const qc = useQueryClient();
  const ask = usePrompt();
  const [msg, setMsg] = useState<string | null>(null);
  // Keep the elapsed badges ticking between polls.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);

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
    onError: (e: any) => setMsg(e?.response?.data?.detail ?? "Could not update the order"),
  });

  const reject = useMutation({
    mutationFn: async ({ o, reason }: { o: Order; reason: string }) =>
      (await api.post(`/pos/orders/${o.id}/reject/`, { reason })).data,
    onSuccess: () => { setMsg("Order rejected"); qc.invalidateQueries({ queryKey: ["online-orders"] }); },
    onError: (e: any) => setMsg(e?.response?.data?.detail ?? "Could not reject the order"),
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
            const mins = elapsedMins(o);
            const urgency = urgencyOf(mins);
            return (
              <Card key={o.id} className={`border-l-4 ${URGENCY_BORDER[urgency]}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="flex items-center gap-1">
                    <Badge tone={PLATFORM_TONE[o.source_platform] ?? "info"}>{o.source_platform}</Badge>
                    {o.brand && <Badge tone="muted">{o.brand}</Badge>}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="text-xs text-muted">{o.kot_no}{o.token_no ? ` · Token ${o.token_no}` : ""}</span>
                    <span className={`rounded-pill px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${URGENCY_BADGE[urgency]}`}>
                      {Math.floor(mins)}m
                    </span>
                  </span>
                </div>
                {o.customer_name && (
                  <div className="text-xs text-muted mb-2 truncate">
                    👤 {o.customer_name}{o.customer_mobile ? ` · ${o.customer_mobile}` : ""}
                  </div>
                )}
                <div className="text-sm space-y-0.5 mb-2">
                  {o.lines.map((l) => (
                    <div key={l.id} className="flex justify-between">
                      <span>{l.qty}× {l.name}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center text-sm border-t border-line pt-2">
                  <span className="font-semibold">{money(o.totals.total)}</span>
                  {o.prepaid && <Badge tone="pine">prepaid</Badge>}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Badge tone={o.online_status === "ready" ? "pine" : "muted"}>{o.online_status}</Badge>
                  {o.online_status === "accepted" && (
                    <span className="text-xs text-muted ml-auto" title="The chef marks it ready on the Kitchen Display">
                      🍳 kitchen cooking…
                    </span>
                  )}
                  {o.online_status === "received" && (
                    <button className="btn-ghost text-xs text-clay py-1 ml-auto" disabled={reject.isPending}
                      onClick={async () => {
                        const reason = await ask({ title: "Reject order", label: "Reason", placeholder: "e.g. item out of stock" });
                        if (reason) reject.mutate({ o, reason });
                      }}>
                      Reject
                    </button>
                  )}
                  {next && (
                    <button className={`btn-primary text-xs py-1 ${o.online_status === "received" ? "" : "ml-auto"}`}
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
