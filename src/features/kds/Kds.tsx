import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

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
  created_at: string; // KOT fire time (for BEO tickets it's the event date — no timer)
  items: { line?: number; name: string; qty: number; station: string; ready?: boolean }[];
}

/** Minutes since the KOT fired; null for BEO tickets and bad dates. */
function elapsedMins(t: Ticket): number | null {
  if (t.type !== "order") return null;
  const fired = new Date(t.created_at).getTime();
  if (isNaN(fired)) return null;
  return Math.max(0, (Date.now() - fired) / 60000);
}

function fmtElapsed(mins: number): string {
  if (mins >= 60) return `${Math.floor(mins / 60)}h ${Math.floor(mins % 60)}m`;
  return `${Math.floor(mins)}:${String(Math.floor((mins % 1) * 60)).padStart(2, "0")}`;
}

interface Performance {
  tickets: number;
  avg_prep_minutes: number;
  slowest: { kot_no: string; table: string; minutes: number }[];
}

export function Kds() {
  const qc = useQueryClient();
  const toast = useToast();
  const { user, property } = useApp();
  const canBump = KITCHEN_ROLES.includes(user?.role ?? "");
  const partialReady = !!property?.entitlement.kds_partial_ready;
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

  // Keep the elapsed timers moving even if the 5s poll stalls (offline etc.).
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const bump = useMutation({
    mutationFn: async (t: Ticket) =>
      (await api.post(`/kds/${t.id}/${t.type === "beo" ? "beo_bump" : "bump"}/`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kds"] }),
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not update the ticket", "error"),
  });

  // Per-item ready — only wired up when Settings > Kitchen Display has
  // partial-ready turned on; the ticket auto-advances once every line is checked.
  const bumpItem = useMutation({
    mutationFn: async ({ ticket, line }: { ticket: Ticket; line: number }) =>
      (await api.post(`/kds/${ticket.id}/bump_item/`, { line })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kds"] }),
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not update the item", "error"),
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
          {data.map((t) => {
            const mins = elapsedMins(t);
            const urgency =
              mins !== null && t.kitchen_status === "cooking"
                ? mins > 20 ? "late" : mins > 10 ? "warn" : "ok"
                : "ok";
            return (
            <div
              key={`${t.type}-${t.id}`}
              className={`rounded-card border p-4 ${
                t.type === "beo"
                  ? "border-clay/50 bg-clay/5"
                  : t.kitchen_status === "ready" ? "border-pine bg-pine-50" : "border-amber/40 bg-amber-50"
              } ${urgency === "late" ? "border-l-4 border-l-clay" : urgency === "warn" ? "border-l-4 border-l-amber" : ""}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-display text-lg">{t.kot_no}</span>
                <span className="flex items-center gap-1.5">
                  {urgency === "late" && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-clay opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-clay" />
                    </span>
                  )}
                  {mins !== null && t.kitchen_status === "cooking" && (
                    <span className={`text-xs tabular-nums font-semibold ${
                      urgency === "late" ? "text-clay" : urgency === "warn" ? "text-amber-600" : "text-muted"
                    }`}>
                      {fmtElapsed(mins)}
                    </span>
                  )}
                  {t.type === "beo" && <Badge tone="clay">BEO</Badge>}
                  <Badge tone={t.kitchen_status === "ready" ? "pine" : "amber"}>{t.kitchen_status}</Badge>
                </span>
              </div>
              <div className="text-xs text-muted mb-2">{t.table}</div>
              {/* Per-item ready checkboxes only while this ticket is still
                  cooking and partial-ready is turned on — once it's fully
                  ready/served there's nothing left to check off. */}
              {partialReady && canBump && t.type === "order" && t.kitchen_status === "cooking" ? (
                <div className="space-y-1 mb-3">
                  {t.items.map((it) => (
                    <button
                      key={it.line}
                      disabled={bumpItem.isPending}
                      onClick={() => bumpItem.mutate({ ticket: t, line: it.line! })}
                      className={`w-full flex items-center justify-between text-sm rounded-lg px-2 py-1 border transition-colors ${
                        it.ready ? "bg-pine-50 border-pine/30 text-pine" : "border-hairline hover:bg-cream"}`}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className={`h-4 w-4 shrink-0 rounded border flex items-center justify-center text-[10px] font-bold ${
                          it.ready ? "bg-pine border-pine text-white" : "border-hairline"}`}>
                          {it.ready ? "✓" : ""}
                        </span>
                        {it.qty}× {it.name}
                      </span>
                      <span className="text-muted text-xs">{it.station}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-1 mb-3">
                  {t.items.map((it, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span>{it.qty}× {it.name}</span>
                      <span className="text-muted text-xs">{it.station}</span>
                    </div>
                  ))}
                </div>
              )}
              {canBump ? (
                <button className="btn-outline w-full text-xs py-1.5" onClick={() => bump.mutate(t)}>
                  {t.kitchen_status === "cooking"
                    ? (partialReady ? "Mark all ready" : "Mark ready")
                    : "Serve & clear"}
                </button>
              ) : (
                <div className="text-center text-[11px] text-muted py-1.5">
                  {t.kitchen_status === "cooking" ? "🍳 kitchen will mark ready" : "ready — dispatch from the POS"}
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
