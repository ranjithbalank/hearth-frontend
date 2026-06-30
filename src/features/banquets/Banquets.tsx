import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Badge, Card, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { useApp } from "../../lib/app-context";
import { inr } from "../../lib/money";

interface Space { id: number; name: string; capacity: number }
interface Event {
  id: number; title: string; host: string; contact: string; event_type: string;
  space: string; event_date: string; covers: number; deposit: string;
  package_amount: string; status: string; billed: boolean;
  food_covers: number; food_pref: string; beo_status: string;
}

const TONE: Record<string, "amber" | "info" | "pine"> = {
  tentative: "amber",
  confirmed: "info",
  completed: "pine",
};

function printBeo(e: Event, propertyName: string) {
  const row = (label: string, value: string) =>
    `<tr><td class="lbl">${label}</td><td class="val">${value || "—"}</td></tr>`;
  const blank = (label: string) =>
    `<div class="blk"><div class="blk-l">${label}</div><div class="blk-lines"></div></div>`;
  const inr = (v: string | number) =>
    "₹" + new Intl.NumberFormat("en-IN").format(Number(v) || 0);
  const balance = Number(e.package_amount) - Number(e.deposit);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>BEO-${e.id}</title>
  <style>
    @page { size: A4; margin: 16mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; color: #16221F; }
    .head { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #1C6B57; padding-bottom:10px; }
    .brand { font-family: Georgia, serif; font-size:26px; color:#1C6B57; font-weight:600; }
    .doc { text-align:right; }
    .doc h1 { font-size:18px; margin:0; letter-spacing:1px; }
    .doc .no { color:#8A8478; font-size:12px; }
    .pill { display:inline-block; padding:2px 10px; border-radius:999px; font-size:11px; font-weight:700; background:#E6F0EB; color:#1C6B57; text-transform:uppercase; }
    .grid { display:grid; grid-template-columns:1fr 1fr; gap:18px; margin-top:18px; }
    .card { border:1px solid #EDE7DC; border-radius:10px; padding:12px 14px; }
    .card h2 { font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:#8A8478; margin:0 0 8px; }
    table { width:100%; border-collapse:collapse; font-size:13px; }
    td { padding:3px 0; vertical-align:top; }
    td.lbl { color:#8A8478; width:42%; }
    td.val { font-weight:600; }
    .blk { margin-top:14px; }
    .blk-l { font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:#8A8478; margin-bottom:4px; }
    .blk-lines { height:64px; border:1px dashed #DDD5C7; border-radius:8px; }
    .sign { display:flex; justify-content:space-between; margin-top:34px; font-size:12px; color:#3D4A4E; }
    .sign div { width:30%; border-top:1px solid #C9C1B2; padding-top:6px; text-align:center; }
    .foot { margin-top:18px; font-size:10.5px; color:#B6AF9F; text-align:center; }
  </style></head><body>
    <div class="head">
      <div><div class="brand">${propertyName}</div><div style="font-size:12px;color:#8A8478">Banquet &amp; Events</div></div>
      <div class="doc"><h1>BANQUET EVENT ORDER</h1><div class="no">BEO-${e.id} &middot; ${new Date().toLocaleDateString("en-IN")}</div><div style="margin-top:6px"><span class="pill">${e.status}</span></div></div>
    </div>
    <div class="grid">
      <div class="card"><h2>Event</h2><table>
        ${row("Title", e.title)}${row("Type", e.event_type)}${row("Date", e.event_date)}${row("Function space", e.space)}${row("Covers (guests)", String(e.covers))}
      </table></div>
      <div class="card"><h2>Client</h2><table>
        ${row("Host / customer", e.host)}${row("Contact", e.contact)}
      </table></div>
      <div class="card"><h2>Catering (F&amp;B)</h2><table>
        ${row("Food plates (approx.)", e.food_covers ? String(e.food_covers) : "—")}${row("Preference", e.food_pref ? e.food_pref.toUpperCase() : "—")}${row("Kitchen prep (BEO)", e.beo_status ? e.beo_status.toUpperCase() : "—")}
      </table></div>
      <div class="card"><h2>Financials</h2><table>
        ${row("Package amount", inr(e.package_amount))}${row("Advance / deposit", inr(e.deposit))}${row("Balance due", inr(balance))}
      </table></div>
    </div>
    ${blank("Service timeline (setup, guest arrival, meal service, close)")}
    ${blank("Hall setup & layout (seating, stage, AV, décor)")}
    ${blank("Special instructions")}
    <div class="sign"><div>Sales / Banquet Sales</div><div>Banquet Manager</div><div>Executive Chef</div></div>
    <div class="foot">Hearth · Banquet Event Order · generated for the service &amp; kitchen team</div>
  </body></html>`;
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

export function Banquets() {
  const qc = useQueryClient();
  const { property } = useApp();
  const [msg, setMsg] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["banquets"],
    queryFn: async () => (await api.get<{ spaces: Space[]; events: Event[] }>("/banquets/")).data,
  });

  const confirm = useMutation({
    mutationFn: async (e: Event) => (await api.post(`/banquets/${e.id}/confirm/`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["banquets"] }),
  });
  const bill = useMutation({
    mutationFn: async (e: Event) => (await api.post(`/banquets/${e.id}/bill/`)).data,
    onSuccess: (d) => {
      setMsg(`Event billed · total ${inr(d.tax.total)} (incl. 18% GST ${inr(d.tax.tax)})`);
      qc.invalidateQueries({ queryKey: ["banquets"] });
    },
  });

  if (isLoading || !data) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Banquets & Events"
        subtitle="Function space &amp; BEOs"
        action={<button className="btn-primary" onClick={() => setBooking(true)}>+ New booking</button>}
      />
      {msg && <div className="card p-3 mb-4 bg-pine-50 text-pine font-medium">{msg}</div>}

      {booking && (
        <BookingForm
          spaces={data.spaces}
          restaurant={!!property?.entitlement.restaurant}
          onCancel={() => setBooking(false)}
          onCreated={() => { setBooking(false); setMsg("Event enquiry booked (tentative)"); qc.invalidateQueries({ queryKey: ["banquets"] }); }}
        />
      )}

      {/* Walk-in enquiry — dedicated area */}
      <div className="rounded-card border-2 border-dashed border-clay/30 bg-clay/5 p-5 mb-6 flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-clay flex items-center justify-center text-white text-xl">＋</div>
        <div className="flex-1">
          <div className="font-semibold text-ink">Walk-in enquiry</div>
          <div className="text-sm text-muted">A customer wants to book a function? Capture the enquiry and hold a hall.</div>
        </div>
        <button className="btn-primary" onClick={() => setBooking(true)}>Book an event</button>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {data.spaces.map((s) => (
          <Badge key={s.id} tone="info">{s.name} · {s.capacity} pax</Badge>
        ))}
      </div>

      <div className="space-y-3">
        {data.events.map((e) => (
          <Card key={e.id} className="flex items-center gap-4">
            <div className="flex-1">
              <div className="font-semibold">{e.title} {e.event_type && <span className="text-muted font-normal">· {e.event_type}</span>}</div>
              <div className="text-sm text-muted">
                {e.space} · {e.event_date} · {e.covers} covers · {e.host}{e.contact ? ` (${e.contact})` : ""}
              </div>
              {e.food_covers > 0 && (
                <div className="text-xs text-pine mt-1">
                  🍽 Catering: ~{e.food_covers} plates{e.food_pref ? ` · ${e.food_pref}` : ""}
                </div>
              )}
            </div>
            <div className="font-medium">{inr(e.package_amount)}</div>
            <Badge tone={TONE[e.status] ?? "muted"}>{e.status}</Badge>
            <button className="btn-ghost text-xs" onClick={() => printBeo(e, property?.name ?? "Hearth")}>Print BEO</button>
            {e.status === "tentative" && (
              <button className="btn-outline" onClick={() => confirm.mutate(e)}>Confirm</button>
            )}
            {e.status === "confirmed" && !e.billed && (
              <button className="btn-primary" onClick={() => bill.mutate(e)}>Bill event</button>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function BookingForm({ spaces, restaurant, onCancel, onCreated }: { spaces: Space[]; restaurant: boolean; onCancel: () => void; onCreated: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({
    title: "", host: "", contact: "", event_type: "Wedding",
    space: "", event_date: today, covers: "", package_amount: "", deposit: "",
    food_covers: "", food_pref: "veg",
  });
  const [err, setErr] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: async () => (await api.post("/banquets/", {
      title: f.title, host: f.host, contact: f.contact, event_type: f.event_type,
      space: Number(f.space), event_date: f.event_date, covers: Number(f.covers || 0),
      package_amount: f.package_amount || 0, deposit: f.deposit || 0,
      food_covers: Number(f.food_covers || 0), food_pref: f.food_covers ? f.food_pref : "",
    })).data,
    onSuccess: onCreated,
    onError: (e: any) => setErr(e?.response?.data?.detail ?? "Could not book"),
  });
  const set = (k: string, v: string) => setF({ ...f, [k]: v });
  const space = spaces.find((s) => s.id === Number(f.space));

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="card p-5 w-[520px] max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="font-display text-xl mb-4">New event booking</div>
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
            <input className="input" value={f.contact} onChange={(e) => set("contact", e.target.value)} />
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
            <label className="block text-xs font-semibold text-muted mb-1">Function space</label>
            <select className="input" value={f.space} onChange={(e) => set("space", e.target.value)}>
              <option value="">Select hall…</option>
              {spaces.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.capacity} pax)</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Covers (guests)</label>
            <input className="input" value={f.covers} onChange={(e) => set("covers", e.target.value)} />
            {space && Number(f.covers) > space.capacity && <div className="text-xs text-clay mt-1">Exceeds {space.capacity} capacity</div>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Package amount (₹)</label>
            <input className="input" value={f.package_amount} onChange={(e) => set("package_amount", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Advance / deposit (₹)</label>
            <input className="input" value={f.deposit} onChange={(e) => set("deposit", e.target.value)} />
          </div>
        </div>

        {restaurant && (
          <div className="mt-4 rounded-card border border-pine/20 bg-pine-50/50 p-3">
            <div className="text-xs font-semibold text-pine mb-2">Catering (optional · F&amp;B)</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Approx. food plates</label>
                <input className="input" placeholder="e.g. 120" value={f.food_covers} onChange={(e) => set("food_covers", e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Preference</label>
                <select className="input" value={f.food_pref} onChange={(e) => set("food_pref", e.target.value)} disabled={!f.food_covers}>
                  <option value="veg">Veg</option>
                  <option value="nonveg">Non-veg</option>
                  <option value="both">Both (veg + non-veg)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-5">
          <button className="btn-ghost flex-1" onClick={onCancel}>Cancel</button>
          <button className="btn-primary flex-1" disabled={!f.title || !f.space || create.isPending} onClick={() => create.mutate()}>
            Book event (tentative)
          </button>
        </div>
      </div>
    </div>
  );
}
