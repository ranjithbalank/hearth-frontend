import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useToast } from "../../design/Toast";
import { Badge, Card, PageHeader } from "../../design/ui";
import { api } from "../../lib/api";
import { useApp } from "../../lib/app-context";
import { currencySymbol, money } from "../../lib/money";

// Plate cost & margin are ownership-level P&L info — Chef and Restaurant
// Manager build recipes without needing to see them.
const COST_VISIBLE_ROLES = ["Super Admin", "Managing Director", "General Manager"];

interface IngredientOpt { id: number; name: string; unit: string; unit_cost?: string; current_stock: string }
interface CategoryOpt { id: number; name: string }

interface Line { ingredient: number | null; qty: string; unit: string; wastage_pct: string }
const EMPTY_LINE: Line = { ingredient: null, qty: "", unit: "", wastage_pct: "" };

// Mirrors the backend's unit conversion (spec §2): recipe qty → material's base unit.
const FACTORS: Record<string, Record<string, number>> = {
  g: { kg: 0.001 }, kg: { g: 1000 }, ml: { l: 0.001 }, l: { ml: 1000 },
};
function toBase(qty: number, from: string, to: string): number {
  if (!from || from === to) return qty;
  return qty * (FACTORS[from]?.[to] ?? 1);
}

/** Create a recipe from raw materials — and put the dish on the restaurant
 *  menu in the same step (spec §2/§5). Consumption then auto-deducts on KOT. */
