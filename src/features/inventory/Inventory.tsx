import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Badge, Card, PageHeader, Spinner, Stat } from "../../design/ui";
import { api, getAccess } from "../../lib/api";
import { useToast } from "../../design/Toast";
import { money } from "../../lib/money";

interface Ingredient {
  id: number; code: string; name: string; unit: string; category: string;
  current_stock: string; min_stock_level: string; reorder_level: string;
  // Absent entirely (not just "0") for Chef — purchase rate is a
  // procurement figure, not something a cook needs. Render "—", not ₹0.00.
  unit_cost?: string; storage_location: string; expiry_date: string | null;
  below_par: boolean; below_min: boolean;
}
interface Movement {
  id: number; ingredient: number; ingredient_name: string; unit: string;
  kind: string; kind_label: string; qty: string; balance: string;
  reason: string; source: string; created_by: string; created_at: string;
}
interface ConsumptionRow {
  ingredient: string; code: string; unit: string; consumed: string;
  // null for Chef — same rule as the ingredient rate (see IngredientSerializer).
  wasted: string; purchased: string; consumption_cost: string | null; in_stock: string;
}
interface Uom { id: number; code: string; name: string }
interface CategoryRow { id: number; name: string }

/** Tab structure per the Restaurant Inventory spec §6. Supplier Master,
 *  Purchase Entry/GRN, Recipe Master, Menu Item Mapping and Inventory Reports
 *  are their own screens — the Dashboard tab deep-links to them. */
type Tab = "dashboard" | "materials" | "masters" | "movements"
  | "transfer" | "wastage" | "stockcount" | "lowstock" | "expiry";
const TABS: { key: Tab; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "materials", label: "Raw material master" },
  { key: "masters", label: "Categories & units" },
  { key: "movements", label: "Movements & consumption" },
  { key: "transfer", label: "Stock transfer" },
  { key: "wastage", label: "Wastage entry" },
  { key: "stockcount", label: "Physical count" },
  { key: "lowstock", label: "Low stock / reorder" },
  { key: "expiry", label: "Expiry tracking" },
];

const MOVE_KINDS = [
  ["", "All"], ["receipt", "Purchase Receipt"], ["consumption", "Recipe Consumption"],
  ["wastage", "Wastage"], ["transfer", "Stock Transfer"], ["production", "Production / Prep"],
  ["adjustment", "Adjustment"], ["count", "Physical Count"], ["return", "Return"],
  ["expiry", "Expiry / Damage"],
];

