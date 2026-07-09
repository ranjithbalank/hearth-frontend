import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { usePrompt } from "../../design/Prompt";
import { useToast } from "../../design/Toast";
import { Badge, Card, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { useApp } from "../../lib/app-context";
import { toCsv, parseCsv, downloadFile } from "../../lib/csv";
import { amount } from "../../lib/inputs";
import { inr } from "../../lib/money";
import type { MenuItem } from "../../lib/types";

interface Category { id: number; name: string }

const CSV_COLUMNS = ["Name", "Category", "Price", "GST Rate", "Diet", "Station"];

export function MenuMaster() {
  const qc = useQueryClient();
  const toast = useToast();
  const ask = usePrompt();
  const { property } = useApp();
  // Combined mode: no separate Bar Menu Master, so beverages are managed
  // right here too — station picker appears, and bar categories show up
  // alongside the restaurant's own.
  const barCombined = property?.entitlement.bar_mode === "combined";
  const empty = { name: "", category: "", price: "", gst_rate: "5", diet: "veg", station: "kitchen" };
  const [form, setForm] = useState(empty);
  const [q, setQ] = useState("");
  const [unavailableOnly, setUnavailableOnly] = useState(false);

  // Separate mode: restaurant categories only — the bar's own (Beer, Wine,
  // Cocktails…) live in Bar Menu Master, never mixed in here.
  const { data: cats } = useQuery({
    queryKey: ["cats", barCombined],
    queryFn: async () => (await api.get<Category[]>(`/pos/categories/${barCombined ? "" : "?is_bar=0"}`)).data,
  });
  const { data: items, isLoading } = useQuery({ queryKey: ["menu"], queryFn: async () => (await api.get<MenuItem[]>("/pos/menu-items/")).data });

  const create = useMutation({
    mutationFn: async () =>
      (await api.post("/pos/menu-items/", {
        name: form.name, category: Number(form.category), price: form.price,
        gst_rate: form.gst_rate, diet: form.diet,
        ...(barCombined ? { station: form.station } : {}),
      })).data,
    onSuccess: () => { setForm({ ...empty, category: form.category, station: form.station }); toast("Menu item added"); qc.invalidateQueries({ queryKey: ["menu"] }); },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not add item — check the values and try again", "error"),
  });

  const toggle = useMutation({
    mutationFn: async (m: MenuItem) => (await api.patch(`/pos/menu-items/${m.id}/`, { available: !m.available })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["menu"] }),
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ category: "", price: "", gst_rate: "5", diet: "veg" });
  function startEdit(m: MenuItem) {
    setEditingId(m.id);
    setEditForm({ category: String(m.category), price: String(m.price), gst_rate: String(m.gst_rate), diet: m.diet });
  }
  const saveEdit = useMutation({
    mutationFn: async (id: number) =>
      (await api.patch(`/pos/menu-items/${id}/`, {
        category: Number(editForm.category), price: editForm.price,
        gst_rate: editForm.gst_rate, diet: editForm.diet,
      })).data,
    onSuccess: () => { setEditingId(null); toast("Menu item updated"); qc.invalidateQueries({ queryKey: ["menu"] }); },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not save changes", "error"),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => api.delete(`/pos/menu-items/${id}/`),
    onSuccess: () => { toast("Item deleted"); qc.invalidateQueries({ queryKey: ["menu"] }); },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not delete that item", "error"),
  });

  function downloadTemplate() {
    const example = ["Veg Manchurian", cats?.[0]?.name ?? "Starters", "180", "5", "veg", "kitchen"];
    downloadFile("menu-item-template.csv", toCsv([CSV_COLUMNS, example]));
  }

  function exportMenu() {
    const rows = shown.map((m) => [m.name, m.category_name, m.price, m.gst_rate, m.diet, m.station]);
    downloadFile("menu-items.csv", toCsv([CSV_COLUMNS, ...rows]));
  }

  const [importing, setImporting] = useState(false);
  function importMenu(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // lets the same file be re-picked after fixing errors
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const rows = parseCsv(String(reader.result));
      if (rows.length < 2) { toast("That file has no data rows", "error"); return; }
      const header = rows[0].map((h) => h.trim().toLowerCase());
      const idx = {
        name: header.indexOf("name"), category: header.indexOf("category"),
        price: header.indexOf("price"), gst: header.indexOf("gst rate"),
        diet: header.indexOf("diet"), station: header.indexOf("station"),
      };
      if (idx.name < 0 || idx.category < 0 || idx.price < 0) {
        toast("The file needs Name, Category and Price columns — download the template to check the format", "error");
        return;
      }
      const catByName = new Map((cats ?? []).map((c) => [c.name.trim().toLowerCase(), c.id]));
      setImporting(true);
      let ok = 0;
      const failed: string[] = [];
      for (const row of rows.slice(1)) {
        const name = row[idx.name]?.trim();
        const catName = row[idx.category]?.trim();
        const price = row[idx.price]?.trim();
        if (!name || !catName || !price) continue;
        const catId = catByName.get(catName.toLowerCase());
        if (!catId) { failed.push(`${name} — unknown category "${catName}"`); continue; }
        try {
          await api.post("/pos/menu-items/", {
            name, category: catId, price,
            gst_rate: idx.gst >= 0 ? (row[idx.gst]?.trim() || "5") : "5",
            diet: idx.diet >= 0 ? (row[idx.diet]?.trim() || "veg") : "veg",
            ...(barCombined && idx.station >= 0 ? { station: row[idx.station]?.trim() || "kitchen" } : {}),
          });
          ok++;
        } catch (err: any) {
          failed.push(`${name} — ${err?.response?.data?.detail ?? "could not add"}`);
        }
      }
      setImporting(false);
      qc.invalidateQueries({ queryKey: ["menu"] });
      if (failed.length) console.warn("Menu import — rows that failed:", failed);
      toast(
        `${ok} item(s) imported${failed.length ? `, ${failed.length} skipped (see console)` : ""}`,
        failed.length ? "error" : "success",
      );
    };
    reader.readAsText(file);
  }

  const setImage = useMutation({
    mutationFn: async ({ id, image }: { id: number; image: string }) =>
      (await api.patch(`/pos/menu-items/${id}/`, { image })).data,
    onSuccess: () => { toast("Photo updated"); qc.invalidateQueries({ queryKey: ["menu"] }); },
  });

  // Resize the chosen photo to a small data URL (same pattern as the property logo).
  function pickImage(m: MenuItem) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const img = new Image();
      img.onload = () => {
        const size = 240;
        const scale = Math.max(size / img.width, size / img.height);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        setImage.mutate({ id: m.id, image: canvas.toDataURL("image/jpeg", 0.75) });
      };
      img.src = URL.createObjectURL(file);
    };
    input.click();
  }

  if (isLoading || !items) return <Spinner />;

  // Separate mode: the bar runs its own menu (see Bar Menu Master) — keep it
  // out of the restaurant's own item list. Combined: show everything.
  const shown = barCombined ? items : items.filter((m) => m.station !== "bar");
  const unavailableCount = shown.filter((m) => !m.available).length;
  const visible = shown
    .filter((m) => !q || m.name.toLowerCase().includes(q.toLowerCase()))
    .filter((m) => !unavailableOnly || !m.available);

  return (
    <div>
      <PageHeader
        title="Menu Master"
        subtitle="Items, categories, prices &amp; tax"
        action={
          <div className="flex items-center gap-2">
            {unavailableCount > 0 && (
              <button
                className={`pill ${unavailableOnly ? "bg-clay text-white" : "bg-clay-50 text-clay"}`}
                onClick={() => setUnavailableOnly((v) => !v)}
                title="Show only 86'd items"
              >
                {unavailableCount} unavailable
              </button>
            )}
            <input className="input w-56" placeholder="Search item…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        }
      />

      <div className="flex items-center gap-2 mb-4">
        <button className="btn-outline text-sm" onClick={downloadTemplate}>⬇ Download template</button>
        <button className="btn-outline text-sm" onClick={exportMenu}>⬇ Export menu (CSV)</button>
        <label className={`btn-outline text-sm cursor-pointer ${importing ? "opacity-50 pointer-events-none" : ""}`}>
          {importing ? "Importing…" : "⬆ Import CSV"}
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={importMenu} disabled={importing} />
        </label>
        <span className="text-xs text-muted">Fill the template's Category column with an existing category name — new items land there.</span>
      </div>

      <Card className="mb-4">
        <div className="font-semibold mb-3">Add menu item</div>
        <div className={`grid gap-2 ${barCombined ? "grid-cols-6" : "grid-cols-5"}`}>
          <input className="input" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            <option value="">Category…</option>
            {cats?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input className="input" inputMode="decimal" placeholder="Price" value={form.price} onChange={(e) => setForm({ ...form, price: amount(e.target.value) })} />
          <select className="input" value={form.gst_rate} onChange={(e) => setForm({ ...form, gst_rate: e.target.value })}>
            <option value="5">5% GST</option>
            <option value="12">12% GST</option>
            <option value="18">18% GST</option>
          </select>
          {barCombined && (
            <select className="input" value={form.station} onChange={(e) => setForm({ ...form, station: e.target.value })}>
              <option value="kitchen">Kitchen dish</option>
              <option value="bar">Beverage (bar)</option>
            </select>
          )}
          <select className="input" value={form.diet} onChange={(e) => setForm({ ...form, diet: e.target.value })}>
            <option value="veg">Veg</option>
            <option value="nonveg">Non-veg</option>
            <option value="egg">Egg</option>
          </select>
        </div>
        <button className="btn-primary mt-3" disabled={!form.name || !form.category || !form.price || create.isPending} onClick={() => create.mutate()}>
          Add item
        </button>
      </Card>

      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-cream text-muted text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Photo</th>
              <th className="text-left px-4 py-3">Item</th>
              <th className="text-left px-4 py-3">Category</th>
              <th className="text-left px-4 py-3">Diet</th>
              <th className="text-right px-4 py-3">Price</th>
              <th className="text-right px-4 py-3">GST</th>
              <th className="text-right px-4 py-3">Available</th>
              <th className="text-right px-4 py-3">&nbsp;</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((m) => {
              const editing = editingId === m.id;
              return (
                <tr key={m.id} className="border-t border-line">
                  <td className="px-4 py-2">
                    <button onClick={() => pickImage(m)} title="Upload photo"
                      className="h-10 w-10 rounded-lg border border-hairline overflow-hidden bg-cream flex items-center justify-center text-muted hover:border-pine">
                      {m.image ? <img src={m.image} alt="" className="h-full w-full object-cover" /> : "📷"}
                    </button>
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {m.name}
                    {barCombined && m.station === "bar" && <Badge tone="amber">bar</Badge>}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {editing ? (
                      <select className="input py-1 text-xs" value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}>
                        {cats?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    ) : m.category_name}
                  </td>
                  <td className="px-4 py-3">
                    {editing ? (
                      <select className="input py-1 text-xs" value={editForm.diet} onChange={(e) => setEditForm({ ...editForm, diet: e.target.value })}>
                        <option value="veg">Veg</option>
                        <option value="nonveg">Non-veg</option>
                        <option value="egg">Egg</option>
                      </select>
                    ) : <Badge tone={m.diet === "veg" ? "pine" : "clay"}>{m.diet}</Badge>}
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
                        <option value="12">12%</option>
                        <option value="18">18%</option>
                      </select>
                    ) : `${Number(m.gst_rate)}%`}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      className={`pill ${m.available ? "bg-pine text-white" : "bg-hairline text-muted"}`}
                      onClick={() => toggle.mutate(m)}
                    >
                      {m.available ? "In stock" : "86'd"}
                    </button>
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
                        <button
                          className="btn-ghost text-xs py-1 px-2 text-clay"
                          disabled={remove.isPending}
                          onClick={async () => {
                            const ok = await ask({
                              title: "Delete menu item", confirm: true, danger: true, confirmLabel: "Delete",
                              message: `Delete "${m.name}"? This can't be undone. If it's ever been ordered, deleting will be blocked — mark it 86'd instead.`,
                            });
                            if (ok) remove.mutate(m.id);
                          }}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            {!visible.length && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted text-sm">
                {unavailableOnly ? "Nothing 86'd right now." : "No items match your search."}
              </td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
