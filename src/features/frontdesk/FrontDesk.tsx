import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Badge, Card, EmptyState, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { inr } from "../../lib/money";
import type { Reservation } from "../../lib/types";
import { WalkInForm } from "./WalkInForm";

const SOURCE_TONE: Record<string, "pine" | "clay" | "amber" | "info"> = {
  direct: "pine",
  ota: "info",
  booking: "amber",
  walkin: "clay",
};

export function FrontDesk() {
  const nav = useNavigate();
  const [walkin, setWalkin] = useState(false);

  const { data: arrivals, isLoading } = useQuery({
    queryKey: ["arrivals"],
    queryFn: async () => (await api.get<Reservation[]>("/reservations/arrivals/")).data,
  });

  if (isLoading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Front Desk"
        subtitle="Arrivals & walk-in check-in"
        action={<Badge tone="pine">{arrivals?.length ?? 0} arriving</Badge>}
      />

      {walkin && <WalkInForm onCancel={() => setWalkin(false)} onCreated={(id) => nav(`/checkin?reservation=${id}`)} />}

      {/* Dedicated walk-in area — guests arriving without a booking */}
      <div className="rounded-card border-2 border-dashed border-pine/30 bg-pine-50/40 p-5 mb-6 flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-pine flex items-center justify-center text-white text-xl">＋</div>
        <div className="flex-1">
          <div className="font-semibold text-ink">Walk-in guest</div>
          <div className="text-sm text-muted">No booking? Register the guest and check them in straight away.</div>
        </div>
        <button className="btn-primary" onClick={() => setWalkin(true)}>Start walk-in check-in</button>
      </div>

      <div className="text-xs uppercase tracking-wide text-muted mb-2">Expected arrivals</div>
      {!arrivals?.length ? (
        <EmptyState title="No pending arrivals" hint="Use the walk-in area above for guests without a booking." />
      ) : (
        <div className="space-y-3">
          {arrivals.map((a) => (
            <Card key={a.id} className="flex items-center gap-4">
              <div className="flex-1">
                <div className="font-semibold text-ink">{a.guest_name}</div>
                <div className="text-sm text-muted">
                  {a.room_type_code} · {a.nights} night{a.nights > 1 ? "s" : ""} ·{" "}
                  {inr(a.rate)}/night
                </div>
              </div>
              <Badge tone={SOURCE_TONE[a.source] ?? "muted"}>{a.source_label}</Badge>
              {a.prepaid && <Badge tone="amber">Prepaid {inr(a.deposit)}</Badge>}
              {a.precheckin_done && (
                <Badge tone="pine">✓ Pre-checked-in{a.precheckin?.eta ? ` · ETA ${a.precheckin.eta}` : ""}</Badge>
              )}
              <button className="btn-primary" onClick={() => nav(`/checkin?reservation=${a.id}`)}>
                Check in
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
