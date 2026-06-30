import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge, Card, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";

interface GstData {
  billing_mode: string;
  slabs: { id: number; name: string; rate: string; hsn_sac: string; applies_to: string }[];
}

export function GstMaster() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["gst-master"],
    queryFn: async () => (await api.get<GstData>("/gst-master/")).data,
  });
  const setMode = useMutation({
    mutationFn: async (mode: string) => (await api.post("/gst-master/billing_mode/", { mode })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gst-master"] }),
  });

  if (isLoading || !data) return <Spinner />;

  return (
    <div>
      <PageHeader title="GST Master" subtitle="Rate slabs & billing mode" />

      <Card className="mb-4">
        <div className="font-semibold mb-1">Billing mode</div>
        <div className="text-sm text-muted mb-3">
          With-GST issues a tax invoice (GSTR-1). Without-GST issues a bill of supply.
        </div>
        <div className="flex gap-2">
          {[
            { k: "with_gst", label: "With GST (tax invoice)" },
            { k: "without_gst", label: "Without GST (bill of supply)" },
          ].map((m) => (
            <button key={m.k} onClick={() => setMode.mutate(m.k)}
              className={`rounded-card border p-3 text-sm ${data.billing_mode === m.k ? "border-pine bg-pine-50" : "border-hairline"}`}>
              {m.label}
            </button>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-cream text-muted text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Slab</th>
              <th className="text-right px-4 py-3">Rate</th>
              <th className="text-left px-4 py-3">HSN/SAC</th>
              <th className="text-left px-4 py-3">Applies to</th>
            </tr>
          </thead>
          <tbody>
            {data.slabs.map((s) => (
              <tr key={s.id} className="border-t border-line">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3 text-right"><Badge tone="info">{Number(s.rate)}%</Badge></td>
                <td className="px-4 py-3 font-mono text-xs">{s.hsn_sac}</td>
                <td className="px-4 py-3 text-muted">{s.applies_to}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
