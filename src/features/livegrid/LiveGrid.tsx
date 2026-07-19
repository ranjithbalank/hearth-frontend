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
  const toast = useToast();
  const { canAccess } = useApp();
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

  const inferFloors = useMutation({
    mutationFn: async () => (await api.post("/rooms/infer_floors/")).data as { changed: number },
    onSuccess: (d) => {
      toast(d.changed ? `${d.changed} room(s) moved to their real floor` : "Floors already match the room numbers");
      qc.invalidateQueries({ queryKey: ["rooms"] });
    },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not set floors", "error"),
  });

  if (isLoading || !rooms) return <Spinner />;

  // Group by branch (only when several are visible), then by floor. Rooms
  // sort naturally within a floor; floors numerically.
  const numeric = (s: string) => Number(s.replace(/\D/g, "")) || 0;
  const byBranch = new Map<string, Room[]>();
  rooms.forEach((r) => {
    const key = r.location_name ?? "";
    byBranch.set(key, [...(byBranch.get(key) ?? []), r]);
  });
  const branches = [...byBranch.keys()].sort((a, b) =>
    a === "" ? 1 : b === "" ? -1 : a.localeCompare(b));
  const multiBranch = branches.length > 1;
  // Rooms default to floor 1 on creation, so a room named 500 ends up filed
  // under Floor 1. Flag every room whose number implies a different floor —
  // the one-click fixer refiles them all (same rule as the backend).
  const impliedFloor = (r: Room) => {
    const n = numeric(r.number);
    return n >= 100 ? Math.floor(n / 100) : n >= 10 ? Math.floor(n / 10) : n;
  };
  const misfiled = rooms.filter((r) =>
    numeric(r.number) >= 10 && impliedFloor(r) >= 1 && impliedFloor(r) !== r.floor);

  return (
    <div>
      <PageHeader
        title="Live Grid"
        subtitle={multiBranch
          ? "Click a room to advance its status · pick a branch in the top bar to focus on one"
          : "Click a room to advance its status"}
        action={<button className="btn-primary text-sm" onClick={() => setAdding(true)}>+ Add room</button>}
      />
      {adding && <AddRoomModal onClose={() => setAdding(false)} />}

      {misfiled.length > 0 && canAccess("roommaster") && (
        <div className="card p-4 mb-4 flex items-center gap-3 border-l-4 border-amber">
          <div className="flex-1 text-sm">
            <span className="font-medium">
              {misfiled.length} room(s) aren't on the floor their number suggests
            </span>
            <span className="text-muted">
              {" "}— e.g. room {misfiled[0].number} filed under floor {misfiled[0].floor}.
              New rooms default to floor 1.
            </span>
          </div>
          <button className="btn-outline text-sm" disabled={inferFloors.isPending}
            onClick={() => inferFloors.mutate()}>
            Set floors from room numbers
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-5 text-xs text-muted">
        {Object.entries(STATUS_STYLE).map(([k, cls]) => (
          <span key={k} className={`pill border ${cls}`}>{k.replace("_", " ")}</span>
        ))}
      </div>
      <div className="space-y-6">
        {branches.map((branchName) => {
          const list = byBranch.get(branchName)!;
          const byFloor = new Map<number, Room[]>();
          list.forEach((r) => byFloor.set(r.floor, [...(byFloor.get(r.floor) ?? []), r]));
          const floors = [...byFloor.keys()].sort((a, b) => a - b);
          return (
            <div key={branchName || "shared"}>
              {multiBranch && (
                <div className="font-semibold mb-3 flex items-center gap-2">
                  {branchName || "Shared / unassigned"}
                  <span className="text-xs text-muted font-normal">{list.length} rooms</span>
                </div>
              )}
              <div className="space-y-5">
                {floors.map((floor) => (
                  <div key={floor}>
                    <div className="text-xs uppercase tracking-wide text-muted mb-2">Floor {floor}</div>
                    <div className="grid grid-cols-8 gap-2">
                      {[...byFloor.get(floor)!].sort((a, b) => numeric(a.number) - numeric(b.number))
                        .map((r) => (
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
        })}
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
    number: "", room_type: "", floor: "", view: "", smoking: false,
    location: activeBranch ? String(activeBranch) : "",
  });
  // Floor tracks the room number (500 → 5) until the user types their own.
  const [floorTouched, setFloorTouched] = useState(false);
  const inferFloor = (num: string) => {
    const n = Number((num.match(/^\d+/) ?? [""])[0]);
    if (!n) return "";
    return String(n >= 100 ? Math.floor(n / 100) : n >= 10 ? Math.floor(n / 10) : n);
  };

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
        // No floor sent = the server infers it from the number (never a
        // silent floor-1 default).
        ...(form.floor ? { floor: Number(form.floor) } : {}),
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
            value={form.number}
            onChange={(e) => setForm({
              ...form, number: e.target.value,
              floor: floorTouched ? form.floor : inferFloor(e.target.value),
            })}
          />
          <select className="input w-full" value={form.room_type} onChange={(e) => setForm({ ...form, room_type: e.target.value })}>
            <option value="">Room type…</option>
            {roomTypes?.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.code})</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input
              className="input" inputMode="numeric" placeholder="Floor (auto)"
              title="Fills itself from the room number — type to override"
              value={form.floor}
              onChange={(e) => { setFloorTouched(true); setForm({ ...form, floor: e.target.value.replace(/\D/g, "") }); }}
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
