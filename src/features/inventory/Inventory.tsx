import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Badge, PageHeader, Spinner, Stat } from "../../design/ui";
import { api } from "../../lib/api";
import { useToast } from "../../design/Toast";
import { inr } from "../../lib/money";

interface Ingredient {
  id: number; code: string; name: string; unit: string; category: string;
  current_stock: string; min_stock_level: string; reorder_level: string;
  unit_cost: string; storage_location: string; expiry_date: string | null;
  below_par: boolean; below_min: boolean;
}
interface Movement {
  id: number; ingredient: number; ingredient_name: string; unit: string;
  kind: string; kind_label: string; qty: string; balance: string;
  reason: string; source: string; created_by: string; created_at: string;
}
interface ConsumptionRow {
  ingredient: string; code: string; unit: string; consumed: string;
  wasted: string; purchased: string; consumption_cost: string; in_stock: string;
}

type Tab = "materials" | "movements" | "consumption" | "expiry";
const TABS: { key: Tab; label: string }[] = [
  { key: "materials", label: "Raw materials" },
  { key: "movements", label: "Movements register" },
  { key: "consumption", label: "Consumption report" },
  { key: "expiry", label: "Expiry tracking" },
];

const UNITS = ["kg", "g", "l", "ml", "pc", "pkt"];
const CATEGORIES = ["Vegetables", "Meat / Seafood", "Dairy", "Spices", "Beverages",
  "Packaging Materials", "Cleaning Materials", "Other Consumables"];
const MOVE_KINDS = [
  ["", "All"], ["receipt", "Purchase Receipt"], ["consumption", "Recipe Consumption"],
  ["wastage", "Wastage"], ["transfer", "Stock Transfer"], ["adjustment", "Adjustment"],
  ["count", "Physical Count"], ["return", "Return"], ["expiry", "Expiry / Damage"],
];

