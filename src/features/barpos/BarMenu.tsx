import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { usePrompt } from "../../design/Prompt";
import { useToast } from "../../design/Toast";
import { Badge, Card, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { amount } from "../../lib/inputs";
import { inr } from "../../lib/money";
import type { MenuItem } from "../../lib/types";

interface Category { id: number; name: string }

/** The bar's own dedicated menu — separate from the restaurant's Menu Master.
 *  Beverages live here by default; a kitchen dish only appears in Bar POS
 *  once it's explicitly added here (e.g. a bar guest asks for a side dish). */
export function BarMenu() {
  const qc = useQueryClient();
  const toast = useToast();
  const ask = usePrompt();
  const empty = { name: "", category: "", price: "", gst_rate: "18" };
  const [form, setForm] = useState(empty);
  const [showAddKitchen, setShowAddKitchen] = useState(false);
  const [newCat, setNewCat] = useState("");

  // The bar's own categories (Beer, Wine, Cocktails…) — never the
  // restaurant's (Rice Bowls, Starters…), even though it's one shared table.
  const { data: cats } = useQuery({ queryKey: ["bar-cats"], queryFn: async () => (await api.get<Category[]>("/pos/categories/?is_bar=1")).data });
  const { data: items, isLoading } = useQuery({ queryKey: ["menu"], queryFn: async () => (await api.get<MenuItem[]>("/pos/menu-items/")).data });

  const barItems = (items ?? []).filter((m) => m.bar_menu);
  const kitchenItems = (items ?? []).filter((m) => m.station !== "bar");

  const createCategory = useMutation({
    mutationFn: async () => (await api.post<Category>("/pos/categories/", { name: newCat, is_bar: true })).data,
    onSuccess: (c) => { setNewCat(""); setForm((f) => ({ ...f, category: String(c.id) })); toast(`"${c.name}" added to bar categories`); qc.invalidateQueries({ queryKey: ["bar-cats"] }); },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not add category", "error"),
  });

  const createBeverage = useMutation({
    mutationFn: async () =>
      (await api.post("/pos/menu-items/", {
        name: form.name, category: Number(form.category), price: form.price,
        gst_rate: form.gst_rate, diet: "veg", station: "bar",
      })).data,
    onSuccess: () => { setForm(empty); toast("Beverage added"); qc.invalidateQueries({ queryKey: ["menu"] }); },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not add beverage", "error"),
  });

  const setInBarMenu = useMutation({
    mutationFn: async ({ id, bar_menu }: { id: number; bar_menu: boolean }) =>
      (await api.patch(`/pos/menu-items/${id}/`, { bar_menu })).data,
    onSuccess: (_d, { bar_menu }) => { toast(bar_menu ? "Added to bar menu" : "Removed from bar menu"); qc.invalidateQueries({ queryKey: ["menu"] }); },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not update", "error"),
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ category: "", price: "", gst_rate: "18" });
  function startEdit(m: MenuItem) {
    setEditingId(m.id);
    setEditForm({ category: String(m.category), price: String(m.price), gst_rate: String(m.gst_rate) });
  }
  const saveEdit = useMutation({
    mutationFn: async (id: number) =>
      (await api.patch(`/pos/menu-items/${id}/`, {
        category: Number(editForm.category), price: editForm.price, gst_rate: editForm.gst_rate,
      })).data,
    onSuccess: () => { setEditingId(null); toast("Item updated"); qc.invalidateQueries({ queryKey: ["menu"] }); },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not save changes", "error"),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => api.delete(`/pos/menu-items/${id}/`),
    onSuccess: () => { toast("Beverage deleted"); qc.invalidateQueries({ queryKey: ["menu"] }); },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not delete that item", "error"),
  });

  if (isLoading || !items) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Bar Menu"
        subtitle="The bar's own menu — separate from the restaurant. Kitchen dishes only appear here once added below."
        action={
          <button className="btn-outline text-sm" onClick={() => setShowAddKitchen((v) => !v)}>
            {showAddKitchen ? "Hide kitchen dishes" : "+ Add a kitchen dish"}
          </button>
        }
      />

      <Card className="mb-4">
        <div className="font-semibold mb-1">Bar categories</div>
        <div className="text-xs text-muted mb-2">Beer, Wine, Cocktails, Spirits… — the bar's own list, separate from the restaurant's.</div>
        <div className="flex flex-wrap gap-2 mb-3">
          {cats?.map((c) => <Badge key={c.id} tone="amber">{c.name}</Badge>)}
          <div className="flex gap-1">
            <input className="input text-xs w-36" placeholder="New category…" value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && newCat.trim() && createCategory.mutate()} />
            <button className="btn-outline text-xs" disabled={!newCat.trim() || createCategory.isPending}
              onClick={() => createCategory.mutate()}>
              + Add
            </button>
          </div>
        </div>
      </Card>

      <Card className="mb-4">
        <div className="font-semibold mb-3">Add a beverage</div>
        <div className="grid grid-cols-5 gap-2">
          <input className="input" placeholder="Name (e.g. Gin & Tonic)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            <option value="">Category…</option>
            {cats?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input className="input" inputMode="decimal" placeholder="Price" value={form.price} onChange={(e) => setForm({ ...form, price: amount(e.target.value) })} />
          <select className="input" value={form.gst_rate} onChange={(e) => setForm({ ...form, gst_rate: e.target.value })}>
            <option value="5">5% GST</option>
            <option value="18">18% GST</option>
          </select>
          <button className="btn-primary" disabled={!form.name || !form.category || !form.price || createBeverage.isPending}
            onClick={() => createBeverage.mutate()}>
            Add beverage
          </button>
        </div>
      </Card>

      {showAddKitchen && (
        <Card className="mb-4">
          <div className="font-semibold mb-1">Add a kitchen dish to the bar menu</div>
          <div className="text-xs text-muted mb-3">
            It still fires a KOT to the shared kitchen and gets prepared there — only the charge lands on the bar's own tab.
          </div>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {kitchenItems.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-sm py-1.5 border-b border-line last:border-0">
                <span>{m.name} <span className="text-muted">· {inr(m.price)}</span></span>
                <button className={`pill text-xs ${m.bar_menu ? "bg-pine text-white" : "bg-hairline text-body"}`}
                  disabled={setInBarMenu.isPending}
                  onClick={() => setInBarMenu.mutate({ id: m.id, bar_menu: !m.bar_menu })}>
                  {m.bar_menu ? "On bar menu" : "Add to bar menu"}
                </button>
              </div>
            ))}
            {!kitchenItems.length && <div className="text-sm text-muted">No kitchen dishes yet.</div>}
          </div>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-cream text-muted text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Item</th>
              <th className="text-left px-4 py-3">Category</th>
              <th className="text-left px-4 py-3">Source</th>
              <th className="text-right px-4 py-3">Price</th>
              <th className="text-right px-4 py-3">GST</th>
              <th className="text-right px-4 py-3">&nbsp;</th>
            </tr>
          </thead>
          <tbody>
            {barItems.map((m) => {
              const editing = editingId === m.id;
              return (
                <tr key={m.id} className="border-t border-line">
                  <td className="px-4 py-3 font-medium">{m.name}</td>
                  <td className="px-4 py-3 text-muted">
                    {editing && m.station === "bar" ? (
                      <select className="input py-1 text-xs" value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}>
                        {cats?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    ) : m.category_name}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={m.station === "bar" ? "amber" : "pine"}>
                      {m.station === "bar" ? "Beverage" : "Kitchen dish"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editing ? (
                      <input className="input py-1 text-xs text-right w-24" inputMode="decimal"
                        value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: amount(e.target.value) })} />
                    ) : inr(m.price)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editing ? (
                      <select className="input py-1 text-xs" value={editForm.gst_rate} onChange={(e) => setEditForm({ ...editForm, gst_rate: e.target.value })}>
                        <option value="5">5%</option>
                        <option value="18">18%</option>
                      </select>
                    ) : `${Number(m.gst_rate)}%`}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {editing ? (
                      <>
                        <button className="btn-ghost text-xs py-1 px-2" disabled={saveEdit.isPending} onClick={() => setEditingId(null)}>Cancel</button>
                        <button className="btn-primary text-xs py-1 px-2" disabled={saveEdit.isPending} onClick={() => saveEdit.mutate(m.id)}>Save</button>
                      </>
                    ) : (
                      <>
                        <button className="btn-ghost text-xs py-1 px-2" onClick={() => startEdit(m)}>Edit</button>
                        {m.station === "bar" && (
                          <button
                            className="btn-ghost text-xs py-1 px-2 text-clay"
                            disabled={remove.isPending}
                            onClick={async () => {
                              const ok = await ask({
                                title: "Delete beverage", confirm: true, danger: true, confirmLabel: "Delete",
                                message: `Delete "${m.name}"? This can't be undone. If it's ever been ordered, deleting will be blocked.`,
                              });
                              if (ok) remove.mutate(m.id);
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            {!barItems.length && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted text-sm">No items on the bar menu yet.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
