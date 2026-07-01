import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { usePrompt } from "../../design/Prompt";
import { useToast } from "../../design/Toast";
import { Badge, Card, PageHeader, Spinner } from "../../design/ui";
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
  const toast = useToast();
  const ask = usePrompt();
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

  const minibar = useMutation({
    mutationFn: async ({ room, item, amount }: { room: Room; item: string; amount: number }) =>
      (await api.post(`/housekeeping/${room.id}/minibar/`, { item, amount })).data,
    onError: () => toast("No open folio for this room", "error"),
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
            {r.status === "occupied" && (
              <button
                className="btn-ghost w-full mt-3 text-xs py-1.5"
                onClick={async () => {
                  const item = await ask({ title: "Post minibar", label: "Item consumed", placeholder: "e.g. Soft drink" });
                  if (!item) return;
                  const amount = Number(await ask({ title: "Minibar amount", label: "Amount (₹)", defaultValue: "150" }));
                  if (amount > 0) minibar.mutate({ room: r, item, amount });
                }}
              >
                Post minibar
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8">
        <LostFound />
      </div>
    </div>
  );
}

interface LostItem { id: number; description: string; location: string; status: string }

function LostFound() {
  const qc = useQueryClient();
  const ask = usePrompt();
  const { data } = useQuery({
    queryKey: ["lost-found"],
    queryFn: async () => (await api.get<LostItem[]>("/housekeeping/lost_found/")).data,
  });
  const add = useMutation({
    mutationFn: async (body: object) => (await api.post("/housekeeping/lost_found/", body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lost-found"] }),
  });
  const claim = useMutation({
    mutationFn: async (id: number) => (await api.post(`/housekeeping/${id}/lost_found_claim/`, { status: "claimed" })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lost-found"] }),
  });

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold">Lost &amp; Found</div>
        <button
          className="btn-outline text-xs py-1"
          onClick={async () => {
            const description = await ask({ title: "Log found item", label: "Description", placeholder: "e.g. Black umbrella" });
            if (!description) return;
            const location = (await ask({ title: "Location", label: "Where was it found?", placeholder: "e.g. Lobby" })) || "";
            add.mutate({ description, location });
          }}
        >
          + Log item
        </button>
      </div>
      {!data?.length ? (
        <div className="text-sm text-muted py-2">No items logged.</div>
      ) : (
        data.map((i) => (
          <div key={i.id} className="flex items-center gap-3 py-2 border-t border-line text-sm">
            <span className="flex-1">{i.description} <span className="text-muted">· {i.location || "—"}</span></span>
            <Badge tone={i.status === "stored" ? "amber" : "pine"}>{i.status}</Badge>
            {i.status === "stored" && <button className="btn-ghost text-xs py-1" onClick={() => claim.mutate(i.id)}>Mark claimed</button>}
          </div>
        ))
      )}
    </Card>
  );
}
