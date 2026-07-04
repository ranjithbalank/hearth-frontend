import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { PhoneInput, joinPhone, splitPhone } from "../../design/PhoneInput";
import { useToast } from "../../design/Toast";
import { Badge, Card, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { useApp } from "../../lib/app-context";
import { amount, digits } from "../../lib/inputs";
import { inr } from "../../lib/money";
import { downloadBeoPdf } from "../print/documents";

function Line({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between text-muted"><span>{label}</span><span>{value}</span></div>;
}

interface Space { id: number; name: string; capacity: number }
interface Event {
  id: number; title: string; host: string; contact: string; event_type: string;
  space: string; space_id: number; event_date: string; start_time: string; end_time: string;
  covers: number; deposit: string;
  package_amount: string; status: string; billed: boolean;
  food_covers: number; food_pref: string; food_veg: number; food_nonveg: number;
  veg_rate: string; nonveg_rate: string; catering_amount: string; bill_subtotal: string;
  beo_status: string;
}

const TONE: Record<string, "amber" | "info" | "pine"> = {
  tentative: "amber",
  confirmed: "info",
  completed: "pine",
};

type Tab = "enquiry" | "confirmed" | "completed";
const TABS: { key: Tab; label: string; status: string }[] = [
  { key: "enquiry", label: "Enquiry", status: "tentative" },
  { key: "confirmed", label: "Confirmed", status: "confirmed" },
  { key: "completed", label: "Completed", status: "completed" },
];

export function Banquets() {
  const qc = useQueryClient();
  const { property } = useApp();
  const toast = useToast();
  const [msg, setMsg] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  const [editing, setEditing] = useState<Event | null>(null);
  const [tab, setTab] = useState<Tab>("enquiry");

  const { data, isLoading } = useQuery({
    queryKey: ["banquets"],
    queryFn: async () => (await api.get<{ spaces: Space[]; events: Event[] }>("/banquets/")).data,
  });

  const confirm = useMutation({
    mutationFn: async (e: Event) => (await api.post(`/banquets/${e.id}/confirm/`)).data,
    onSuccess: () => {
      toast("Event confirmed");
      setTab("confirmed"); // follow the event to its new tab
      qc.invalidateQueries({ queryKey: ["banquets"] });
    },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not confirm", "error"),
  });
  const bill = useMutation({
    mutationFn: async (e: Event) => (await api.post(`/banquets/${e.id}/bill/`)).data,
    onSuccess: (d) => {
      const cat = Number(d.catering) > 0 ? ` (incl. catering ${inr(d.catering)})` : "";
      setMsg(`Event billed · subtotal ${inr(d.subtotal)}${cat} · GST ${inr(d.tax.tax)} · total ${inr(d.tax.total)} · balance ${inr(d.balance)}`);
      qc.invalidateQueries({ queryKey: ["banquets"] });
    },
  });

  if (isLoading || !data) return <Spinner />;
  const activeStatus = TABS.find((t) => t.key === tab)?.status;
  const visible = data.events.filter((e) => e.status === activeStatus);

  return (
    <div>
      <PageHeader
        title="Banquets & Events"
        subtitle="Function space &amp; BEOs"
        action={<button className="btn-primary" onClick={() => setBooking(true)}>+ New booking</button>}
      />
      {msg && <div className="card p-3 mb-4 bg-pine-50 text-pine font-medium">{msg}</div>}

      {(booking || editing) && (
        <BookingForm
          spaces={data.spaces}
          restaurant={!!property?.entitlement.restaurant}
          event={editing ?? undefined}
          onCancel={() => { setBooking(false); setEditing(null); }}
          onSaved={(edited) => {
            setBooking(false); setEditing(null);
            setMsg(edited ? "Event updated" : "Event enquiry booked (tentative)");
            if (!edited) setTab("enquiry"); // new bookings start as an enquiry
            qc.invalidateQueries({ queryKey: ["banquets"] });
          }}
        />
      )}

      {/* Walk-in enquiry — dedicated area, only where it's relevant */}
      {tab === "enquiry" && (
        <div className="rounded-card border-2 border-dashed border-clay/30 bg-clay/5 p-5 mb-6 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-clay flex items-center justify-center text-white text-xl">＋</div>
          <div className="flex-1">
            <div className="font-semibold text-ink">Walk-in enquiry</div>
            <div className="text-sm text-muted">A customer wants to book a function? Capture the enquiry and hold a hall.</div>
          </div>
          <button className="btn-primary" onClick={() => setBooking(true)}>Book an event</button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-5">
        {data.spaces.map((s) => (
          <Badge key={s.id} tone="info">{s.name} · {s.capacity} pax</Badge>
        ))}
      </div>

      <div className="flex gap-3 mb-5">
        {TABS.map((t) => {
          const count = data.events.filter((e) => e.status === t.status).length;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`rounded-pill text-base font-bold px-6 py-3 transition-colors ${
                tab === t.key ? "bg-ink text-white" : "bg-hairline text-body hover:bg-hairline/70"}`}>
              {t.label} ({count})
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        {visible.map((e) => (
          <Card key={e.id} className="flex items-center gap-4">
            <div className="flex-1">
              <div className="font-semibold">{e.title} {e.event_type && <span className="text-muted font-normal">· {e.event_type}</span>}</div>
              <div className="text-sm text-muted">
                {e.space} · {e.event_date}{e.start_time ? ` · ${e.start_time}${e.end_time ? `–${e.end_time}` : ""}` : ""} · {e.covers} covers · {e.host}{e.contact ? ` (${e.contact})` : ""}
              </div>
              {e.food_covers > 0 && (
                <div className="text-xs text-pine mt-1">
                  🍽 Catering: ~{e.food_covers} plates · {e.food_pref === "both"
                    ? `veg ${e.food_veg} + non-veg ${e.food_nonveg}`
                    : e.food_pref === "nonveg" ? "non-veg" : "veg"}
                  {Number(e.catering_amount) > 0 && ` · ${inr(e.catering_amount)}`}
                </div>
              )}
            </div>
            <div className="font-medium">{inr(e.package_amount)}</div>
            <Badge tone={TONE[e.status] ?? "muted"}>{e.status}</Badge>
            <button className="btn-ghost text-xs" onClick={() => downloadBeoPdf(e.id)}>BEO PDF</button>
            {!e.billed && (
              <button className="btn-ghost text-xs" onClick={() => setEditing(e)}>Adjust</button>
            )}
            {e.status === "tentative" && (
              <button className="btn-outline text-base px-5 py-2.5" onClick={() => confirm.mutate(e)}>Confirm</button>
            )}
            {e.status === "confirmed" && !e.billed && (
              <button className="btn-primary text-base px-5 py-2.5" onClick={() => bill.mutate(e)}>Bill event</button>
            )}
          </Card>
        ))}
        {!visible.length && (
          <div className="text-sm text-muted text-center py-10">
            {tab === "enquiry" ? "No open enquiries — capture a walk-in above."
              : tab === "confirmed" ? "No confirmed events yet."
                : "No completed events yet."}
          </div>
        )}
      </div>
    </div>
  );
}

function BookingForm({ spaces, restaurant, event, onCancel, onSaved }: {
  spaces: Space[]; restaurant: boolean; event?: Event; onCancel: () => void; onSaved: (edited: boolean) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const ns = (v: string | number) => (Number(v) ? String(v) : ""); // hide zeros in edit
  const p = event ? splitPhone(event.contact) : { code: "+91", number: "" };
  const [f, setF] = useState(event ? {
    title: event.title, host: event.host, contact_code: p.code, contact: p.number,
    event_type: event.event_type || "Wedding",
    space: String(event.space_id), event_date: event.event_date,
    start_time: event.start_time || "18:00", end_time: event.end_time || "23:00",
    covers: ns(event.covers), package_amount: ns(event.package_amount), deposit: ns(event.deposit),
    food_pref: event.food_pref || "veg", food_veg: ns(event.food_veg), food_nonveg: ns(event.food_nonveg),
    veg_rate: ns(event.veg_rate), nonveg_rate: ns(event.nonveg_rate),
  } : {
    title: "", host: "", contact_code: "+91", contact: "", event_type: "Wedding",
    space: "", event_date: today, start_time: "18:00", end_time: "23:00",
    covers: "", package_amount: "", deposit: "",
    food_pref: "veg", food_veg: "", food_nonveg: "", veg_rate: "", nonveg_rate: "",
  });
  const [err, setErr] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: async () => {
      const body = {
        title: f.title, host: f.host, contact: joinPhone(f.contact_code, f.contact), event_type: f.event_type,
        space: Number(f.space), event_date: f.event_date, start_time: f.start_time, end_time: f.end_time,
        covers: Number(f.covers || 0),
        package_amount: f.package_amount || 0, deposit: f.deposit || 0,
        food_pref: f.food_pref, food_veg: Number(f.food_veg || 0), food_nonveg: Number(f.food_nonveg || 0),
        veg_rate: Number(f.veg_rate || 0), nonveg_rate: Number(f.nonveg_rate || 0),
      };
      return event
        ? (await api.patch(`/banquets/${event.id}/`, body)).data
        : (await api.post("/banquets/", body)).data;
    },
    onSuccess: () => onSaved(!!event),
    onError: (e: any) => setErr(e?.response?.data?.detail ?? "Could not save"),
  });
  const set = (k: string, v: string) => setF({ ...f, [k]: v });
  const space = spaces.find((s) => s.id === Number(f.space));

  // For a new booking, pre-fill catering rates from the property's price master.
  const { data: defaultRates } = useQuery({
    queryKey: ["catering-prices"],
    queryFn: async () => (await api.get<{ veg_rate: string; nonveg_rate: string }>("/banquets/catering_prices/")).data,
    enabled: !event,
  });
  useEffect(() => {
    if (!defaultRates || event) return;
    setF((cur) => ({
      ...cur,
      veg_rate: cur.veg_rate || (Number(defaultRates.veg_rate) ? defaultRates.veg_rate : ""),
      nonveg_rate: cur.nonveg_rate || (Number(defaultRates.nonveg_rate) ? defaultRates.nonveg_rate : ""),
    }));
  }, [defaultRates, event]);

  // Live bill estimate: hall/package + catering (plates × per-plate rate) + 18% GST.
  const vegCatering = f.food_pref !== "nonveg" ? Number(f.food_veg || 0) * Number(f.veg_rate || 0) : 0;
  const nvCatering = f.food_pref !== "veg" ? Number(f.food_nonveg || 0) * Number(f.nonveg_rate || 0) : 0;
  const catering = vegCatering + nvCatering;
  const subtotal = Number(f.package_amount || 0) + catering;
  const gst = subtotal * 0.18;
  const total = subtotal + gst;
  const balance = total - Number(f.deposit || 0);

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="card p-5 w-[520px] max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="font-display text-xl mb-4">{event ? "Adjust event booking" : "New event booking"}</div>
        {err && <div className="text-sm text-clay mb-3">{err}</div>}

        <label className="block text-xs font-semibold text-muted mb-1">Event title</label>
        <input className="input mb-3" placeholder="e.g. Sharma Wedding Reception" value={f.title} onChange={(e) => set("title", e.target.value)} />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Host / customer</label>
            <input className="input" value={f.host} onChange={(e) => set("host", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Contact</label>
            <PhoneInput code={f.contact_code} number={f.contact}
              onCode={(c) => set("contact_code", c)} onNumber={(n) => set("contact", n)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Event type</label>
            <select className="input" value={f.event_type} onChange={(e) => set("event_type", e.target.value)}>
              {["Wedding", "Corporate", "Birthday", "Conference", "Other"].map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Date</label>
            <input type="date" className="input" value={f.event_date} onChange={(e) => set("event_date", e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Start time</label>
            <input type="time" className="input" value={f.start_time} onChange={(e) => set("start_time", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">End time</label>
            <input type="time" className="input" value={f.end_time} onChange={(e) => set("end_time", e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Function space</label>
            <select className="input" value={f.space} onChange={(e) => set("space", e.target.value)}>
              <option value="">Select hall…</option>
              {spaces.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.capacity} pax)</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Covers (guests)</label>
            <input className="input" inputMode="numeric" value={f.covers} onChange={(e) => set("covers", digits(e.target.value, 5))} />
            {space && Number(f.covers) > space.capacity && <div className="text-xs text-clay mt-1">Exceeds {space.capacity} capacity</div>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Package amount (₹)</label>
            <input className="input" inputMode="decimal" value={f.package_amount} onChange={(e) => set("package_amount", amount(e.target.value))} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Advance / deposit (₹)</label>
            <input className="input" inputMode="decimal" value={f.deposit} onChange={(e) => set("deposit", amount(e.target.value))} />
          </div>
        </div>

        {restaurant && (
          <div className="mt-4 rounded-card border border-pine/20 bg-pine-50/50 p-3">
            <div className="text-xs font-semibold text-pine mb-2">Catering (optional · F&amp;B)</div>
            <label className="block text-xs font-semibold text-muted mb-1">Meal preference</label>
            <select className="input mb-3" value={f.food_pref} onChange={(e) => set("food_pref", e.target.value)}>
              <option value="veg">Veg</option>
              <option value="nonveg">Non-veg</option>
              <option value="both">Both (veg + non-veg)</option>
            </select>
            {f.food_pref !== "nonveg" && (
              <div className="grid grid-cols-2 gap-3 mb-2">
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">Veg plates</label>
                  <input className="input" inputMode="numeric" placeholder="e.g. 80" value={f.food_veg} onChange={(e) => set("food_veg", digits(e.target.value, 5))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">Veg rate (₹/plate)</label>
                  <input className="input" inputMode="decimal" placeholder="e.g. 850" value={f.veg_rate} onChange={(e) => set("veg_rate", amount(e.target.value))} />
                </div>
              </div>
            )}
            {f.food_pref !== "veg" && (
              <div className="grid grid-cols-2 gap-3 mb-2">
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">Non-veg plates</label>
                  <input className="input" inputMode="numeric" placeholder="e.g. 40" value={f.food_nonveg} onChange={(e) => set("food_nonveg", digits(e.target.value, 5))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">Non-veg rate (₹/plate)</label>
                  <input className="input" inputMode="decimal" placeholder="e.g. 1050" value={f.nonveg_rate} onChange={(e) => set("nonveg_rate", amount(e.target.value))} />
                </div>
              </div>
            )}
            {catering > 0 && <div className="text-xs text-muted mt-1">Catering charge: {inr(catering)}</div>}
          </div>
        )}

        {/* Live bill estimate */}
        {(subtotal > 0) && (
          <div className="mt-4 rounded-card border border-hairline p-3 text-sm">
            <div className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Estimated bill</div>
            <Line label="Hall / package" value={inr(Number(f.package_amount || 0))} />
            {catering > 0 && <Line label="Catering" value={inr(catering)} />}
            <Line label="Subtotal" value={inr(subtotal)} />
            <Line label="GST 18%" value={inr(gst)} />
            <div className="flex justify-between font-semibold border-t border-hairline mt-1 pt-1">
              <span>Total</span><span>{inr(total)}</span>
            </div>
            {Number(f.deposit || 0) > 0 && (
              <>
                <Line label="Less advance/deposit" value={`−${inr(Number(f.deposit || 0))}`} />
                <div className="flex justify-between font-semibold text-pine">
                  <span>Balance due</span><span>{inr(balance)}</span>
                </div>
              </>
            )}
          </div>
        )}

        <div className="flex gap-2 mt-5">
          <button className="btn-ghost flex-1" onClick={onCancel}>Cancel</button>
          <button className="btn-primary flex-1"
            disabled={!f.title || !f.space || save.isPending || (!!space && Number(f.covers) > space.capacity)}
            onClick={() => save.mutate()}>
            {event ? "Save changes" : "Book event (tentative)"}
          </button>
        </div>
      </div>
    </div>
  );
}
