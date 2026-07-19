import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { usePrompt } from "../../design/Prompt";
import { useToast } from "../../design/Toast";
import { Badge, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { fmtDate } from "../../lib/date";
import { money } from "../../lib/money";
import type { Reservation } from "../../lib/types";

const STATUS_TONE: Record<string, "pine" | "clay" | "amber" | "info" | "muted"> = {
  booked: "info",
  in_house: "pine",
  checked_out: "muted",
  cancelled: "clay",
  no_show: "amber",
};

interface Avail { room_type: string; name: string; physical: number; held: number; available: number }

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "booked", label: "Booked" },
  { key: "in_house", label: "In-house" },
  { key: "checked_out", label: "Checked out" },
  { key: "cancelled", label: "Cancelled" },
  { key: "no_show", label: "No-show" },
];

export function Reservations() {
  const qc = useQueryClient();
  const ask = usePrompt();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [rtype, setRtype] = useState("all");
  const [source, setSource] = useState("all");
  const [changeRoomFor, setChangeRoomFor] = useState<Reservation | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["reservations"],
    queryFn: async () => (await api.get<Reservation[]>("/reservations/")).data,
  });
  const { data: avail } = useQuery({
    queryKey: ["availability"],
    queryFn: async () => (await api.get<Avail[]>("/reservations/availability/")).data,
  });

  const act = useMutation({
    mutationFn: async ({ id, action, body }: { id: number; action: string; body?: object }) =>
      (await api.post(`/reservations/${id}/${action}/`, body ?? {})).data,
    onSuccess: (_d, v) => {
      toast(`Reservation ${v.action.replace("_", " ")} done`);
      qc.invalidateQueries({ queryKey: ["reservations"] });
      qc.invalidateQueries({ queryKey: ["availability"] });
    },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not complete that action", "error"),
  });

  if (isLoading || !data) return <Spinner />;

  const needle = q.trim().toLowerCase();
  const rows = data.filter((r) =>
    (status === "all" || r.status === status)
    && (rtype === "all" || r.room_type_code === rtype)
    && (source === "all" || r.source === source)
    && (!needle
      || r.guest_name.toLowerCase().includes(needle)
      || (r.room_number ?? "").toLowerCase().includes(needle)
      || r.room_type_code.toLowerCase().includes(needle)
      || (r.room_type_name ?? "").toLowerCase().includes(needle)
      || r.status_label.toLowerCase().includes(needle)));

  // Counts respect the other filters so the pills stay honest while drilling.
  const inScope = data.filter((r) =>
    (rtype === "all" || r.room_type_code === rtype)
    && (source === "all" || r.source === source));
  const countOf = (key: string) =>
    key === "all" ? inScope.length : inScope.filter((r) => r.status === key).length;
  const roomTypes = [...new Map(data.map((r) => [r.room_type_code, r.room_type_name])).entries()];
  const sources = [...new Map(data.map((r) => [r.source, r.source_label])).entries()];

  return (
    <div>
      <PageHeader
        title="Reservations"
        subtitle="Bookings, availability & amendments"
        action={<input className="input w-56" placeholder="Search guest, room or status…" value={q} onChange={(e) => setQ(e.target.value)} />}
      />

      {changeRoomFor && (
        <ChangeRoomModal
          reservation={changeRoomFor}
          onClose={() => setChangeRoomFor(null)}
          onPick={(roomId) => {
            act.mutate({ id: changeRoomFor.id, action: "room_move", body: { room: roomId } });
            setChangeRoomFor(null);
          }}
        />
      )}

      {/* Filters: status pills (with live counts) + room type + source */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {STATUS_FILTERS.map((s) => (
          <button key={s.key} onClick={() => setStatus(s.key)}
            className={`pill text-xs ${status === s.key ? "bg-ink text-white" : "bg-hairline text-body"}`}>
            {s.label} <span className={status === s.key ? "opacity-70" : "text-muted"}>{countOf(s.key)}</span>
          </button>
        ))}
        <select className="input py-1 text-xs w-44" value={rtype}
          onChange={(e) => setRtype(e.target.value)} aria-label="Room type filter">
          <option value="all">All room types</option>
          {roomTypes.map(([code, name]) => (
            <option key={code} value={code}>{name || code} ({code})</option>
          ))}
        </select>
        <select className="input py-1 text-xs w-40" value={source}
          onChange={(e) => setSource(e.target.value)} aria-label="Source filter">
          <option value="all">All sources</option>
          {sources.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        {(status !== "all" || rtype !== "all" || source !== "all") && (
          <button className="btn-ghost text-xs py-1"
            onClick={() => { setStatus("all"); setRtype("all"); setSource("all"); }}>
            Clear filters
          </button>
        )}
      </div>

      {avail && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          {avail.map((a) => (
            <button key={a.room_type}
              className={`card p-5 text-left hover:bg-cream ${rtype === a.room_type ? "ring-2 ring-pine" : ""}`}
              title="Click to filter the list by this room type"
              onClick={() => setRtype(rtype === a.room_type ? "all" : a.room_type)}>
              <div className="flex justify-between items-center">
                <span className="font-semibold">{a.name}</span>
                <Badge tone={a.available > 0 ? "pine" : "clay"}>{a.available} avail</Badge>
              </div>
              <div className="text-xs text-muted mt-1">{a.physical} rooms · {a.held} held</div>
            </button>
          ))}
        </div>
      )}

      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-cream text-muted text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Guest</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-left px-4 py-3">Check-in</th>
              <th className="text-left px-4 py-3">Check-out</th>
              <th className="text-left px-4 py-3">Room</th>
              <th className="text-right px-4 py-3">Rate</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="px-4 py-3">
                  <div className="font-medium">{r.guest_name}</div>
                  <div className="text-xs text-muted">
                    {r.source_label}{r.channel_name ? ` · ${r.channel_name}` : ""}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {r.room_type_name || r.room_type_code}
                  <span className="text-muted text-xs"> ({r.room_type_code})</span>
                </td>
                <td className="px-4 py-3">{fmtDate(r.checkin_date)}</td>
                <td className="px-4 py-3">{fmtDate(r.checkout_date)} <span className="text-muted text-xs">· {r.nights}n</span></td>
                <td className="px-4 py-3">{r.room_number ?? "—"}</td>
                <td className="px-4 py-3 text-right">{money(r.rate)}</td>
                <td className="px-4 py-3"><Badge tone={STATUS_TONE[r.status] ?? "muted"}>{r.status_label}</Badge></td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {r.status === "booked" && (
                    <>
                      <button
                        className="btn-ghost text-xs py-1 text-amber-600"
                        disabled={act.isPending}
                        onClick={async () => {
                          const ok = await ask({ title: "Mark no-show", confirm: true, danger: true, confirmLabel: "Mark no-show",
                            message: `Mark ${r.guest_name}'s booking as a no-show? This releases the held room.` });
                          if (ok) act.mutate({ id: r.id, action: "no_show" });
                        }}
                      >
                        No-show
                      </button>
                      <button
                        className="btn-ghost text-xs py-1 text-clay"
                        disabled={act.isPending}
                        onClick={async () => {
                          const ok = await ask({ title: "Cancel reservation", confirm: true, danger: true, confirmLabel: "Cancel booking",
                            message: `Cancel ${r.guest_name}'s booking? This frees the held room and can't be undone.` });
                          if (ok) act.mutate({ id: r.id, action: "cancel" });
                        }}
                      >
                        Cancel
                      </button>
                    </>
                  )}
                  {r.status === "in_house" && (
                    <button
                      className="btn-ghost text-xs py-1"
                      disabled={act.isPending}
                      onClick={() => setChangeRoomFor(r)}
                    >
                      Change room
                    </button>
                  )}
                  {r.status !== "booked" && r.status !== "in_house" && <span className="text-muted text-xs">—</span>}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-muted">
                {q ? "No reservations match your search." : "No reservations yet."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Guest asks to switch rooms mid-stay — pick from the actual available
 *  rooms of the same type rather than typing a room number from memory. */
function ChangeRoomModal({
  reservation,
  onClose,
  onPick,
}: {
  reservation: Reservation;
  onClose: () => void;
  onPick: (roomId: number) => void;
}) {
  const { data: opts, isLoading } = useQuery({
    queryKey: ["room-options", reservation.id],
    queryFn: async () => (await api.get<{ id: number; number: string }[]>(`/reservations/${reservation.id}/room_options/`)).data,
  });

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="card p-5 w-[420px] max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="font-display text-xl mb-1">Change room</div>
        <div className="text-xs text-muted mb-3">
          {reservation.guest_name} is currently in room {reservation.room_number ?? "—"}. Pick a new room to move them to.
        </div>
        {isLoading ? (
          <Spinner />
        ) : !opts?.length ? (
          <div className="text-sm text-muted text-center py-6">No alternative rooms available right now.</div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {opts.map((o) => (
              <button key={o.id} className="card p-3 text-center hover:bg-cream" onClick={() => onPick(o.id)}>
                <div className="font-display text-lg">{o.number}</div>
              </button>
            ))}
          </div>
        )}
        <button className="btn-ghost w-full mt-3" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
