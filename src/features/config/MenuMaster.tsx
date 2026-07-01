import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Badge, Card, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { inr } from "../../lib/money";
import type { MenuItem } from "../../lib/types";

interface Category { id: number; name: string }

export function MenuMaster() {
  const qc = useQueryClient();
  const empty = { name: "", category: "", price: "", gst_rate: "5", diet: "veg" };
  const [form, setForm] = useState(empty);
  const [q, setQ] = useState("");

  const { data: cats } = useQuery({ queryKey: ["cats"], queryFn: async () => (await api.get<Category[]>("/pos/categories/")).data });
  const { data: items, isLoading } = useQuery({ queryKey: ["menu"], queryFn: async () => (await api.get<MenuItem[]>("/pos/menu-items/")).data });

  const create = useMutation({
    mutationFn: async () =>
      (await api.post("/pos/menu-items/", {
        name: form.name, category: Number(form.category), price: form.price,
        gst_rate: form.gst_rate, diet: form.diet,
      })).data,
    onSuccess: () => { setForm({ ...empty, category: form.category }); qc.invalidateQueries({ queryKey: ["menu"] }); },
  });

  const toggle = useMutation({
    mutationFn: async (m: MenuItem) => (await api.patch(`/pos/menu-items/${m.id}/`, { available: !m.available })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["menu"] }),
  });

  if (isLoading || !items) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Menu Master"
        subtitle="Items, categories, prices &amp; tax"
        action={<input className="input w-56" placeholder="Search item…" value={q} onChange={(e) => setQ(e.target.value)} />}
      />
      <Card className="mb-4">
        <div className="font-semibold mb-3">Add menu item</div>
        <div className="grid grid-cols-5 gap-2">
          <input className="input" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            <option value="">Category…</option>
            {cats?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input className="input" placeholder="Price" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          <select className="input" value={form.gst_rate} onChange={(e) => setForm({ ...form, gst_rate: e.target.value })}>
            <option value="5">5% GST</option>
            <option value="12">12% GST</option>
            <option value="18">18% GST</option>
          </select>
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
              <th className="text-left px-4 py-3">Item</th>
              <th className="text-left px-4 py-3">Category</th>
              <th className="text-left px-4 py-3">Diet</th>
              <th className="text-right px-4 py-3">Price</th>
              <th className="text-right px-4 py-3">GST</th>
              <th className="text-right px-4 py-3">Available</th>
            </tr>
          </thead>
          <tbody>
            {items.filter((m) => !q || m.name.toLowerCase().includes(q.toLowerCase())).map((m) => (
              <tr key={m.id} className="border-t border-line">
                <td className="px-4 py-3 font-medium">{m.name}</td>
                <td className="px-4 py-3 text-muted">{m.category_name}</td>
                <td className="px-4 py-3">
                  <Badge tone={m.diet === "veg" ? "pine" : "clay"}>{m.diet}</Badge>
                </td>
                <td className="px-4 py-3 text-right">{inr(m.price)}</td>
                <td className="px-4 py-3 text-right">{Number(m.gst_rate)}%</td>
                <td className="px-4 py-3 text-right">
                  <button
                    className={`pill ${m.available ? "bg-pine text-white" : "bg-hairline text-muted"}`}
                    onClick={() => toggle.mutate(m)}
                  >
                    {m.available ? "In stock" : "86'd"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
