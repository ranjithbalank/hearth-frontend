import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { Badge, Card, EmptyState, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { inr } from "../../lib/money";
import type { Reservation } from "../../lib/types";

const SOURCE_TONE: Record<string, "pine" | "clay" | "amber" | "info"> = {
  direct: "pine",
  ota: "info",
  booking: "amber",
  walkin: "clay",
};

export function FrontDesk() {
  const nav = useNavigate();

  const { data: arrivals, isLoading } = useQuery({
    queryKey: ["arrivals"],
    queryFn: async () => (await api.get<Reservation[]>("/reservations/arrivals/")).data,
  });

  if (isLoading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Front Desk"
        subtitle="Expected arrivals"
        action={<Badge tone="pine">{arrivals?.length ?? 0} arriving</Badge>}
      />

      {!arrivals?.length ? (
        <EmptyState title="No pending arrivals" hint="All expected guests are checked in." />
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
              <button
                className="btn-primary"
                onClick={() => nav(`/checkin?reservation=${a.id}`)}
              >
                Check in
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
