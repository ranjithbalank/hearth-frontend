import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { usePrompt } from "../../design/Prompt";
import { Badge, Card, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { inr } from "../../lib/money";
import type { Reservation } from "../../lib/types";

const STATUS_TONE: Record<string, "pine" | "clay" | "amber" | "info" | "muted"> = {
  booked: "info",
  in_house: "pine",
  checked_out: "muted",
  cancelled: "clay",
  no_show: "amber",
};

interface Avail { room_type: string; name: string; physical: number; held: number; available: number }

export function Reservations() {
  const qc = useQueryClient();
  const ask = usePrompt();
  const [msg, setMsg] = useState<string | null>(null);
  const [q, setQ] = useState("");

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
      setMsg(`Reservation ${v.action.replace("_", " ")} done`);
      qc.invalidateQueries({ queryKey: ["reservations"] });
      qc.invalidateQueries({ queryKey: ["availability"] });
    },
  });

  if (isLoading || !data) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Reservations"
        subtitle="Bookings, availability & amendments"
        action={<input className="input w-56" placeholder="Search guest…" value={q} onChange={(e) => setQ(e.target.value)} />}
      />
      {msg && <div className="card p-3 mb-4 bg-pine-50 text-pine font-medium">{msg}</div>}

      {avail && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          {avail.map((a) => (
            <Card key={a.room_type}>
              <div className="flex justify-between items-center">
                <span className="font-semibold">{a.name}</span>
                <Badge tone={a.available > 0 ? "pine" : "clay"}>{a.available} avail</Badge>
              </div>
              <div className="text-xs text-muted mt-1">{a.physical} rooms · {a.held} held</div>
            </Card>
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
            {data.filter((r) => !q || r.guest_name.toLowerCase().includes(q.toLowerCase())).map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="px-4 py-3 font-medium">{r.guest_name}</td>
                <td className="px-4 py-3">{r.room_type_code}</td>
                <td className="px-4 py-3">{r.checkin_date}</td>
                <td className="px-4 py-3">{r.checkout_date}</td>
                <td className="px-4 py-3">{r.room_number ?? "—"}</td>
                <td className="px-4 py-3 text-right">{inr(r.rate)}</td>
                <td className="px-4 py-3"><Badge tone={STATUS_TONE[r.status] ?? "muted"}>{r.status_label}</Badge></td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {r.status === "booked" && (
                    <>
                      <button className="btn-ghost text-xs py-1 text-amber-600" onClick={() => act.mutate({ id: r.id, action: "no_show" })}>No-show</button>
                      <button className="btn-ghost text-xs py-1 text-clay" onClick={() => act.mutate({ id: r.id, action: "cancel" })}>Cancel</button>
                    </>
                  )}
                  {r.status === "in_house" && (
                    <button
                      className="btn-ghost text-xs py-1"
                      onClick={async () => {
                        const opts = (await api.get(`/reservations/${r.id}/room_options/`)).data as { id: number; number: string }[];
                        const num = await ask({ title: "Move room", label: "New room number", placeholder: opts.map((o) => o.number).join(", ") });
                        const dest = opts.find((o) => o.number === num);
                        if (dest) act.mutate({ id: r.id, action: "room_move", body: { room: dest.id } });
                        else if (num) setMsg("Room not available");
                      }}
                    >
                      Move room
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
