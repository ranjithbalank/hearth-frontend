import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useToast } from "../../design/Toast";
import { Badge, Card, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { useApp } from "../../lib/app-context";
import { money } from "../../lib/money";

interface Po {
  id: number; supplier: string; status: string; total: string;
  lines: { ingredient: string; qty: string; rate: string }[];
}
const TABS = ["all", "pending", "approved", "received"];
const TONE: Record<string, "amber" | "info" | "pine"> = { pending: "amber", approved: "info", received: "pine" };
// Mirrors the backend's PO_APPROVER_ROLES / PO_HANDLER_ROLES (accounts/constants.py):
// Finance can reach this screen (via the "pomanage" module) to approve spend,
// but never raises or receives a PO itself — Restaurant Manager and Store
// Keeper physically handle the goods. Hiding the button (not just disabling
// it) avoids a click that would only ever come back a 403.
const PO_APPROVER_ROLES = new Set([
  "Super Admin", "Managing Director", "General Manager", "Finance", "Restaurant Manager",
]);
const PO_HANDLER_ROLES = new Set([
  "Super Admin", "Managing Director", "General Manager", "Restaurant Manager", "Store Keeper",
]);

export function PurchaseOrders() {
  const qc = useQueryClient();
  const toast = useToast();
  const { user } = useApp();
  const role = user?.role ?? "";
  const canApprove = PO_APPROVER_ROLES.has(role);
  const canHandle = PO_HANDLER_ROLES.has(role);
  const [tab, setTab] = useState("all");
  const { data, isLoading } = useQuery({
    queryKey: ["po-master", tab],
    queryFn: async () => (await api.get<Po[]>(`/purchase-orders/${tab !== "all" ? `?status=${tab}` : ""}`)).data,
  });
  const act = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: string }) =>
      (await api.post(`/purchase-orders/${id}/${action}/`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["po-master"] }),
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not update the purchase order", "error"),
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
              <div className="font-semibold">PO #{po.id}</div>
              <span className="text-sm text-muted">{po.supplier}</span>
              <Badge tone={TONE[po.status] ?? "muted"}>{po.status}</Badge>
              <div className="ml-auto font-medium">{money(po.total)}</div>
              {po.status === "pending" && canApprove && (
                <button className="btn-outline" onClick={() => act.mutate({ id: po.id, action: "approve" })}>Approve</button>
              )}
              {po.status === "approved" && canHandle && (
                <button className="btn-primary" onClick={() => act.mutate({ id: po.id, action: "receive" })}>Receive</button>
              )}
            </div>
          </Card>
        ))}
        {!data.length && <div className="text-sm text-muted">No purchase orders in this state.</div>}
      </div>
    </div>
  );
}
