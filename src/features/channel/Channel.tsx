import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useToast } from "../../design/Toast";
import { Badge, Card, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { inr } from "../../lib/money";

/** Build a demo Booking.com payload with a unique ref and near-future dates. */
function demoBooking() {
  const names = ["Emma Watson", "Liam O'Brien", "Yuki Tanaka", "Sofia Rossi", "Arjun Mehta"];
  const ci = new Date(Date.now() + 21 * 864e5);
  const co = new Date(Date.now() + 24 * 864e5);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return {
    channel: "Booking.com",
    reservation_id: "BDC-" + Math.floor(Math.random() * 1e6),
    guest_name: names[Math.floor(Math.random() * names.length)],
    mobile: "+44 7700" + Math.floor(100000 + Math.random() * 899999),
    room_type: "STD", checkin: iso(ci), checkout: iso(co),
    rate: "4200", amount_prepaid: "12600",
  };
}

interface Cell { channel: string; rate: string | null; availability: number }
interface Row { room_type: string; name: string; cells: Cell[]; parity_breach: boolean }
interface Ari { channels: string[]; grid: Row[]; parity_ok: boolean }
interface Push { id: number; kind: string; detail: string; created_at: string }

export function Channel() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: ari, isLoading } = useQuery({
    queryKey: ["ari"],
    queryFn: async () => (await api.get<Ari>("/channel/ari/")).data,
  });
  const { data: channels } = useQuery({
    queryKey: ["channels"],
    queryFn: async () => (await api.get<{ name: string; connected: boolean; commission_pct: string }[]>("/channel/")).data,
  });
  const { data: pushes } = useQuery({
    queryKey: ["pushes"],
    queryFn: async () => (await api.get<Push[]>("/channel/pushes/")).data,
  });

  const fixParity = useMutation({
    mutationFn: async () => (await api.post("/channel/fix_parity/")).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ari"] });
      qc.invalidateQueries({ queryKey: ["pushes"] });
    },
  });

  const ingest = useMutation({
    mutationFn: async () => (await api.post("/channel/ingest/", demoBooking())).data,
    onSuccess: (d) => {
      const r = d.reservation;
      toast(`Booking imported · ${r.guest_name} · ${r.room_type_code} ${r.checkin_date}→${r.checkout_date} (prepaid ${inr(r.deposit)})`);
      qc.invalidateQueries({ queryKey: ["pushes"] });
      qc.invalidateQueries({ queryKey: ["reservations"] });
      qc.invalidateQueries({ queryKey: ["arrivals"] });
    },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not import booking", "error"),
  });

  if (isLoading || !ari) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Channel Manager"
        subtitle="Pooled ARI across OTAs · rate parity"
        action={
          <div className="flex items-center gap-2">
            <button className="btn-outline" disabled={ingest.isPending} onClick={() => ingest.mutate()}>
              {ingest.isPending ? "Importing…" : "Simulate incoming booking"}
            </button>
            {ari.parity_ok
              ? <Badge tone="pine">Parity OK</Badge>
              : <button className="btn-primary" onClick={() => fixParity.mutate()}>Fix parity</button>}
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        {channels?.map((c) => (
          <Badge key={c.name} tone={c.connected ? "pine" : "muted"}>
            {c.name} · {c.commission_pct}%
          </Badge>
        ))}
      </div>

      <Card className="mb-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-muted text-xs uppercase">
            <tr>
              <th className="text-left py-2 pr-4">Room type</th>
              {ari.channels.map((c) => <th key={c} className="text-right py-2 px-3">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {ari.grid.map((row) => (
              <tr key={row.room_type} className="border-t border-line">
                <td className="py-2 pr-4 font-medium">
                  {row.name}{" "}
                  {row.parity_breach && <Badge tone="clay">parity</Badge>}
                </td>
                {row.cells.map((cell, i) => (
                  <td key={i} className="py-2 px-3 text-right">
                    {cell.rate ? inr(cell.rate) : "—"}
                    <span className="text-muted text-xs"> ·{cell.availability}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <div className="font-semibold mb-3">Recent pushes</div>
        {pushes?.map((p) => (
          <div key={p.id} className="flex justify-between py-2 border-t border-line text-sm">
            <span>{p.detail}</span>
            <Badge tone={p.kind === "rms" ? "info" : p.kind === "parity" ? "amber" : p.kind === "booking" ? "pine" : "muted"}>
              {p.kind === "booking" ? "inbound" : p.kind}
            </Badge>
          </div>
        ))}
        {!pushes?.length && <div className="text-sm text-muted py-3">No pushes yet.</div>}
      </Card>
    </div>
  );
}
