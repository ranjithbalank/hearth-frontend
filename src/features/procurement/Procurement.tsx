import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Badge, Card, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { inr } from "../../lib/money";

interface PoLine { ingredient: string; qty: string; rate: string; received_qty: string }
interface Po { id: number; supplier: string; status: string; total: string; lines: PoLine[] }

const TONE: Record<string, "info" | "amber" | "pine"> = {
  pending: "amber",
  approved: "info",
  received: "pine",
};

export function Procurement() {
  const qc = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);

  const { data: pos, isLoading } = useQuery({
    queryKey: ["pos"],
    queryFn: async () => (await api.get<Po[]>("/purchase-orders/")).data,
  });

  const approve = useMutation({
    mutationFn: async (po: Po) => (await api.post(`/purchase-orders/${po.id}/approve/`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pos"] }),
  });
  const receive = useMutation({
    mutationFn: async (po: Po) => (await api.post(`/purchase-orders/${po.id}/receive/`)).data,
    onSuccess: (_d, po) => {
      setMsg(`Goods received against PO #${po.id} — stock updated`);
      qc.invalidateQueries({ queryKey: ["pos"] });
    },
  });

  if (isLoading || !pos) return <Spinner />;

  return (
    <div>
      <PageHeader title="Procurement" subtitle="Purchase orders &amp; goods receipt" />
      {msg && <div className="card p-3 mb-4 bg-pine-50 text-pine font-medium">{msg}</div>}
      <div className="space-y-3">
        {pos.map((po) => (
          <Card key={po.id}>
            <div className="flex items-center gap-3">
              <div className="font-semibold">PO #{po.id}</div>
              <span className="text-sm text-muted">{po.supplier}</span>
              <Badge tone={TONE[po.status] ?? "muted"}>{po.status}</Badge>
              <div className="ml-auto font-medium">{inr(po.total)}</div>
              {po.status === "pending" && (
                <button className="btn-outline" onClick={() => approve.mutate(po)}>Approve</button>
              )}
              {po.status === "approved" && (
                <button className="btn-primary" onClick={() => receive.mutate(po)}>Receive (GRN)</button>
              )}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1 text-sm pl-1">
              {po.lines.map((l, i) => (
                <div key={i} className="flex justify-between border-b border-line py-1">
                  <span>{l.ingredient}</span>
                  <span className="text-muted">{Number(l.qty)} × {inr(l.rate)}</span>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
