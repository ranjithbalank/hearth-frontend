import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useToast } from "../../design/Toast";
import { Badge, EmptyState, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import type { Room } from "../../lib/types";

interface WorkOrder {
  id: number;
  room_number: string | null;
  title: string;
  detail: string;
  status: string;
  status_label: string;
  raised_by: string;
}

const TONE: Record<string, "info" | "amber" | "pine"> = {
  open: "info",
  in_progress: "amber",
  done: "pine",
};

export function Engineering() {
  const qc = useQueryClient();
  const [raising, setRaising] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["work-orders"],
    queryFn: async () => (await api.get<WorkOrder[]>("/work-orders/")).data,
  });

  const advance = useMutation({
    mutationFn: async (wo: WorkOrder) => (await api.patch(`/work-orders/${wo.id}/advance/`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-orders"] });
      qc.invalidateQueries({ queryKey: ["rooms"] });
    },
  });

  if (isLoading) return <Spinner />;

  // Working queue first; finished jobs sink to the bottom.
  const sorted = [...(data ?? [])].sort((a, b) =>
    (a.status === "done" ? 1 : 0) - (b.status === "done" ? 1 : 0));

  return (
    <div>
      <PageHeader
        title="Engineering"
        subtitle="Maintenance work orders"
        action={
          <button className="btn-primary text-sm" onClick={() => setRaising(true)}>
            + New work order
          </button>
        }
      />
      {raising && <NewWorkOrderModal onClose={() => setRaising(false)} />}
      {!sorted.length ? (
        <EmptyState title="No work orders"
          hint="Raise one above — picking a room takes it out of order until the job is done." />
      ) : (
        <div className="space-y-3">
          {sorted.map((w) => (
            <div key={w.id} className="card p-4 flex items-center gap-4">
              <div className="flex-1">
                <div className="font-semibold">{w.title}</div>
                <div className="text-sm text-muted">
                  {w.room_number ? `Room ${w.room_number}` : "General"}
                  {w.detail && ` · ${w.detail}`}
                  {w.raised_by && ` · by ${w.raised_by}`}
                </div>
              </div>
              <Badge tone={TONE[w.status] ?? "info"}>{w.status_label}</Badge>
              {w.status !== "done" && (
                <button className="btn-outline"
                  title={w.status === "in_progress" && w.room_number
                    ? "Finishing returns the room to service (dirty, for housekeeping)" : undefined}
                  onClick={() => advance.mutate(w)}>
                  {w.status === "open" ? "Start work" : "Mark done"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Anyone with the Engineering screen can raise a job: a leaking AC in room
 *  204, or a general one (lobby light, boiler). Picking a room takes it out
 *  of order; marking the job done returns it to service via housekeeping. */
function NewWorkOrderModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({ title: "", detail: "", room: "" });
  const { data: rooms } = useQuery({
    queryKey: ["rooms"],
    queryFn: async () => (await api.get<Room[]>("/rooms/")).data,
  });

  const create = useMutation({
    mutationFn: async () => (await api.post("/work-orders/", {
      title: form.title.trim(),
      detail: form.detail.trim(),
      ...(form.room ? { room: Number(form.room) } : {}),
    })).data as WorkOrder,
    onSuccess: (wo) => {
      toast(wo.room_number
        ? `Work order raised — room ${wo.room_number} is out of order until it's done`
        : "Work order raised");
      qc.invalidateQueries({ queryKey: ["work-orders"] });
      qc.invalidateQueries({ queryKey: ["rooms"] });
      onClose();
    },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not raise the work order", "error"),
  });

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="card p-5 w-[420px]" onClick={(e) => e.stopPropagation()}>
        <div className="font-display text-xl mb-1">New work order</div>
        <div className="text-xs text-muted mb-3">
          Picking a room takes it out of order until the job is marked done.
        </div>
        <div className="space-y-3">
          <input className="input w-full" placeholder="What needs fixing? (e.g. AC leaking)" autoFocus
            value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <input className="input w-full" placeholder="Detail (optional)"
            value={form.detail} onChange={(e) => setForm({ ...form, detail: e.target.value })} />
          <select className="input w-full" value={form.room}
            onChange={(e) => setForm({ ...form, room: e.target.value })}>
            <option value="">General — no specific room</option>
            {rooms?.map((r) => (
              <option key={r.id} value={r.id}>
                Room {r.number} · {r.status_label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 mt-4">
          <button className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
          <button className="btn-primary flex-1"
            disabled={!form.title.trim() || create.isPending}
            onClick={() => create.mutate()}>
            Raise work order
          </button>
        </div>
      </div>
    </div>
  );
}
