import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { usePrompt } from "../../design/Prompt";
import { useToast } from "../../design/Toast";
import { Badge, Card, EmptyState, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { useApp } from "../../lib/app-context";
import { money, num } from "../../lib/money";
import type { Folio, FolioLine } from "../../lib/types";
import { downloadInvoicePdf, printInvoice } from "../print/documents";

const TENDERS = ["Cash", "Card", "UPI", "BTC"];

interface Registration {
  id: number; guest_name: string; id_type: string; id_number: string;
  id_scan: string; signature: string;
}

/** Desk-side incidental: description + amount + GST slab. */
function AddChargeModal({ busy, onSave, onClose }: {
  busy: boolean;
  onSave: (b: { description: string; amount: string; gst_rate: string }) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({ description: "", amount: "", gst_rate: "18" });
  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="card p-5 w-[380px]" onClick={(e) => e.stopPropagation()}>
        <div className="font-display text-xl mb-3">Add charge</div>
        <div className="space-y-3">
          <input className="input w-full" placeholder="Description (e.g. Laundry — 3 shirts)" autoFocus
            value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <input className="input" inputMode="decimal" placeholder="Amount (pre-tax)"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^\d.]/g, "") })} />
            <select className="input" value={form.gst_rate}
              onChange={(e) => setForm({ ...form, gst_rate: e.target.value })}>
              {["0", "5", "12", "18", "28"].map((r) => <option key={r} value={r}>{r}% GST</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
          <button className="btn-primary flex-1"
            disabled={busy || !form.description.trim() || !(Number(form.amount) > 0)}
            onClick={() => onSave(form)}>
            Post charge
          </button>
        </div>
      </div>
    </div>
  );
}

