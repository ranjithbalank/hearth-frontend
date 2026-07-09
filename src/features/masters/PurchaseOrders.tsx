import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useToast } from "../../design/Toast";
import { Badge, Card, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { useApp } from "../../lib/app-context";
import { toCsv, parseCsv, downloadFile } from "../../lib/csv";
import { inr } from "../../lib/money";

interface Po {
  id: number; supplier: string; status: string; total: string;
  lines: { ingredient: string; qty: string; rate: string }[];
}
interface SupplierOpt { id: number; name: string }
interface IngredientOpt { id: number; name: string; unit_cost: string }

const CSV_COLUMNS = ["PO Ref", "Supplier", "Raw Material", "Qty", "Rate"];
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

  // Only fetched to resolve names -> ids on import — the approve/receive
  // flow above never needs either of these.
  const { data: suppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => (await api.get<SupplierOpt[]>("/suppliers/")).data,
  });
  const { data: materials } = useQuery({
    queryKey: ["ingredients"],
    queryFn: async () => (await api.get<IngredientOpt[]>("/inventory/")).data,
  });

  function downloadTemplate() {
    downloadFile("purchase-order-template.csv", toCsv([
      CSV_COLUMNS,
      ["1", suppliers?.[0]?.name ?? "ABC Traders", materials?.[0]?.name ?? "Tomatoes", "10", "40"],
      ["1", suppliers?.[0]?.name ?? "ABC Traders", materials?.[1]?.name ?? "Onions", "5", "30"],
    ]));
  }

  function exportPos() {
    const rows = data!.flatMap((po) => po.lines.map((l) => [po.id, po.supplier, l.ingredient, l.qty, l.rate]));
    downloadFile("purchase-orders.csv", toCsv([CSV_COLUMNS, ...rows]));
  }

  const [importing, setImporting] = useState(false);
  function importPos(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const rows = parseCsv(String(reader.result));
      if (rows.length < 2) { toast("That file has no data rows", "error"); return; }
      const header = rows[0].map((h) => h.trim().toLowerCase());
      const idx = {
        ref: header.indexOf("po ref"), supplier: header.indexOf("supplier"),
        material: header.indexOf("raw material"), qty: header.indexOf("qty"), rate: header.indexOf("rate"),
      };
      if (idx.ref < 0 || idx.supplier < 0 || idx.material < 0 || idx.qty < 0) {
        toast("The file needs PO Ref, Supplier, Raw Material and Qty columns — download the template to check the format", "error");
        return;
      }
      const supplierByName = new Map((suppliers ?? []).map((s) => [s.name.trim().toLowerCase(), s.id]));
      const materialByName = new Map((materials ?? []).map((m) => [m.name.trim().toLowerCase(), m]));

      // Group data rows by "PO Ref" — every row sharing the same ref becomes
      // one line on the same PO, in file order.
      const groups = new Map<string, string[][]>();
      for (const row of rows.slice(1)) {
        const ref = row[idx.ref]?.trim();
        if (!ref) continue;
        if (!groups.has(ref)) groups.set(ref, []);
        groups.get(ref)!.push(row);
      }

      setImporting(true);
      let ok = 0;
      const failed: string[] = [];
      for (const [ref, groupRows] of groups) {
        const supplierName = groupRows[0][idx.supplier]?.trim();
        const supplierId = supplierName ? supplierByName.get(supplierName.toLowerCase()) : undefined;
        if (!supplierId) { failed.push(`PO ${ref} — unknown supplier "${supplierName}"`); continue; }
        const lines: { ingredient: number; qty: string; rate?: string }[] = [];
        let lineError = "";
        for (const row of groupRows) {
          const matName = row[idx.material]?.trim();
          const qty = row[idx.qty]?.trim();
          const mat = matName ? materialByName.get(matName.toLowerCase()) : undefined;
          if (!mat) { lineError = `unknown raw material "${matName}"`; break; }
          if (!qty || Number(qty) <= 0) { lineError = `bad quantity for "${matName}"`; break; }
          lines.push({ ingredient: mat.id, qty, rate: idx.rate >= 0 ? (row[idx.rate]?.trim() || undefined) : undefined });
        }
        if (lineError) { failed.push(`PO ${ref} — ${lineError}`); continue; }
        try {
          await api.post("/purchase-orders/", { supplier: supplierId, lines });
          ok++;
        } catch (err: any) {
          failed.push(`PO ${ref} — ${err?.response?.data?.detail ?? "could not raise"}`);
        }
      }
      setImporting(false);
      qc.invalidateQueries({ queryKey: ["po-master"] });
      if (failed.length) console.warn("PO import — groups that failed:", failed);
      toast(
        `${ok} purchase order(s) imported${failed.length ? `, ${failed.length} skipped (see console)` : ""}`,
        failed.length ? "error" : "success",
      );
    };
    reader.readAsText(file);
  }

  if (isLoading || !data) return <Spinner />;

  return (
    <div>
      <PageHeader title="Purchase Orders" subtitle="Lifecycle: pending → approved → received" />

      <div className="flex items-center gap-2 mb-4">
        <button className="btn-outline text-sm" onClick={downloadTemplate}>⬇ Download template</button>
        <button className="btn-outline text-sm" onClick={exportPos}>⬇ Export POs (CSV)</button>
        <label className={`btn-outline text-sm cursor-pointer ${importing ? "opacity-50 pointer-events-none" : ""}`}>
          {importing ? "Importing…" : "⬆ Import CSV"}
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={importPos} disabled={importing} />
        </label>
        <span className="text-xs text-muted">Rows sharing the same "PO Ref" become one PO with multiple lines.</span>
      </div>

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
              <div className="ml-auto font-medium">{inr(po.total)}</div>
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
