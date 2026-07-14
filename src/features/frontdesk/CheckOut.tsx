import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Badge, Card, EmptyState, PageHeader, Spinner } from "../../design/ui";
import { useToast } from "../../design/Toast";
import { api } from "../../lib/api";
import { money } from "../../lib/money";
import type { Folio } from "../../lib/types";
import { downloadInvoicePdf } from "../print/documents";

const TENDERS = ["Card", "Cash", "UPI", "BTC"];

export function CheckOut() {
  const qc = useQueryClient();
  const toast = useToast();
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
      (await api.post(`/folios/${f.id}/checkout/`, { tender })).data as Folio,
    onSuccess: (f: Folio) => {
      setDone(`Checked out · invoice ${f.invoice_no} · room ${f.room_number} released to housekeeping`);
      qc.invalidateQueries({ queryKey: ["open-folios"] });
      qc.invalidateQueries({ queryKey: ["rooms"] });
      setSelId(null);
      downloadInvoicePdf(f); // auto-download the GST invoice
    },
  });

  // Bill with or without GST (tax invoice ↔ bill of supply) — recomputes the folio.
  const billingMode = useMutation({
    mutationFn: async ({ id, mode }: { id: number; mode: string }) =>
      (await api.post(`/folios/${id}/billing_mode/`, { mode })).data,
    onSuccess: (f: Folio) => {
      toast(f.effective_billing_mode === "with_gst"
        ? "Bill switched to GST tax invoice"
        : "Room switched to bill of supply — food keeps GST");
      qc.invalidateQueries({ queryKey: ["open-folios"] });
    },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not switch", "error"),
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
                <div className="text-sm text-muted">{f.guest_name} · {money(f.balance)}</div>
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
                      <td className="py-2 text-right font-medium">{money(l.total)}</td>
                    </tr>
                  ))}
                  {sel.pending_charges?.map((c) => (
                    <tr key={c.description} className="border-t border-line text-muted">
                      <td className="py-2">{c.description}</td>
                      <td className="py-2 text-right font-medium">{money(c.total)}</td>
                    </tr>
                  ))}
                  {!sel.lines.length && !sel.pending_charges?.length && (
                    <tr><td colSpan={2} className="py-4 text-center text-muted">No charges on this folio.</td></tr>
                  )}
                </tbody>
              </table>
              <div className="flex justify-between font-semibold text-lg border-t border-hairline pt-3">
                <span>Balance due</span><span>{money(sel.projected_balance ?? sel.balance)}</span>
              </div>
              <div className="mt-3">
                <button
                  className={`pill text-xs ${sel.effective_billing_mode === "with_gst"
                    ? "bg-pine-50 text-pine border border-pine/40"
                    : "bg-amber-50 text-amber-700 border border-amber-300"}`}
                  title="Toggle: GST tax invoice ↔ bill of supply. Applies to room charges only — food always keeps GST."
                  disabled={billingMode.isPending}
                  onClick={() => billingMode.mutate({
                    id: sel.id,
                    mode: sel.effective_billing_mode === "with_gst" ? "without_gst" : "with_gst",
                  })}
                >
                  {sel.effective_billing_mode === "with_gst"
                    ? "With GST — tax invoice"
                    : "Room without GST — food keeps GST"}
                </button>
              </div>
              <div className="mt-4 flex items-center gap-2">
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
