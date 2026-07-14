import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Card, PageHeader, Spinner, Stat } from "../../design/ui";
import { api } from "../../lib/api";
import { money } from "../../lib/money";

interface RoomCard { room_type: string; name: string; rate: string; available: number; max_occupancy: number }
interface Stats { direct_share_pct: number; ota_bookings: number; direct_bookings: number; commission_saved: string }

export function Booking() {
  const qc = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);

  const { data: rooms, isLoading } = useQuery({
    queryKey: ["booking-rooms"],
    queryFn: async () => (await api.get<RoomCard[]>("/booking/")).data,
  });
  const { data: stats } = useQuery({
    queryKey: ["booking-stats"],
    queryFn: async () => (await api.get<Stats>("/booking/stats/")).data,
  });

  const book = useMutation({
    mutationFn: async (r: RoomCard) =>
      (await api.post("/booking/", { room_type: r.room_type, guest_name: "Web Guest", nights: 2 })).data,
    onSuccess: (d) => {
      setMsg(`Direct booking confirmed for ${d.guest_name} · ${d.room_type} · arriving ${d.checkin_date}`);
      qc.invalidateQueries({ queryKey: ["booking-rooms"] });
      qc.invalidateQueries({ queryKey: ["booking-stats"] });
    },
  });

  if (isLoading) return <Spinner />;

  return (
    <div>
      <PageHeader title="Booking Engine" subtitle="Commission-free direct bookings" />
      {msg && <div className="card p-3 mb-4 bg-pine-50 text-pine font-medium">{msg}</div>}

      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          <Stat tone="dark" label="Direct share" value={`${stats.direct_share_pct}%`} />
          <Stat label="Direct bookings" value={stats.direct_bookings} />
          <Stat label="OTA bookings" value={stats.ota_bookings} />
          <Stat label="Commission saved" value={money(stats.commission_saved)} />
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {rooms?.map((r) => (
          <Card key={r.room_type}>
            <div className="font-display text-xl">{r.name}</div>
            <div className="text-sm text-muted">Sleeps {r.max_occupancy} · {r.available} available</div>
            <div className="stat-num text-2xl mt-3">{money(r.rate)}<span className="text-sm text-muted">/night</span></div>
            <button
              className="btn-primary w-full mt-3"
              disabled={!r.available || book.isPending}
              onClick={() => book.mutate(r)}
            >
              Book direct
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}
