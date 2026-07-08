import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { usePrompt } from "../../design/Prompt";
import { useToast } from "../../design/Toast";
import { Badge, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { useApp } from "../../lib/app-context";
import { inr } from "../../lib/money";
import type { MenuItem, Order } from "../../lib/types";

interface BarTable {
  id: number; name: string; section: string; seats: number; status: string; status_label: string;
}
interface Category { id: number; name: string }
interface ReadyKot { kot: number; kot_no: string; order: number; table: string; captain: string }

const TENDER_LABELS: Record<string, string> = { UPI: "UPI", Gateway: "Card (gateway)" };

/** The bar's own POS — separate operation from the restaurant floor. A tab
 *  can include kitchen-made side dishes (they still fire a KOT to the shared
 *  kitchen display), but everything settles on the bar's own bill. */
export function BarPos() {
  const qc = useQueryClient();
  const ask = usePrompt();
  const toast = useToast();
  const { user } = useApp();
  // Bar Captain runs tabs on bar tables; walk-up takeaway (no table) stays
  // with the Bar Cashier — same split as F&B Cashier vs Captain.
  const canTakeaway = user?.role === "Bar Cashier";
  const [view, setView] = useState<"floor" | "order">("floor");
  const [table, setTable] = useState<BarTable | null>(null);
  const [mode, setMode] = useState<"dinein" | "takeaway">("dinein");
  const [orderId, setOrderId] = useState<number | null>(null);
  const [cat, setCat] = useState<number | null>(null);

  const { data: tables } = useQuery({
    queryKey: ["bar-tables"],
    queryFn: async () => (await api.get<BarTable[]>("/bar/tables/")).data,
    enabled: view === "floor",
  });
  const { data: floorOrders } = useQuery({
    queryKey: ["bar-floor-orders"],
    queryFn: async () => (await api.get<Order[]>("/pos/orders/?open=1")).data,
    enabled: view === "floor",
    refetchInterval: 15000,
  });
  const ordersByTable = new Map<number, Order[]>();
  for (const o of floorOrders ?? []) {
    if (o.bar_table) ordersByTable.set(o.bar_table, [...(ordersByTable.get(o.bar_table) ?? []), o]);
  }

  const { data: cats } = useQuery({ queryKey: ["bar-cats"], queryFn: async () => (await api.get<Category[]>("/pos/categories/?is_bar=1")).data });
  // The bar's own dedicated menu — never the full restaurant catalogue. A
  // kitchen dish only shows up here once it's been explicitly added to the
  // bar menu (see Bar Menu Master).
  const { data: items, isLoading } = useQuery({
    queryKey: ["bar-menu-items"],
    queryFn: async () => (await api.get<MenuItem[]>("/pos/menu-items/?bar_menu=1")).data,
  });
  const { data: order } = useQuery({
    queryKey: ["bar-order", orderId],
    queryFn: async () => (await api.get<Order>(`/pos/orders/${orderId}/`)).data,
    enabled: orderId !== null,
  });

  // A side dish the kitchen has finished for a bar tab — the kitchen can't
  // tell whether it actually reached the bar customer, so bar staff confirm
  // pickup themselves (same handshake the restaurant's captains use).
  const { data: readyKots } = useQuery({
    queryKey: ["bar-ready-kots"],
    queryFn: async () => (await api.get<ReadyKot[]>("/pos/orders/ready/")).data,
    refetchInterval: 10000,
  });
  const prevReady = useRef(0);
  useEffect(() => {
    const n = readyKots?.length ?? 0;
    if (n > prevReady.current && readyKots?.length) {
      toast(`🍽 Side dish ready to collect — ${readyKots[readyKots.length - 1].table}`);
    }
    prevReady.current = n;
  }, [readyKots]); // eslint-disable-line react-hooks/exhaustive-deps

  const collectKot = useMutation({
    mutationFn: async (kot: number) => (await api.post("/pos/orders/serve/", { kot })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bar-ready-kots"] }),
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not mark collected", "error"),
  });

  function openTable(t: BarTable, resumeOrder?: number | null) {
    setTable(t); setMode("dinein"); setOrderId(resumeOrder ?? null); setCat(null); setView("order");
    if (resumeOrder !== undefined) return;
    api.get<Order[]>(`/pos/orders/?bar_table=${t.id}&open=1`).then((r) => {
      if (r.data.length) setOrderId(r.data[0].id);
    });
  }

  function startTakeaway() {
    setTable(null); setMode("takeaway"); setOrderId(null); setCat(null); setView("order");
  }

  function reset() {
    setView("floor"); setTable(null); setMode("dinein"); setOrderId(null); setCat(null);
    qc.invalidateQueries({ queryKey: ["bar-tables"] });
    qc.invalidateQueries({ queryKey: ["bar-floor-orders"] });
  }

  const openOrder = useMutation({
    mutationFn: async () => (await api.post("/pos/orders/", mode === "dinein"
      ? { bar_table: table!.id, department: "bar" }
      : { mode: "takeaway", department: "bar" })).data as Order,
    onSuccess: (o) => setOrderId(o.id),
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not open the order", "error"),
  });

  const addItem = useMutation({
    mutationFn: async (menuItem: MenuItem) =>
      (await api.post(`/pos/orders/${orderId}/add_item/`, { menu_item: menuItem.id, qty: 1 })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bar-order", orderId] }),
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not add item", "error"),
  });

  const setQty = useMutation({
    mutationFn: async ({ line, qty }: { line: number; qty: number }) =>
      (await api.post(`/pos/orders/${orderId}/set_qty/`, { line, qty })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bar-order", orderId] }),
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not update quantity", "error"),
  });

  const fireKot = useMutation({
    mutationFn: async () => (await api.post(`/pos/orders/${orderId}/fire_kot/`)).data as Order,
    onSuccess: (o) => {
      toast(`Sent · ${o.kot_no}`);
      qc.invalidateQueries({ queryKey: ["bar-order", orderId] });
    },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not send to kitchen", "error"),
  });

  const bill = useMutation({
    mutationFn: async () => (await api.post(`/pos/orders/${orderId}/bill/`)).data,
    onSuccess: () => { toast("Bill printed"); qc.invalidateQueries({ queryKey: ["bar-order", orderId] }); },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not bill — fire the KOT for every item first", "error"),
  });

  const settle = useMutation({
    mutationFn: async (tender: string) => (await api.post(`/pos/orders/${orderId}/settle/`, { tender })).data,
    onSuccess: (_d, tender) => { toast(`Tab settled · ${tender}`); reset(); },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Payment failed", "error"),
  });

  const readyStrip = !!readyKots?.length && (
    <div className="card p-3 mb-4 bg-pine-50 border border-pine/30">
      <div className="text-[10px] uppercase tracking-wide text-pine font-semibold mb-2">🔔 Side dishes ready from the kitchen</div>
      <div className="flex flex-wrap gap-2">
        {readyKots.map((k) => (
          <div key={k.kot} className="flex items-center gap-2 rounded-lg border border-pine/30 bg-surface px-3 py-1.5 text-sm">
            <span className="font-semibold">{k.table}</span>
            <span className="text-xs text-muted">{k.kot_no}</span>
            <button className="btn-primary text-xs py-1 px-2.5" disabled={collectKot.isPending}
              onClick={() => collectKot.mutate(k.kot)}>
              Collected ✓
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  if (view === "floor") {
    return (
      <div>
        <PageHeader
          title="Bar POS"
          subtitle="The bar's own tabs — separate from the restaurant floor"
          action={canTakeaway ? (
            <button className="btn-primary text-sm" onClick={startTakeaway}>+ New takeaway order</button>
          ) : undefined}
        />
        {readyStrip}
        <div className="grid grid-cols-6 gap-3">
          {tables?.map((t) => {
            const running = ordersByTable.get(t.id) ?? [];
            return (
              <button key={t.id} onClick={() => openTable(t, running[0]?.id ?? null)}
                className="card p-4 text-left hover:bg-cream">
                <div className="font-semibold flex items-center gap-1">
                  {running.length > 0 && <span className="text-clay">●</span>}
                  {t.name}
                </div>
                <div className="text-xs text-muted mt-1">{t.seats} seats</div>
                {running.length > 0 && (
                  <div className="text-xs text-pine mt-1">{running.length} open tab(s)</div>
                )}
              </button>
            );
          })}
          {!tables?.length && <div className="text-sm text-muted">No bar tables set up yet.</div>}
        </div>
      </div>
    );
  }

  const screenTitle = mode === "takeaway" ? "Takeaway order" : `Bar table ${table?.name}`;

  // Order view
  if (orderId === null) {
    return (
      <div>
        <PageHeader title={screenTitle} action={<button className="btn-ghost text-sm" onClick={reset}>← Bar floor</button>} />
        <button className="btn-primary" disabled={openOrder.isPending} onClick={() => openOrder.mutate()}>
          {mode === "takeaway" ? "Start takeaway order" : "Open a new tab"}
        </button>
      </div>
    );
  }

  if (!order || isLoading || !items) return <Spinner />;
  const canFire = order.lines.some((l) => !l.kot_fired);
  const canBill = order.status === "open" || order.status === "kot_fired";
  const canSettle = order.status === "billed";
  const cats2 = cats ?? [];
  const shownItems = (items as MenuItem[]).filter((m) => m.available && (!cat || m.category === cat));

  return (
    <div>
      <PageHeader
        title={screenTitle}
        subtitle={order.bill_no ? `Bill ${order.bill_no}` : order.kot_no ? `Ticket ${order.kot_no}` : mode === "takeaway" ? "New takeaway order" : "New tab"}
        action={<button className="btn-ghost text-sm" onClick={reset}>← Bar floor</button>}
      />
      {readyStrip}
      <div className="grid grid-cols-[1fr_360px] gap-4">
        <div>
          <div className="flex gap-2 mb-3 flex-wrap">
            <button onClick={() => setCat(null)} className={`pill ${!cat ? "bg-ink text-white" : "bg-hairline text-body"}`}>All</button>
            {cats2.map((c) => (
              <button key={c.id} onClick={() => setCat(c.id)} className={`pill ${cat === c.id ? "bg-ink text-white" : "bg-hairline text-body"}`}>
                {c.name}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {shownItems.map((m) => (
              <button key={m.id} className="card p-3 text-left hover:bg-cream" disabled={addItem.isPending}
                onClick={() => addItem.mutate(m)}>
                <div className="font-medium text-sm flex items-center justify-between">
                  <span>{m.name}</span>
                  {m.station === "bar" && <Badge tone="amber">bar</Badge>}
                </div>
                <div className="text-xs text-muted mt-1">{inr(m.price)}</div>
              </button>
            ))}
            {!shownItems.length && <div className="text-sm text-muted col-span-3">No items in this category.</div>}
          </div>
        </div>

        <div className="card p-4">
          <div className="font-semibold mb-3">{mode === "takeaway" ? "This order" : "This tab"}</div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {order.lines.map((l) => (
              <div key={l.id} className="flex items-center justify-between text-sm">
                <div>
                  <div>{l.name}</div>
                  <div className="text-xs text-muted">{inr(l.unit_price)} each{l.kot_fired ? " · sent" : ""}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="btn-ghost text-xs" disabled={setQty.isPending}
                    onClick={() => setQty.mutate({ line: l.id, qty: l.qty - 1 })}>−</button>
                  <span>{l.qty}</span>
                  <button className="btn-ghost text-xs" disabled={setQty.isPending}
                    onClick={() => setQty.mutate({ line: l.id, qty: l.qty + 1 })}>+</button>
                </div>
              </div>
            ))}
            {!order.lines.length && <div className="text-sm text-muted">No items yet — tap something to add it.</div>}
          </div>

          <div className="border-t border-line mt-3 pt-3 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted">Taxable</span><span>{inr(order.totals.taxable)}</span></div>
            <div className="flex justify-between"><span className="text-muted">Tax</span><span>{inr(order.totals.tax)}</span></div>
            <div className="flex justify-between font-semibold text-base"><span>Total</span><span>{inr(order.totals.total)}</span></div>
          </div>

          <div className="mt-3 space-y-2">
            <button className="btn-outline w-full" disabled={!canFire || fireKot.isPending} onClick={() => fireKot.mutate()}>
              Send to kitchen
            </button>
            <button className="btn-outline w-full" disabled={!canBill || canFire || bill.isPending} onClick={() => bill.mutate()}>
              Print bill
            </button>
            {(["UPI", "Gateway"] as const).map((t) => (
              <button key={t} className="btn-primary w-full" disabled={!canSettle || settle.isPending}
                onClick={async () => {
                  const ok = await ask({
                    title: "Confirm settlement", confirm: true, confirmLabel: "Settle",
                    message: `Settle ${inr(order.totals.total)} via ${TENDER_LABELS[t]}?`,
                  });
                  if (ok) settle.mutate(t);
                }}>
                Settle · {TENDER_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
