import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

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
  const qc = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => (await api.get<Customer[]>("/customers/")).data,
  });

  const exportData = useMutation({
    mutationFn: async (c: Customer) => (await api.get(`/customers/${c.id}/export/`)).data,
    onSuccess: (d) => {
      const blob = new Blob([JSON.stringify(d, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `customer-${d.profile.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg("Data-subject export downloaded (DPDP).");
    },
  });
  const erase = useMutation({
    mutationFn: async (c: Customer) => (await api.post(`/customers/${c.id}/erase/`)).data,
    onSuccess: () => {
      setMsg("Customer PII anonymised (DPDP erasure).");
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
  });

  if (isLoading || !data) return <Spinner />;
  const loyalty = data.reduce((s, c) => s + c.loyalty_points, 0);
  const outstanding = data.reduce((s, c) => s + Number(c.outstanding), 0);

  return (
    <div>
      <PageHeader title="Guest CRM &amp; Loyalty" subtitle="Unified customer profiles" />
      {msg && <div className="card p-3 mb-4 bg-pine-50 text-pine font-medium">{msg}</div>}
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
              <th className="text-right px-4 py-3">DPDP</th>
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
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button className="btn-ghost text-xs py-1" onClick={() => exportData.mutate(c)}>Export</button>
                  <button className="btn-ghost text-xs py-1 text-clay" onClick={() => erase.mutate(c)}>Erase</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
