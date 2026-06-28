import { useQuery } from "@tanstack/react-query";

import { Badge, Card, PageHeader, Spinner, Stat } from "../../design/ui";
import { api } from "../../lib/api";
import { inr } from "../../lib/money";

interface Customer {
  id: number; name: string; mobile: string; type_label: string; customer_type: string;
  gstin: string; outstanding: string; loyalty_points: number; btc_enabled: boolean;
}

const TONE: Record<string, "pine" | "info" | "amber"> = {
  guest: "pine",
  corporate: "info",
  agent: "amber",
};

export function Crm() {
  const { data, isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => (await api.get<Customer[]>("/customers/")).data,
  });

  if (isLoading || !data) return <Spinner />;
  const loyalty = data.reduce((s, c) => s + c.loyalty_points, 0);
  const outstanding = data.reduce((s, c) => s + Number(c.outstanding), 0);

  return (
    <div>
      <PageHeader title="Guest CRM &amp; Loyalty" subtitle="Unified customer profiles" />
      <div className="grid grid-cols-3 gap-4 mb-5">
        <Stat tone="dark" label="Customers" value={data.length} />
        <Stat label="Loyalty points" value={loyalty.toLocaleString("en-IN")} />
        <Stat label="Outstanding (BTC/AR)" value={inr(outstanding)} />
      </div>

      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-cream text-muted text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Mobile</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-left px-4 py-3">GSTIN</th>
              <th className="text-right px-4 py-3">Loyalty</th>
              <th className="text-right px-4 py-3">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {data.map((c) => (
              <tr key={c.id} className="border-t border-line">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 font-mono text-xs">{c.mobile}</td>
                <td className="px-4 py-3"><Badge tone={TONE[c.customer_type] ?? "pine"}>{c.type_label}</Badge></td>
                <td className="px-4 py-3 text-muted">{c.gstin || "—"}</td>
                <td className="px-4 py-3 text-right">{c.loyalty_points}</td>
                <td className="px-4 py-3 text-right">{inr(c.outstanding)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
