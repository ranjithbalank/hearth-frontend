import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Badge, Card, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { inr } from "../../lib/money";

interface Customer {
  id: number; name: string; mobile: string; customer_type: string; type_label: string;
  gstin: string; btc_enabled: boolean; outstanding: string; loyalty_points: number;
}

const TABS = [
  { key: "", label: "All" },
  { key: "guest", label: "Guests" },
  { key: "corporate", label: "Corporate" },
  { key: "agent", label: "Travel Agents" },
];

export function Customers() {
  const [tab, setTab] = useState("");
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["cust-master", tab],
    queryFn: async () => (await api.get<Customer[]>(`/customers/${tab ? `?type=${tab}` : ""}`)).data,
  });

  if (isLoading || !data) return <Spinner />;
  const rows = data.filter((c) =>
    !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.mobile.includes(q));

  return (
    <div>
      <PageHeader title="Customers" subtitle="Guest, corporate & travel-agent master" />
      <div className="flex items-center gap-2 mb-4">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`pill ${tab === t.key ? "bg-ink text-white" : "bg-hairline text-body"}`}>
            {t.label}
          </button>
        ))}
        <input className="input ml-auto w-56" placeholder="Search name or mobile…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-cream text-muted text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Mobile</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-left px-4 py-3">GSTIN</th>
              <th className="text-left px-4 py-3">BTC</th>
              <th className="text-right px-4 py-3">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-line">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 font-mono text-xs">{c.mobile}</td>
                <td className="px-4 py-3">{c.type_label}</td>
                <td className="px-4 py-3 text-muted">{c.gstin || "—"}</td>
                <td className="px-4 py-3">{c.btc_enabled ? <Badge tone="info">BTC</Badge> : "—"}</td>
                <td className="px-4 py-3 text-right">{inr(c.outstanding)}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="px-4 py-6 text-center text-muted">No customers.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
