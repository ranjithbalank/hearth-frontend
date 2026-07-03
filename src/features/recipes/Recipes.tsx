import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { usePrompt } from "../../design/Prompt";
import { useToast } from "../../design/Toast";
import { Badge, Card, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { inr } from "../../lib/money";

interface Recipe {
  id: number; item: string; price: string; plate_cost: string; margin_pct: number;
  ingredients: { name: string; qty: string; unit: string }[];
}
interface MappingLine {
  ingredient: number | null; sub_recipe: number | null; name: string;
  qty: string; unit: string; wastage_pct: string;
}
interface MappingRow {
  menu_item: number; name: string; category: string; price: string; available: boolean;
  recipe_id: number | null; plate_cost: string | null; lines: MappingLine[];
}
interface IngredientOpt { id: number; name: string; unit: string }

export function Recipes() {
  const qc = useQueryClient();
  const ask = usePrompt();
  const toast = useToast();
  const [tab, setTab] = useState<"recipes" | "mapping">("recipes");
  const [editing, setEditing] = useState<MappingRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["recipes"],
    queryFn: async () => (await api.get<Recipe[]>("/recipes/")).data,
  });
  const { data: mapping } = useQuery({
    queryKey: ["recipe-mapping"],
    queryFn: async () => (await api.get<MappingRow[]>("/recipes/mapping/")).data,
    enabled: tab === "mapping",
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ["recipes"] });
    qc.invalidateQueries({ queryKey: ["recipe-mapping"] });
  }

  // Batch prep: consumes the BOM (production movements) and credits "Prep: <item>" stock.
  const produce = useMutation({
    mutationFn: async ({ id, portions }: { id: number; portions: string }) =>
      (await api.post(`/recipes/${id}/produce/`, { portions })).data,
    onSuccess: (d: { portions: string; prep_ingredient: string }) => {
      toast(`Prepped ${Number(d.portions)} portion(s) → ${d.prep_ingredient} stocked`);
      qc.invalidateQueries({ queryKey: ["recipes"] });
      qc.invalidateQueries({ queryKey: ["ingredients"] });
    },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Batch failed", "error"),
  });

  const unmap = useMutation({
    mutationFn: async (recipeId: number) => api.delete(`/recipes/${recipeId}/`),
    onSuccess: () => { toast("Recipe unmapped — item no longer draws stock"); refresh(); },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not unmap", "error"),
  });

  if (isLoading || !data) return <Spinner />;

  const unmappedCount = mapping?.filter((m) => !m.recipe_id).length ?? 0;

  return (
    <div>
      <PageHeader title="Recipes & BOM" subtitle="Plate cost &amp; margin · auto-deducts on KOT" />

      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab("recipes")}
          className={`pill ${tab === "recipes" ? "bg-ink text-white" : "bg-hairline text-body"}`}>
          Recipes &amp; costing
        </button>
        <button onClick={() => setTab("mapping")}
          className={`pill ${tab === "mapping" ? "bg-ink text-white" : "bg-hairline text-body"}`}>
          Menu item mapping{unmappedCount ? ` (${unmappedCount} unmapped)` : ""}
        </button>
      </div>

      {tab === "recipes" && (
        <div className="grid grid-cols-3 gap-4">
          {data.map((r) => (
            <Card key={r.id}>
              <div className="flex items-center justify-between">
                <div className="font-semibold">{r.item}</div>
                <Badge tone={r.margin_pct >= 65 ? "pine" : r.margin_pct >= 50 ? "amber" : "clay"}>
                  {r.margin_pct}% margin
                </Badge>
              </div>
              <div className="flex gap-4 mt-2 text-sm">
                <div><span className="text-muted">Sells </span>{inr(r.price)}</div>
                <div><span className="text-muted">Cost </span>{inr(r.plate_cost)}</div>
              </div>
              <div className="mt-3 border-t border-line pt-2 space-y-1">
                {r.ingredients.map((ing) => (
                  <div key={ing.name} className="flex justify-between text-xs text-body">
                    <span>{ing.name}</span>
                    <span className="text-muted">{Number(ing.qty)} {ing.unit}</span>
                  </div>
                ))}
              </div>
              <button
                className="btn-ghost text-xs mt-3"
                disabled={produce.isPending}
                onClick={async () => {
                  const raw = await ask({ title: `Prep batch — ${r.item}`, label: "How many portions?", placeholder: "e.g. 10" });
                  const portions = (raw ?? "").replace(/[^\d.]/g, "");
                  if (portions && Number(portions) > 0) produce.mutate({ id: r.id, portions });
                }}
              >
                🍲 Produce batch
              </button>
            </Card>
          ))}
          {!data.length && <div className="text-sm text-muted">No recipes defined.</div>}
        </div>
      )}

      {tab === "mapping" && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-cream text-muted text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Menu item</th>
                <th className="text-left px-4 py-3">Category</th>
                <th className="text-right px-4 py-3">Price</th>
                <th className="text-left px-4 py-3">Recipe</th>
                <th className="text-right px-4 py-3">Plate cost</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {mapping?.map((m) => (
                <tr key={m.menu_item} className="border-t border-line">
                  <td className="px-4 py-3 font-medium">{m.name}</td>
                  <td className="px-4 py-3 text-muted text-xs">{m.category}</td>
                  <td className="px-4 py-3 text-right">{inr(m.price)}</td>
                  <td className="px-4 py-3">
                    {m.recipe_id
                      ? <span className="text-xs">{m.lines.map((l) => l.name).join(", ")}</span>
                      : <Badge tone="amber">Unmapped — no stock deduction</Badge>}
                  </td>
                  <td className="px-4 py-3 text-right">{m.plate_cost ? inr(m.plate_cost) : "—"}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button className="btn-ghost text-xs" onClick={() => setEditing(m)}>
                      {m.recipe_id ? "Edit" : "Map recipe"}
                    </button>
                    {m.recipe_id && (
                      <button className="btn-ghost text-xs text-clay" disabled={unmap.isPending}
                        onClick={() => unmap.mutate(m.recipe_id!)}>
                        Unmap
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!mapping?.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted text-sm">No menu items yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <MapRecipeModal row={editing}
          onDone={() => { setEditing(null); refresh(); toast("Recipe saved"); }}
          onCancel={() => setEditing(null)} />
      )}
    </div>
  );
}

const EMPTY_LINE: MappingLine = { ingredient: null, sub_recipe: null, name: "", qty: "", unit: "", wastage_pct: "" };

function MapRecipeModal({ row, onDone, onCancel }: {
  row: MappingRow; onDone: () => void; onCancel: () => void;
}) {
  const toast = useToast();
  const [lines, setLines] = useState<MappingLine[]>(
    row.lines.length ? row.lines : [{ ...EMPTY_LINE }]);
  const { data: ingredients } = useQuery({
    queryKey: ["ingredients-opts"],
    queryFn: async () => (await api.get<IngredientOpt[]>("/inventory/")).data,
  });

  const save = useMutation({
    mutationFn: async () => (await api.post("/recipes/", {
      menu_item: row.menu_item,
      lines: lines
        .filter((l) => (l.ingredient || l.sub_recipe) && Number(l.qty) > 0)
        .map((l) => ({ ingredient: l.ingredient, sub_recipe: l.sub_recipe,
          qty: l.qty, unit: l.unit, wastage_pct: l.wastage_pct || "0" })),
    })).data,
    onSuccess: onDone,
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not save recipe", "error"),
  });

  const setLine = (i: number, patch: Partial<MappingLine>) =>
    setLines(lines.map((l, ix) => (ix === i ? { ...l, ...patch } : l)));

  const valid = lines.some((l) => (l.ingredient || l.sub_recipe) && Number(l.qty) > 0);

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="card p-5 w-[560px] max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="font-display text-xl mb-1">Recipe — {row.name}</div>
        <div className="text-sm text-muted mb-4">
          Per-serving BOM · fires auto-deduct raw materials on KOT (spec §2–3)
        </div>
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_80px_70px_80px_32px] gap-2 items-center">
              {l.sub_recipe ? (
                <div className="input bg-hairline text-muted">{l.name} (prep)</div>
              ) : (
                <select className="input" value={l.ingredient ?? ""}
                  onChange={(e) => {
                    const ing = ingredients?.find((x) => x.id === Number(e.target.value));
                    setLine(i, { ingredient: ing?.id ?? null, unit: l.unit || ing?.unit || "" });
                  }}>
                  <option value="">Ingredient…</option>
                  {ingredients?.map((ing) => (
                    <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
                  ))}
                </select>
              )}
              <input className="input" inputMode="decimal" placeholder="Qty"
                value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} />
              <input className="input" placeholder="Unit"
                value={l.unit} onChange={(e) => setLine(i, { unit: e.target.value })}
                disabled={!!l.sub_recipe} />
              <input className="input" inputMode="decimal" placeholder="Waste %"
                value={l.wastage_pct === "0.00" ? "" : l.wastage_pct}
                onChange={(e) => setLine(i, { wastage_pct: e.target.value })}
                disabled={!!l.sub_recipe} />
              <button className="btn-ghost text-clay text-sm"
                onClick={() => setLines(lines.filter((_, ix) => ix !== i))}>
                ✕
              </button>
            </div>
          ))}
        </div>
        <button className="btn-ghost text-xs mt-2" onClick={() => setLines([...lines, { ...EMPTY_LINE }])}>
          + Add ingredient
        </button>
        <div className="flex gap-2 mt-4">
          <button className="btn-ghost flex-1" onClick={onCancel}>Cancel</button>
          <button className="btn-primary flex-1" disabled={!valid || save.isPending}
            onClick={() => save.mutate()}>
            Save recipe
          </button>
        </div>
      </div>
    </div>
  );
}