async function downloadRegister(kind: string, days: number) {
  const res = await fetch(`/api/inventory/movements/?days=${days}${kind ? `&kind=${kind}` : ""}&fmt=csv`,
    { headers: { Authorization: `Bearer ${getAccess()}` } });
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = `${kind || "movements"}-register.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function Inventory({ fixedTab, tabGroup, title }: {
  fixedTab?: Tab;
  /** Render a subset of tabs with their own pill bar (e.g. Stock Control). */
  tabGroup?: Tab[];
  title?: string;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const nav = useNavigate();
  // Props must win on every render: React keeps this component mounted when
  // routing between /store/* screens, so state seeded from a prop goes stale.
  const [tabState, setTab] = useState<Tab>("dashboard");
  const tab: Tab = fixedTab
    ?? (tabGroup ? (tabGroup.includes(tabState) ? tabState : tabGroup[0]) : tabState);
  const visibleTabs = tabGroup ? TABS.filter((t) => tabGroup.includes(t.key)) : TABS;
  const [q, setQ] = useState("");
  // Stock stays one shared system — this just lets you see, at a glance,
  // which materials are Liquor (bar-exclusive) vs the shared kitchen stock.
  const [catFilter, setCatFilter] = useState("");
  const [action, setAction] = useState<{ kind: "adjust" | "waste" | "count" | "transfer"; ing: Ingredient } | null>(null);
  const [moveKind, setMoveKind] = useState("");
  const [days, setDays] = useState(30);

  // Stock changes from other screens (a GRN received in Procurement, a
  // recipe firing on the POS) don't invalidate this query on their own if
  // this screen is just sitting open — poll lightly so it self-heals
  // instead of showing stale numbers until you navigate away and back.
  const { data, isLoading } = useQuery({
    queryKey: ["ingredients"],
    queryFn: async () => (await api.get<Ingredient[]>("/inventory/")).data,
    refetchInterval: 20000,
  });
  const { data: moves } = useQuery({
    queryKey: ["inv-moves", tab, moveKind, days, catFilter],
    queryFn: async () => {
      const kind = tab === "transfer" ? "transfer"
        : tab === "wastage" ? "wastage" : moveKind;
      return (await api.get<Movement[]>(`/inventory/movements/?days=${days}${kind ? `&kind=${kind}` : ""}${catFilter ? `&category=${encodeURIComponent(catFilter)}` : ""}`)).data;
    },
    enabled: ["movements", "transfer", "wastage"].includes(tab),
  });
  const { data: consumption } = useQuery({
    queryKey: ["inv-consumption", days, catFilter],
    queryFn: async () => (await api.get<{ rows: ConsumptionRow[] }>(`/inventory/consumption_report/?days=${days}${catFilter ? `&category=${encodeURIComponent(catFilter)}` : ""}`)).data,
    enabled: tab === "dashboard",
  });
  const { data: expiring } = useQuery({
    queryKey: ["inv-expiring"],
    queryFn: async () => (await api.get<Ingredient[]>("/inventory/expiring/?days=30")).data,
    enabled: tab === "expiry" || tab === "dashboard",
  });
  const { data: uoms } = useQuery({
    queryKey: ["inv-uoms"],
    queryFn: async () => (await api.get<Uom[]>("/inventory-uoms/")).data,
  });
  const { data: categories } = useQuery({
    queryKey: ["inv-categories"],
    queryFn: async () => (await api.get<CategoryRow[]>("/inventory-categories/")).data,
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ["ingredients"] });
    qc.invalidateQueries({ queryKey: ["inv-moves"] });
    qc.invalidateQueries({ queryKey: ["inv-consumption"] });
    qc.invalidateQueries({ queryKey: ["inv-expiring"] });
  }

  if (isLoading || !data) return <Spinner />;
  const low = data.filter((i) => i.below_par);
  // Rates are hidden from Chef entirely (see IngredientSerializer) — rather
  // than silently total to ₹0, don't show a stock-value figure at all when
  // any material's rate is missing.
  const canSeeRates = data.every((i) => i.unit_cost != null);
  const stockValue = canSeeRates
    ? data.reduce((s, i) => s + Number(i.current_stock) * Number(i.unit_cost), 0)
    : null;
  const canSeeConsumptionCost = (consumption?.rows ?? []).every((r) => r.consumption_cost != null);
  const consumed30 = canSeeConsumptionCost
    ? (consumption?.rows ?? []).reduce((s, r) => s + Number(r.consumption_cost), 0)
    : null;
  const rows = data.filter((i) =>
    (!q || i.name.toLowerCase().includes(q.toLowerCase()) || i.code.toLowerCase().includes(q.toLowerCase()))
    && (!catFilter || i.category === catFilter));

  const registerTable = (title: string, kind: string, extra?: React.ReactNode) => (
    <>
      <div className="flex gap-2 mb-3 items-center flex-wrap">
        {[7, 30, 90].map((d) => (
          <button key={d} onClick={() => setDays(d)}
            className={`pill text-xs ${days === d ? "bg-ink text-white" : "bg-hairline text-body"}`}>
            Last {d} days
          </button>
        ))}
        <select className="input w-40 text-xs" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
          <option value="">All categories</option>
          {categories?.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        {extra}
        <button className="btn-outline text-xs py-1 ml-auto" onClick={() => downloadRegister(kind, days)}>
          Export CSV
        </button>
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
            {!moves?.length && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted text-sm">No {title.toLowerCase()} in this period.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );

  return (
    <div>
      <PageHeader
        title={title ?? (fixedTab ? (TABS.find((t) => t.key === fixedTab)?.label ?? "Store") : "Inventory & Stock")}
        subtitle="Raw materials · consumption auto-deducts from recipes on KOT"
        action={tab === "materials" ? (
          <div className="flex items-center gap-2">
            <select className="input w-40" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
              <option value="">All categories</option>
              {categories?.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <input className="input w-48" placeholder="Search name or code…" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="btn-primary text-sm" onClick={() => nav("/store/materials/new")}>+ Raw material</button>
          </div>
        ) : undefined}
      />

      {/* tabGroup renders a left-side menu (like the app nav, but inside the
          screen); the combined view keeps its horizontal pills. */}
      <div className={tabGroup ? "grid grid-cols-[220px_1fr] gap-4 items-start" : ""}>
        {tabGroup ? (
          <div className="card p-2 space-y-1 sticky top-4">
            {visibleTabs.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`w-full text-left rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  tab === t.key ? "bg-pine text-white font-medium" : "text-body hover:bg-cream"}`}>
                {t.label}
                {t.key === "lowstock" && low.length ? ` (${low.length})` : ""}
              </button>
            ))}
          </div>
        ) : !fixedTab && (
          <div className="flex gap-2 mb-4 flex-wrap">
            {visibleTabs.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`pill text-xs ${tab === t.key ? "bg-ink text-white" : "bg-hairline text-body"}`}>
                {t.label}
                {t.key === "lowstock" && low.length ? ` (${low.length})` : ""}
              </button>
            ))}
          </div>
        )}
        <div className="min-w-0">

      {tab === "dashboard" && (
        <>
          <div className="grid grid-cols-5 gap-4 mb-4">
            <Stat tone="dark" label="Materials tracked" value={data.length} />
            <Stat label="Stock value" value={stockValue == null ? "—" : money(stockValue)} />
            <Stat label="Below reorder level" value={low.length} />
            <Stat label="Expiring ≤ 30 days" value={expiring?.length ?? 0} />
            <Stat label={`Consumption cost (${days}d)`} value={consumed30 == null ? "—" : money(consumed30)} />
          </div>

          {/* Deep links to the sibling screens the spec lists as tabs (§6) */}
          <div className="grid grid-cols-6 gap-3 mb-4">
            {[
              { label: "Supplier Master", path: "/masters/suppliers" },
              { label: "Purchase Entry / GRN", path: "/procurement" },
              { label: "Purchase Orders", path: "/masters/purchase-orders" },
              { label: "Recipe Master", path: "/recipes" },
              { label: "Material Requests", path: "/material-requests" },
              { label: "Inventory Reports", path: "/reports" },
            ].map((l) => (
              <button key={l.path} className="card p-3 text-sm font-medium hover:bg-cream text-left"
                onClick={() => nav(l.path)}>
                {l.label} →
              </button>
            ))}
          </div>

          <div className="text-xs uppercase tracking-wide text-muted mb-2">
            Raw material consumption — purchased vs consumed vs wasted (last {days} days)
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
                    <td className="px-4 py-3 text-right font-medium">{r.consumption_cost == null ? "—" : money(r.consumption_cost)}</td>
                  </tr>
                ))}
                {!consumption?.rows.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted text-sm">No consumption in this period.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "materials" && (
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
                <th className="text-left px-4 py-3">Expiry</th>
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
                  <td className="px-4 py-3 text-right">{i.unit_cost == null ? "—" : money(i.unit_cost)}</td>
                  <td className="px-4 py-3 text-muted text-xs">{i.storage_location || "—"}</td>
                  <td className="px-4 py-3 text-muted text-xs">{i.expiry_date ?? "—"}</td>
                  <td className="px-4 py-3">
                    {i.below_min ? <Badge tone="clay">Critical</Badge>
                      : i.below_par ? <Badge tone="amber">Reorder</Badge>
                        : <Badge tone="pine">OK</Badge>}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button className="btn-ghost text-xs" onClick={() => setAction({ kind: "adjust", ing: i })}>Adjust</button>
                    <button className="btn-ghost text-xs text-clay" onClick={() => setAction({ kind: "waste", ing: i })}>Waste</button>
                    <button className="btn-ghost text-xs" onClick={() => setAction({ kind: "transfer", ing: i })}>Transfer</button>
                    <button className="btn-ghost text-xs" onClick={() => setAction({ kind: "count", ing: i })}>Count</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "masters" && (
        <div className="grid grid-cols-2 gap-4">
          <MasterCard
            title="Raw material categories"
            hint="Grouping on the material master (spec §6)"
            rows={(categories ?? []).map((c) => ({ id: c.id, label: c.name }))}
            endpoint="/inventory-categories/"
            fields={[{ key: "name", placeholder: "Category name" }]}
            queryKey="inv-categories"
          />
          <MasterCard
            title="Units of measurement"
            hint="Base consumption units — KG, GM, L, ML, Nos, Packet…"
            rows={(uoms ?? []).map((u) => ({ id: u.id, label: `${u.name} (${u.code})` }))}
            endpoint="/inventory-uoms/"
            fields={[{ key: "code", placeholder: "Code e.g. kg" }, { key: "name", placeholder: "Name e.g. Kilogram (KG)" }]}
            queryKey="inv-uoms"
          />
        </div>
      )}

      {tab === "movements" && registerTable("Movements", moveKind,
        <>
          {MOVE_KINDS.map(([k, label]) => (
            <button key={k} onClick={() => setMoveKind(k)}
              className={`pill text-xs ${moveKind === k ? "bg-ink text-white" : "bg-hairline text-body"}`}>
              {label}
            </button>
          ))}
        </>
      )}

      {tab === "transfer" && registerTable("Stock transfers", "transfer",
        <span className="text-xs text-muted">Use a material's Transfer action to move stock out to / in from another location.</span>
      )}

      {tab === "wastage" && registerTable("Wastage entries", "wastage",
        <span className="text-xs text-muted">Use a material's Waste action to record wastage (reason required).</span>
      )}

      {tab === "stockcount" && (
        <StockCountSheet materials={rows} onSaved={refresh} q={q} setQ={setQ} />
      )}

      {tab === "lowstock" && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-cream text-muted text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Material</th>
                <th className="text-right px-4 py-3">In stock</th>
                <th className="text-right px-4 py-3">Reorder at</th>
                <th className="text-right px-4 py-3">Shortfall</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {low.map((i) => (
                <tr key={i.id} className="border-t border-line">
                  <td className="px-4 py-3 font-medium">{i.name}</td>
                  <td className="px-4 py-3 text-right">{Number(i.current_stock)} {i.unit}</td>
                  <td className="px-4 py-3 text-right text-muted">{Number(i.reorder_level)} {i.unit}</td>
                  <td className="px-4 py-3 text-right text-clay font-medium">
                    {(Number(i.reorder_level) - Number(i.current_stock)).toFixed(2)} {i.unit}
                  </td>
                  <td className="px-4 py-3">
                    {i.below_min ? <Badge tone="clay">Critical — below minimum</Badge>
                      : <Badge tone="amber">Below reorder level</Badge>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className="btn-outline text-xs py-1" onClick={() => nav("/procurement?prefill=low")}>
                      Raise purchase order →
                    </button>
                  </td>
                </tr>
              ))}
              {!low.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted text-sm">Nothing below reorder level — stock is healthy.</td></tr>}
            </tbody>
          </table>
        </div>
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
        </div>
      </div>

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

/** Physical stock count sheet (§6): enter counted quantities; each save posts a
 *  'count' movement for the difference so the ledger explains the correction. */
function StockCountSheet({ materials, onSaved, q, setQ }: {
  materials: Ingredient[]; onSaved: () => void; q: string; setQ: (v: string) => void;
}) {
  const toast = useToast();
  const [counted, setCounted] = useState<Record<number, string>>({});
  const [savedIds, setSavedIds] = useState<number[]>([]);
  const save = useMutation({
    mutationFn: async (ing: Ingredient) =>
      (await api.post(`/inventory/${ing.id}/count/`, { counted: counted[ing.id] })).data,
    onSuccess: (_d, ing) => {
      setSavedIds((s) => [...s, ing.id]);
      toast(`${ing.name} booked at ${counted[ing.id]} ${ing.unit}`);
      onSaved();
    },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not save count", "error"),
  });
  return (
    <>
      <div className="flex gap-2 mb-3 items-center">
        <input className="input w-64" placeholder="Search material…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="text-xs text-muted">Enter the physically counted quantity — the difference posts as a count movement.</span>
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-cream text-muted text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Material</th>
              <th className="text-right px-4 py-3">Book stock</th>
              <th className="text-right px-4 py-3">Counted</th>
              <th className="text-right px-4 py-3">Difference</th>
              <th className="text-right px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {materials.map((i) => {
              const val = counted[i.id] ?? "";
              const diff = val === "" ? null : Number(val) - Number(i.current_stock);
              return (
                <tr key={i.id} className="border-t border-line">
                  <td className="px-4 py-2.5 font-medium">{i.name} <span className="text-xs text-muted">{i.code}</span></td>
                  <td className="px-4 py-2.5 text-right">{Number(i.current_stock)} {i.unit}</td>
                  <td className="px-4 py-2.5 text-right">
                    <input className="input w-24 text-right" inputMode="decimal" value={val}
                      onChange={(e) => setCounted({ ...counted, [i.id]: e.target.value })} />
                  </td>
                  <td className={`px-4 py-2.5 text-right font-medium ${diff == null ? "text-muted" : diff < 0 ? "text-clay" : "text-pine"}`}>
                    {diff == null ? "—" : `${diff > 0 ? "+" : ""}${diff.toFixed(3)} ${i.unit}`}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button className="btn-outline text-xs py-1"
                      disabled={val === "" || save.isPending || savedIds.includes(i.id)}
                      onClick={() => save.mutate(i)}>
                      {savedIds.includes(i.id) ? "✓ Booked" : "Book count"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function MasterCard({ title, hint, rows, endpoint, fields, queryKey }: {
  title: string; hint: string; rows: { id: number; label: string }[];
  endpoint: string; fields: { key: string; placeholder: string }[]; queryKey: string;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState<Record<string, string>>({});
  const add = useMutation({
    mutationFn: async () => (await api.post(endpoint, form)).data,
    onSuccess: () => { setForm({}); qc.invalidateQueries({ queryKey: [queryKey] }); },
    onError: (e: any) => {
      const d = e?.response?.data;
      toast(d?.detail ?? d?.name?.[0] ?? d?.code?.[0] ?? "Could not save", "error");
    },
  });
  const remove = useMutation({
    mutationFn: async (id: number) => (await api.delete(`${endpoint}${id}/`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] }),
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not delete", "error"),
  });
  const complete = fields.every((f) => (form[f.key] ?? "").trim());
  return (
    <Card>
      <div className="font-semibold">{title}</div>
      <div className="text-xs text-muted mb-3">{hint}</div>
      <div className="flex gap-2 mb-3">
        {fields.map((f) => (
          <input key={f.key} className="input flex-1" placeholder={f.placeholder}
            value={form[f.key] ?? ""}
            onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
        ))}
        <button className="btn-primary text-sm" disabled={!complete || add.isPending}
          onClick={() => add.mutate()}>
          Add
        </button>
      </div>
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between text-sm border-t border-line py-1.5">
            <span>{r.label}</span>
            <button className="btn-ghost text-xs text-clay" disabled={remove.isPending}
              onClick={() => remove.mutate(r.id)}>
              Delete
            </button>
          </div>
        ))}
        {!rows.length && <div className="text-sm text-muted py-4 text-center">Nothing yet.</div>}
      </div>
    </Card>
  );
}

function StockActionModal({ kind, ing, onDone, onCancel }: {
  kind: "adjust" | "waste" | "count" | "transfer"; ing: Ingredient; onDone: () => void; onCancel: () => void;
}) {
  const toast = useToast();
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [expired, setExpired] = useState(false);
  const [direction, setDirection] = useState<"out" | "in">("out");
  const [location, setLocation] = useState("");
  const titles = { adjust: "Stock adjustment", waste: "Wastage entry", count: "Physical stock count", transfer: "Stock transfer" };
  const save = useMutation({
    mutationFn: async () => {
      const body = kind === "count" ? { counted: qty }
        : kind === "transfer" ? { qty, direction, location }
        : { qty, reason, expired: expired || undefined };
      return (await api.post(`/inventory/${ing.id}/${kind}/`, body)).data;
    },
    onSuccess: onDone,
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Failed", "error"),
  });
  const disabled = !qty || save.isPending
    || (kind === "waste" && !reason.trim())
    || (kind === "transfer" && !location.trim());
  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="card p-5 w-[380px]" onClick={(e) => e.stopPropagation()}>
        <div className="font-display text-xl mb-1">{titles[kind]}</div>
        <div className="text-sm text-muted mb-4">{ing.name} · in stock {Number(ing.current_stock)} {ing.unit}</div>
        <div className="grid gap-2">
          {kind === "transfer" && (
            <div className="grid grid-cols-2 gap-2">
              <select className="input" value={direction} onChange={(e) => setDirection(e.target.value as "out" | "in")}>
                <option value="out">Transfer out — to</option>
                <option value="in">Transfer in — from</option>
              </select>
              <input className="input" placeholder="Location / outlet" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
          )}
          <input className="input" inputMode="decimal" autoFocus
            placeholder={kind === "count" ? `Counted quantity (${ing.unit})` : kind === "adjust" ? `Qty ± (${ing.unit})` : `Qty (${ing.unit})`}
            value={qty} onChange={(e) => setQty(e.target.value)} />
          {(kind === "adjust" || kind === "waste") && (
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
          <button className="btn-primary flex-1" disabled={disabled} onClick={() => save.mutate()}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
