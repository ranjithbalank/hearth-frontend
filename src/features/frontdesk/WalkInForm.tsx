import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { PhoneInput, joinPhone } from "../../design/PhoneInput";
import { Field } from "../../design/ui";
import { api } from "../../lib/api";
import { digits, personName } from "../../lib/inputs";
import { money } from "../../lib/money";
import type { Reservation } from "../../lib/types";

export interface RoomTypeOpt { code: string; name: string; base_rate: string; available: number }

/** Modal form to register a guest who arrived without a booking, then proceed
 *  to check-in. Used from both Front Desk and the Check-In screen. */

export function WalkInForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (id: number) => void }) {
  const [form, setForm] = useState({ guest_name: "", code: "+91", mobile: "", room_type: "", nights: "1" });
  const { data: types } = useQuery({
    queryKey: ["walkin-room-types"],
    queryFn: async () => (await api.get<RoomTypeOpt[]>("/reservations/room_types/")).data,
  });
  const create = useMutation({
    mutationFn: async () => (await api.post("/reservations/walkin/", {
      guest_name: form.guest_name,
      mobile: joinPhone(form.code, form.mobile),
      room_type: form.room_type, nights: Number(form.nights) || 1,
    })).data as Reservation,
    onSuccess: (r) => onCreated(r.id),
  });
  const picked = types?.find((t) => t.code === form.room_type);

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="card p-5 w-[440px]" onClick={(e) => e.stopPropagation()}>
        <div className="font-display text-xl mb-4">Walk-in guest</div>
        <div className="mb-3">
          <Field label="Guest name" required>
            <input className="input" value={form.guest_name} onChange={(e) => setForm({ ...form, guest_name: personName(e.target.value) })} />
          </Field>
        </div>
        <div className="mb-3">
          <Field label="Mobile">
            <PhoneInput
              code={form.code}
              number={form.mobile}
              onCode={(code) => setForm({ ...form, code })}
              onNumber={(mobile) => setForm({ ...form, mobile })}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Room type" required>
            <select className="input" value={form.room_type} onChange={(e) => setForm({ ...form, room_type: e.target.value })}>
              <option value="">Select…</option>
              {types?.map((t) => (
                <option key={t.code} value={t.code} disabled={t.available === 0}>
                  {t.name} — {money(t.base_rate)} ({t.available} free)
                </option>
              ))}
            </select>
          </Field>
          <Field label="Nights">
            <input className="input" inputMode="numeric" value={form.nights}
              onChange={(e) => setForm({ ...form, nights: digits(e.target.value, 3) })} />
          </Field>
        </div>
        {picked && <div className="text-sm text-muted mt-3">Estimated room: {money(Number(picked.base_rate) * Number(form.nights || 1))} + GST</div>}
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
