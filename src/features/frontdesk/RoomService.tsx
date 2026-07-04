import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { usePrompt } from "../../design/Prompt";
import { useToast } from "../../design/Toast";
import { Badge, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { inr } from "../../lib/money";
import type { Folio } from "../../lib/types";

interface MenuOpt { id: number; name: string; category: string; price: string; diet: string }
interface SentOrder {
  order: number; kot_no: string; kitchen_status: string; cancellable: boolean;
  items: string[]; total: string; created_at: string;
}

/** Front-desk room service, step by step:
 *  1. pick an in-house room → 2. add items from the menu → 3. order check
 *  (review, adjust, add more) → fire the KOT & post to the folio. */
export function RoomServiceFlow({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const ask = usePrompt();
  const [step, setStep] = useState<"room" | "menu" | "check">("room");
  const [folio, setFolio] = useState<Folio | null>(null);
  const [qty, setQty] = useState<Record<number, number>>({});
  const [filter, setFilter] = useState("");

  const { data: folios, isLoading } = useQuery({
    queryKey: ["open-folios"],
    queryFn: async () => (await api.get<Folio[]>("/folios/?status=open")).data,
  });
  const { data: menu } = useQuery({
    queryKey: ["room-service-menu"],
    queryFn: async () => (await api.get<MenuOpt[]>("/folios/room_service_menu/")).data,
    enabled: !!folio,
  });
  const { data: sent } = useQuery({
    queryKey: ["room-service-orders", folio?.id],
    queryFn: async () => (await api.get<SentOrder[]>(`/folios/${folio!.id}/room_service_orders/`)).data,
    enabled: !!folio,
    refetchInterval: 15000, // live kitchen status
  });

  const delivered = useMutation({
    mutationFn: async (id: number) =>
      (await api.post(`/folios/${folio!.id}/room_service_delivered/`, { order: id })).data,
    onSuccess: () => {
      toast("Delivered to the room ✓");
      qc.invalidateQueries({ queryKey: ["room-service-orders"] });
    },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not confirm", "error"),
  });

  const cancel = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) =>
      (await api.post(`/folios/${folio!.id}/room_service_cancel/`, { order: id, reason })).data,
    onSuccess: () => {
      toast("Order cancelled — bill reversed, kitchen ticket pulled, stock returned");
      qc.invalidateQueries({ queryKey: ["room-service-orders"] });
      qc.invalidateQueries({ queryKey: ["folios"] });
      qc.invalidateQueries({ queryKey: ["open-folios"] });
    },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not cancel", "error"),
  });

  const order = useMutation({
    mutationFn: async () => (await api.post(`/folios/${folio!.id}/room_service/`, {
      items: Object.entries(qty).filter(([, n]) => n > 0)
        .map(([id, n]) => ({ menu_item: Number(id), qty: n })),
    })).data,
    onSuccess: () => {
      toast(`KOT fired to kitchen · bill posted to room ${folio?.room_number ?? ""}`);
      qc.invalidateQueries({ queryKey: ["folios"] });
      qc.invalidateQueries({ queryKey: ["open-folios"] });
      onClose();
    },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not place the order", "error"),
  });

  const add = (id: number, delta: number) =>
    setQty((q) => ({ ...q, [id]: Math.max(0, (q[id] ?? 0) + delta) }));

  const picked = (menu ?? []).filter((m) => (qty[m.id] ?? 0) > 0);
  const total = picked.reduce((s, m) => s + qty[m.id] * Number(m.price), 0);
  const count = picked.reduce((s, m) => s + qty[m.id], 0);
  const visible = (menu ?? []).filter((m) =>
    !filter || m.name.toLowerCase().includes(filter.toLowerCase()));
  const inhouse = (folios ?? []).filter((f) => f.room_number);

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="card p-5 w-[520px] max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>

        {step === "room" && (
          <>
            <div className="font-display text-xl mb-1">Room service — pick a room</div>
            <div className="text-sm text-muted mb-3">In-house guests with an open folio</div>
            {isLoading ? <Spinner /> : (
              <div className="grid grid-cols-3 gap-2 overflow-y-auto">
                {inhouse.map((f) => (
                  <button key={f.id} className="card p-3 text-center hover:bg-cream"
                    onClick={() => { setFolio(f); setStep("menu"); }}>
                    <div className="font-display text-lg">{f.room_number}</div>
                    <div className="text-xs text-muted truncate">{f.guest_name}</div>
                  </button>
                ))}
                {!inhouse.length && (
                  <div className="col-span-3 text-sm text-muted text-center py-6">
                    No in-house guests right now.
                  </div>
                )}
              </div>
            )}
            <button className="btn-ghost w-full mt-3" onClick={onClose}>Cancel</button>
          </>
        )}

        {step === "menu" && folio && (
          <>
            <div className="font-display text-xl mb-1">
              Add items — Room {folio.room_number} · {folio.guest_name}
            </div>
            <div className="text-sm text-muted mb-3">Tap + to add; check the order before firing</div>

            {/* Already-sent orders: live kitchen status + cancel-before-served */}
            {!!sent?.length && (
              <div className="rounded-card border border-hairline p-2 mb-2 space-y-1">
                <div className="text-xs uppercase tracking-wide text-muted">Sent to kitchen</div>
                {sent.map((o) => (
                  <div key={o.order} className="flex items-center justify-between text-xs gap-2">
                    <span className="truncate flex-1">{o.kot_no} · {o.items.join(", ")}</span>
                    <Badge tone={o.kitchen_status === "ready" ? "pine"
                      : o.kitchen_status === "cooking" ? "amber" : "muted"}>
                      {o.kitchen_status}
                    </Badge>
                    {o.kitchen_status === "ready" && (
                      <button className="btn-outline text-xs py-0.5" disabled={delivered.isPending}
                        onClick={() => delivered.mutate(o.order)}>
                        Delivered ✓
                      </button>
                    )}
                    {o.cancellable && (
                      <button className="btn-ghost text-xs text-clay" disabled={cancel.isPending}
                        onClick={async () => {
                          const reason = await ask({
                            title: `Cancel ${o.kot_no}?`,
                            label: "Reason (bill is reversed & the kitchen ticket is pulled)",
                            placeholder: "e.g. wrong room / guest changed mind",
                          });
                          if (reason !== null) cancel.mutate({ id: o.order, reason: reason || "wrong order" });
                        }}>
                        Cancel
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <input className="input mb-2" placeholder="Search menu…" value={filter}
              onChange={(e) => setFilter(e.target.value)} autoFocus />
            <div className="overflow-y-auto flex-1 space-y-1 min-h-[160px]">
              {visible.map((m) => (
                <div key={m.id} className="flex items-center justify-between border-t border-line py-1.5 text-sm">
                  <div>
                    <span className="font-medium">{m.name}</span>
                    <span className="text-xs text-muted ml-2">{m.category} · {inr(m.price)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {(qty[m.id] ?? 0) > 0 ? (
                      <>
                        <button className="btn-ghost text-sm px-2" onClick={() => add(m.id, -1)}>−</button>
                        <span className="w-6 text-center font-medium">{qty[m.id]}</span>
                        <button className="btn-ghost text-sm px-2" onClick={() => add(m.id, 1)}>+</button>
                      </>
                    ) : (
                      <button className="btn-outline text-xs py-1" onClick={() => add(m.id, 1)}>Add</button>
                    )}
                  </div>
                </div>
              ))}
              {!visible.length && <div className="text-sm text-muted py-6 text-center">No menu items.</div>}
            </div>
            <div className="flex gap-2 mt-3">
              <button className="btn-ghost flex-1" onClick={() => setStep("room")}>← Rooms</button>
              <button className="btn-primary flex-1" disabled={!count}
                onClick={() => setStep("check")}>
                Check order ({count}) →
              </button>
            </div>
          </>
        )}

        {step === "check" && folio && (
          <>
            <div className="font-display text-xl mb-1">
              Order check — Room {folio.room_number} · {folio.guest_name}
            </div>
            <div className="text-sm text-muted mb-3">
              Confirm before firing — the KOT goes to the kitchen and the bill posts to the folio
            </div>
            <div className="overflow-y-auto flex-1 min-h-[120px]">
              {picked.map((m) => (
                <div key={m.id} className="flex items-center justify-between border-t border-line py-2 text-sm">
                  <div className="flex-1">
                    <span className="font-medium">{m.name}</span>
                    <span className="text-xs text-muted ml-2">{inr(m.price)} each</span>
                  </div>
                  <div className="flex items-center gap-2 mr-3">
                    <button className="btn-ghost text-sm px-2" onClick={() => add(m.id, -1)}>−</button>
                    <span className="w-6 text-center font-medium">{qty[m.id]}</span>
                    <button className="btn-ghost text-sm px-2" onClick={() => add(m.id, 1)}>+</button>
                  </div>
                  <div className="w-20 text-right font-medium">{inr(qty[m.id] * Number(m.price))}</div>
                  <button className="btn-ghost text-xs text-clay ml-2"
                    onClick={() => setQty((q) => ({ ...q, [m.id]: 0 }))}>✕</button>
                </div>
              ))}
              {!picked.length && (
                <div className="text-sm text-muted py-6 text-center">
                  Nothing on the order — add some items.
                </div>
              )}
            </div>
            <button className="btn-outline text-sm w-full mt-2" onClick={() => setStep("menu")}>
              ＋ Add more items
            </button>
            <div className="flex justify-between font-semibold border-t border-hairline pt-3 mt-3 text-sm">
              <span>{count} item(s)</span><span>{inr(total)} + GST</span>
            </div>
            <div className="flex gap-2 mt-3">
              <button className="btn-ghost flex-1" onClick={() => setStep("menu")}>← Back</button>
              <button className="btn-primary flex-1" disabled={!count || order.isPending}
                onClick={() => order.mutate()}>
                Fire KOT &amp; post to room
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
