import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import type { Room } from "../../lib/types";

const STATUS_STYLE: Record<string, string> = {
  vacant_clean: "bg-pine-50 text-pine border-pine/30",
  inspected: "bg-pine text-white border-pine",
  occupied: "bg-clay/90 text-white border-clay",
  vacant_dirty: "bg-amber-50 text-amber-600 border-amber/30",
  cleaning: "bg-info-50 text-info border-info/30",
  ooo: "bg-hairline text-muted border-hairline",
};

// Click cycles a room's status for quick demo control.
const NEXT: Record<string, string> = {
  vacant_clean: "occupied",
  occupied: "vacant_dirty",
  vacant_dirty: "cleaning",
  cleaning: "inspected",
  inspected: "vacant_clean",
  ooo: "vacant_dirty",
};

export function LiveGrid() {
  const qc = useQueryClient();
  const { data: rooms, isLoading } = useQuery({
    queryKey: ["rooms"],
    queryFn: async () => (await api.get<Room[]>("/rooms/")).data,
  });

  const patch = useMutation({
    mutationFn: async (room: Room) =>
      (await api.patch(`/rooms/${room.id}/status/`, { status: NEXT[room.status] })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rooms"] }),
  });

  if (isLoading || !rooms) return <Spinner />;

  const byFloor: Record<number, Room[]> = {};
  rooms.forEach((r) => (byFloor[r.floor] ??= []).push(r));

  return (
    <div>
      <PageHeader title="Live Grid" subtitle="Click a room to advance its status" />
      <div className="flex flex-wrap gap-3 mb-5 text-xs text-muted">
        {Object.entries(STATUS_STYLE).map(([k, cls]) => (
          <span key={k} className={`pill border ${cls}`}>{k.replace("_", " ")}</span>
        ))}
      </div>
      <div className="space-y-5">
        {Object.entries(byFloor).map(([floor, list]) => (
          <div key={floor}>
            <div className="text-xs uppercase tracking-wide text-muted mb-2">Floor {floor}</div>
            <div className="grid grid-cols-8 gap-2">
              {list.map((r) => (
                <button
                  key={r.id}
                  onClick={() => patch.mutate(r)}
                  className={`rounded-card border p-3 text-left transition-transform hover:scale-[1.03] ${
                    STATUS_STYLE[r.status] ?? "bg-surface"
                  }`}
                >
                  <div className="font-display text-lg leading-none">{r.number}</div>
                  <div className="text-[10px] mt-1 opacity-80">{r.room_type_code}</div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
