import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { Badge, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { useApp } from "../../lib/app-context";
import { inr } from "../../lib/money";
import { cacheMenu, enqueue, getCachedMenu, uuid, type OfflineBill } from "../../lib/offline";
import { useOnline } from "../../lib/useOnline";
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

  const { online, queued, sync } = useOnline();
  // Cache the menu so the POS keeps working through an outage (NFR-002).
  useEffect(() => { if (items?.length) cacheMenu(items); }, [items]);

  async function ensureOrder(): Promise<number> {
    if (orderId) return orderId;
    const o = (await api.post<Order>("/pos/orders/", { mode, table: table?.id ?? null })).data;
    setOrderId(o.id);
    return o.id;
  }

  const [picker, setPicker] = useState<MenuItem | null>(null);

  const addItem = useMutation({
    mutationFn: async (payload: { menu_item: number; qty: number; variant?: number; addons?: number[] }) => {
      const id = await ensureOrder();
      return (await api.post(`/pos/orders/${id}/add_item/`, payload)).data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["order", orderId] }); setPicker(null); },
    onError: (e: any) => setMsg(e?.response?.data?.detail ?? "Could not add item"),
  });

  function onItemClick(item: MenuItem) {
    if ((item.variants?.length ?? 0) > 0 || (item.addon_groups?.length ?? 0) > 0) {
      setPicker(item);
    } else {
      addItem.mutate({ menu_item: item.id, qty: 1 });
    }
  }

  const setQty = useMutation({
    mutationFn: async ({ line, qty }: { line: number; qty: number }) =>
      (await api.post(`/pos/orders/${orderId}/set_qty/`, { line, qty })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["order", orderId] }),
  });

  const fireKot = useMutation({
    mutationFn: async () => (await api.post(`/pos/orders/${orderId}/fire_kot/`)).data,
    onSuccess: (o: Order) => { setMsg(`KOT fired: ${o.kot_no}`); qc.invalidateQueries({ queryKey: ["order", orderId] }); },
  });

  const applyDiscount = useMutation({
    mutationFn: async (body: { kind: string; value: number; reason: string; override?: string }) =>
      (await api.post(`/pos/orders/${orderId}/apply_discount/`, body)).data,
    onSuccess: () => { setMsg("Discount applied"); qc.invalidateQueries({ queryKey: ["order", orderId] }); },
    onError: async (e: any) => {
      if (e?.response?.data?.cap_exceeded) {
        const code = window.prompt(`${e.response.data.detail}\nEnter manager passcode to override:`);
        if (code) applyDiscount.mutate({ ...lastDiscount.current!, override: code });
      } else {
        setMsg(e?.response?.data?.detail ?? "Discount failed");
      }
    },
  });
  const lastDiscount = useRef<{ kind: string; value: number; reason: string } | null>(null);

  const applyCoupon = useMutation({
    mutationFn: async (code: string) =>
      (await api.post(`/pos/orders/${orderId}/apply_coupon/`, { code })).data,
    onSuccess: () => { setMsg("Coupon applied"); qc.invalidateQueries({ queryKey: ["order", orderId] }); },
    onError: (e: any) => setMsg(e?.response?.data?.detail ?? "Invalid coupon"),
  });

  const move = useMutation({
    mutationFn: async (dest: number) => (await api.post(`/pos/orders/${orderId}/move/`, { table: dest })).data,
    onSuccess: () => { setMsg("Order moved"); reset(); },
  });
  const voidOrder = useMutation({
    mutationFn: async (override: string) =>
      (await api.post(`/pos/orders/${orderId}/void/`, { override, reason: "voided at POS" })).data,
    onSuccess: () => { setMsg("Order voided"); reset(); },
    onError: (e: any) => setMsg(e?.response?.data?.detail ?? "Void failed"),
  });

  const settle = useMutation({
    mutationFn: async (tender: string) =>
      (await api.post(`/pos/orders/${orderId}/settle/`, {
        tender, token: tender === "Gateway" ? "tok_demo_card" : undefined,
      })).data,
    onSuccess: (_d, tender) => { setMsg(`Settled (${tender})`); reset(); },
    onError: (e: any) => setMsg(e?.response?.data?.detail ?? "Payment failed"),
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

  if (isLoading && online) return <Spinner />;
  const shown = cat ? items?.filter((i) => i.category === cat) : items;

  const banner = (!online || queued > 0) && (
    <div className={`card p-3 mb-4 flex items-center gap-3 ${online ? "bg-amber-50" : "bg-clay/10"}`}>
      <Badge tone={online ? "amber" : "clay"}>{online ? "Back online" : "Offline"}</Badge>
      <span className="text-sm flex-1">
        {online
          ? `${queued} offline bill(s) waiting to sync.`
          : "Billing continues locally — bills will sync automatically when the connection returns."}
      </span>
      {online && queued > 0 && (
        <button className="btn-primary text-xs py-1" onClick={() => sync().then((n) => n && setMsg(`Synced ${n} offline bill(s)`))}>
          Sync now ({queued})
        </button>
      )}
    </div>
  );

  // Offline: render the self-contained offline-billing panel (NFR-002).
  if (!online) {
    return (
      <div>
        <PageHeader title="Restaurant POS" subtitle="Offline mode" />
        {banner}
        <OfflineBilling mode={mode} table={table} onQueued={() => setMsg("Bill saved offline")} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Restaurant POS" subtitle="Orders · KOT · settlement" />
      {banner}
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
                onClick={() => onItemClick(i)}
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
                <Row label="Subtotal" value={inr(order.totals.subtotal)} />
                {Number(order.totals.discount) > 0 && (
                  <div className="flex justify-between text-clay">
                    <span>Discount{order.coupon_code ? ` (${order.coupon_code})` : ""}</span>
                    <span>−{inr(order.totals.discount)}</span>
                  </div>
                )}
                <Row label="Taxable" value={inr(order.totals.taxable)} />
                <Row label="CGST" value={inr(order.totals.cgst)} />
                <Row label="SGST" value={inr(order.totals.sgst)} />
                <div className="flex justify-between font-semibold text-base pt-1">
                  <span>Total</span><span>{inr(order.totals.total)}</span>
                </div>
              </div>

              <div className="flex gap-2 mt-3">
                <button
                  className="btn-ghost text-xs flex-1"
                  onClick={() => {
                    const v = Number(window.prompt("Discount % (within your cap):", "10"));
                    if (!v) return;
                    const reason = window.prompt("Reason for discount:") || "";
                    if (!reason) { setMsg("A reason is required"); return; }
                    lastDiscount.current = { kind: "percent", value: v, reason };
                    applyDiscount.mutate({ kind: "percent", value: v, reason });
                  }}
                >
                  % Discount
                </button>
                <button
                  className="btn-ghost text-xs flex-1"
                  onClick={() => {
                    const code = window.prompt("Coupon code:");
                    if (code) applyCoupon.mutate(code);
                  }}
                >
                  Coupon
                </button>
              </div>

              <div className="flex gap-2 mt-2">
                <button
                  className="btn-ghost text-xs flex-1"
                  onClick={() => {
                    const name = window.prompt("Move to table (name):");
                    const dest = tables?.find((t) => t.name.toLowerCase() === (name ?? "").toLowerCase());
                    if (dest) move.mutate(dest.id); else if (name) setMsg("Table not found");
                  }}
                >
                  Move
                </button>
                <button
                  className="btn-ghost text-xs flex-1 text-clay"
                  onClick={() => {
                    const code = window.prompt("Void order — manager passcode:");
                    if (code) voidOrder.mutate(code);
                  }}
                >
                  Void
                </button>
              </div>

              <div className="grid gap-2 mt-3">
                <button className="btn-primary" onClick={() => fireKot.mutate()}>Fire KOT</button>
                <div className="grid grid-cols-2 gap-2">
                  <button className="btn-outline" onClick={() => settle.mutate("Cash")}>Settle cash</button>
                  <button className="btn-outline" onClick={() => settle.mutate("Gateway")}>Card (gateway)</button>
                </div>
                {hms && <button className="btn-outline" onClick={() => postToRoom.mutate()}>Post to room</button>}
              </div>
            </>
          ) : null}
        </div>
      </div>

      {picker && (
        <ItemPicker
          item={picker}
          onCancel={() => setPicker(null)}
          onAdd={(variant, addons) => addItem.mutate({ menu_item: picker.id, qty: 1, variant, addons })}
        />
      )}
    </div>
  );
}

