import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useToast } from "../../design/Toast";
import { PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { useApp } from "../../lib/app-context";
import type { Branch, Room } from "../../lib/types";

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
  const [adding, setAdding] = useState(false);
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
      <PageHeader
        title="Live Grid"
        subtitle="Click a room to advance its status"
        action={<button className="btn-primary text-sm" onClick={() => setAdding(true)}>+ Add room</button>}
      />
      {adding && <AddRoomModal onClose={() => setAdding(false)} />}
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

interface RoomTypeOpt { id: number; code: string; name: string }

/** Physical room instance, not the room type — created here rather than on
 *  Room Master so it lands under the module (`livegrid`) that actually gates
 *  writes to it, and shows up on this same grid the moment it's added. */
function AddRoomModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { user, activeBranch } = useApp();
  const [form, setForm] = useState({
    number: "", room_type: "", floor: "1", view: "", smoking: false,
    location: activeBranch ? String(activeBranch) : "",
  });

  const { data: roomTypes } = useQuery({
    queryKey: ["room-types"],
    queryFn: async () => (await api.get<RoomTypeOpt[]>("/room-types/")).data,
  });

  const allBranches = user?.branches === "*";
  const { data: everyBranch } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => (await api.get<Branch[]>("/auth/branches/")).data,
    enabled: allBranches,
  });
  const branchOptions = allBranches
    ? everyBranch ?? []
    : Array.from(
        new Map(
          (Array.isArray(user?.branches) ? user.branches : [])
            .map((a) => [a.branch, { id: a.branch, name: a.branch_name }]),
        ).values(),
      );

  const create = useMutation({
    mutationFn: async () =>
      (await api.post("/rooms/", {
        number: form.number.trim(),
        room_type: Number(form.room_type),
        floor: Number(form.floor) || 1,
        view: form.view,
        smoking: form.smoking,
        ...(form.location ? { location: Number(form.location) } : {}),
      })).data,
    onSuccess: () => {
      toast(`Room ${form.number} added — live on the grid`);
      qc.invalidateQueries({ queryKey: ["rooms"] });
      onClose();
    },
    onError: (e: any) =>
      toast(e?.response?.data?.number?.[0] ?? e?.response?.data?.detail ?? "Could not add that room", "error"),
  });

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="card p-5 w-[380px]" onClick={(e) => e.stopPropagation()}>
        <div className="font-display text-xl mb-3">Add room</div>
        <div className="space-y-3">
          <input
            className="input w-full" placeholder="Room number" autoFocus
            value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })}
          />
          <select className="input w-full" value={form.room_type} onChange={(e) => setForm({ ...form, room_type: e.target.value })}>
            <option value="">Room type…</option>
            {roomTypes?.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.code})</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input
              className="input" inputMode="numeric" placeholder="Floor"
              value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value.replace(/\D/g, "") })}
            />
            <input
              className="input" placeholder="View (optional)"
              value={form.view} onChange={(e) => setForm({ ...form, view: e.target.value })}
            />
          </div>
          {branchOptions.length > 1 && (
            <select className="input w-full" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}>
              <option value="">Branch…</option>
              {branchOptions.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <label className="flex items-center gap-2 text-sm text-body">
            <input type="checkbox" checked={form.smoking} onChange={(e) => setForm({ ...form, smoking: e.target.checked })} />
            Smoking room
          </label>
        </div>
        <div className="flex gap-2 mt-4">
          <button className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary flex-1"
            disabled={!form.number || !form.room_type || create.isPending}
            onClick={() => create.mutate()}
          >
            Add room
          </button>
        </div>
      </div>
    </div>
  );
}
