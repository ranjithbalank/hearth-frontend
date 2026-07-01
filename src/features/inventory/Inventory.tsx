import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Badge, PageHeader, Spinner, Stat } from "../../design/ui";
import { api } from "../../lib/api";
import { inr } from "../../lib/money";

interface Ingredient {
  id: number; name: string; unit: string; current_stock: string;
  reorder_level: string; unit_cost: string; below_par: boolean;
}

export function Inventory() {
  const [onlyLow, setOnlyLow] = useState(false);
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["ingredients"],
    queryFn: async () => (await api.get<Ingredient[]>("/inventory/")).data,
  });

  if (isLoading || !data) return <Spinner />;
  const low = data.filter((i) => i.below_par);
  const rows = (onlyLow ? low : data).filter((i) => !q || i.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <PageHeader
        title="Inventory & Stock"
        subtitle="Raw-material par levels"
        action={
          <div className="flex items-center gap-2">
            <input className="input w-48" placeholder="Search ingredient…" value={q} onChange={(e) => setQ(e.target.value)} />
            <button
              className={`pill border ${onlyLow ? "bg-amber text-white border-amber" : "border-hairline"}`}
              onClick={() => setOnlyLow((v) => !v)}
            >
              Below par only ({low.length})
            </button>
          </div>
        }
      />
      <div className="grid grid-cols-3 gap-4 mb-4">
        <Stat tone="dark" label="Ingredients tracked" value={data.length} />
        <Stat label="Below par" value={low.length} />
        <Stat label="Stock value" value={inr(data.reduce((s, i) => s + Number(i.current_stock) * Number(i.unit_cost), 0))} />
      </div>
      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-cream text-muted text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Ingredient</th>
              <th className="text-right px-4 py-3">In stock</th>
              <th className="text-right px-4 py-3">Reorder at</th>
              <th className="text-right px-4 py-3">Unit cost</th>
              <th className="text-left px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i.id} className="border-t border-line">
                <td className="px-4 py-3 font-medium">{i.name}</td>
                <td className="px-4 py-3 text-right">{Number(i.current_stock)} {i.unit}</td>
                <td className="px-4 py-3 text-right text-muted">{Number(i.reorder_level)} {i.unit}</td>
                <td className="px-4 py-3 text-right">{inr(i.unit_cost)}</td>
                <td className="px-4 py-3">
                  {i.below_par ? <Badge tone="clay">Reorder</Badge> : <Badge tone="pine">OK</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
