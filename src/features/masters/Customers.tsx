import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Badge, Card, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { fmtDate } from "../../lib/date";
import { money } from "../../lib/money";

interface Customer {
  id: number; name: string; mobile: string; customer_type: string; type_label: string;
  gstin: string; btc_enabled: boolean; outstanding: string; loyalty_points: number;
  tier_name?: string | null;
}
interface GuestDetail {
  profile: Customer & { email: string; address: string; marketing_consent: boolean };
  orders: { id: number; mode: string; status: string; created_at: string }[];
  reservations: { id: number; checkin_date: string; checkout_date: string; status: string }[];
  city_ledger: { folio: number; guest: string; invoice_no: string; room: string | null; amount: string }[];
}

const TABS = [
  { key: "", label: "All" },
  { key: "guest", label: "Guests" },
  { key: "corporate", label: "Corporate" },
  { key: "agent", label: "Travel Agents" },
];

function GuestModal({ id, onClose }: { id: number; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["guest-detail", id],
    queryFn: async () => (await api.get<GuestDetail>(`/customers/${id}/export/`)).data,
  });
  const statusTone: Record<string, "pine" | "muted" | "amber" | "clay"> = {
    in_house: "pine", checked_out: "muted", booked: "amber", cancelled: "clay", no_show: "clay",
  };
  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="card p-6 w-[560px] max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {isLoading || !data ? <Spinner /> : (
          <>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="font-display text-2xl">{data.profile.name}</div>
                <div className="text-sm text-muted">{data.profile.mobile} · {data.profile.type_label}</div>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge tone="info">{data.profile.loyalty_points} pts</Badge>
                {data.profile.tier_name && data.profile.tier_name !== "Base" && (
                  <Badge tone="amber">{data.profile.tier_name}</Badge>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm mb-4">
              <Field label="Email" value={data.profile.email || "—"} />
              <Field label="GSTIN" value={data.profile.gstin || "—"} />
              <Field label="Address" value={data.profile.address || "—"} />
              <Field label="Outstanding" value={money(data.profile.outstanding)} />
            </div>

            <div className="text-xs uppercase tracking-wide text-muted mb-2">Stay history ({data.reservations.length})</div>
            {data.reservations.length ? data.reservations.map((r) => (
              <div key={r.id} className="flex justify-between items-center py-1.5 border-t border-line text-sm">
                <span>{fmtDate(r.checkin_date)} → {fmtDate(r.checkout_date)}</span>
                <Badge tone={statusTone[r.status] ?? "muted"}>{r.status.replace("_", " ")}</Badge>
              </div>
            )) : <div className="text-sm text-muted py-2">No stays on record.</div>}

            {data.city_ledger?.length > 0 && (
              <>
                <div className="text-xs uppercase tracking-wide text-muted mt-4 mb-2">
                  City ledger — bill-to-company stays ({data.city_ledger.length})
                </div>
                {data.city_ledger.map((f) => (
                  <div key={f.folio} className="flex justify-between py-1.5 border-t border-line text-sm">
                    <span>{f.invoice_no || `Folio #${f.folio}`} · {f.guest}{f.room ? ` · Rm ${f.room}` : ""}</span>
                    <span className="font-medium">{money(f.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-1.5 border-t border-line text-sm font-semibold">
                  <span>Outstanding</span>
                  <span className={Number(data.profile.outstanding) > 0 ? "text-clay" : "text-pine"}>{money(data.profile.outstanding)}</span>
                </div>
              </>
            )}

            <div className="text-xs uppercase tracking-wide text-muted mt-4 mb-2">Restaurant orders ({data.orders.length})</div>
            {data.orders.length ? data.orders.slice(0, 8).map((o) => (
              <div key={o.id} className="flex justify-between py-1.5 border-t border-line text-sm">
                <span>#{o.id} · {o.mode}</span>
                <span className="text-muted">{o.status}</span>
              </div>
            )) : <div className="text-sm text-muted py-2">No orders on record.</div>}

            <button className="btn-primary w-full mt-5" onClick={onClose}>Close</button>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs text-muted">{label}</div><div className="font-medium">{value}</div></div>;
}

export function Customers() {
  const [tab, setTab] = useState("");
  const [q, setQ] = useState("");
  const [viewId, setViewId] = useState<number | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["cust-master", tab],
    queryFn: async () => (await api.get<Customer[]>(`/customers/${tab ? `?type=${tab}` : ""}`)).data,
  });

  if (isLoading || !data) return <Spinner />;
  const rows = data.filter((c) =>
    !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.mobile.includes(q));

  return (
    <div>
      <PageHeader title="Customers" subtitle="Guest, corporate & travel-agent master" />
      <div className="flex items-center gap-3 mb-4">
        <div className="flex gap-1 rounded-pill bg-hairline p-1">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`pill ${tab === t.key ? "bg-ink text-white shadow-sm" : "bg-transparent text-body hover:bg-white/70"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <input className="input ml-auto w-56" placeholder="Search name or mobile…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-cream text-muted text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Mobile</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-left px-4 py-3">GSTIN</th>
              <th className="text-left px-4 py-3">BTC</th>
              <th className="text-right px-4 py-3">Outstanding</th>
              <th className="text-right px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-line hover:bg-cream cursor-pointer" onClick={() => setViewId(c.id)}>
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 font-mono text-xs">{c.mobile}</td>
                <td className="px-4 py-3">{c.type_label}</td>
                <td className="px-4 py-3 text-muted">{c.gstin || "—"}</td>
                <td className="px-4 py-3">{c.btc_enabled ? <Badge tone="info">BTC</Badge> : "—"}</td>
                <td className="px-4 py-3 text-right">{money(c.outstanding)}</td>
                <td className="px-4 py-3 text-right"><span className="text-pine text-sm">View →</span></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} className="px-4 py-6 text-center text-muted">No customers.</td></tr>}
          </tbody>
        </table>
      </Card>

      {viewId !== null && <GuestModal id={viewId} onClose={() => setViewId(null)} />}
    </div>
  );
}