/** Advance / part-payment: tender + amount (defaults to the balance) + ref. */
function RecordPaymentModal({ folio, busy, onSave, onClose }: {
  folio: Folio; busy: boolean;
  onSave: (b: { tender: string; amount: string; reference: string }) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    tender: "UPI", amount: String(Math.max(num(folio.balance), 0) || ""), reference: "",
  });
  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="card p-5 w-[380px]" onClick={(e) => e.stopPropagation()}>
        <div className="font-display text-xl mb-1">Record payment</div>
        <div className="text-sm text-muted mb-3">
          {folio.guest_name} · balance {money(folio.balance)} — a part-payment keeps the folio open.
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <select className="input" value={form.tender}
              onChange={(e) => setForm({ ...form, tender: e.target.value })}>
              {TENDERS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input className="input" inputMode="decimal" placeholder="Amount" autoFocus
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^\d.]/g, "") })} />
          </div>
          <input className="input w-full" placeholder="Reference (UPI ref / card slip — optional)"
            value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
        </div>
        <div className="flex gap-2 mt-4">
          <button className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
          <button className="btn-primary flex-1"
            disabled={busy || !(Number(form.amount) > 0)}
            onClick={() => onSave(form)}>
            Record {form.amount ? money(form.amount) : "payment"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Registration-card evidence captured at check-in (ID scan + signature).
 *  Fetched on open only — the server audit-logs every view of it. */
function RegistrationModal({ folioId, onClose }: { folioId: number; onClose: () => void }) {
  const { data: reg, isLoading } = useQuery({
    queryKey: ["registration", folioId],
    queryFn: async () => (await api.get<Registration>(`/folios/${folioId}/registration/`)).data,
  });
  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="card p-5 w-[520px] max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {isLoading || !reg ? <Spinner /> : (
          <>
            <div className="font-display text-xl mb-1">Registration — {reg.guest_name}</div>
            <div className="text-sm text-muted mb-4">{reg.id_type} · {reg.id_number || "—"}</div>
            <div className="text-xs font-semibold text-muted mb-1">ID proof</div>
            {reg.id_scan
              ? <img src={reg.id_scan} alt="ID scan" className="w-full rounded-card border border-hairline mb-4" />
              : <div className="text-sm text-muted mb-4">No scan on file.</div>}
            <div className="text-xs font-semibold text-muted mb-1">Guest signature</div>
            {reg.signature
              ? <img src={reg.signature} alt="Signature" className="w-full h-28 object-contain rounded-card border border-hairline bg-white" />
              : <div className="text-sm text-muted">No signature on file.</div>}
            <div className="text-right mt-4">
              <button className="btn-outline" onClick={onClose}>Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function Folios() {
  const qc = useQueryClient();
  const { property } = useApp();
  const toast = useToast();
  const ask = usePrompt();
  // ?sel=<id> lets Check-In's "Open folio" land on the folio it just made
  // (QA finding UXF-01 — it used to select whichever folio was listed first).
  const [params] = useSearchParams();
  const [selId, setSelId] = useState<number | null>(() => Number(params.get("sel")) || null);
  const [tender, setTender] = useState("Card");
  const [q, setQ] = useState("");
  const [showReg, setShowReg] = useState(false);
  const [moveLine, setMoveLine] = useState<FolioLine | null>(null);
  const [addingCharge, setAddingCharge] = useState(false);
  const [payingDeposit, setPayingDeposit] = useState(false);

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

  // Desk-side incidental (laundry, airport pickup…) straight onto the bill.
  const addCharge = useMutation({
    mutationFn: async (body: { description: string; amount: string; gst_rate: string }) =>
      (await api.post(`/folios/${selId}/add_charge/`, body)).data as Folio,
    onSuccess: (f) => {
      setAddingCharge(false);
      qc.invalidateQueries({ queryKey: ["folios"] });
      toast(`Charge added — balance ${money(f.balance)}`);
    },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not add the charge", "error"),
  });

  // Advance / part-payment: records the settlement, folio stays open until
  // the balance clears (then it settles itself with an invoice number).
  const recordPayment = useMutation({
    mutationFn: async (body: { tender: string; amount: string; reference: string }) =>
      (await api.post(`/folios/${selId}/settle/`, { payments: [body] })).data as Folio,
    onSuccess: (f) => {
      setPayingDeposit(false);
      qc.invalidateQueries({ queryKey: ["folios"] });
      toast(f.status === "settled"
        ? `Bill cleared · invoice ${f.invoice_no ?? ""}`.trim()
        : `Payment recorded — ${money(f.balance)} still due`);
    },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not record the payment", "error"),
  });

  // F&B/incidental charges can move to another open folio (companion's
  // dinner on the wrong room, split bills). Room nights and tax stay put.
  const transfer = useMutation({
    mutationFn: async ({ line, to }: { line: number; to: number }) =>
      (await api.post(`/folios/${selId}/transfer_charge/`, { line, to_folio: to })).data as
        { moved: number; to_folio: number; to_guest: string },
    onSuccess: (d) => {
      setMoveLine(null);
      qc.invalidateQueries({ queryKey: ["folios"] });
      toast(`Charge moved to ${d.to_guest}'s folio`);
    },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not move charge", "error"),
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
          ? `Room ${sel.room_number ?? "—"} · Balance ${money(sel.projected_balance ?? sel.balance)} · ${sel.status}`
          : "Charge ledger & settlement"}
      />
      <div className="grid grid-cols-[300px_1fr] gap-4 items-start">
        {/* The guest list scrolls inside its own box; the search stays put
            above it and the detail card on the right never moves. */}
        <div className="sticky top-4 self-start max-h-[calc(100vh-8rem)] flex flex-col">
          <input className="input w-full mb-2 shrink-0" placeholder="Search guest or room…"
            value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="space-y-2 overflow-y-auto pr-1 min-h-0">
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
                  <span className={num(f.balance) > 0 ? "text-clay font-medium" : ""}>{money(f.balance)}</span>
                </div>
              </button>
            ))}
            {!visible.length && <div className="text-sm text-muted text-center py-6">No folios match.</div>}
          </div>
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
                {(sel.has_id_scan || sel.has_signature) && (
                  <button className="btn-ghost text-xs py-1" title="ID scan & signature from check-in"
                    onClick={() => setShowReg(true)}>
                    Registration
                  </button>
                )}
                {sel.status === "open" && (
                  <>
                    <button className="btn-outline text-xs py-1"
                      title="Post a desk-side incidental (laundry, airport pickup…)"
                      onClick={() => setAddingCharge(true)}>
                      ＋ Charge
                    </button>
                    <button className="btn-outline text-xs py-1"
                      title="Record an advance / part-payment without checking out"
                      onClick={() => setPayingDeposit(true)}>
                      ₹ Payment
                    </button>
                  </>
                )}
              </div>
            </div>
            {showReg && <RegistrationModal folioId={sel.id} onClose={() => setShowReg(false)} />}
            {addingCharge && (
              <AddChargeModal busy={addCharge.isPending}
                onSave={(b) => addCharge.mutate(b)}
                onClose={() => setAddingCharge(false)} />
            )}
            {payingDeposit && (
              <RecordPaymentModal folio={sel} busy={recordPayment.isPending}
                onSave={(b) => recordPayment.mutate(b)}
                onClose={() => setPayingDeposit(false)} />
            )}
            {moveLine && (
              <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50"
                onClick={() => setMoveLine(null)}>
                <div className="card p-5 w-[440px] max-h-[80vh] overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}>
                  <div className="font-display text-xl mb-1">Move charge</div>
                  <div className="text-sm text-muted mb-4">
                    {moveLine.description} · {money(moveLine.total)} — pick the folio it belongs on.
                  </div>
                  <div className="space-y-2">
                    {folios.filter((f) => f.status === "open" && f.id !== sel.id).map((f) => (
                      <button key={f.id}
                        className="card p-3 w-full text-left hover:bg-cream flex justify-between items-center"
                        disabled={transfer.isPending}
                        onClick={() => transfer.mutate({ line: moveLine.id, to: f.id })}>
                        <span>
                          <span className="font-medium">{f.guest_name}</span>
                          <span className="text-muted text-sm"> · Room {f.room_number ?? "—"}</span>
                        </span>
                        <span className="text-sm text-muted">{money(f.balance)}</span>
                      </button>
                    ))}
                  </div>
                  <div className="text-right mt-4">
                    <button className="btn-outline" onClick={() => setMoveLine(null)}>Cancel</button>
                  </div>
                </div>
              </div>
            )}

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
                {sel.lines.map((l) => {
                  const movable = sel.status === "open"
                    && l.kind !== "room" && l.kind !== "tax"
                    && folios.some((f) => f.status === "open" && f.id !== sel.id);
                  return (
                    <tr key={l.id} className="border-t border-line group">
                      <td className="py-2">
                        {l.description}
                        {movable && (
                          <button
                            className="ml-2 text-xs text-muted underline opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Move this charge to another open folio"
                            onClick={() => setMoveLine(l)}>
                            Move
                          </button>
                        )}
                      </td>
                      <td className="py-2 text-right">{money(l.taxable)}</td>
                      <td className="py-2 text-right">{money(num(l.cgst) + num(l.sgst))}</td>
                      <td className="py-2 text-right font-medium">{money(l.total)}</td>
                    </tr>
                  );
                })}
                {sel.pending_charges?.map((c) => (
                  <tr key={c.description} className="border-t border-line text-muted">
                    <td className="py-2">{c.description}</td>
                    <td className="py-2 text-right">—</td>
                    <td className="py-2 text-right">—</td>
                    <td className="py-2 text-right font-medium">{money(c.total)}</td>
                  </tr>
                ))}
                {!sel.lines.length && !sel.pending_charges?.length && (
                  <tr><td colSpan={4} className="py-4 text-center text-muted">No charges posted yet.</td></tr>
                )}
              </tbody>
            </table>

            <div className="flex justify-between border-t border-hairline pt-3 text-sm">
              <span className="text-muted">Charges</span><span>{money(sel.charges_total)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Paid</span><span>{money(sel.paid_total)}</span>
            </div>
            <div className="flex justify-between font-semibold text-lg mt-1">
              <span>Balance</span>
              <span className={num(sel.balance) > 0 ? "text-clay" : "text-pine"}>{money(sel.balance)}</span>
            </div>

            {sel.status === "open" && sel.routing === "city_ledger" && (
              <div className="mt-5">
                <div className="text-sm text-muted mb-2">
                  Bill-to-company — no payment collected at the desk. The {money(sel.balance)} balance
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
                      message: `Post the ${money(sel.balance)} balance to ${sel.company_name || "the company"}'s city-ledger account and check out ${sel.guest_name}? No payment is collected now.`,
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
                        ? `Settle the ${money(sel.balance)} balance via ${tender} and check out ${sel.guest_name}?`
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
