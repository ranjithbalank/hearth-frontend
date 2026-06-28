import { useQuery } from "@tanstack/react-query";

import { Badge, PageHeader, Spinner } from "../../design/ui";
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

export function Reservations() {
  const { data, isLoading } = useQuery({
    queryKey: ["reservations"],
    queryFn: async () => (await api.get<Reservation[]>("/reservations/")).data,
  });

  if (isLoading || !data) return <Spinner />;

  return (
    <div>
      <PageHeader title="Reservations" subtitle="Bookings by stay window" />
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-cream text-muted text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Guest</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-left px-4 py-3">Check-in</th>
              <th className="text-left px-4 py-3">Check-out</th>
              <th className="text-left px-4 py-3">Room</th>
              <th className="text-right px-4 py-3">Rate</th>
              <th className="text-left px-4 py-3">Source</th>
              <th className="text-left px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="px-4 py-3 font-medium">{r.guest_name}</td>
                <td className="px-4 py-3">{r.room_type_code}</td>
                <td className="px-4 py-3">{r.checkin_date}</td>
                <td className="px-4 py-3">{r.checkout_date}</td>
                <td className="px-4 py-3">{r.room_number ?? "—"}</td>
                <td className="px-4 py-3 text-right">{inr(r.rate)}</td>
                <td className="px-4 py-3">{r.source_label}</td>
                <td className="px-4 py-3">
                  <Badge tone={STATUS_TONE[r.status] ?? "muted"}>{r.status_label}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
