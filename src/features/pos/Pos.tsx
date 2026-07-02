import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { Badge, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { useApp } from "../../lib/app-context";
import { amount, digits } from "../../lib/inputs";
import { inr } from "../../lib/money";
import { usePrompt } from "../../design/Prompt";
import { useToast } from "../../design/Toast";
import { cacheMenu, enqueue, getCachedMenu, uuid, type OfflineBill } from "../../lib/offline";
import { useOnline } from "../../lib/useOnline";
import type { Folio, MenuItem, Order, Table } from "../../lib/types";
import { downloadBillPdf, printKot } from "../print/documents";

type Mode = "dinein" | "takeaway" | "delivery";
const MODE_LABELS: Record<Mode, string> = { dinein: "Dine-in", takeaway: "Takeaway", delivery: "Delivery" };
interface Category { id: number; name: string }
interface ReadyKot { kot: number; kot_no: string; order: number; table: string; captain: string }
interface TillSession {
  id: number; status: string; opened_by: string; opening_float: string; opened_at: string;
  counted_cash: string | null; expected_cash: string | null; variance: string | null;
  cash_in: string; cash_out: string;
  tender_totals: { tender: string; amount: string; count: number }[];
  entries: { id: number; kind: string; amount: string; reason: string }[];
}
interface TableRes {
  id: number; kind: string; table: number | null; table_name: string | null;
  name: string; mobile: string; party_size: number; reserved_for: string | null;
  status: string; note: string;
}

const TENDER_LABELS: Record<string, string> = { Cash: "Cash", UPI: "UPI", Gateway: "Card (gateway)" };

export function Pos() {
  const qc = useQueryClient();
  const { property, user } = useApp();
  const ask = usePrompt();
  const toast = useToast();
  const hms = property?.entitlement.hms;
  // Role↔tender mapping (mirrors the backend): captains settle digital payments
  // tableside; cash is collected only at the cashier counter.
  const tenders = user?.role === "Captain" ? ["UPI", "Gateway"] : ["Cash", "UPI", "Gateway"];

  const [mode, setMode] = useState<Mode>("dinein");
  const [table, setTable] = useState<Table | null>(null);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [cat, setCat] = useState<number | null>(null);
  // Table-first flow: start on the floor, drill into a table's order screen.
  const [view, setView] = useState<"floor" | "order">("floor");

  function openTable(t: Table) {
    setMode("dinein"); setTable(t); setOrderId(null); setCat(null); setView("order");
    // Resume the table's running order (KOT fired / billed) instead of starting a blank one.
    api.get<Order[]>(`/pos/orders/?table=${t.id}&open=1`).then((r) => {
      if (r.data.length) setOrderId(r.data[0].id);
    });
  }
  function startMode(m: Mode) { setMode(m); setTable(null); setOrderId(null); setCat(null); setView("order"); }

  const { data: tables } = useQuery({ queryKey: ["tables"], queryFn: async () => (await api.get<Table[]>("/pos/tables/")).data });
  const { data: cats } = useQuery({ queryKey: ["cats"], queryFn: async () => (await api.get<Category[]>("/pos/categories/")).data });
  const { data: items, isLoading } = useQuery({ queryKey: ["menu"], queryFn: async () => (await api.get<MenuItem[]>("/pos/menu-items/")).data });
  const { data: order } = useQuery({
    queryKey: ["order", orderId],
    queryFn: async () => (await api.get<Order>(`/pos/orders/${orderId}/`)).data,
    enabled: orderId !== null,
  });

  const { online, queued, sync } = useOnline();

  // Kitchen→floor loop: rounds marked ready on the KDS, filtered to this
  // captain's own tables. Poll like the KDS does; toast when a new one lands.
  const { data: readyKots } = useQuery({
    queryKey: ["ready-kots"],
    queryFn: async () =>
      (await api.get<ReadyKot[]>(`/pos/orders/ready/${user?.role === "Captain" ? "?mine=1" : ""}`)).data,
    refetchInterval: 10000,
    enabled: online,
  });
  const prevReady = useRef(0);
  useEffect(() => {
    const n = readyKots?.length ?? 0;
    if (n > prevReady.current && readyKots?.length) {
      toast(`🍽 Ready to serve — ${readyKots[readyKots.length - 1].table}`);
    }
    prevReady.current = n;
  }, [readyKots]); // eslint-disable-line react-hooks/exhaustive-deps

  const serveKot = useMutation({
    mutationFn: async (kot: number) => (await api.post("/pos/orders/serve/", { kot })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ready-kots"] }),
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not mark served", "error"),
  });
  // Cache the menu so the POS keeps working through an outage (NFR-002).
  useEffect(() => { if (items?.length) cacheMenu(items); }, [items]);

  async function ensureOrder(): Promise<number> {
    if (orderId) return orderId;
    const o = (await api.post<Order>("/pos/orders/", { mode, table: table?.id ?? null })).data;
    setOrderId(o.id);
    return o.id;
  }

  const [picker, setPicker] = useState<MenuItem | null>(null);
  const [showDiscount, setShowDiscount] = useState(false);
  const [showCoupon, setShowCoupon] = useState(false);
  const [showFinal, setShowFinal] = useState(false);
  const [q, setQ] = useState("");
  const [diet, setDiet] = useState<"" | "veg" | "nonveg" | "egg">("");
  const [showTablePick, setShowTablePick] = useState(false);
  const [showTill, setShowTill] = useState(false);
  const [showReserve, setShowReserve] = useState(false);

  // Till session (day-end close) + open reservations/waitlist for the floor.
  const { data: till } = useQuery({
    queryKey: ["till"],
    queryFn: async () => (await api.get<TillSession | null>("/pos/till/current/")).data,
    enabled: user?.role !== "Captain", // counter-only (server enforces too)
  });
  const { data: reservations } = useQuery({
    queryKey: ["table-reservations"],
    queryFn: async () => (await api.get<TableRes[]>("/pos/table-reservations/?open=1")).data,
  });
  const resAction = useMutation({
    mutationFn: async ({ id, act, table: tbl }: { id: number; act: string; table?: number }) =>
      (await api.post(`/pos/table-reservations/${id}/${act}/`, tbl ? { table: tbl } : {})).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["table-reservations"] });
      qc.invalidateQueries({ queryKey: ["tables"] });
    },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Failed", "error"),
  });

  const addItem = useMutation({
    mutationFn: async (payload: { menu_item: number; qty: number; variant?: number; addons?: number[] }) => {
      const id = await ensureOrder();
      return (await api.post(`/pos/orders/${id}/add_item/`, payload)).data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["order", orderId] }); setPicker(null); },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not add item", "error"),
  });

  function onItemClick(item: MenuItem) {
    if ((item.variants?.length ?? 0) > 0 || (item.addon_groups?.length ?? 0) > 0) {
      setPicker(item);
    } else {
      addItem.mutate({ menu_item: item.id, qty: 1 });
    }
  }

  const setQty = useMutation({
    mutationFn: async ({ line, qty, override }: { line: number; qty: number; override?: string }) =>
      (await api.post(`/pos/orders/${orderId}/set_qty/`, { line, qty, override })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["order", orderId] }),
    onError: async (e: any, vars) => {
      // Reducing a KOT-fired item is an item void — the backend asks for a manager passcode.
      if (e?.response?.data?.override_required) {
        const code = await ask({ title: "Manager override", label: e.response.data.detail, password: true, placeholder: "Manager passcode" });
        if (code) setQty.mutate({ ...vars, override: code });
      } else {
        toast(e?.response?.data?.detail ?? "Could not update item", "error");
      }
    },
  });

  const fireKot = useMutation({
    mutationFn: async () => (await api.post(`/pos/orders/${orderId}/fire_kot/`)).data,
    onSuccess: (o: Order) => {
      toast(`KOT fired · ${o.kot_no}${o.token_no ? ` · Token ${o.token_no}` : ""}`);
      // Dine-in: kitchen display only. Takeaway: also print the token slip.
      // Delivery: go straight to the final bill — payment is collected up
      // front and the printed bill carries the pickup token.
      if (o.mode === "takeaway") printKot(o, property?.name ?? "Hearth");
      if (o.mode === "delivery") setShowFinal(true);
      qc.invalidateQueries({ queryKey: ["order", orderId] });
    },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "KOT failed", "error"),
  });

  // One-tap close: print the final bill, settle the payment, free the table.
  const finalBill = useMutation({
    mutationFn: async (tender: string) => {
      const id = orderId!;
      if (order?.status !== "billed") {
        await api.post(`/pos/orders/${id}/bill/`);
        downloadBillPdf(id);
      }
      return (await api.post(`/pos/orders/${id}/settle/`, {
        tender, token: tender === "Gateway" ? "tok_demo_card" : undefined,
      })).data;
    },
    onSuccess: (_d, tender) => {
      setShowFinal(false);
      toast(`Final bill settled · ${tender} — table freed`);
      reset();
    },
    // Bill stays printed if payment fails (e.g. card declined) — settle again from the billed state.
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Payment failed — bill kept, settle again", "error"),
  });

  const reopenOrder = useMutation({
    mutationFn: async () => (await api.post(`/pos/orders/${orderId}/reopen/`)).data,
    onSuccess: () => {
      toast("Bill reopened — reprint after changes");
      qc.invalidateQueries({ queryKey: ["order", orderId] });
      qc.invalidateQueries({ queryKey: ["tables"] });
    },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not reopen", "error"),
  });

  const applyDiscount = useMutation({
    mutationFn: async (body: { kind: string; value: number; reason: string; override?: string }) =>
      (await api.post(`/pos/orders/${orderId}/apply_discount/`, body)).data,
    onSuccess: () => { toast("Discount applied"); setShowDiscount(false); qc.invalidateQueries({ queryKey: ["order", orderId] }); },
    onError: async (e: any) => {
      if (e?.response?.data?.cap_exceeded) {
        const code = await ask({ title: "Manager override", label: e.response.data.detail, password: true, placeholder: "Manager passcode" });
        if (code) applyDiscount.mutate({ ...lastDiscount.current!, override: code });
      } else {
        toast(e?.response?.data?.detail ?? "Discount failed", "error");
      }
    },
  });
  const lastDiscount = useRef<{ kind: string; value: number; reason: string } | null>(null);

  const applyCoupon = useMutation({
    mutationFn: async (code: string) =>
      (await api.post(`/pos/orders/${orderId}/apply_coupon/`, { code })).data,
    onSuccess: () => { toast("Coupon applied"); setShowCoupon(false); qc.invalidateQueries({ queryKey: ["order", orderId] }); },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Invalid coupon", "error"),
  });

  const move = useMutation({
    mutationFn: async (dest: number) => (await api.post(`/pos/orders/${orderId}/move/`, { table: dest })).data,
    onSuccess: () => { toast("Order moved"); reset(); },
  });
  const voidOrder = useMutation({
    mutationFn: async (override: string) =>
      (await api.post(`/pos/orders/${orderId}/void/`, { override, reason: "voided at POS" })).data,
    onSuccess: () => { toast("Order voided"); reset(); },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Void failed", "error"),
  });

  const settle = useMutation({
    mutationFn: async (tender: string) =>
      (await api.post(`/pos/orders/${orderId}/settle/`, {
        tender, token: tender === "Gateway" ? "tok_demo_card" : undefined,
      })).data,
    onSuccess: (_d, tender) => { toast(`Settled · ${tender}`); reset(); },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Payment failed", "error"),
  });

  // Post-to-room: show the occupied rooms (open folios) and pick the guest.
  const [roomPick, setRoomPick] = useState<Folio[] | null>(null);
  async function openRoomPick() {
    const folios = (await api.get<Folio[]>("/folios/?status=open")).data
      .filter((f) => f.room_number);
    if (!folios.length) { toast("No occupied rooms with an open folio", "error"); return; }
    setRoomPick(folios);
  }
  const postToRoom = useMutation({
    mutationFn: async (folioId: number) =>
      (await api.post(`/pos/orders/${orderId}/post_to_room/`, { folio: folioId })).data,
    onSuccess: (o: Order) => { setRoomPick(null); toast(`Posted to room · folio #${o.folio}`); reset(); },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not post to room", "error"),
  });

  function reset() {
    setOrderId(null);
    setTable(null);
    setView("floor");
    qc.invalidateQueries({ queryKey: ["tables"] });
    qc.invalidateQueries({ queryKey: ["folios"] });
  }

  if (isLoading && online) return <Spinner />;
  const needle = q.trim().toLowerCase();
  const shown = items?.filter((i) =>
    (!cat || i.category === cat) &&
    (!diet || i.diet === diet) &&
    (!needle || i.name.toLowerCase().includes(needle) || i.short_code.toLowerCase().includes(needle)),
  );
  // Lifecycle flags: un-fired lines block billing/settling; a printed bill locks edits.
  const unfired = order?.lines.some((l) => !l.kot_fired) ?? false;
  const billed = order?.status === "billed";

  // Serve board: every ready round for my tables, with one-tap "Delivered".
  const readyStrip = !!readyKots?.length && (
    <div className="card p-3 mb-4 bg-pine-50 border border-pine/30">
      <div className="text-[10px] uppercase tracking-wide text-pine font-semibold mb-2">🔔 Ready to serve</div>
      <div className="flex flex-wrap gap-2">
        {readyKots.map((k) => (
          <div key={k.kot} className="flex items-center gap-2 rounded-lg border border-pine/30 bg-surface px-3 py-1.5 text-sm">
            <span className="font-semibold">{k.table}</span>
            <span className="text-xs text-muted">{k.kot_no}{k.captain ? ` · ${k.captain}` : ""}</span>
            <button className="btn-primary text-xs py-1 px-2.5" disabled={serveKot.isPending}
              onClick={() => serveKot.mutate(k.kot)}>
              Delivered ✓
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  const banner = (!online || queued > 0) && (
    <div className={`card p-3 mb-4 flex items-center gap-3 ${online ? "bg-amber-50" : "bg-clay/10"}`}>
      <Badge tone={online ? "amber" : "clay"}>{online ? "Back online" : "Offline"}</Badge>
      <span className="text-sm flex-1">
        {online
          ? `${queued} offline bill(s) waiting to sync.`
          : "Billing continues locally — bills will sync automatically when the connection returns."}
      </span>
      {online && queued > 0 && (
        <button className="btn-primary text-xs py-1" onClick={() => sync().then((n) => n && toast(`Synced ${n} offline bill(s)`))}>
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
        <OfflineBilling mode={mode} table={table} onQueued={() => toast("Bill saved offline")} />
      </div>
    );
  }

  // FLOOR VIEW — tables first. Tap a table (or start takeaway/delivery) to order.
  if (view === "floor") {
    return (
      <div>
        <PageHeader title="Restaurant POS" subtitle="Tap a table to open its order" />
        {banner}
        {readyStrip}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <button className="btn-outline" onClick={() => startMode("takeaway")}>+ Takeaway</button>
          <button className="btn-outline" onClick={() => startMode("delivery")}>+ Delivery</button>
          <button className="btn-outline" onClick={() => setShowReserve(true)}>+ Reserve / Waitlist</button>
          <a className="btn-ghost text-sm" href="/tokens" target="_blank" rel="noreferrer">Token board ↗</a>
          {/* Cash controls are counter business — hidden from captains. */}
          {user?.role !== "Captain" && (
            <>
              <a className="btn-ghost text-sm" href="/reconciliation">Reconciliation</a>
              <div className="ml-auto">
                <button
                  className={`pill border ${till ? "bg-pine-50 border-pine text-pine" : "border-hairline"}`}
                  onClick={() => setShowTill(true)}
                >
                  {till ? `Till open · float ${inr(till.opening_float)}` : "Open till"}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Upcoming reservations + walk-in waitlist */}
        {!!reservations?.length && (
          <div className="card p-3 mb-5">
            <div className="text-[10px] uppercase tracking-wide text-muted mb-2">Reservations & waitlist</div>
            <div className="flex flex-wrap gap-2">
              {reservations.map((r) => (
                <div key={r.id} className="flex items-center gap-2 rounded-lg border border-hairline px-3 py-1.5 text-sm">
                  <span className="font-medium">{r.name}</span>
                  <span className="text-xs text-muted">
                    {r.party_size} pax
                    {r.kind === "waitlist"
                      ? " · waitlist"
                      : ` · ${r.table_name ?? "any table"}${r.reserved_for ? ` · ${new Date(r.reserved_for).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : ""}`}
                  </span>
                  <button
                    className="btn-primary text-xs py-0.5 px-2"
                    onClick={async () => {
                      if (r.table) { resAction.mutate({ id: r.id, act: "seat" }); return; }
                      const name = await ask({ title: `Seat ${r.name}`, label: "Table name", placeholder: "e.g. A2" });
                      const dest = tables?.find((t) => t.name.toLowerCase() === (name ?? "").toLowerCase());
                      if (dest) resAction.mutate({ id: r.id, act: "seat", table: dest.id });
                      else if (name) toast("Table not found", "error");
                    }}
                  >
                    Seat
                  </button>
                  <button className="btn-ghost text-xs py-0.5" onClick={() => resAction.mutate({ id: r.id, act: "cancel" })}>✕</button>
                  {r.kind === "reservation" && (
                    <button className="btn-ghost text-xs py-0.5 text-clay" title="No-show"
                      onClick={() => resAction.mutate({ id: r.id, act: "no_show" })}>NS</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="text-xs uppercase tracking-wide text-muted mb-2">Tables</div>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 gap-3">
          {tables?.map((t) => (
            <button
              key={t.id}
              onClick={() => openTable(t)}
              className={`rounded-card border p-4 text-center transition-colors ${
                t.status === "running"
                  ? "bg-clay/90 text-white border-clay"
                  : t.status === "printed"
                    ? "bg-amber-100 border-amber-400"
                    : t.status === "reserved"
                      ? "bg-pine-50 border-pine"
                      : "bg-surface hover:bg-cream border-hairline"
              }`}
            >
              <div className="font-display text-xl">{t.name}</div>
              <div className={`text-xs mt-0.5 ${t.status === "running" ? "opacity-80" : "text-muted"}`}>{t.seats} seats</div>
              <div className="text-[10px] uppercase tracking-wide mt-1">
                {t.status === "running" ? "● Running"
                  : t.status === "printed" ? "● Bill printed"
                    : t.status === "reserved" ? "● Reserved" : "Free"}
              </div>
            </button>
          ))}
          {!tables?.length && (
            <div className="col-span-full text-sm text-muted py-8 text-center">
              No tables configured — add them in Table Master.
            </div>
          )}
        </div>

        {showTill && (
          <TillModal
            till={till ?? null}
            onClose={() => { setShowTill(false); qc.invalidateQueries({ queryKey: ["till"] }); }}
          />
        )}
        {showReserve && (
          <ReserveModal
            tables={tables ?? []}
            onDone={() => {
              setShowReserve(false);
              qc.invalidateQueries({ queryKey: ["table-reservations"] });
              qc.invalidateQueries({ queryKey: ["tables"] });
            }}
            onCancel={() => setShowReserve(false)}
          />
        )}
      </div>
    );
  }

  // ORDER VIEW — menu + running bill for the selected table / mode.
  return (
    <div>
      {/* Open-bill tabs: only tables being served right now, like browser tabs.
          The full floor lives behind the "Tables" picker — no chip clutter. */}
      <div className="mb-3 flex items-center gap-2">
        <button className="btn-outline text-sm shrink-0" onClick={reset}>← Floor</button>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 flex-1">
          {tables
            ?.filter((t) => t.status === "running" || t.status === "printed" || (mode === "dinein" && table?.id === t.id))
            .map((t) => {
              const current = mode === "dinein" && table?.id === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => openTable(t)}
                  title={`${t.name} · ${t.status_label}`}
                  className={`shrink-0 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                    current
                      ? "bg-ink text-white border-ink"
                      : t.status === "printed"
                        ? "bg-amber-100 border-amber-400 hover:bg-amber-200"
                        : "bg-surface border-hairline hover:bg-cream"
                  }`}
                >
                  {t.status === "running" && !current && <span className="text-clay mr-1">●</span>}
                  {t.status === "printed" && !current && <span className="text-amber-600 mr-1">●</span>}
                  {t.name}
                </button>
              );
            })}
        </div>
        <button className="btn-ghost text-sm shrink-0" onClick={() => setShowTablePick(true)}>⊞ Tables</button>
      </div>
      <div className="flex items-center gap-3 mb-4">
        <div>
          <div className="font-display text-xl">{mode === "dinein" ? `Table ${table?.name ?? ""}` : MODE_LABELS[mode]}</div>
          <div className="text-xs text-muted">{mode === "dinein" ? `${table?.seats ?? 0} seats` : "New order"}</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {order?.token_no && <Badge tone="pine">Token {order.token_no}</Badge>}
          {order?.kot_no && <Badge tone="amber">{order.kot_no}</Badge>}
          {order && <Badge tone={billed ? "clay" : "pine"}>{order.status_label}</Badge>}
        </div>
      </div>
      {banner}
      {readyStrip}

      {/* Phones stack into a single column (captain tableside flow); the
          3-column workstation layout starts at lg. */}
      <div className="grid grid-cols-1 lg:grid-cols-[180px_1fr_360px] gap-4">
        {/* Category rail — vertical like the module nav; hidden on phones. */}
        <div className="hidden lg:block card p-2 h-fit sticky top-4">
          <div className="text-[10px] uppercase tracking-wide text-muted px-3 pt-1 pb-2">Categories</div>
          <div className="grid gap-0.5">
            <CategoryButton name="All items" count={items?.length ?? 0} active={!cat} onClick={() => setCat(null)} />
            {cats?.map((c) => (
              <CategoryButton
                key={c.id}
                name={c.name}
                count={items?.filter((i) => i.category === c.id).length ?? 0}
                active={cat === c.id}
                onClick={() => setCat(c.id)}
              />
            ))}
          </div>
        </div>

        <div>
          {/* Mobile: categories as a swipeable chip row instead of the rail. */}
          <div className="flex lg:hidden items-center gap-2 mb-3 overflow-x-auto pb-1">
            <button onClick={() => setCat(null)} className={`pill shrink-0 ${!cat ? "bg-pine text-white" : "bg-hairline text-body"}`}>All</button>
            {cats?.map((c) => (
              <button key={c.id} onClick={() => setCat(c.id)} className={`pill shrink-0 ${cat === c.id ? "bg-pine text-white" : "bg-hairline text-body"}`}>
                {c.name}
              </button>
            ))}
          </div>
          {/* Quick find: name or short-code, plus diet filter. */}
          <div className="flex items-center gap-2 mb-3">
            <input
              className="input flex-1"
              placeholder="Search item or short code…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {(["veg", "nonveg", "egg"] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDiet(diet === d ? "" : d)}
                className={`pill flex items-center gap-1.5 ${diet === d ? "bg-ink text-white" : "bg-hairline text-body"}`}
              >
                <span className={`h-2 w-2 rounded-full ${d === "veg" ? "bg-pine" : d === "egg" ? "bg-amber-500" : "bg-clay"}`} />
                {d === "veg" ? "Veg" : d === "egg" ? "Egg" : "Non-veg"}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2">
            {shown?.map((i) => (
              <button
                key={i.id}
                disabled={(mode === "dinein" && !table) || !i.available || billed}
                onClick={() => onItemClick(i)}
                className="card p-3 text-left hover:bg-cream disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-surface"
              >
                {i.image && (
                  <img src={i.image} alt="" className="h-16 w-full object-cover rounded-lg mb-2" />
                )}
                <div className="flex items-center gap-1.5">
                  <span className={`h-2.5 w-2.5 rounded-sm border ${i.diet === "veg" ? "border-pine" : "border-clay"}`}>
                    <span className={`block h-1 w-1 m-auto mt-0.5 rounded-full ${i.diet === "veg" ? "bg-pine" : "bg-clay"}`} />
                  </span>
                  <span className="font-medium text-sm">{i.name}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-sm text-muted">{inr(i.price)}</span>
                  {!i.available
                    ? <span className="text-[10px] font-semibold uppercase tracking-wide text-clay">86</span>
                    : i.short_code && <span className="text-[10px] uppercase tracking-wide text-muted">{i.short_code}</span>}
                </div>
              </button>
            ))}
            {!shown?.length && (
              <div className="col-span-full text-sm text-muted py-8 text-center">
                {needle || diet ? "No items match the search/filter." : "No items in this category."}
              </div>
            )}
          </div>
        </div>

        {/* Order panel */}
        <div id="pos-order-panel" className="card p-4 h-fit lg:sticky lg:top-4 scroll-mt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold">Current order</div>
            {!!order?.lines.length && (
              <div className="text-xs text-muted">{order.lines.reduce((n, l) => n + l.qty, 0)} item(s)</div>
            )}
          </div>

          {!order?.lines.length ? (
            <div className="text-sm text-muted py-8 text-center">No items yet.</div>
          ) : (
            <div className="space-y-2 mb-3">
              {order.lines.map((l) => (
                <div key={l.id} className="flex items-center gap-2 text-sm">
                  <div className="flex-1">
                    {l.name}
                    {l.kot_no && (
                      <span className="ml-1.5 text-[10px] uppercase tracking-wide text-muted" title={l.kot_no}>
                        {l.kot_no.includes("/") ? `KOT ${l.kot_no.split("/")[1]}` : "KOT ✓"}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="h-6 w-6 rounded bg-hairline disabled:opacity-40" disabled={billed}
                      onClick={() => setQty.mutate({ line: l.id, qty: l.qty - 1 })}>−</button>
                    <span className="w-6 text-center">{l.qty}</span>
                    <button className="h-6 w-6 rounded bg-hairline disabled:opacity-40" disabled={billed}
                      onClick={() => setQty.mutate({ line: l.id, qty: l.qty + 1 })}>+</button>
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
                <button className="btn-ghost text-xs flex-1" disabled={billed} onClick={() => setShowDiscount(true)}>
                  Discount
                </button>
                <button className="btn-ghost text-xs flex-1" disabled={billed} onClick={() => setShowCoupon(true)}>
                  Coupon
                </button>
              </div>

              <div className="flex gap-2 mt-2">
                <button
                  className="btn-ghost text-xs flex-1"
                  onClick={async () => {
                    const name = await ask({ title: "Move order", label: "Destination table", placeholder: "Table name" });
                    const dest = tables?.find((t) => t.name.toLowerCase() === (name ?? "").toLowerCase());
                    if (dest) move.mutate(dest.id); else if (name) toast("Table not found", "error");
                  }}
                >
                  Move
                </button>
                <button
                  className="btn-ghost text-xs flex-1 text-clay"
                  onClick={async () => {
                    const code = await ask({ title: "Void order", label: "Manager passcode", password: true });
                    if (code) voidOrder.mutate(code);
                  }}
                >
                  Void
                </button>
              </div>

              <div className="grid gap-2 mt-3">
                {!billed && (
                  <button className="btn-primary" disabled={fireKot.isPending || !unfired} onClick={() => fireKot.mutate()}>
                    {fireKot.isPending ? "Firing…"
                      : !unfired ? "KOT fired ✓"
                        : mode === "dinein" ? "Fire KOT"
                          : mode === "takeaway" ? "Fire KOT + token slip 🖨"
                            : "Fire KOT + final bill"}
                  </button>
                )}
                {billed ? (
                  <>
                    {/* Bill printed but payment failed/pending — settle to free the table. */}
                    <div className={`grid gap-2 ${tenders.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
                      {tenders.map((tn) => (
                        <button key={tn} className="btn-outline" disabled={settle.isPending} onClick={() => settle.mutate(tn)}>
                          {TENDER_LABELS[tn]}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button className="btn-ghost text-xs" onClick={() => order && downloadBillPdf(order.id)}>Reprint bill</button>
                      <button className="btn-ghost text-xs" disabled={reopenOrder.isPending} onClick={() => reopenOrder.mutate()}>
                        Reopen to edit
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    className="btn-primary"
                    disabled={finalBill.isPending || unfired}
                    title={unfired ? "Fire the KOT before the final bill" : undefined}
                    onClick={() => setShowFinal(true)}
                  >
                    Final bill
                  </button>
                )}
                {hms && (
                  <button className="btn-outline" disabled={postToRoom.isPending || unfired} onClick={openRoomPick}>
                    Post to room
                  </button>
                )}
                <button className="btn-ghost text-xs" onClick={() => order && printKot(order, property?.name ?? "Hearth")}>
                  Print KOT
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Mobile sticky cart bar: running count + total, jumps to the order panel. */}
      {!!order?.lines.length && (
        <button
          className="lg:hidden fixed bottom-4 left-4 right-4 z-40 btn-primary py-3 shadow-lg flex items-center justify-between px-5"
          onClick={() => document.getElementById("pos-order-panel")?.scrollIntoView({ behavior: "smooth" })}
        >
          <span>{order.lines.reduce((n, l) => n + l.qty, 0)} item(s)</span>
          <span className="font-semibold">{inr(order.totals.total)} → view order</span>
        </button>
      )}

      {picker && (
        <ItemPicker
          item={picker}
          onCancel={() => setPicker(null)}
          onAdd={(variant, addons) => addItem.mutate({ menu_item: picker.id, qty: 1, variant, addons })}
        />
      )}

      {showDiscount && (
        <DiscountModal
          onCancel={() => setShowDiscount(false)}
          onApply={(kind, value, reason) => {
            lastDiscount.current = { kind, value, reason };
            applyDiscount.mutate({ kind, value, reason });
          }}
        />
      )}

      {showCoupon && (
        <CouponModal onCancel={() => setShowCoupon(false)} onApply={(code) => applyCoupon.mutate(code)} />
      )}

      {showTablePick && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50" onClick={() => setShowTablePick(false)}>
          <div className="card p-5 w-[560px] max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="font-display text-xl mb-4">Switch table</div>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {tables?.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setShowTablePick(false); openTable(t); }}
                  className={`rounded-card border p-3 text-center transition-colors ${
                    mode === "dinein" && table?.id === t.id
                      ? "border-ink bg-ink text-white"
                      : t.status === "running"
                        ? "bg-clay/90 text-white border-clay"
                        : t.status === "printed"
                          ? "bg-amber-100 border-amber-400"
                          : "bg-surface hover:bg-cream border-hairline"
                  }`}
                >
                  <div className="font-display text-lg">{t.name}</div>
                  <div className="text-[10px] uppercase tracking-wide mt-0.5 opacity-80">
                    {t.status === "running" ? "Running" : t.status === "printed" ? "Billed" : "Free"}
                  </div>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-outline" onClick={() => { setShowTablePick(false); startMode("takeaway"); }}>+ Takeaway</button>
              <button className="btn-outline" onClick={() => { setShowTablePick(false); startMode("delivery"); }}>+ Delivery</button>
            </div>
          </div>
        </div>
      )}

      {roomPick && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50" onClick={() => setRoomPick(null)}>
          <div className="card p-5 w-[420px] max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="font-display text-xl mb-1">Post to room</div>
            <div className="text-xs text-muted mb-4">Occupied rooms with an open folio — pick the guest.</div>
            <div className="grid gap-2">
              {roomPick.map((f) => (
                <button key={f.id} disabled={postToRoom.isPending}
                  className="card p-3 text-left hover:bg-cream flex items-center gap-3"
                  onClick={() => postToRoom.mutate(f.id)}>
                  <span className="font-display text-xl w-14">{f.room_number}</span>
                  <span className="flex-1">
                    <span className="font-medium">{f.guest_name}</span>
                    <span className="block text-xs text-muted">balance {inr(f.balance)}</span>
                  </span>
                  <span className="text-pine text-sm">Post →</span>
                </button>
              ))}
            </div>
            <button className="btn-ghost w-full mt-3" onClick={() => setRoomPick(null)}>Cancel</button>
          </div>
        </div>
      )}

      {showFinal && order && (
        <FinalBillModal
          total={order.totals.total}
          tableName={mode === "dinein" ? table?.name : undefined}
          tenders={tenders}
          busy={finalBill.isPending}
          onCancel={() => setShowFinal(false)}
          onConfirm={(tender) => finalBill.mutate(tender)}
        />
      )}
    </div>
  );
}

function FinalBillModal({
  total, tableName, tenders, busy, onCancel, onConfirm,
}: {
  total: string;
  tableName?: string;
  tenders: string[];
  busy: boolean;
  onCancel: () => void;
  onConfirm: (tender: string) => void;
}) {
  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="card p-5 w-[380px]" onClick={(e) => e.stopPropagation()}>
        <div className="font-display text-xl mb-2">Final bill</div>
        <div className="text-sm bg-amber-50 border border-amber-300 rounded-lg p-3 mb-4">
          ⚠ This prints the final bill and closes the order.
          {tableName ? ` Table ${tableName} will be freed for the next guest.` : ""} This cannot be undone.
        </div>
        <div className="flex justify-between font-semibold text-lg mb-4">
          <span>Total to collect</span><span>{inr(total)}</span>
        </div>
        <div className={`grid gap-2 mb-2 ${tenders.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
          {tenders.map((tn, idx) => (
            <button key={tn} className={idx === 0 ? "btn-primary" : "btn-outline"} disabled={busy} onClick={() => onConfirm(tn)}>
              {busy ? "Settling…" : TENDER_LABELS[tn]}
            </button>
          ))}
        </div>
        <button className="btn-ghost w-full" disabled={busy} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function DiscountModal({ onCancel, onApply }: { onCancel: () => void; onApply: (kind: string, value: number, reason: string) => void }) {
  const [kind, setKind] = useState("percent");
  const [value, setValue] = useState("10");
  const [reason, setReason] = useState("");

  function onValue(raw: string) {
    if (kind === "percent") {
      const v = digits(raw, 3);
      setValue(Number(v) > 100 ? "100" : v);
    } else {
      setValue(amount(raw));
    }
  }
  function onKind(k: string) {
    setKind(k);
    if (k === "percent" && Number(value) > 100) setValue("100");
  }

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="card p-5 w-[360px]" onClick={(e) => e.stopPropagation()}>
        <div className="font-display text-xl mb-4">Apply discount</div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <select className="input" value={kind} onChange={(e) => onKind(e.target.value)}>
            <option value="percent">Percentage %</option>
            <option value="fixed">Fixed ₹</option>
          </select>
          <div className="relative">
            <input className="input pr-7" inputMode="decimal" value={value} onChange={(e) => onValue(e.target.value)} placeholder="Value" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-sm">{kind === "percent" ? "%" : "₹"}</span>
          </div>
        </div>
        <input className="input mb-1" placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="text-xs text-muted mb-4">Over your cap? A manager passcode will be requested.</div>
        <div className="flex gap-2">
          <button className="btn-ghost flex-1" onClick={onCancel}>Cancel</button>
          <button className="btn-primary flex-1" disabled={!value || Number(value) <= 0 || !reason.trim()} onClick={() => onApply(kind, Number(value), reason.trim())}>Apply</button>
        </div>
      </div>
    </div>
  );
}

function CouponModal({ onCancel, onApply }: { onCancel: () => void; onApply: (code: string) => void }) {
  const [code, setCode] = useState("");
  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="card p-5 w-[340px]" onClick={(e) => e.stopPropagation()}>
        <div className="font-display text-xl mb-4">Apply coupon</div>
        <input className="input mb-4" placeholder="Coupon code (e.g. WELCOME10)" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
        <div className="flex gap-2">
          <button className="btn-ghost flex-1" onClick={onCancel}>Cancel</button>
          <button className="btn-primary flex-1" disabled={!code} onClick={() => onApply(code)}>Apply</button>
        </div>
      </div>
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

function CategoryButton({
  name, count, active, onClick,
}: {
  name: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-left transition-colors ${
        active ? "bg-pine text-white" : "text-body hover:bg-cream"
      }`}
    >
      <span className="truncate">{name}</span>
      <span className={`text-xs tabular-nums ${active ? "opacity-80" : "text-muted"}`}>{count}</span>
    </button>
  );
}

function TillModal({ till, onClose }: { till: TillSession | null; onClose: () => void }) {
  const toast = useToast();
  const [state, setState] = useState<TillSession | null>(till);
  const [float_, setFloat] = useState("2000");
  const [entry, setEntry] = useState({ kind: "out", amount: "", reason: "" });
  const [counted, setCounted] = useState("");
  const [closed, setClosed] = useState<TillSession | null>(null);

  async function call(path: string, body: object) {
    try {
      return (await api.post(path, body)).data as TillSession;
    } catch (e: any) {
      toast(e?.response?.data?.detail ?? "Failed", "error");
      return null;
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="card p-5 w-[420px] max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="font-display text-xl mb-4">{closed ? "Day closed" : state ? "Till session" : "Open till"}</div>

        {closed ? (
          <>
            <div className="grid grid-cols-3 gap-2 text-center mb-4">
              <div className="card p-3"><div className="text-xs text-muted">Expected</div><div className="font-semibold">{inr(closed.expected_cash ?? 0)}</div></div>
              <div className="card p-3"><div className="text-xs text-muted">Counted</div><div className="font-semibold">{inr(closed.counted_cash ?? 0)}</div></div>
              <div className={`card p-3 ${Number(closed.variance) !== 0 ? "bg-clay/10" : "bg-pine-50"}`}>
                <div className="text-xs text-muted">Variance</div>
                <div className="font-semibold">{inr(closed.variance ?? 0)}</div>
              </div>
            </div>
            <div className="text-xs uppercase tracking-wide text-muted mb-1">Tender totals (session)</div>
            <div className="space-y-1 mb-4 text-sm">
              {closed.tender_totals.map((t) => (
                <div key={t.tender} className="flex justify-between"><span>{t.tender} × {t.count}</span><span>{inr(t.amount)}</span></div>
              ))}
              {!closed.tender_totals.length && <div className="text-muted text-sm">No settlements this session.</div>}
            </div>
            <button className="btn-primary w-full" onClick={onClose}>Done</button>
          </>
        ) : !state ? (
          <>
            <label className="text-sm text-muted">Opening float (cash in drawer)</label>
            <input className="input w-full mt-1 mb-4" inputMode="decimal" value={float_} onChange={(e) => setFloat(amount(e.target.value))} />
            <button className="btn-primary w-full" onClick={async () => {
              const s = await call("/pos/till/open/", { opening_float: float_ });
              if (s) { setState(s); toast("Till opened"); }
            }}>
              Open session
            </button>
          </>
        ) : (
          <>
            <div className="text-sm space-y-1 mb-4">
              <div className="flex justify-between"><span className="text-muted">Opened by</span><span>{state.opened_by}</span></div>
              <div className="flex justify-between"><span className="text-muted">Opening float</span><span>{inr(state.opening_float)}</span></div>
              <div className="flex justify-between"><span className="text-muted">Cash in / out</span><span>+{inr(state.cash_in)} / −{inr(state.cash_out)}</span></div>
            </div>
            {!!state.entries.length && (
              <div className="mb-4 space-y-1 text-xs text-muted border-t border-hairline pt-2">
                {state.entries.map((e) => (
                  <div key={e.id} className="flex justify-between">
                    <span>{e.kind === "in" ? "＋" : "−"} {e.reason}</span><span>{inr(e.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="text-xs uppercase tracking-wide text-muted mb-2">Cash in / out</div>
            <div className="grid grid-cols-[80px_1fr] gap-2 mb-2">
              <select className="input" value={entry.kind} onChange={(e) => setEntry({ ...entry, kind: e.target.value })}>
                <option value="out">Out</option>
                <option value="in">In</option>
              </select>
              <input className="input" inputMode="decimal" placeholder="Amount"
                value={entry.amount} onChange={(e) => setEntry({ ...entry, amount: amount(e.target.value) })} />
            </div>
            <input className="input w-full mb-2" placeholder="Reason (required)"
              value={entry.reason} onChange={(e) => setEntry({ ...entry, reason: e.target.value })} />
            <button className="btn-outline w-full mb-5" disabled={!entry.amount || !entry.reason.trim()}
              onClick={async () => {
                const s = await call(`/pos/till/${state.id}/entry/`, entry);
                if (s) { setState(s); setEntry({ kind: "out", amount: "", reason: "" }); }
              }}>
              Record cash {entry.kind}
            </button>

            <div className="text-xs uppercase tracking-wide text-muted mb-2">Day-end close</div>
            <input className="input w-full mb-2" inputMode="decimal" placeholder="Counted cash in drawer"
              value={counted} onChange={(e) => setCounted(amount(e.target.value))} />
            <button className="btn-primary w-full" disabled={!counted}
              onClick={async () => {
                const s = await call(`/pos/till/${state.id}/close/`, { counted_cash: counted });
                if (s) setClosed(s);
              }}>
              Close day & show variance
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ReserveModal({ tables, onDone, onCancel }: { tables: Table[]; onDone: () => void; onCancel: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ kind: "reservation", name: "", mobile: "", party_size: "2", table: "", time: "" });

  async function save() {
    try {
      const today = new Date().toISOString().slice(0, 10);
      await api.post("/pos/table-reservations/", {
        kind: f.kind, name: f.name.trim(), mobile: f.mobile, party_size: Number(f.party_size) || 1,
        table: f.table || null,
        reserved_for: f.kind === "reservation" && f.time ? `${today}T${f.time}:00` : null,
      });
      toast(f.kind === "waitlist" ? "Added to waitlist" : "Table reserved");
      onDone();
    } catch (e: any) {
      toast(e?.response?.data?.detail ?? "Could not save", "error");
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="card p-5 w-[380px]" onClick={(e) => e.stopPropagation()}>
        <div className="font-display text-xl mb-4">Reserve / Waitlist</div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {["reservation", "waitlist"].map((k) => (
            <button key={k} onClick={() => setF({ ...f, kind: k })}
              className={`pill justify-center ${f.kind === k ? "bg-ink text-white" : "bg-hairline text-body"}`}>
              {k === "reservation" ? "Reservation" : "Walk-in waitlist"}
            </button>
          ))}
        </div>
        <div className="grid gap-2">
          <input className="input" placeholder="Guest name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <input className="input" placeholder="Mobile (optional)" inputMode="tel"
              value={f.mobile} onChange={(e) => setF({ ...f, mobile: digits(e.target.value, 10) })} />
            <input className="input" placeholder="Party size" inputMode="numeric"
              value={f.party_size} onChange={(e) => setF({ ...f, party_size: digits(e.target.value, 2) })} />
          </div>
          {f.kind === "reservation" && (
            <div className="grid grid-cols-2 gap-2">
              <select className="input" value={f.table} onChange={(e) => setF({ ...f, table: e.target.value })}>
                <option value="">Any table…</option>
                {tables.filter((t) => t.status === "free").map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.seats})</option>
                ))}
              </select>
              <input className="input" type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} />
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-4">
          <button className="btn-ghost flex-1" onClick={onCancel}>Cancel</button>
          <button className="btn-primary flex-1" disabled={!f.name.trim()} onClick={save}>Save</button>
        </div>
      </div>
    </div>
  );
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
