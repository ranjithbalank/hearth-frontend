import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useToast } from "../../design/Toast";
import { Badge, Card, PageHeader } from "../../design/ui";
import { api, getAccess } from "../../lib/api";
import { currencySymbol, money } from "../../lib/money";

interface Uom { id: number; code: string; name: string }
interface CategoryRow { id: number; name: string }

interface Draft {
  name: string; unit: string; category: string; opening_stock: string;
  min_stock_level: string; reorder_level: string; unit_cost: string;
  storage_location: string; expiry_date: string;
}
const EMPTY: Draft = {
  name: "", unit: "kg", category: "", opening_stock: "",
  min_stock_level: "", reorder_level: "", unit_cost: "",
  storage_location: "", expiry_date: "",
};

/** New raw materials — dedicated page per spec §1 (no popup): fill the form,
 *  add each item to the staging list, then save the lot and land back on the
 *  Raw Material Master with everything in stock. */
export function NewRawMaterial() {
  const nav = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const [f, setF] = useState<Draft>(EMPTY);
  const [staged, setStaged] = useState<Draft[]>([]);
  const [importResult, setImportResult] = useState<{
    created: number; skipped_existing: string[];
    errors: { row: number; name: string; reason: string }[];
  } | null>(null);

  const { data: uoms } = useQuery({
    queryKey: ["inv-uoms"],
    queryFn: async () => (await api.get<Uom[]>("/inventory-uoms/")).data,
  });
  const { data: categories } = useQuery({
    queryKey: ["inv-categories"],
    queryFn: async () => (await api.get<CategoryRow[]>("/inventory-categories/")).data,
  });

  const set = (k: keyof Draft) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  function addToList() {
    const name = f.name.trim();
    if (!name) return;
    if (staged.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      toast(`"${name}" is already on the list`, "error");
      return;
    }
    setStaged([...staged, { ...f, name }]);
    setF({ ...EMPTY, unit: f.unit, category: f.category }); // keep unit/category for fast entry
  }

  // Whatever is still typed in the form counts too — nobody should lose an
  // item because they pressed Save before "Add to list".
  const toSave: Draft[] = f.name.trim()
    ? [...staged, { ...f, name: f.name.trim() }]
    : staged;

  const saveAll = useMutation({
    mutationFn: async () => {
      // Create each material, then book its opening stock through the ledger
      // (an 'adjustment' movement) so the register explains where it came from.
      const saved: string[] = [];
      for (const s of toSave) {
        try {
          const body = {
            name: s.name, unit: s.unit, category: s.category,
            min_stock_level: s.min_stock_level || "0",
            reorder_level: s.reorder_level || "0",
            unit_cost: s.unit_cost || "0",
            storage_location: s.storage_location,
            expiry_date: s.expiry_date || null,
          };
          const created = (await api.post("/inventory/", body)).data;
          if (Number(s.opening_stock) > 0) {
            await api.post(`/inventory/${created.id}/adjust/`,
              { qty: s.opening_stock, reason: "opening stock" });
          }
          saved.push(s.name);
        } catch (e: any) {
          const d = e?.response?.data;
          const why = d?.name?.[0] ?? d?.unit?.[0] ?? d?.category?.[0] ?? d?.detail ?? "could not save";
          throw new Error(`"${s.name}": ${why}${saved.length ? ` (already saved: ${saved.join(", ")})` : ""}`);
        }
      }
      return saved.length;
    },
    onSuccess: (n) => {
      toast(`${n} raw material(s) added to stock`);
      qc.invalidateQueries({ queryKey: ["ingredients"] });
      nav("/store/materials");
    },
    onError: (e: any) => toast(e?.message ?? "Could not save — check the list", "error"),
  });

  return (
    <div>
      <PageHeader
        title="New raw materials"
        subtitle="Spec §1 — fill the form, add each item to the list, then save the lot"
        action={
          <button className="btn-ghost text-sm" onClick={() => nav("/store/materials")}>
            ← Raw material master
          </button>
        }
      />

      {/* Bulk onboarding: download the format, fill it in Excel, upload once. */}
      <Card className="mb-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[260px]">
            <div className="font-semibold">Import from Excel / CSV</div>
            <div className="text-sm text-muted">
              Onboarding many materials? Download the format, fill it in Excel
              (or export from your old system), and upload — opening stock is
              booked automatically, new categories/units are created for you.
            </div>
          </div>
          <button className="btn-outline text-sm"
            onClick={async () => {
              const res = await fetch("/api/inventory/import/", {
                headers: { Authorization: `Bearer ${getAccess()}` },
              });
              const url = URL.createObjectURL(await res.blob());
              const a = document.createElement("a");
              a.href = url;
              a.download = "raw-materials-template.csv";
              a.click();
              URL.revokeObjectURL(url);
            }}>
            ⬇ Download format
          </button>
          <label className="btn-primary text-sm cursor-pointer">
            ⬆ Upload file
            <input type="file" accept=".csv,.xlsx" className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                e.target.value = "";
                const fd = new FormData();
                fd.append("file", file);
                try {
                  const r = (await api.post("/inventory/import/", fd)).data as {
                    created: number; skipped_existing: string[];
                    errors: { row: number; name: string; reason: string }[];
                  };
                  setImportResult(r);
                  if (r.created && !r.errors.length) {
                    toast(`${r.created} material(s) imported to stock`);
                    qc.invalidateQueries({ queryKey: ["ingredients"] });
                  }
                } catch (err: any) {
                  toast(err?.response?.data?.detail ?? "Import failed — use the downloaded format", "error");
                }
              }} />
          </label>
        </div>
        {importResult && (
          <div className="border-t border-line mt-3 pt-3 text-sm space-y-1">
            <div>
              <Badge tone="pine">{importResult.created} created</Badge>{" "}
              {!!importResult.skipped_existing.length && (
                <span className="text-muted text-xs">
                  skipped (already exist): {importResult.skipped_existing.join(", ")}
                </span>
              )}
            </div>
            {importResult.errors.map((er) => (
              <div key={er.row} className="text-clay text-xs">
                Row {er.row} — {er.name}: {er.reason}
              </div>
            ))}
            {importResult.created > 0 && (
              <button className="btn-outline text-xs py-1 mt-1" onClick={() => nav("/store/materials")}>
                View in Raw Material Master →
              </button>
            )}
          </div>
        )}
      </Card>

      <div className="text-xs uppercase tracking-wide text-muted mb-2">Or add one by one</div>
      <Card className="mb-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-1">
            <label className="text-xs text-muted">Raw material name *</label>
            <input className="input w-full" autoFocus placeholder="e.g. Basmati Rice"
              value={f.name} onChange={set("name")}
              onKeyDown={(e) => e.key === "Enter" && addToList()} />
          </div>
          <div>
            <label className="text-xs text-muted">Category</label>
            <select className="input w-full" value={f.category} onChange={set("category")}>
              <option value="">Select…</option>
              {categories?.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted">Base consumption unit *</label>
            <select className="input w-full" value={f.unit} onChange={set("unit")}>
              {uoms?.map((u) => <option key={u.id} value={u.code}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted">Opening stock ({f.unit})</label>
            <input className="input w-full" inputMode="decimal" placeholder="0"
              value={f.opening_stock} onChange={set("opening_stock")} />
          </div>
          <div>
            <label className="text-xs text-muted">Minimum stock level</label>
            <input className="input w-full" inputMode="decimal" placeholder="0"
              value={f.min_stock_level} onChange={set("min_stock_level")} />
          </div>
          <div>
            <label className="text-xs text-muted">Reorder level</label>
            <input className="input w-full" inputMode="decimal" placeholder="0"
              value={f.reorder_level} onChange={set("reorder_level")} />
          </div>
          <div>
            <label className="text-xs text-muted">Purchase rate ({currencySymbol()} per {f.unit})</label>
            <input className="input w-full" inputMode="decimal" placeholder="0"
              value={f.unit_cost} onChange={set("unit_cost")} />
          </div>
          <div>
            <label className="text-xs text-muted">Storage location / warehouse</label>
            <input className="input w-full" placeholder="e.g. Dry store"
              value={f.storage_location} onChange={set("storage_location")} />
          </div>
          <div>
            <label className="text-xs text-muted">Expiry date (if applicable)</label>
            <input className="input w-full" type="date" value={f.expiry_date} onChange={set("expiry_date")} />
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <button className="btn-primary" disabled={!f.name.trim()} onClick={addToList}>
            ＋ Add to list
          </button>
        </div>
      </Card>

      <div className="text-xs uppercase tracking-wide text-muted mb-2">
        Items to add ({staged.length})
      </div>
      <div className="card overflow-x-auto p-0 mb-4">
        <table className="w-full text-sm">
          <thead className="bg-cream text-muted text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Material</th>
              <th className="text-left px-4 py-3">Category</th>
              <th className="text-left px-4 py-3">Unit</th>
              <th className="text-right px-4 py-3">Opening stock</th>
              <th className="text-right px-4 py-3">Min / Reorder</th>
              <th className="text-right px-4 py-3">Rate</th>
              <th className="text-left px-4 py-3">Location</th>
              <th className="text-left px-4 py-3">Expiry</th>
              <th className="text-right px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {staged.map((s, ix) => (
              <tr key={s.name} className="border-t border-line">
                <td className="px-4 py-2.5 font-medium">{s.name}</td>
                <td className="px-4 py-2.5 text-xs text-muted">{s.category || "—"}</td>
                <td className="px-4 py-2.5"><Badge tone="muted">{s.unit}</Badge></td>
                <td className="px-4 py-2.5 text-right">{s.opening_stock || "0"} {s.unit}</td>
                <td className="px-4 py-2.5 text-right text-muted">{s.min_stock_level || "0"} / {s.reorder_level || "0"}</td>
                <td className="px-4 py-2.5 text-right">{money(s.unit_cost || 0)}</td>
                <td className="px-4 py-2.5 text-xs text-muted">{s.storage_location || "—"}</td>
                <td className="px-4 py-2.5 text-xs text-muted">{s.expiry_date || "—"}</td>
                <td className="px-4 py-2.5 text-right">
                  <button className="btn-ghost text-xs text-clay"
                    onClick={() => setStaged(staged.filter((_, i) => i !== ix))}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {!staged.length && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-muted text-sm">
                Nothing on the list yet — fill the form above and press "Add to list".
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end gap-2">
        <button className="btn-ghost" onClick={() => nav("/store/materials")}>Cancel</button>
        <button className="btn-primary" disabled={!toSave.length || saveAll.isPending}
          onClick={() => saveAll.mutate()}>
          {saveAll.isPending ? "Saving…" : `Save ${toSave.length || ""} material(s) to stock`}
        </button>
      </div>
    </div>
  );
}
