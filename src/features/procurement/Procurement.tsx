import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useToast } from "../../design/Toast";
import { Badge, Card, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { useApp } from "../../lib/app-context";
import { currencySymbol, money } from "../../lib/money";

interface PoLine { id: number; ingredient: string; qty: string; rate: string; received_qty: string }
interface Grn { id: number; grn_no: string; has_bill: boolean }
interface Po {
  id: number; po_no: string; supplier: string; status: string; total: string;
  requested_by: string; lines: PoLine[]; grns: Grn[];
}
interface SupplierOpt { id: number; name: string }
interface IngredientOpt {
  id: number; name: string; unit: string; unit_cost: string; below_par: boolean;
  current_stock: string; reorder_level: string;
}

const TONE: Record<string, "info" | "amber" | "pine"> = {
  pending: "amber",
  approved: "info",
  received: "pine",
};

export function Procurement() {
  const qc = useQueryClient();
  const { user } = useApp();
  const [msg, setMsg] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showReceived, setShowReceived] = useState(false);
  // Arriving from Low Stock: open the PO form pre-filled with the shortfalls.
  const [params, setParams] = useSearchParams();
  const prefillLow = params.get("prefill") === "low";
  useEffect(() => { if (prefillLow) setCreating(true); }, [prefillLow]);

  const { data: pos, isLoading } = useQuery({
    queryKey: ["pos"],
    queryFn: async () => (await api.get<Po[]>("/purchase-orders/")).data,
  });
  // Live below-par count, right here — no need to go through Inventory first.
  const { data: lowStock } = useQuery({
    queryKey: ["ingredients-low"],
    queryFn: async () => (await api.get<IngredientOpt[]>("/inventory/?below_par=1")).data,
    refetchInterval: 30000,
  });
  const lowCount = lowStock?.length ?? 0;

  const approve = useMutation({
    mutationFn: async (po: Po) => (await api.post(`/purchase-orders/${po.id}/approve/`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pos"] }),
  });
  const [receiving, setReceiving] = useState<Po | null>(null);
  const [viewBill, setViewBill] = useState<Grn | null>(null);
  const receive = useMutation({
    mutationFn: async ({ po, lines, note, bill }: {
      po: Po; lines: { line: number; qty: string }[]; note: string; bill: string;
    }) => (await api.post(`/purchase-orders/${po.id}/receive/`,
      { lines, note, bill_image: bill })).data as Po,
    onSuccess: (updated, { po }) => {
      setReceiving(null);
      setMsg(updated.status === "received"
        ? `Goods received against ${po.po_no || `PO #${po.id}`} — stock & purchase rates updated`
        : `Partial delivery booked against ${po.po_no || `PO #${po.id}`} — the remainder stays outstanding`);
      qc.invalidateQueries({ queryKey: ["pos"] });
      qc.invalidateQueries({ queryKey: ["ingredients"] });
      qc.invalidateQueries({ queryKey: ["ingredients-low"] });
    },
  });

  if (isLoading || !pos) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Procurement"
        subtitle="Purchase orders &amp; goods receipt — receiving posts stock automatically"
        action={
          <div className="flex items-center gap-2">
            {lowCount > 0 ? (
              <button className="btn-outline text-sm border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100"
                onClick={() => setParams({ prefill: "low" })}>
                ⚠ Suggest reorder ({lowCount})
              </button>
            ) : (
              <span className="text-xs text-muted">✓ Stock levels OK</span>
            )}
            <button className="btn-primary text-sm" onClick={() => setCreating(true)}>
              + New purchase order
            </button>
          </div>
        }
      />
      {msg && <div className="card p-3 mb-4 bg-pine-50 text-pine font-medium">{msg}</div>}

      {receiving && (
        <ReceiveModal po={receiving} busy={receive.isPending}
          onConfirm={(lines, note, bill) => receive.mutate({ po: receiving, lines, note, bill })}
          onCancel={() => setReceiving(null)} />
      )}
      {viewBill && <BillModal grn={viewBill} onClose={() => setViewBill(null)} />}

      {creating && (
        <NewPoModal
          prefillLow={prefillLow}
          onDone={(id, po_no, status) => {
            setCreating(false);
            if (prefillLow) setParams({});
            setMsg(status === "approved"
              ? `${po_no || `PO #${id}`} raised & approved — receive when the goods arrive`
              : `${po_no || `PO #${id}`} raised — awaiting approval`);
            qc.invalidateQueries({ queryKey: ["pos"] });
          }}
          onCancel={() => { setCreating(false); if (prefillLow) setParams({}); }}
        />
      )}

      {(() => {
        // Actionable POs first (receive, then approve — newest first inside
        // each); the received pile stays collapsed so the list is readable.
        const open = [...pos.filter((p) => p.status !== "received")]
          .sort((a, b) => (a.status === b.status ? b.id - a.id : a.status === "approved" ? -1 : 1));
        const received = [...pos.filter((p) => p.status === "received")].sort((a, b) => b.id - a.id);
        const card = (po: Po) => {
          const own = po.requested_by === user?.username;
          return (
            <Card key={po.id}>
              <div className="flex items-center gap-3">
                <div className="font-semibold">{po.po_no || `PO #${po.id}`}</div>
                <span className="text-sm text-muted">{po.supplier}</span>
                <Badge tone={TONE[po.status] ?? "muted"}>{po.status}</Badge>
                {po.requested_by && (
                  <span className="text-xs text-muted">by {po.requested_by}</span>
                )}
                <div className="ml-auto font-medium">{money(po.total)}</div>
                {po.status === "pending" && (own ? (
                  <span className="text-xs text-muted italic"
                    title="You raised this PO — segregation of duties">
                    awaiting another approver
                  </span>
                ) : (
                  <button className="btn-outline" onClick={() => approve.mutate(po)}>Approve</button>
                ))}
                {po.status === "approved" && (
                  <button className="btn-primary" onClick={() => setReceiving(po)}>Receive (GRN)</button>
                )}
              </div>
              {po.grns?.some((g) => g.has_bill) && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {po.grns.filter((g) => g.has_bill).map((g) => (
                    <button key={g.id} className="pill bg-hairline text-body text-xs"
                      title="View the supplier bill photo"
                      onClick={() => setViewBill(g)}>
                      🧾 {g.grn_no || `GRN #${g.id}`}
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1 text-sm pl-1">
                {po.lines.map((l, i) => (
                  <div key={i} className="flex justify-between border-b border-line py-1">
                    <span>{l.ingredient}</span>
                    <span className="text-muted">
                      {Number(l.qty)} × {money(l.rate)}
                      {Number(l.received_qty) > 0 && Number(l.received_qty) < Number(l.qty) && (
                        <span className="ml-2 text-amber-600">· {Number(l.received_qty)} received</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          );
        };
        return (
          <div className="space-y-3">
            {open.map(card)}
            {!open.length && (
              <Card><div className="text-sm text-muted text-center py-6">
                {pos.length ? "Nothing needs action — every PO is received."
                  : "No purchase orders yet — raise one to bring stock in."}
              </div></Card>
            )}
            {received.length > 0 && (
              <button className="w-full text-left card p-4 hover:bg-cream flex items-center justify-between"
                onClick={() => setShowReceived(!showReceived)}>
                <span className="font-semibold">Received ({received.length})</span>
                <span className="text-muted text-sm">{showReceived ? "Hide ▲" : "Show ▼"}</span>
              </button>
            )}
            {showReceived && received.map(card)}
          </div>
        );
      })()}
    </div>
  );
}

/** Goods receipt with per-line quantities: defaults to the full outstanding
 *  amount (the common case), editable down for short deliveries — the PO
 *  stays open for the remainder and a later GRN closes it. */
function ReceiveModal({ po, busy, onConfirm, onCancel }: {
  po: Po; busy: boolean;
  onConfirm: (lines: { line: number; qty: string }[], note: string, bill: string) => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const outstanding = (l: PoLine) => Math.max(Number(l.qty) - Number(l.received_qty), 0);
  const [qtys, setQtys] = useState<Record<number, string>>(() =>
    Object.fromEntries(po.lines.map((l) => [l.id, String(outstanding(l))])));
  const [note, setNote] = useState("");
  const [bill, setBill] = useState("");

  function pickBill(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("The bill must be a photo/image file", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result ?? "");
      if (url.length > 800_000) {
        toast("That photo is too large — retake at a smaller size", "error");
        return;
      }
      setBill(url);
    };
    reader.readAsDataURL(file);
  }
  const anyShort = po.lines.some((l) => Number(qtys[l.id] || 0) < outstanding(l));
  const invalid = po.lines.some((l) => {
    const q = Number(qtys[l.id]);
    return Number.isNaN(q) || q < 0 || q > outstanding(l);
  });
  const nothing = po.lines.every((l) => Number(qtys[l.id] || 0) === 0);

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="card p-5 w-[520px] max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="font-display text-xl mb-1">
          Receive goods — {po.po_no || `PO #${po.id}`}
        </div>
        <div className="text-sm text-muted mb-4">
          Enter what actually arrived. Anything short stays outstanding on the PO.
        </div>
        <div className="grid grid-cols-[1fr_110px_110px] gap-2 text-xs text-muted uppercase tracking-wide mb-1 px-1">
          <span>Material</span><span className="text-right">Outstanding</span><span>Received</span>
        </div>
        <div className="space-y-2">
          {po.lines.map((l) => (
            <div key={l.id} className="grid grid-cols-[1fr_110px_110px] gap-2 items-center">
              <span className="text-sm">{l.ingredient}</span>
              <span className="text-sm text-muted text-right">{outstanding(l)}</span>
              <input className="input" inputMode="decimal" value={qtys[l.id] ?? ""}
                disabled={outstanding(l) === 0}
                onChange={(e) => setQtys({ ...qtys, [l.id]: e.target.value })} />
            </div>
          ))}
        </div>
        <input className="input mt-3" placeholder="Note (optional — e.g. 2 kg rejected, damaged)"
          value={note} onChange={(e) => setNote(e.target.value)} />

        {/* Photo of the supplier's bill/challan, stored on the GRN */}
        <div className="mt-3 flex items-center gap-3">
          <label className="btn-outline text-xs cursor-pointer">
            {bill ? "Retake bill photo" : "📷 Attach bill photo"}
            <input type="file" accept="image/*" capture="environment" className="hidden"
              onChange={(e) => pickBill(e.target.files?.[0])} />
          </label>
          {bill && (
            <>
              <img src={bill} alt="Supplier bill"
                className="h-12 rounded border border-hairline object-cover" />
              <button className="btn-ghost text-xs text-clay" onClick={() => setBill("")}>Remove</button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 mt-4">
          {anyShort && !invalid && !nothing && (
            <span className="text-xs text-amber-600">Partial delivery — PO stays open</span>
          )}
          <div className="flex-1" />
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn-primary" disabled={busy || invalid || nothing}
            onClick={() => onConfirm(
              po.lines.filter((l) => outstanding(l) > 0)
                .map((l) => ({ line: l.id, qty: qtys[l.id] || "0" })),
              note, bill)}>
            Book receipt
          </button>
        </div>
      </div>
    </div>
  );
}

/** The supplier-bill photo attached at receipt, fetched on demand. */
function BillModal({ grn, onClose }: { grn: Grn; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["grn-bill", grn.id],
    queryFn: async () =>
      (await api.get<{ grn_no: string; bill_image: string }>(`/goods-receipts/${grn.id}/bill/`)).data,
  });
  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="card p-5 w-[560px] max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="font-display text-xl mb-3">
          Supplier bill — {grn.grn_no || `GRN #${grn.id}`}
        </div>
        {isLoading || !data
          ? <Spinner />
          : <img src={data.bill_image} alt="Supplier bill"
              className="w-full rounded-card border border-hairline" />}
        <div className="text-right mt-4">
          <button className="btn-outline" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

interface DraftLine { ingredient: number | null; qty: string; rate: string }
const EMPTY: DraftLine = { ingredient: null, qty: "", rate: "" };

function NewPoModal({ prefillLow, onDone, onCancel }: {
  prefillLow?: boolean; onDone: (id: number, po_no?: string, status?: string) => void; onCancel: () => void;
}) {
  const toast = useToast();
  const [supplier, setSupplier] = useState<number | null>(null);
  const [lines, setLines] = useState<DraftLine[]>([{ ...EMPTY }]);

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => (await api.get<SupplierOpt[]>("/suppliers/")).data,
  });
  const { data: materials } = useQuery({
    queryKey: ["ingredients"],
    queryFn: async () => (await api.get<IngredientOpt[]>("/inventory/")).data,
  });
  const byId = new Map((materials ?? []).map((m) => [m.id, m]));

  // Low-stock prefill: every below-par material with its shortfall quantity.
  useEffect(() => {
    if (!prefillLow || !materials) return;
    const low = materials.filter((m) => m.below_par);
    if (low.length) {
      setLines(low.map((m) => ({
        ingredient: m.id,
        qty: String(Math.max(Number(m.reorder_level) - Number(m.current_stock), 0)),
        rate: m.unit_cost,
      })));
    }
  }, [prefillLow, materials]); // eslint-disable-line react-hooks/exhaustive-deps

  const setLine = (i: number, patch: Partial<DraftLine>) =>
    setLines(lines.map((l, ix) => (ix === i ? { ...l, ...patch } : l)));

  const valid = lines.filter((l) => l.ingredient && Number(l.qty) > 0);
  const total = valid.reduce((s, l) => {
    const m = byId.get(l.ingredient!);
    return s + Number(l.qty) * Number(l.rate || m?.unit_cost || 0);
  }, 0);

  const save = useMutation({
    mutationFn: async () => (await api.post("/purchase-orders/", {
      supplier,
      lines: valid.map((l) => ({ ingredient: l.ingredient, qty: l.qty, rate: l.rate || undefined })),
    })).data,
    onSuccess: (d: { id: number; po_no?: string; status?: string }) => onDone(d.id, d.po_no, d.status),
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not raise the PO", "error"),
  });

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="card p-5 w-[560px] max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="font-display text-xl mb-1">New purchase order</div>
        <div className="text-sm text-muted mb-3">
          On goods receipt the stock and purchase rates update automatically.
        </div>
        <select className="input mb-3" value={supplier ?? ""}
          onChange={(e) => setSupplier(Number(e.target.value) || null)}>
          <option value="">Supplier…</option>
          {suppliers?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div className="grid grid-cols-[1fr_90px_110px_32px] gap-2 text-xs text-muted uppercase tracking-wide mb-1 px-1">
          <span>Raw material</span><span>Qty</span><span>Rate {currencySymbol()}</span><span></span>
        </div>
        <div className="space-y-2 overflow-y-auto flex-1">
          {lines.map((l, i) => {
            const m = l.ingredient ? byId.get(l.ingredient) : undefined;
            return (
              <div key={i} className="grid grid-cols-[1fr_90px_110px_32px] gap-2 items-center">
                <select className="input" value={l.ingredient ?? ""}
                  onChange={(e) => {
                    const mat = byId.get(Number(e.target.value));
                    setLine(i, { ingredient: mat?.id ?? null, rate: l.rate || (mat?.unit_cost ?? "") });
                  }}>
                  <option value="">Pick a material…</option>
                  {materials?.map((mat) => (
                    <option key={mat.id} value={mat.id}>
                      {mat.name}{mat.below_par ? " ⚠ low" : ""}
                    </option>
                  ))}
                </select>
                <input className="input" inputMode="decimal" placeholder={m ? m.unit : "Qty"}
                  value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} />
                <input className="input" inputMode="decimal" placeholder="Rate"
                  value={l.rate} onChange={(e) => setLine(i, { rate: e.target.value })} />
                <button className="btn-ghost text-clay text-sm"
                  onClick={() => setLines(lines.length > 1 ? lines.filter((_, ix) => ix !== i) : [{ ...EMPTY }])}>
                  ✕
                </button>
              </div>
            );
          })}
        </div>
        <button className="btn-outline text-xs mt-2" onClick={() => setLines([...lines, { ...EMPTY }])}>
          ＋ Add line
        </button>
        <div className="flex items-center gap-2 mt-4">
          <div className="font-semibold text-sm">Total {money(total)}</div>
          <div className="flex-1" />
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn-primary" disabled={!supplier || !valid.length || save.isPending}
            onClick={() => save.mutate()}>
            Raise PO
          </button>
        </div>
      </div>
    </div>
  );
}
