import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useToast } from "../../design/Toast";
import { Badge, EmptyState, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { useApp } from "../../lib/app-context";

// Mirrors the backend's KITCHEN_ROLES: only the kitchen marks food ready.
const KITCHEN_ROLES = ["Chef / Kitchen", "Restaurant Manager", "General Manager",
  "Managing Director", "Super Admin"];

interface Ticket {
  id: number;
  type: "order" | "beo";
  kot_no: string;
  kitchen_status: string;
  table: string;
  items: { name: string; qty: number; station: string }[];
}

interface Performance {
  tickets: number;
  avg_prep_minutes: number;
  slowest: { kot_no: string; table: string; minutes: number }[];
}

export function Kds() {
  const qc = useQueryClient();
  const toast = useToast();
  const { user } = useApp();
  const canBump = KITCHEN_ROLES.includes(user?.role ?? "");
  const { data, isLoading } = useQuery({
    queryKey: ["kds"],
    queryFn: async () => (await api.get<Ticket[]>("/kds/")).data,
    refetchInterval: 5000, // live board
  });
  // Prep-time stats over the last 7 days (fire → ready).
  const { data: perf } = useQuery({
    queryKey: ["kds-perf"],
    queryFn: async () => (await api.get<Performance>("/kds/performance/")).data,
    refetchInterval: 60000,
  });

  const bump = useMutation({
    mutationFn: async (t: Ticket) =>
      (await api.post(`/kds/${t.id}/${t.type === "beo" ? "beo_bump" : "bump"}/`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kds"] }),
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not update the ticket", "error"),
  });

  if (isLoading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Kitchen Display"
        subtitle="Live tickets · auto-refresh"
        action={perf && perf.tickets > 0 ? (
          <div className="flex items-center gap-2 text-sm">
            <Badge tone={perf.avg_prep_minutes <= 15 ? "pine" : perf.avg_prep_minutes <= 25 ? "amber" : "clay"}>
              avg prep {perf.avg_prep_minutes} min
            </Badge>
            <span className="text-muted text-xs">{perf.tickets} tickets · 7 days</span>
          </div>
        ) : undefined}
      />
      {!data?.length ? (
        <EmptyState title="No active tickets" hint="Fired KOTs appear here." />
      ) : (
        <div className="grid grid-cols-4 gap-3">
          {data.map((t) => (
            <div
              key={`${t.type}-${t.id}`}
              className={`rounded-card border p-4 ${
                t.type === "beo"
                  ? "border-clay/50 bg-clay/5"
                  : t.kitchen_status === "ready" ? "border-pine bg-pine-50" : "border-amber/40 bg-amber-50"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-display text-lg">{t.kot_no}</span>
                <span className="flex items-center gap-1">
                  {t.type === "beo" && <Badge tone="clay">BEO</Badge>}
                  <Badge tone={t.kitchen_status === "ready" ? "pine" : "amber"}>{t.kitchen_status}</Badge>
                </span>
              </div>
              <div className="text-xs text-muted mb-2">{t.table}</div>
              <div className="space-y-1 mb-3">
                {t.items.map((it, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>{it.qty}× {it.name}</span>
                    <span className="text-muted text-xs">{it.station}</span>
                  </div>
                ))}
              </div>
              {canBump ? (
                <button className="btn-outline w-full text-xs py-1.5" onClick={() => bump.mutate(t)}>
                  {t.kitchen_status === "cooking" ? "Mark ready" : "Serve & clear"}
                </button>
              ) : (
                <div className="text-center text-[11px] text-muted py-1.5">
                  {t.kitchen_status === "cooking" ? "🍳 kitchen will mark ready" : "ready — dispatch from the POS"}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
