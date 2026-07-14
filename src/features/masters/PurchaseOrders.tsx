import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Badge, Card, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { money } from "../../lib/money";

interface Po {
  id: number; po_no: string; supplier: string; status: string; total: string;
  lines: { ingredient: string; qty: string; rate: string }[];
}
const TABS = ["all", "pending", "approved", "received"];
const TONE: Record<string, "amber" | "info" | "pine"> = { pending: "amber", approved: "info", received: "pine" };

export function PurchaseOrders() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("all");
  const { data, isLoading } = useQuery({
    queryKey: ["po-master", tab],
    queryFn: async () => (await api.get<Po[]>(`/purchase-orders/${tab !== "all" ? `?status=${tab}` : ""}`)).data,
  });
  const act = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: string }) =>
      (await api.post(`/purchase-orders/${id}/${action}/`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["po-master"] }),
  });

  if (isLoading || !data) return <Spinner />;

  return (
    <div>
      <PageHeader title="Purchase Orders" subtitle="Lifecycle: pending → approved → received" />
      <div className="flex gap-2 mb-4">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`pill capitalize ${tab === t ? "bg-ink text-white" : "bg-hairline text-body"}`}>{t}</button>
        ))}
      </div>
      <div className="space-y-3">
        {data.map((po) => (
          <Card key={po.id}>
            <div className="flex items-center gap-3">
              <div className="font-semibold">{po.po_no || `PO #${po.id}`}</div>
              <span className="text-sm text-muted">{po.supplier}</span>
              <Badge tone={TONE[po.status] ?? "muted"}>{po.status}</Badge>
              <div className="ml-auto font-medium">{money(po.total)}</div>
              {po.status === "pending" && <button className="btn-outline" onClick={() => act.mutate({ id: po.id, action: "approve" })}>Approve</button>}
              {po.status === "approved" && <button className="btn-primary" onClick={() => act.mutate({ id: po.id, action: "receive" })}>Receive</button>}
            </div>
          </Card>
        ))}
        {!data.length && <div className="text-sm text-muted">No purchase orders in this state.</div>}
      </div>
    </div>
  );
}