function ItemPicker({
  item,
  onCancel,
  onAdd,
}: {
  item: MenuItem;
  onCancel: () => void;
  onAdd: (variant: number | undefined, addons: number[]) => void;
}) {
  const [variant, setVariant] = useState<number | undefined>(item.variants?.[0]?.id);
  const [addons, setAddons] = useState<number[]>([]);

  function toggle(id: number, group: { max_select: number; options: { id: number }[] }) {
    setAddons((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      const groupIds = group.options.map((o) => o.id);
      const inGroup = cur.filter((x) => groupIds.includes(x));
      if (group.max_select && inGroup.length >= group.max_select) {
        return [...cur.filter((x) => !groupIds.includes(x)), id]; // replace within single-select
      }
      return [...cur, id];
    });
  }

  const missing = (item.addon_groups ?? []).filter(
    (g) => g.min_select > 0 && !g.options.some((o) => addons.includes(o.id)),
  );

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="card p-5 w-[420px] max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="font-display text-xl mb-3">{item.name}</div>

        {!!item.variants?.length && (
          <div className="mb-4">
            <div className="text-xs uppercase tracking-wide text-muted mb-2">Variant</div>
            <div className="grid grid-cols-2 gap-2">
              {item.variants.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setVariant(v.id)}
                  className={`rounded-card border p-2 text-left ${variant === v.id ? "border-pine bg-pine-50" : "border-hairline"}`}
                >
                  <div className="font-medium text-sm">{v.name}</div>
                  <div className="text-xs text-muted">{inr(v.price)}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {(item.addon_groups ?? []).map((g) => (
          <div key={g.id} className="mb-4">
            <div className="text-xs uppercase tracking-wide text-muted mb-2">
              {g.name} {g.min_select > 0 && <span className="text-clay">· required</span>}
            </div>
            <div className="grid gap-1.5">
              {g.options.map((o) => (
                <button
                  key={o.id}
                  onClick={() => toggle(o.id, g)}
                  className={`flex justify-between rounded-lg border px-3 py-2 text-sm ${addons.includes(o.id) ? "border-pine bg-pine-50" : "border-hairline"}`}
                >
                  <span>{o.name}</span>
                  <span className="text-muted">{Number(o.price) > 0 ? `+${inr(o.price)}` : "free"}</span>
                </button>
              ))}
            </div>
          </div>
        ))}

        <div className="flex gap-2 mt-2">
          <button className="btn-ghost flex-1" onClick={onCancel}>Cancel</button>
          <button
            className="btn-primary flex-1"
            disabled={missing.length > 0}
            onClick={() => onAdd(variant, addons)}
          >
            {missing.length ? `Choose ${missing[0].name}` : "Add to order"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between text-muted"><span>{label}</span><span>{value}</span></div>;
}

/** Self-contained offline cart: uses the cached menu, bills are queued locally
 *  and synced (idempotently) when connectivity returns. */
function OfflineBilling({ mode, table, onQueued }: { mode: string; table: Table | null; onQueued: () => void }) {
  const menu = getCachedMenu();
  const [cart, setCart] = useState<Record<number, number>>({});
  const lines = Object.entries(cart).map(([id, qty]) => {
    const item = menu.find((m) => m.id === Number(id))!;
    return { item, qty };
  });
  const total = lines.reduce((s, l) => s + Number(l.item.price) * l.qty * 1.05, 0); // approx incl 5%

  if (!menu.length) {
    return <div className="card p-6 text-muted text-sm">No cached menu available offline. Connect once to cache it.</div>;
  }

  function settle(tender: string) {
    const bill: OfflineBill = {
      client_uuid: uuid(),
      mode,
      table: table?.id ?? null,
      lines: lines.map((l) => ({ menu_item: l.item.id, qty: l.qty, unit_price: String(l.item.price), name: l.item.name })),
      tender,
      settled: true,
      total,
    };
    enqueue(bill);
    window.dispatchEvent(new Event("storage"));
    setCart({});
    onQueued();
  }

  return (
    <div className="grid grid-cols-[1fr_340px] gap-4">
      <div className="grid grid-cols-3 gap-2">
        {menu.filter((m) => m.available).map((m) => (
          <button key={m.id} className="card p-3 text-left hover:bg-cream"
            onClick={() => setCart((c) => ({ ...c, [m.id]: (c[m.id] ?? 0) + 1 }))}>
            <div className="font-medium text-sm">{m.name}</div>
            <div className="text-sm text-muted mt-1">{inr(m.price)}</div>
          </button>
        ))}
      </div>
      <div className="card p-4 h-fit">
        <div className="font-semibold mb-3">Offline bill</div>
        {!lines.length ? (
          <div className="text-sm text-muted py-6 text-center">Tap items to add.</div>
        ) : (
          <>
            <div className="space-y-1 mb-3">
              {lines.map((l) => (
                <div key={l.item.id} className="flex justify-between text-sm">
                  <span>{l.qty}× {l.item.name}</span>
                  <span>{inr(Number(l.item.price) * l.qty)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between font-semibold border-t border-hairline pt-2">
              <span>Total (incl. GST)</span><span>{inr(total)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <button className="btn-primary" onClick={() => settle("Cash")}>Settle cash</button>
              <button className="btn-outline" onClick={() => settle("Card")}>Settle card</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
