import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import type { Room } from "../../lib/types";

const STATUS_TONE: Record<string, "pine" | "clay" | "amber" | "info" | "muted"> = {
  vacant_clean: "pine",
  inspected: "pine",
  occupied: "clay",
  vacant_dirty: "amber",
  cleaning: "info",
  ooo: "muted",
};

const CAN_ADVANCE = new Set(["vacant_dirty", "cleaning", "vacant_clean"]);

export function Housekeeping() {
  const qc = useQueryClient();
  const { data: rooms, isLoading } = useQuery({
    queryKey: ["hk-rooms"],
    queryFn: async () => (await api.get<Room[]>("/housekeeping/")).data,
  });

  const advance = useMutation({
    mutationFn: async (room: Room) => (await api.patch(`/housekeeping/${room.id}/advance/`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hk-rooms"] });
      qc.invalidateQueries({ queryKey: ["rooms"] });
    },
  });

  if (isLoading || !rooms) return <Spinner />;

  const counts: Record<string, number> = {};
  rooms.forEach((r) => (counts[r.status] = (counts[r.status] ?? 0) + 1));

  return (
    <div>
      <PageHeader title="Housekeeping" subtitle="Dirty → Cleaning → Clean → Inspected" />
      <div className="flex gap-3 mb-5">
        {Object.entries(counts).map(([s, n]) => (
          <Badge key={s} tone={STATUS_TONE[s] ?? "muted"}>{s.replace("_", " ")}: {n}</Badge>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-3">
        {rooms.map((r) => (
          <div key={r.id} className="card p-4">
            <div className="flex items-center justify-between">
              <div className="font-display text-lg">{r.number}</div>
              <Badge tone={STATUS_TONE[r.status] ?? "muted"}>{r.status_label}</Badge>
            </div>
            <div className="text-xs text-muted mt-1">{r.room_type_name}</div>
            {CAN_ADVANCE.has(r.status) && (
              <button className="btn-outline w-full mt-3 text-xs py-1.5" onClick={() => advance.mutate(r)}>
                Advance
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
