import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { api } from "../../lib/api";
import { inr } from "../../lib/money";
import type { Reservation } from "../../lib/types";

export interface RoomTypeOpt { code: string; name: string; base_rate: string; available: number }

/** Modal form to register a guest who arrived without a booking, then proceed
 *  to check-in. Used from both Front Desk and the Check-In screen. */
const DIAL_CODES = ["+91", "+1", "+44", "+971", "+65", "+61", "+49", "+33", "+94", "+880", "+977"];

export function WalkInForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (id: number) => void }) {
  const [form, setForm] = useState({ guest_name: "", code: "+91", mobile: "", room_type: "", nights: "1" });
  const { data: types } = useQuery({
    queryKey: ["walkin-room-types"],
    queryFn: async () => (await api.get<RoomTypeOpt[]>("/reservations/room_types/")).data,
  });
  const create = useMutation({
    mutationFn: async () => (await api.post("/reservations/walkin/", {
      guest_name: form.guest_name,
      mobile: form.mobile ? `${form.code} ${form.mobile}` : "",
      room_type: form.room_type, nights: Number(form.nights),
    })).data as Reservation,
    onSuccess: (r) => onCreated(r.id),
  });
  const picked = types?.find((t) => t.code === form.room_type);

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="card p-5 w-[440px]" onClick={(e) => e.stopPropagation()}>
        <div className="font-display text-xl mb-4">Walk-in guest</div>
        <label className="block text-xs font-semibold text-muted mb-1">Guest name</label>
        <input className="input mb-3" value={form.guest_name} onChange={(e) => setForm({ ...form, guest_name: e.target.value })} />
        <label className="block text-xs font-semibold text-muted mb-1">Mobile</label>
        <div className="flex gap-2 mb-3">
          <select className="input w-24" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}>
            {DIAL_CODES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <input
            className="input flex-1"
            inputMode="numeric"
            placeholder="Mobile number"
            value={form.mobile}
            onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/\D/g, "").slice(0, 12) })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Room type</label>
            <select className="input" value={form.room_type} onChange={(e) => setForm({ ...form, room_type: e.target.value })}>
              <option value="">Select…</option>
              {types?.map((t) => (
                <option key={t.code} value={t.code} disabled={t.available === 0}>
                  {t.name} — {inr(t.base_rate)} ({t.available} free)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Nights</label>
            <input className="input" value={form.nights} onChange={(e) => setForm({ ...form, nights: e.target.value })} />
          </div>
        </div>
        {picked && <div className="text-sm text-muted mt-3">Estimated room: {inr(Number(picked.base_rate) * Number(form.nights || 1))} + GST</div>}
        <div className="flex gap-2 mt-5">
          <button className="btn-ghost flex-1" onClick={onCancel}>Cancel</button>
          <button className="btn-primary flex-1" disabled={!form.guest_name || !form.room_type || create.isPending}
            onClick={() => create.mutate()}>
            Create &amp; check in
          </button>
        </div>
      </div>
    </div>
  );
}
