import { useQuery } from "@tanstack/react-query";

import { Badge, Card, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { inr } from "../../lib/money";

interface Recipe {
  id: number; item: string; price: string; plate_cost: string; margin_pct: number;
  ingredients: { name: string; qty: string; unit: string }[];
}

export function Recipes() {
  const { data, isLoading } = useQuery({
    queryKey: ["recipes"],
    queryFn: async () => (await api.get<Recipe[]>("/recipes/")).data,
  });

  if (isLoading || !data) return <Spinner />;

  return (
    <div>
      <PageHeader title="Recipes & BOM" subtitle="Plate cost &amp; margin · auto-deducts on KOT" />
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
          </Card>
        ))}
        {!data.length && <div className="text-sm text-muted">No recipes defined.</div>}
      </div>
    </div>
  );
}