export function NewRecipe() {
  const nav = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const { user } = useApp();
  const canSeeCost = COST_VISIBLE_ROLES.includes(user?.role ?? "");
  // Mirrors the backend: a Chef-proposed dish needs a manager's sign-off
  // before it's orderable — everyone else creating a dish here is trusted.
  const needsApproval = user?.role === "Chef / Kitchen";
  const [dish, setDish] = useState({ name: "", price: "", category: "", gst_rate: "5", diet: "veg" });
  const [lines, setLines] = useState<Line[]>([{ ...EMPTY_LINE }]);

  const { data: materials } = useQuery({
    queryKey: ["ingredients"],
    queryFn: async () => (await api.get<IngredientOpt[]>("/inventory/")).data,
  });
  const { data: categories } = useQuery({
    queryKey: ["menu-categories"],
    queryFn: async () => (await api.get<CategoryOpt[]>("/recipes/menu_categories/")).data,
  });

  const byId = new Map((materials ?? []).map((m) => [m.id, m]));
  const setLine = (i: number, patch: Partial<Line>) =>
    setLines(lines.map((l, ix) => (ix === i ? { ...l, ...patch } : l)));

  // Live plate cost: Σ per-serving draw (in the material's base unit, incl. wastage) × rate.
  // Chef doesn't get ingredient unit_cost from the API at all, so this naturally computes
  // nothing for them — the cost/margin card below is hidden for the same reason.
  const lineCost = (l: Line) => {
    const m = l.ingredient ? byId.get(l.ingredient) : undefined;
    if (!m || !Number(l.qty) || m.unit_cost == null) return 0;
    const base = toBase(Number(l.qty), l.unit || m.unit, m.unit);
    const waste = 1 + (Number(l.wastage_pct) || 0) / 100;
    return base * waste * Number(m.unit_cost);
  };
  const plateCost = lines.reduce((s, l) => s + lineCost(l), 0);
  const price = Number(dish.price) || 0;
  const marginPct = price ? Math.round(((price - plateCost) / price) * 1000) / 10 : null;
  const validLines = lines.filter((l) => l.ingredient && Number(l.qty) > 0);

  const save = useMutation({
    mutationFn: async () => (await api.post("/recipes/", {
      new_item: dish,
      lines: validLines.map((l) => ({ ingredient: l.ingredient, qty: l.qty,
        unit: l.unit, wastage_pct: l.wastage_pct || "0" })),
    })).data,
    onSuccess: (d: { item: string; plate_cost?: string; approval_status: string }) => {
      if (d.approval_status === "pending") {
        toast(`"${d.item}" saved — pending manager approval before it goes on the menu`);
      } else {
        toast(d.plate_cost
          ? `"${d.item}" is on the menu · plate cost ${money(d.plate_cost)} · stock deducts on every KOT`
          : `"${d.item}" is on the menu · stock deducts on every KOT`);
      }
      qc.invalidateQueries({ queryKey: ["recipes"] });
      qc.invalidateQueries({ queryKey: ["recipe-mapping"] });
      qc.invalidateQueries({ queryKey: ["recipe-pending"] });
      nav("/recipes");
    },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not save the recipe", "error"),
  });

  return (
    <div>
      <PageHeader
        title="Create recipe"
        subtitle={needsApproval
          ? "Per-serving raw-material consumption · a manager signs off before it goes live"
          : "Per-serving raw-material consumption · the dish goes live on the restaurant menu"}
        action={<button className="btn-ghost text-sm" onClick={() => nav("/recipes")}>← Recipes</button>}
      />

      <Card className="mb-4">
        <div className="font-semibold mb-3">1 · The dish</div>
        <div className="grid grid-cols-5 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-muted">Dish name *</label>
            <input className="input w-full" autoFocus placeholder="e.g. Chicken Fried Rice"
              value={dish.name} onChange={(e) => setDish({ ...dish, name: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-muted">Selling price ({currencySymbol()}) *</label>
            <input className="input w-full" inputMode="decimal" placeholder="0"
              value={dish.price} onChange={(e) => setDish({ ...dish, price: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-muted">Menu category *</label>
            <input className="input w-full" list="menu-cats" placeholder="e.g. Mains"
              value={dish.category} onChange={(e) => setDish({ ...dish, category: e.target.value })} />
            <datalist id="menu-cats">
              {categories?.map((c) => <option key={c.id} value={c.name} />)}
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted">GST %</label>
              <input className="input w-full" inputMode="decimal"
                value={dish.gst_rate} onChange={(e) => setDish({ ...dish, gst_rate: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted">Diet</label>
              <select className="input w-full" value={dish.diet}
                onChange={(e) => setDish({ ...dish, diet: e.target.value })}>
                <option value="veg">Veg</option>
                <option value="nonveg">Non-veg</option>
                <option value="egg">Egg</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      <Card className="mb-4">
        <div className="font-semibold mb-1">2 · Raw-material consumption per serving</div>
        <div className="text-xs text-muted mb-3">
          Each line is what ONE plate draws from the store — units convert automatically
          (250 g against a kg-stocked material = 0.25 kg) and wastage % inflates the draw.
        </div>
        <div className={`grid ${canSeeCost ? "grid-cols-[1fr_90px_80px_90px_110px_32px]" : "grid-cols-[1fr_90px_80px_90px_32px]"} gap-2 text-xs text-muted uppercase tracking-wide mb-1 px-1`}>
          <span>Raw material</span><span>Qty</span><span>Unit</span><span>Waste %</span>
          {canSeeCost && <span className="text-right">Line cost</span>}<span></span>
        </div>
        <div className="space-y-2">
          {lines.map((l, i) => {
            const m = l.ingredient ? byId.get(l.ingredient) : undefined;
            return (
              <div key={i} className={`grid ${canSeeCost ? "grid-cols-[1fr_90px_80px_90px_110px_32px]" : "grid-cols-[1fr_90px_80px_90px_32px]"} gap-2 items-center`}>
                <select className="input" value={l.ingredient ?? ""}
                  onChange={(e) => {
                    const mat = byId.get(Number(e.target.value));
                    setLine(i, { ingredient: mat?.id ?? null, unit: l.unit || mat?.unit || "" });
                  }}>
                  <option value="">Pick a raw material…</option>
                  {materials?.map((mat) => (
                    <option key={mat.id} value={mat.id}>
                      {mat.name} — {Number(mat.current_stock)} {mat.unit} in stock
                    </option>
                  ))}
                </select>
                <input className="input" inputMode="decimal" placeholder="Qty"
                  value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} />
                <input className="input" placeholder={m?.unit ?? "unit"}
                  value={l.unit} onChange={(e) => setLine(i, { unit: e.target.value })} />
                <input className="input" inputMode="decimal" placeholder="0"
                  value={l.wastage_pct} onChange={(e) => setLine(i, { wastage_pct: e.target.value })} />
                {canSeeCost && (
                  <div className="text-right text-sm font-medium">{lineCost(l) ? money(lineCost(l)) : "—"}</div>
                )}
                <button className="btn-ghost text-clay text-sm"
                  onClick={() => setLines(lines.length > 1 ? lines.filter((_, ix) => ix !== i) : [{ ...EMPTY_LINE }])}>
                  ✕
                </button>
              </div>
            );
          })}
        </div>
        <button className="btn-outline text-xs mt-3" onClick={() => setLines([...lines, { ...EMPTY_LINE }])}>
          ＋ Add raw material
        </button>
      </Card>

      <Card className="mb-4">
        <div className="flex items-center gap-6 flex-wrap">
          {canSeeCost && (
            <div>
              <div className="text-xs text-muted uppercase tracking-wide">Plate cost</div>
              <div className="stat-num text-2xl">{money(plateCost)}</div>
            </div>
          )}
          <div>
            <div className="text-xs text-muted uppercase tracking-wide">Selling price</div>
            <div className="stat-num text-2xl">{price ? money(price) : "—"}</div>
          </div>
          {canSeeCost && (
            <div>
              <div className="text-xs text-muted uppercase tracking-wide">Margin</div>
              <div className="stat-num text-2xl">
                {marginPct == null ? "—" : (
                  <Badge tone={marginPct >= 65 ? "pine" : marginPct >= 50 ? "amber" : "clay"}>
                    {marginPct}%
                  </Badge>
                )}
              </div>
            </div>
          )}
          <div className="flex-1" />
          <button className="btn-ghost" onClick={() => nav("/recipes")}>Cancel</button>
          <button className="btn-primary"
            disabled={!dish.name.trim() || !dish.category.trim() || !(price > 0) || !validLines.length || save.isPending}
            onClick={() => save.mutate()}>
            {needsApproval
              ? (save.isPending ? "Sending…" : "Send for approval")
              : (save.isPending ? "Saving…" : "Save — put dish on the menu")}
          </button>
        </div>
      </Card>

      {needsApproval && (
        <div className="text-xs text-muted -mt-2 mb-4">
          A manager (Restaurant Manager, GM, MD or Super Admin) reviews it before it's orderable — you'll see the outcome on this screen.
        </div>
      )}
    </div>
  );
}
