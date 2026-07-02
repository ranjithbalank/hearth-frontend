import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useToast } from "../../design/Toast";
import { Badge, Card, EmptyState, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { inr } from "../../lib/money";
import type { Reservation, Room } from "../../lib/types";
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
  const [hkPick, setHkPick] = useState(false);

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
        action={
          <div className="flex items-center gap-2">
            <button className="btn-outline text-sm" onClick={() => setHkPick(true)}>🧹 Request cleaning</button>
            <Badge tone="pine">{arrivals?.length ?? 0} arriving</Badge>
          </div>
        }
      />

      {hkPick && <RequestCleaningModal onClose={() => setHkPick(false)} />}

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

/** Front desk raises a cleaning request: occupied rooms (make-up-room) and
 *  vacated/dirty rooms land flagged on the housekeeping board + notifications. */
function RequestCleaningModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: rooms } = useQuery({
    queryKey: ["hk-rooms"],
    queryFn: async () => (await api.get<Room[]>("/housekeeping/")).data,
  });
  const candidates = (rooms ?? []).filter(
    (r) => (r.status === "occupied" || r.status === "vacant_dirty") && !r.cleaning_requested);

  async function request(room: Room) {
    setBusy(true);
    try {
      await api.post(`/housekeeping/${room.id}/request_cleaning/`, { note });
      toast(`Cleaning requested for room ${room.number} — housekeeping notified`);
      onClose();
    } catch (e: any) {
      toast(e?.response?.data?.detail ?? "Could not request", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="card p-5 w-[420px] max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="font-display text-xl mb-1">Request cleaning</div>
        <div className="text-xs text-muted mb-3">
          Occupied rooms (guest asked for service) and vacated rooms. Housekeeping is notified instantly.
        </div>
        <input className="input w-full mb-3" placeholder="Note (e.g. guest asked for turndown at 6pm)"
          value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="grid grid-cols-3 gap-2">
          {candidates.map((r) => (
            <button key={r.id} disabled={busy}
              className="card p-3 text-center hover:bg-cream"
              onClick={() => request(r)}>
              <div className="font-display text-lg">{r.number}</div>
              <div className="text-[10px] uppercase tracking-wide text-muted">{r.status_label}</div>
            </button>
          ))}
          {!candidates.length && (
            <div className="col-span-3 text-sm text-muted text-center py-6">
              No occupied or vacated-dirty rooms pending — all requests are already raised.
            </div>
          )}
        </div>
        <button className="btn-ghost w-full mt-3" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
