import { useQuery } from "@tanstack/react-query";

import { Badge, Card, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";

interface Supplier {
  id: number; name: string; gstin: string; contact: string;
  payment_terms: string; lead_time_days: number; rating: string;
}

export function Suppliers() {
  const { data, isLoading } = useQuery({
    queryKey: ["suppliers-master"],
    queryFn: async () => (await api.get<Supplier[]>("/suppliers/")).data,
  });
  if (isLoading || !data) return <Spinner />;
  return (
    <div>
      <PageHeader title="Suppliers" subtitle="Goods suppliers · lead time & rating" />
      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-cream text-muted text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Supplier</th>
              <th className="text-left px-4 py-3">GSTIN</th>
              <th className="text-left px-4 py-3">Terms</th>
              <th className="text-right px-4 py-3">Lead time</th>
              <th className="text-right px-4 py-3">Rating</th>
            </tr>
          </thead>
          <tbody>
            {data.map((s) => (
              <tr key={s.id} className="border-t border-line">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3 text-muted">{s.gstin || "—"}</td>
                <td className="px-4 py-3">{s.payment_terms || "—"}</td>
                <td className="px-4 py-3 text-right">{s.lead_time_days}d</td>
                <td className="px-4 py-3 text-right"><Badge tone="pine">{Number(s.rating).toFixed(1)}★</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
