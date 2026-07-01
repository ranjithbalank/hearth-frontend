import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Badge, Card, EmptyState, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { useApp } from "../../lib/app-context";
import { inr, num } from "../../lib/money";
import type { Folio } from "../../lib/types";
import { downloadInvoicePdf, printInvoice } from "../print/documents";

const TENDERS = ["Cash", "Card", "UPI", "BTC"];

export function Folios() {
  const qc = useQueryClient();
  const { property } = useApp();
  const [selId, setSelId] = useState<number | null>(null);
  const [tender, setTender] = useState("Card");

  const { data: folios, isLoading } = useQuery({
    queryKey: ["folios"],
    queryFn: async () => (await api.get<Folio[]>("/folios/")).data,
  });

  useEffect(() => {
    if (folios?.length && selId === null) setSelId(folios[0].id);
  }, [folios, selId]);

  const sel = folios?.find((f) => f.id === selId) ?? null;

  const checkout = useMutation({
    mutationFn: async (folio: Folio) =>
      (await api.post(`/folios/${folio.id}/checkout/`, { tender })).data as Folio,
    onSuccess: (settled) => {
      qc.invalidateQueries({ queryKey: ["folios"] });
      downloadInvoicePdf(settled); // auto-download the GST invoice on check-out
    },
  });

  const emailInvoice = useMutation({
    mutationFn: async (id: number) => (await api.post(`/folios/${id}/email_invoice/`)).data,
    onSuccess: (d: { channel: string; to: string }) => alert(`Invoice sent via ${d.channel} to ${d.to}`),
    onError: (e: any) => alert(e?.response?.data?.detail ?? "Could not send"),
  });

  if (isLoading) return <Spinner />;
  if (!folios?.length) return <><PageHeader title="Folios" /><EmptyState title="No folios yet" hint="Check in a guest from Front Desk." /></>;

  return (
    <div>
      <PageHeader title="Guest Folios" subtitle="Charge ledger &amp; settlement" />
      <div className="grid grid-cols-[300px_1fr] gap-4">
        <div className="space-y-2">
          {folios.map((f) => (
            <button
              key={f.id}
              onClick={() => setSelId(f.id)}
              className={`w-full text-left card p-4 ${selId === f.id ? "ring-2 ring-pine" : ""}`}
            >
              <div className="flex justify-between items-center">
                <span className="font-medium">{f.guest_name}</span>
                <Badge tone={f.status === "open" ? "pine" : "muted"}>{f.status}</Badge>
              </div>
              <div className="text-sm text-muted mt-1">
                Room {f.room_number ?? "—"} · Balance {inr(f.balance)}
              </div>
            </button>
          ))}
        </div>

        {sel && (
          <Card>
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="font-display text-xl">{sel.guest_name}</div>
                <div className="text-sm text-muted">
                  Room {sel.room_number ?? "—"} {sel.invoice_no && `· ${sel.invoice_no}`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={sel.status === "open" ? "pine" : "muted"}>{sel.status}</Badge>
                <button
                  className="btn-ghost text-xs py-1"
                  onClick={() => downloadInvoicePdf(sel)}
                >
                  Invoice PDF
                </button>
                <button
                  className="btn-ghost text-xs py-1"
                  onClick={() => printInvoice(sel, property?.name ?? "Hearth", property?.gstin ?? "")}
                  title="Open print preview"
                >
                  Print
                </button>
                <button
                  className="btn-ghost text-xs py-1"
                  onClick={() => emailInvoice.mutate(sel.id)}
                >
                  Email
                </button>
              </div>
            </div>

            <table className="w-full text-sm mb-4">
              <thead className="text-muted text-xs uppercase">
                <tr>
                  <th className="text-left py-2">Charge</th>
                  <th className="text-right py-2">Taxable</th>
                  <th className="text-right py-2">GST</th>
                  <th className="text-right py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {sel.lines.map((l) => (
                  <tr key={l.id} className="border-t border-line">
                    <td className="py-2">{l.description}</td>
                    <td className="py-2 text-right">{inr(l.taxable)}</td>
                    <td className="py-2 text-right">{inr(num(l.cgst) + num(l.sgst))}</td>
                    <td className="py-2 text-right font-medium">{inr(l.total)}</td>
                  </tr>
                ))}
                {!sel.lines.length && (
                  <tr><td colSpan={4} className="py-4 text-center text-muted">No charges posted yet.</td></tr>
                )}
              </tbody>
            </table>

            <div className="flex justify-between border-t border-hairline pt-3 text-sm">
              <span className="text-muted">Charges</span><span>{inr(sel.charges_total)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Paid</span><span>{inr(sel.paid_total)}</span>
            </div>
            <div className="flex justify-between font-semibold text-lg mt-1">
              <span>Balance</span><span>{inr(sel.balance)}</span>
            </div>

            {sel.status === "open" && (
              <div className="mt-5 flex items-center gap-2">
                <select className="input w-32" value={tender} onChange={(e) => setTender(e.target.value)}>
                  {TENDERS.map((t) => <option key={t}>{t}</option>)}
                </select>
                <button className="btn-primary flex-1" disabled={checkout.isPending} onClick={() => checkout.mutate(sel)}>
                  Settle &amp; check out
                </button>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
