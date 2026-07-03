import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { usePrompt } from "../../design/Prompt";
import { useToast } from "../../design/Toast";
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
  const toast = useToast();
  const ask = usePrompt();
  const [selId, setSelId] = useState<number | null>(null);
  const [tender, setTender] = useState("Card");
  const [q, setQ] = useState("");

  const { data: folios, isLoading } = useQuery({
    queryKey: ["folios"],
    queryFn: async () => (await api.get<Folio[]>("/folios/")).data,
  });

  useEffect(() => {
    if (folios?.length && selId === null) setSelId(folios[0].id);
  }, [folios, selId]);

  const sel = folios?.find((f) => f.id === selId) ?? null;

  // Clicking a guest far down the list jumps the view back up to the details
  // (the app shell scrolls inside <main>, not the window).
  const detailRef = useRef<HTMLDivElement>(null);
  function select(id: number) {
    setSelId(id);
    requestAnimationFrame(() => {
      const scroller = detailRef.current?.closest("main");
      if (scroller) scroller.scrollTo({ top: 0, behavior: "smooth" });
      else window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  const checkout = useMutation({
    mutationFn: async (folio: Folio) =>
      (await api.post(`/folios/${folio.id}/checkout/`, { tender })).data as Folio,
    onSuccess: (settled) => {
      qc.invalidateQueries({ queryKey: ["folios"] });
      toast(`${settled.guest_name} checked out · invoice ${settled.invoice_no ?? ""}`.trim());
      downloadInvoicePdf(settled); // auto-download the GST invoice on check-out
    },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Check-out failed", "error"),
  });

  const emailInvoice = useMutation({
    mutationFn: async (id: number) => (await api.post(`/folios/${id}/email_invoice/`)).data,
    onSuccess: (d: { channel: string; to: string }) => toast(`Invoice sent via ${d.channel} to ${d.to}`),
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not send", "error"),
  });

  // Room bill with or without GST (BRD 5.23): switching recomputes the lines.
  const billingMode = useMutation({
    mutationFn: async ({ id, mode }: { id: number; mode: string }) =>
      (await api.post(`/folios/${id}/billing_mode/`, { mode })).data,
    onSuccess: (f: Folio) => {
      toast(f.effective_billing_mode === "with_gst"
        ? "Bill switched to GST tax invoice"
        : "Room switched to bill of supply — food keeps GST");
      qc.invalidateQueries({ queryKey: ["folios"] });
    },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not switch", "error"),
  });

  if (isLoading) return <Spinner />;
  if (!folios?.length) return <><PageHeader title="Folios" /><EmptyState title="No folios yet" hint="Check in a guest from Front Desk." /></>;

  const needle = q.trim().toLowerCase();
  const matches = folios.filter((f) =>
    !needle || f.guest_name.toLowerCase().includes(needle) || (f.room_number ?? "").toLowerCase().includes(needle));
  // The selected guest is pinned to the top of the list.
  const visible = [...matches.filter((f) => f.id === selId),
                   ...matches.filter((f) => f.id !== selId)];

  return (
    <div>
      <PageHeader
        title={sel ? `Guest Folios — ${sel.guest_name}` : "Guest Folios"}
        subtitle={sel
          ? `Room ${sel.room_number ?? "—"} · Balance ${inr(sel.projected_balance ?? sel.balance)} · ${sel.status}`
          : "Charge ledger & settlement"}
      />
      <div className="grid grid-cols-[300px_1fr] gap-4">
        <div className="space-y-2">
          <input className="input w-full mb-1" placeholder="Search guest or room…" value={q} onChange={(e) => setQ(e.target.value)} />
          {visible.map((f) => (
            <button
              key={f.id}
              onClick={() => select(f.id)}
              className={`w-full text-left card p-4 ${selId === f.id ? "ring-2 ring-pine" : ""}`}
            >
              <div className="flex justify-between items-center">
                <span className="font-medium">{f.guest_name}</span>
                <Badge tone={f.status === "open" ? "pine" : "muted"}>{f.status}</Badge>
              </div>
              <div className="text-sm text-muted mt-1">
                Room {f.room_number ?? "—"} · Balance{" "}
                <span className={num(f.balance) > 0 ? "text-clay font-medium" : ""}>{inr(f.balance)}</span>
              </div>
            </button>
          ))}
          {!visible.length && <div className="text-sm text-muted text-center py-6">No folios match.</div>}
        </div>

        {sel && (
          // Sticky keeps the card in view while scrolling; scroll-mt keeps the
          // jump-to-details from tucking the name under the shell header.
          <div ref={detailRef}
            className="sticky top-4 self-start max-h-[calc(100vh-2rem)] overflow-y-auto scroll-mt-4">
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
                  {sel.effective_billing_mode === "with_gst" ? "With GST" : "Without GST"}
                </button>
                <button
                  className="btn-ghost text-xs py-1"
                  onClick={() => downloadInvoicePdf(sel)}
                >
                  {sel.effective_billing_mode === "with_gst" ? "Invoice PDF" : "Bill PDF"}
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
                  disabled={emailInvoice.isPending}
                  onClick={() => emailInvoice.mutate(sel.id)}
                >
                  {emailInvoice.isPending ? "Sending…" : "Email"}
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
                {sel.pending_charges?.map((c) => (
                  <tr key={c.description} className="border-t border-line text-muted">
                    <td className="py-2">{c.description}</td>
                    <td className="py-2 text-right">—</td>
                    <td className="py-2 text-right">—</td>
                    <td className="py-2 text-right font-medium">{inr(c.total)}</td>
                  </tr>
                ))}
                {!sel.lines.length && !sel.pending_charges?.length && (
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
              <span>Balance</span>
              <span className={num(sel.balance) > 0 ? "text-clay" : "text-pine"}>{inr(sel.balance)}</span>
            </div>

            {sel.status === "open" && sel.routing === "city_ledger" && (
              <div className="mt-5">
                <div className="text-sm text-muted mb-2">
                  Bill-to-company — no payment collected at the desk. The {inr(sel.balance)} balance
                  posts to <span className="font-medium text-body">{sel.company_name || "the company"}</span>'s
                  account and is settled later from Guest CRM.
                </div>
                <button
                  className="btn-primary w-full"
                  disabled={checkout.isPending}
                  onClick={async () => {
                    const ok = await ask({
                      title: "Bill to company & check out",
                      confirm: true,
                      confirmLabel: "Check out (BTC)",
                      message: `Post the ${inr(sel.balance)} balance to ${sel.company_name || "the company"}'s city-ledger account and check out ${sel.guest_name}? No payment is collected now.`,
                    });
                    if (ok) checkout.mutate(sel);
                  }}
                >
                  {checkout.isPending ? "Checking out…" : "Bill to company & check out"}
                </button>
              </div>
            )}

            {sel.status === "open" && sel.routing !== "city_ledger" && (
              <div className="mt-5 flex items-center gap-2">
                <select className="input w-32" value={tender} onChange={(e) => setTender(e.target.value)}>
                  {TENDERS.map((t) => <option key={t}>{t}</option>)}
                </select>
                <button
                  className="btn-primary flex-1"
                  disabled={checkout.isPending}
                  onClick={async () => {
                    const bal = num(sel.balance);
                    const ok = await ask({
                      title: "Settle & check out",
                      confirm: true,
                      confirmLabel: "Check out",
                      message: bal > 0
                        ? `Settle the ${inr(sel.balance)} balance via ${tender} and check out ${sel.guest_name}?`
                        : `Check out ${sel.guest_name}? The folio is already settled.`,
                    });
                    if (ok) checkout.mutate(sel);
                  }}
                >
                  {checkout.isPending ? "Checking out…" : "Settle & check out"}
                </button>
              </div>
            )}
          </Card>
          </div>
        )}
      </div>

    </div>
  );
}
