import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useToast } from "../../design/Toast";
import { Badge, Card, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { inr } from "../../lib/money";

interface PoLine { ingredient: string; qty: string; rate: string; received_qty: string }
interface Po { id: number; supplier: string; status: string; total: string; lines: PoLine[] }
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
  const [msg, setMsg] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
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
  const receive = useMutation({
    mutationFn: async (po: Po) => (await api.post(`/purchase-orders/${po.id}/receive/`)).data,
    onSuccess: (_d, po) => {
      setMsg(`Goods received against PO #${po.id} — stock & purchase rates updated`);
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

      {creating && (
        <NewPoModal
          prefillLow={prefillLow}
          onDone={(id) => {
            setCreating(false);
            if (prefillLow) setParams({});
            setMsg(`PO #${id} raised — awaiting approval`);
            qc.invalidateQueries({ queryKey: ["pos"] });
          }}
          onCancel={() => { setCreating(false); if (prefillLow) setParams({}); }}
        />
      )}

      <div className="space-y-3">
        {pos.map((po) => (
          <Card key={po.id}>
            <div className="flex items-center gap-3">
              <div className="font-semibold">PO #{po.id}</div>
              <span className="text-sm text-muted">{po.supplier}</span>
              <Badge tone={TONE[po.status] ?? "muted"}>{po.status}</Badge>
              <div className="ml-auto font-medium">{inr(po.total)}</div>
              {po.status === "pending" && (
                <button className="btn-outline" onClick={() => approve.mutate(po)}>Approve</button>
              )}
              {po.status === "approved" && (
                <button className="btn-primary" onClick={() => receive.mutate(po)}>Receive (GRN)</button>
              )}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1 text-sm pl-1">
              {po.lines.map((l, i) => (
                <div key={i} className="flex justify-between border-b border-line py-1">
                  <span>{l.ingredient}</span>
                  <span className="text-muted">{Number(l.qty)} × {inr(l.rate)}</span>
                </div>
              ))}
            </div>
          </Card>
        ))}
        {!pos.length && (
          <Card><div className="text-sm text-muted text-center py-6">
            No purchase orders yet — raise one to bring stock in.
          </div></Card>
        )}
      </div>
    </div>
  );
}

interface DraftLine { ingredient: number | null; qty: string; rate: string }
const EMPTY: DraftLine = { ingredient: null, qty: "", rate: "" };

function NewPoModal({ prefillLow, onDone, onCancel }: {
  prefillLow?: boolean; onDone: (id: number) => void; onCancel: () => void;
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
    onSuccess: (d: { id: number }) => onDone(d.id),
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
          <span>Raw material</span><span>Qty</span><span>Rate ₹</span><span></span>
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
          <div className="font-semibold text-sm">Total {inr(total)}</div>
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
