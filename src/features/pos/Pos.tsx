import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Badge, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { useApp } from "../../lib/app-context";
import { inr } from "../../lib/money";
import type { Folio, MenuItem, Order, Table } from "../../lib/types";

type Mode = "dinein" | "takeaway" | "delivery";
interface Category { id: number; name: string }

export function Pos() {
  const qc = useQueryClient();
  const { property } = useApp();
  const hms = property?.entitlement.hms;

  const [mode, setMode] = useState<Mode>("dinein");
  const [table, setTable] = useState<Table | null>(null);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [cat, setCat] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const { data: tables } = useQuery({ queryKey: ["tables"], queryFn: async () => (await api.get<Table[]>("/pos/tables/")).data });
  const { data: cats } = useQuery({ queryKey: ["cats"], queryFn: async () => (await api.get<Category[]>("/pos/categories/")).data });
  const { data: items, isLoading } = useQuery({ queryKey: ["menu"], queryFn: async () => (await api.get<MenuItem[]>("/pos/menu-items/")).data });
  const { data: order } = useQuery({
    queryKey: ["order", orderId],
    queryFn: async () => (await api.get<Order>(`/pos/orders/${orderId}/`)).data,
    enabled: orderId !== null,
  });

  async function ensureOrder(): Promise<number> {
    if (orderId) return orderId;
    const o = (await api.post<Order>("/pos/orders/", { mode, table: table?.id ?? null })).data;
    setOrderId(o.id);
    return o.id;
  }

  const addItem = useMutation({
    mutationFn: async (item: MenuItem) => {
      const id = await ensureOrder();
      return (await api.post(`/pos/orders/${id}/add_item/`, { menu_item: item.id, qty: 1 })).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["order", orderId] }),
  });

  const setQty = useMutation({
    mutationFn: async ({ line, qty }: { line: number; qty: number }) =>
      (await api.post(`/pos/orders/${orderId}/set_qty/`, { line, qty })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["order", orderId] }),
  });

  const fireKot = useMutation({
    mutationFn: async () => (await api.post(`/pos/orders/${orderId}/fire_kot/`)).data,
    onSuccess: (o: Order) => { setMsg(`KOT fired: ${o.kot_no}`); qc.invalidateQueries({ queryKey: ["order", orderId] }); },
  });

  const settle = useMutation({
    mutationFn: async () => (await api.post(`/pos/orders/${orderId}/settle/`, { tender: "Cash" })).data,
    onSuccess: () => { setMsg("Settled (Cash)"); reset(); },
  });

  const postToRoom = useMutation({
    mutationFn: async () => {
      const folios = (await api.get<Folio[]>("/folios/?status=open")).data;
      if (!folios.length) throw new Error("No open folio");
      return (await api.post(`/pos/orders/${orderId}/post_to_room/`, { folio: folios[0].id })).data;
    },
    onSuccess: (o: Order) => { setMsg(`Posted to room (folio #${o.folio})`); reset(); },
    onError: () => setMsg("No open folio to post to"),
  });

  function reset() {
    setOrderId(null);
    setTable(null);
    qc.invalidateQueries({ queryKey: ["tables"] });
    qc.invalidateQueries({ queryKey: ["folios"] });
  }

  if (isLoading) return <Spinner />;
  const shown = cat ? items?.filter((i) => i.category === cat) : items;

  return (
    <div>
      <PageHeader title="Restaurant POS" subtitle="Orders · KOT · settlement" />
      {msg && <div className="card p-3 mb-4 bg-pine-50 text-pine font-medium">{msg}</div>}

      <div className="flex gap-2 mb-4">
        {(["dinein", "takeaway", "delivery"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); if (m !== "dinein") setTable(null); }}
            className={`pill border ${mode === m ? "bg-pine text-white border-pine" : "border-hairline text-body"}`}
          >
            {m}
          </button>
        ))}
      </div>

      {mode === "dinein" && (
        <div className="flex flex-wrap gap-2 mb-4">
          {tables?.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTable(t); setOrderId(null); }}
              className={`rounded-card border px-3 py-2 text-sm ${
                table?.id === t.id ? "bg-pine text-white border-pine" :
                t.status === "running" ? "bg-clay/90 text-white border-clay" : "border-hairline"
              }`}
            >
              {t.name} <span className="opacity-60 text-xs">({t.seats})</span>
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-[1fr_360px] gap-4">
        <div>
          <div className="flex flex-wrap gap-2 mb-3">
            <button onClick={() => setCat(null)} className={`pill ${!cat ? "bg-ink text-white" : "bg-hairline text-body"}`}>All</button>
            {cats?.map((c) => (
              <button key={c.id} onClick={() => setCat(c.id)} className={`pill ${cat === c.id ? "bg-ink text-white" : "bg-hairline text-body"}`}>{c.name}</button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {shown?.map((i) => (
              <button
                key={i.id}
                disabled={mode === "dinein" && !table}
                onClick={() => addItem.mutate(i)}
                className="card p-3 text-left hover:bg-cream disabled:opacity-40"
              >
                <div className="flex items-center gap-1.5">
                  <span className={`h-2.5 w-2.5 rounded-sm border ${i.diet === "veg" ? "border-pine" : "border-clay"}`}>
                    <span className={`block h-1 w-1 m-auto mt-0.5 rounded-full ${i.diet === "veg" ? "bg-pine" : "bg-clay"}`} />
                  </span>
                  <span className="font-medium text-sm">{i.name}</span>
                </div>
                <div className="text-sm text-muted mt-1">{inr(i.price)}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Order panel */}
        <div className="card p-4 h-fit sticky top-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold">
              {mode === "dinein" ? (table ? `Table ${table.name}` : "Pick a table") : mode}
            </div>
            {order?.kot_no && <Badge tone="amber">{order.kot_no}</Badge>}
          </div>

          {!order?.lines.length ? (
            <div className="text-sm text-muted py-8 text-center">No items yet.</div>
          ) : (
            <div className="space-y-2 mb-3">
              {order.lines.map((l) => (
                <div key={l.id} className="flex items-center gap-2 text-sm">
                  <div className="flex-1">{l.name}</div>
                  <div className="flex items-center gap-1">
                    <button className="h-6 w-6 rounded bg-hairline" onClick={() => setQty.mutate({ line: l.id, qty: l.qty - 1 })}>−</button>
                    <span className="w-6 text-center">{l.qty}</span>
                    <button className="h-6 w-6 rounded bg-hairline" onClick={() => setQty.mutate({ line: l.id, qty: l.qty + 1 })}>+</button>
                  </div>
                  <div className="w-16 text-right">{inr(Number(l.unit_price) * l.qty)}</div>
                </div>
              ))}
            </div>
          )}

          {order?.lines.length ? (
            <>
              <div className="border-t border-hairline pt-2 text-sm space-y-1">
                <Row label="Taxable" value={inr(order.totals.taxable)} />
                <Row label="CGST" value={inr(order.totals.cgst)} />
                <Row label="SGST" value={inr(order.totals.sgst)} />
                <div className="flex justify-between font-semibold text-base pt-1">
                  <span>Total</span><span>{inr(order.totals.total)}</span>
                </div>
              </div>
              <div className="grid gap-2 mt-4">
                <button className="btn-primary" onClick={() => fireKot.mutate()}>Fire KOT</button>
                <div className="grid grid-cols-2 gap-2">
                  <button className="btn-outline" onClick={() => settle.mutate()}>Settle cash</button>
                  {hms && <button className="btn-outline" onClick={() => postToRoom.mutate()}>Post to room</button>}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between text-muted"><span>{label}</span><span>{value}</span></div>;
}
