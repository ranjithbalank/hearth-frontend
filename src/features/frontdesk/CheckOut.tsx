import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Badge, Card, EmptyState, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { inr, num } from "../../lib/money";
import type { Folio } from "../../lib/types";

const TENDERS = ["Card", "Cash", "UPI", "BTC"];

export function CheckOut() {
  const qc = useQueryClient();
  const [selId, setSelId] = useState<number | null>(null);
  const [tender, setTender] = useState("Card");
  const [done, setDone] = useState<string | null>(null);

  const { data: folios, isLoading } = useQuery({
    queryKey: ["open-folios"],
    queryFn: async () => (await api.get<Folio[]>("/folios/?status=open")).data,
  });
  useEffect(() => { if (folios?.length && selId === null) setSelId(folios[0].id); }, [folios, selId]);
  const sel = folios?.find((f) => f.id === selId) ?? null;

  const checkout = useMutation({
    mutationFn: async (f: Folio) =>
      (await api.post(`/folios/${f.id}/checkout/`, {
        payments: num(f.balance) > 0 ? [{ tender, amount: f.balance }] : [],
      })).data,
    onSuccess: (f: Folio) => {
      setDone(`Checked out · invoice ${f.invoice_no} · room ${f.room_number} released to housekeeping`);
      qc.invalidateQueries({ queryKey: ["open-folios"] });
      qc.invalidateQueries({ queryKey: ["rooms"] });
      setSelId(null);
    },
  });

  if (isLoading) return <Spinner />;

  return (
    <div>
      <PageHeader title="Check-Out" subtitle="Settle the folio & release the room" />
      {done && <div className="card p-4 mb-4 bg-pine-50 border-pine/20 text-pine font-medium">{done}</div>}

      {!folios?.length ? (
        <EmptyState title="No in-house guests" hint="Open folios appear here for check-out." />
      ) : (
        <div className="grid grid-cols-[280px_1fr] gap-4">
          <div className="space-y-2">
            {folios.map((f) => (
              <button key={f.id} onClick={() => setSelId(f.id)}
                className={`w-full text-left card p-4 ${selId === f.id ? "ring-2 ring-pine" : ""}`}>
                <div className="font-medium">Room {f.room_number ?? "—"}</div>
                <div className="text-sm text-muted">{f.guest_name} · {inr(f.balance)}</div>
              </button>
            ))}
          </div>

          {sel && (
            <Card>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="font-display text-xl">{sel.guest_name}</div>
                  <div className="text-sm text-muted">Room {sel.room_number ?? "—"}</div>
                </div>
                <Badge tone="pine">{sel.status}</Badge>
              </div>
              <table className="w-full text-sm mb-4">
                <tbody>
                  {sel.lines.map((l) => (
                    <tr key={l.id} className="border-t border-line">
                      <td className="py-2">{l.description}</td>
                      <td className="py-2 text-right font-medium">{inr(l.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-between font-semibold text-lg border-t border-hairline pt-3">
                <span>Balance due</span><span>{inr(sel.balance)}</span>
              </div>
              <div className="mt-5 flex items-center gap-2">
                <select className="input w-32" value={tender} onChange={(e) => setTender(e.target.value)}>
                  {TENDERS.map((t) => <option key={t}>{t}</option>)}
                </select>
                <button className="btn-primary flex-1" disabled={checkout.isPending} onClick={() => checkout.mutate(sel)}>
                  Collect &amp; check out
                </button>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
