import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { usePrompt } from "../../design/Prompt";
import { useToast } from "../../design/Toast";
import { Badge, Card, EmptyState, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { fmtDate } from "../../lib/date";
import { money } from "../../lib/money";
import { useApp } from "../../lib/app-context";
import type { Reservation, Room } from "../../lib/types";
import { RoomServiceFlow } from "./RoomService";
import { WalkInForm } from "./WalkInForm";

const SOURCE_TONE: Record<string, "pine" | "clay" | "amber" | "info"> = {
  direct: "pine",
  ota: "info",
  booking: "amber",
  walkin: "clay",
};

export function FrontDesk() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const ask = usePrompt();
  const toast = useToast();
  const { property } = useApp();
  const [walkin, setWalkin] = useState(false);
  const [hkPick, setHkPick] = useState(false);
  const [roomService, setRoomService] = useState(false);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["arrivals"] });
    qc.invalidateQueries({ queryKey: ["reservations"] });
    qc.invalidateQueries({ queryKey: ["availability"] });
  };
  const noShow = useMutation({
    mutationFn: async (id: number) => (await api.post(`/reservations/${id}/no_show/`)).data,
    onSuccess: () => { toast("Marked as no-show — the held room is released"); refresh(); },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not mark no-show", "error"),
  });
  const extend = useMutation({
    mutationFn: async ({ id, nights }: { id: number; nights: number }) =>
      (await api.post(`/reservations/${id}/extend/`, { nights })).data as Reservation,
    onSuccess: (r) => { toast(`Stay extended — now checking out ${fmtDate(r.checkout_date)}`); refresh(); },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not extend the stay", "error"),
  });

  const { data: arrivals, isLoading } = useQuery({
    queryKey: ["arrivals"],
    queryFn: async () => (await api.get<Reservation[]>("/reservations/arrivals/")).data,
  });
  // Departures: in-house stays whose checkout date has arrived.
  const { data: allRes } = useQuery({
    queryKey: ["reservations"],
    queryFn: async () => (await api.get<Reservation[]>("/reservations/")).data,
  });

  if (isLoading) return <Spinner />;

  const today = property?.business_date ?? new Date().toISOString().slice(0, 10);
  const dueOut = (allRes ?? []).filter(
    (r) => r.status === "in_house" && r.checkout_date <= today);
  // The desk works today's list first: overdue, then today, then the future.
  const sorted = [...(arrivals ?? [])].sort((a, b) =>
    a.checkin_date.localeCompare(b.checkin_date));
  const whenBadge = (d: string) =>
    d < today ? { tone: "clay" as const, label: `Overdue · ${fmtDate(d)}` }
      : d === today ? { tone: "pine" as const, label: "Today" }
        : { tone: "muted" as const, label: fmtDate(d) };

  return (
    <div>
      <PageHeader
        title="Front Desk"
        subtitle="Arrivals & walk-in check-in"
        action={
          <div className="flex items-center gap-2">
            {property?.entitlement?.restaurant && (
              <button className="btn-outline text-sm" onClick={() => setRoomService(true)}>🍽 Order food</button>
            )}
            <button className="btn-outline text-sm" onClick={() => setHkPick(true)}>🧹 Request cleaning</button>
            <Badge tone="pine">{arrivals?.length ?? 0} arriving</Badge>
          </div>
        }
      />

      {hkPick && <RequestCleaningModal onClose={() => setHkPick(false)} />}

      {roomService && <RoomServiceFlow onClose={() => setRoomService(false)} />}

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

      {dueOut.length > 0 && (
        <>
          <div className="text-xs uppercase tracking-wide text-muted mb-2">
            Departures — due out ({dueOut.length})
          </div>
          <div className="space-y-3 mb-6">
            {dueOut.map((d) => (
              <Card key={d.id} className="flex items-center gap-4 border-l-4 border-amber">
                <div className="flex-1">
                  <div className="font-semibold text-ink">{d.guest_name}</div>
                  <div className="text-sm text-muted">
                    Room {d.room_number ?? "—"} · {d.room_type_name || d.room_type_code} ·
                    out {fmtDate(d.checkout_date)}
                  </div>
                </div>
                {d.checkout_date < today && <Badge tone="clay">Overstay</Badge>}
                <button className="btn-ghost text-xs py-1" disabled={extend.isPending}
                  title="Guest is staying on — push the checkout date"
                  onClick={async () => {
                    const n = await ask({ title: `Extend stay — ${d.guest_name}`,
                      label: `Room ${d.room_number ?? "—"} · currently out ${fmtDate(d.checkout_date)}`,
                      defaultValue: "1", placeholder: "Nights to add" });
                    const nights = Number(n);
                    if (nights >= 1) extend.mutate({ id: d.id, nights });
                  }}>
                  Extend stay
                </button>
                <button className="btn-outline" onClick={() => nav("/folios")}>
                  Check out →
                </button>
              </Card>
            ))}
          </div>
        </>
      )}

      <div className="text-xs uppercase tracking-wide text-muted mb-2">Expected arrivals</div>
      {!sorted.length ? (
        <EmptyState title="No pending arrivals" hint="Use the walk-in area above for guests without a booking." />
      ) : (
        <div className="space-y-3">
          {sorted.map((a) => {
            const when = whenBadge(a.checkin_date);
            return (
              <Card key={a.id} className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="font-semibold text-ink">{a.guest_name}</div>
                  <div className="text-sm text-muted">
                    {a.room_type_name || a.room_type_code} · {fmtDate(a.checkin_date)} → {fmtDate(a.checkout_date)}
                    {" "}· {a.nights} night{a.nights > 1 ? "s" : ""} · {money(a.rate)}/night
                  </div>
                </div>
                <Badge tone={when.tone}>{when.label}</Badge>
                <Badge tone={SOURCE_TONE[a.source] ?? "muted"}>{a.source_label}</Badge>
                {a.prepaid && <Badge tone="amber">Prepaid {money(a.deposit)}</Badge>}
                {a.precheckin_done && (
                  <Badge tone="pine">✓ Pre-checked-in{a.precheckin?.eta ? ` · ETA ${a.precheckin.eta}` : ""}</Badge>
                )}
                {a.checkin_date < today && (
                  <button className="btn-ghost text-xs py-1 text-amber-600" disabled={noShow.isPending}
                    onClick={async () => {
                      const ok = await ask({ title: "Mark no-show", confirm: true, danger: true,
                        confirmLabel: "Mark no-show",
                        message: `${a.guest_name} was due ${fmtDate(a.checkin_date)} and never arrived? This releases the held room.` });
                      if (ok) noShow.mutate(a.id);
                    }}>
                    No-show
                  </button>
                )}
                <button className="btn-primary" onClick={() => nav(`/checkin?reservation=${a.id}`)}>
                  Check in
                </button>
              </Card>
            );
          })}
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