export function Inventory() {
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("materials");
  const [onlyLow, setOnlyLow] = useState(false);
  const [q, setQ] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [action, setAction] = useState<{ kind: "adjust" | "waste" | "count"; ing: Ingredient } | null>(null);
  const [moveKind, setMoveKind] = useState("");
  const [days, setDays] = useState(30);

  const { data, isLoading } = useQuery({
    queryKey: ["ingredients"],
    queryFn: async () => (await api.get<Ingredient[]>("/inventory/")).data,
  });
  const { data: moves } = useQuery({
    queryKey: ["inv-moves", moveKind],
    queryFn: async () => (await api.get<Movement[]>(`/inventory/movements/?days=90${moveKind ? `&kind=${moveKind}` : ""}`)).data,
    enabled: tab === "movements",
  });
  const { data: consumption } = useQuery({
    queryKey: ["inv-consumption", days],
    queryFn: async () => (await api.get<{ rows: ConsumptionRow[] }>(`/inventory/consumption_report/?days=${days}`)).data,
    enabled: tab === "consumption",
  });
  const { data: expiring } = useQuery({
    queryKey: ["inv-expiring"],
    queryFn: async () => (await api.get<Ingredient[]>("/inventory/expiring/?days=30")).data,
    enabled: tab === "expiry",
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ["ingredients"] });
    qc.invalidateQueries({ queryKey: ["inv-moves"] });
    qc.invalidateQueries({ queryKey: ["inv-consumption"] });
    qc.invalidateQueries({ queryKey: ["inv-expiring"] });
  }

  if (isLoading || !data) return <Spinner />;
  const low = data.filter((i) => i.below_par);
  const rows = (onlyLow ? low : data).filter((i) =>
    !q || i.name.toLowerCase().includes(q.toLowerCase()) || i.code.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <PageHeader
        title="Inventory & Stock"
        subtitle="Raw materials · consumption auto-deducts from recipes on KOT"
        action={tab === "materials" ? (
          <div className="flex items-center gap-2">
            <input className="input w-48" placeholder="Search name or code…" value={q} onChange={(e) => setQ(e.target.value)} />
            <button
              className={`pill border ${onlyLow ? "bg-amber text-white border-amber" : "border-hairline"}`}
              onClick={() => setOnlyLow((v) => !v)}
            >
              Below par ({low.length})
            </button>
            <button className="btn-primary text-sm" onClick={() => setShowAdd(true)}>+ Raw material</button>
          </div>
        ) : undefined}
      />

      <div className="flex gap-2 mb-4">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`pill ${tab === t.key ? "bg-ink text-white" : "bg-hairline text-body"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "materials" && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <Stat tone="dark" label="Materials tracked" value={data.length} />
            <Stat label="Below reorder level" value={low.length} />
            <Stat label="Stock value" value={inr(data.reduce((s, i) => s + Number(i.current_stock) * Number(i.unit_cost), 0))} />
          </div>
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-cream text-muted text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3">Code</th>
                  <th className="text-left px-4 py-3">Material</th>
                  <th className="text-left px-4 py-3">Category</th>
                  <th className="text-right px-4 py-3">In stock</th>
                  <th className="text-right px-4 py-3">Min / Reorder</th>
                  <th className="text-right px-4 py-3">Rate</th>
                  <th className="text-left px-4 py-3">Location</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((i) => (
                  <tr key={i.id} className="border-t border-line">
                    <td className="px-4 py-3 text-xs text-muted font-mono">{i.code}</td>
                    <td className="px-4 py-3 font-medium">{i.name}</td>
                    <td className="px-4 py-3 text-muted text-xs">{i.category || "—"}</td>
                    <td className="px-4 py-3 text-right">{Number(i.current_stock)} {i.unit}</td>
                    <td className="px-4 py-3 text-right text-muted">{Number(i.min_stock_level)} / {Number(i.reorder_level)}</td>
                    <td className="px-4 py-3 text-right">{inr(i.unit_cost)}</td>
                    <td className="px-4 py-3 text-muted text-xs">{i.storage_location || "—"}</td>
                    <td className="px-4 py-3">
                      {i.below_min ? <Badge tone="clay">Critical</Badge>
                        : i.below_par ? <Badge tone="amber">Reorder</Badge>
                          : <Badge tone="pine">OK</Badge>}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button className="btn-ghost text-xs" onClick={() => setAction({ kind: "adjust", ing: i })}>Adjust</button>
                      <button className="btn-ghost text-xs text-clay" onClick={() => setAction({ kind: "waste", ing: i })}>Waste</button>
                      <button className="btn-ghost text-xs" onClick={() => setAction({ kind: "count", ing: i })}>Count</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "movements" && (
        <>
          <div className="flex gap-2 mb-3 flex-wrap">
            {MOVE_KINDS.map(([k, label]) => (
              <button key={k} onClick={() => setMoveKind(k)}
                className={`pill text-xs ${moveKind === k ? "bg-ink text-white" : "bg-hairline text-body"}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-cream text-muted text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3">Date / time</th>
                  <th className="text-left px-4 py-3">Material</th>
                  <th className="text-left px-4 py-3">Type</th>
                  <th className="text-right px-4 py-3">In</th>
                  <th className="text-right px-4 py-3">Out</th>
                  <th className="text-right px-4 py-3">Balance</th>
                  <th className="text-left px-4 py-3">Reference</th>
                  <th className="text-left px-4 py-3">By</th>
                </tr>
              </thead>
              <tbody>
                {moves?.map((m) => (
                  <tr key={m.id} className="border-t border-line">
                    <td className="px-4 py-2.5 text-xs text-muted">{new Date(m.created_at).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-2.5 font-medium">{m.ingredient_name}</td>
                    <td className="px-4 py-2.5"><Badge tone={Number(m.qty) >= 0 ? "pine" : "amber"}>{m.kind_label}</Badge></td>
                    <td className="px-4 py-2.5 text-right text-pine">{Number(m.qty) > 0 ? `${Number(m.qty)} ${m.unit}` : ""}</td>
                    <td className="px-4 py-2.5 text-right text-clay">{Number(m.qty) < 0 ? `${-Number(m.qty)} ${m.unit}` : ""}</td>
                    <td className="px-4 py-2.5 text-right">{Number(m.balance)} {m.unit}</td>
                    <td className="px-4 py-2.5 text-xs text-muted">{m.source || m.reason || "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-muted">{m.created_by || "system"}</td>
                  </tr>
                ))}
                {!moves?.length && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted text-sm">No movements for this filter.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "consumption" && (
        <>
          <div className="flex gap-2 mb-3">
            {[7, 30, 90].map((d) => (
              <button key={d} onClick={() => setDays(d)}
                className={`pill text-xs ${days === d ? "bg-ink text-white" : "bg-hairline text-body"}`}>
                Last {d} days
              </button>
            ))}
          </div>
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-cream text-muted text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3">Material</th>
                  <th className="text-right px-4 py-3">Purchased</th>
                  <th className="text-right px-4 py-3">Consumed</th>
                  <th className="text-right px-4 py-3">Wasted</th>
                  <th className="text-right px-4 py-3">In stock</th>
                  <th className="text-right px-4 py-3">Consumption cost</th>
                </tr>
              </thead>
              <tbody>
                {consumption?.rows.map((r) => (
                  <tr key={r.ingredient} className="border-t border-line">
                    <td className="px-4 py-3 font-medium">{r.ingredient} <span className="text-xs text-muted font-mono">{r.code}</span></td>
                    <td className="px-4 py-3 text-right text-pine">{Number(r.purchased)} {r.unit}</td>
                    <td className="px-4 py-3 text-right">{Number(r.consumed)} {r.unit}</td>
                    <td className="px-4 py-3 text-right text-clay">{Number(r.wasted)} {r.unit}</td>
                    <td className="px-4 py-3 text-right text-muted">{Number(r.in_stock)} {r.unit}</td>
                    <td className="px-4 py-3 text-right font-medium">{inr(r.consumption_cost)}</td>
                  </tr>
                ))}
                {!consumption?.rows.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted text-sm">No consumption in this period.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "expiry" && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-cream text-muted text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Material</th>
                <th className="text-left px-4 py-3">Expiry date</th>
                <th className="text-right px-4 py-3">In stock</th>
                <th className="text-left px-4 py-3">Location</th>
                <th className="text-right px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {expiring?.map((i) => {
                const expired = i.expiry_date! <= new Date().toISOString().slice(0, 10);
                return (
                  <tr key={i.id} className="border-t border-line">
                    <td className="px-4 py-3 font-medium">{i.name}</td>
                    <td className="px-4 py-3">
                      <Badge tone={expired ? "clay" : "amber"}>{i.expiry_date}{expired ? " · expired" : ""}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">{Number(i.current_stock)} {i.unit}</td>
                    <td className="px-4 py-3 text-muted text-xs">{i.storage_location || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <button className="btn-ghost text-xs text-clay" onClick={() => setAction({ kind: "waste", ing: i })}>
                        Write off
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!expiring?.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted text-sm">Nothing expiring in the next 30 days.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && <AddMaterialModal onDone={() => { setShowAdd(false); refresh(); }} onCancel={() => setShowAdd(false)} />}
      {action && (
        <StockActionModal
          kind={action.kind}
          ing={action.ing}
          onDone={() => { setAction(null); refresh(); toast("Stock updated"); }}
          onCancel={() => setAction(null)}
        />
      )}
    </div>
  );
}

function AddMaterialModal({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ name: "", unit: "kg", category: "", min_stock_level: "0", reorder_level: "0", unit_cost: "0", storage_location: "", expiry_date: "" });
  const save = useMutation({
    mutationFn: async () => (await api.post("/inventory/", { ...f, expiry_date: f.expiry_date || null })).data,
    onSuccess: onDone,
    onError: (e: any) => toast(e?.response?.data?.name?.[0] ?? "Could not save material", "error"),
  });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="card p-5 w-[420px]" onClick={(e) => e.stopPropagation()}>
        <div className="font-display text-xl mb-4">New raw material</div>
        <div className="grid gap-2">
          <input className="input" placeholder="Name" value={f.name} onChange={set("name")} />
          <div className="grid grid-cols-2 gap-2">
            <select className="input" value={f.unit} onChange={set("unit")}>
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <select className="input" value={f.category} onChange={set("category")}>
              <option value="">Category…</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input className="input" inputMode="decimal" placeholder="Min level" value={f.min_stock_level} onChange={set("min_stock_level")} />
            <input className="input" inputMode="decimal" placeholder="Reorder at" value={f.reorder_level} onChange={set("reorder_level")} />
            <input className="input" inputMode="decimal" placeholder="Rate ₹" value={f.unit_cost} onChange={set("unit_cost")} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input className="input" placeholder="Storage location" value={f.storage_location} onChange={set("storage_location")} />
            <input className="input" type="date" value={f.expiry_date} onChange={set("expiry_date")} />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button className="btn-ghost flex-1" onClick={onCancel}>Cancel</button>
          <button className="btn-primary flex-1" disabled={!f.name.trim() || save.isPending} onClick={() => save.mutate()}>Save</button>
        </div>
      </div>
    </div>
  );
}

function StockActionModal({ kind, ing, onDone, onCancel }: {
  kind: "adjust" | "waste" | "count"; ing: Ingredient; onDone: () => void; onCancel: () => void;
}) {
  const toast = useToast();
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [expired, setExpired] = useState(false);
  const titles = { adjust: "Stock adjustment", waste: "Wastage entry", count: "Physical stock count" };
  const save = useMutation({
    mutationFn: async () => {
      const body = kind === "count" ? { counted: qty } : { qty, reason, expired: expired || undefined };
      return (await api.post(`/inventory/${ing.id}/${kind}/`, body)).data;
    },
    onSuccess: onDone,
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Failed", "error"),
  });
  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="card p-5 w-[380px]" onClick={(e) => e.stopPropagation()}>
        <div className="font-display text-xl mb-1">{titles[kind]}</div>
        <div className="text-sm text-muted mb-4">{ing.name} · in stock {Number(ing.current_stock)} {ing.unit}</div>
        <div className="grid gap-2">
          <input className="input" inputMode="decimal" autoFocus
            placeholder={kind === "count" ? `Counted quantity (${ing.unit})` : kind === "adjust" ? `Qty ± (${ing.unit})` : `Qty wasted (${ing.unit})`}
            value={qty} onChange={(e) => setQty(e.target.value)} />
          {kind !== "count" && (
            <input className="input" placeholder={`Reason${kind === "waste" ? " (required)" : ""}`} value={reason} onChange={(e) => setReason(e.target.value)} />
          )}
          {kind === "waste" && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={expired} onChange={(e) => setExpired(e.target.checked)} />
              Expiry / damage loss (not prep wastage)
            </label>
          )}
        </div>
        <div className="flex gap-2 mt-4">
          <button className="btn-ghost flex-1" onClick={onCancel}>Cancel</button>
          <button className="btn-primary flex-1"
            disabled={!qty || (kind === "waste" && !reason.trim()) || save.isPending}
            onClick={() => save.mutate()}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
