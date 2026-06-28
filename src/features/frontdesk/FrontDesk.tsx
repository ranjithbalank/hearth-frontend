import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

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
  const qc = useQueryClient();
  const [done, setDone] = useState<string | null>(null);

  const { data: arrivals, isLoading } = useQuery({
    queryKey: ["arrivals"],
    queryFn: async () => (await api.get<Reservation[]>("/reservations/arrivals/")).data,
  });

  const checkin = useMutation({
    mutationFn: async (resv: Reservation) => {
      const opts = (await api.get(`/reservations/${resv.id}/room_options/`)).data;
      const room = opts[0];
      const folio = (await api.post("/checkin/", { reservation: resv.id, room: room?.id })).data;
      return { resv, room, folio };
    },
    onSuccess: ({ resv, room }) => {
      setDone(`${resv.guest_name} checked in to room ${room?.number}`);
      qc.invalidateQueries({ queryKey: ["arrivals"] });
      qc.invalidateQueries({ queryKey: ["folios"] });
    },
  });

  if (isLoading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Front Desk"
        subtitle="Expected arrivals"
        action={<Badge tone="pine">{arrivals?.length ?? 0} arriving</Badge>}
      />

      {done && (
        <div className="card p-4 mb-4 bg-pine-50 border-pine/20 text-pine font-medium">{done}</div>
      )}

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
                disabled={checkin.isPending}
                onClick={() => checkin.mutate(a)}
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
