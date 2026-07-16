import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { usePrompt } from "../../design/Prompt";
import { Badge, Card, PageHeader, Spinner, Stat } from "../../design/ui";
import { api } from "../../lib/api";
import { amount as amtFilter } from "../../lib/inputs";
import { money } from "../../lib/money";

interface Customer {
  id: number; name: string; mobile: string; type_label: string; customer_type: string;
  gstin: string; outstanding: string; loyalty_points: number; btc_enabled: boolean;
}

interface FeedbackSummary {
  count: number; avg_rating: number; nps: number; pending: number;
  recent: { id: number; rating: number; nps: number | null; comment: string; where: string; submitted_at: string }[];
}

const TONE: Record<string, "pine" | "info" | "amber"> = {
  guest: "pine",
  corporate: "info",
  agent: "amber",
};

export function Crm() {
  const qc = useQueryClient();
  const ask = usePrompt();
  const [msg, setMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "due" | "settled">("all");
  const [showCampaign, setShowCampaign] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => (await api.get<Customer[]>("/customers/")).data,
  });
  // Guest feedback rollup (collected via the QR/link on POS bills).
  const { data: fb } = useQuery({
    queryKey: ["feedback-summary"],
    queryFn: async () => (await api.get<FeedbackSummary>("/crm/feedback/")).data,
  });

  const exportData = useMutation({
    mutationFn: async (c: Customer) => (await api.get(`/customers/${c.id}/export/`)).data,
    onSuccess: (d) => {
      const blob = new Blob([JSON.stringify(d, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `customer-${d.profile.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg("Data-subject export downloaded (DPDP).");
    },
  });
  const erase = useMutation({
    mutationFn: async (c: Customer) => (await api.post(`/customers/${c.id}/erase/`)).data,
    onSuccess: () => {
      setMsg("Customer PII anonymised (DPDP erasure).");
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
  });
  const receive = useMutation({
    mutationFn: async ({ id, amount }: { id: number; amount: string }) =>
      (await api.post(`/customers/${id}/settle_ar/`, { amount })).data,
    onSuccess: (d) => {
      setMsg(`Receipt recorded · ${money(d.received)} · balance now ${money(d.outstanding)}`);
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
  });

  if (isLoading || !data) return <Spinner />;
  const loyalty = data.reduce((s, c) => s + c.loyalty_points, 0);
  const outstanding = data.reduce((s, c) => s + Number(c.outstanding), 0);
  const dueCount = data.filter((c) => Number(c.outstanding) > 0).length;
  const rows = data.filter((c) =>
    filter === "all" ? true : filter === "due" ? Number(c.outstanding) > 0 : Number(c.outstanding) === 0);
  const TABS: [typeof filter, string][] = [["all", "All"], ["due", "To receive"], ["settled", "Settled"]];

  return (
    <div>
      <PageHeader
        title="Guest CRM &amp; Loyalty"
        subtitle="Unified customer profiles"
        action={<button className="btn-primary text-sm" onClick={() => setShowCampaign(true)}>📣 New campaign</button>}
      />
      {msg && <div className="card p-3 mb-4 bg-pine-50 text-pine font-medium">{msg}</div>}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <Stat tone="dark" label="Customers" value={data.length} />
        <Stat label="Loyalty points" value={loyalty.toLocaleString("en-IN")} />
        <Stat label="Outstanding (BTC/AR)" value={money(outstanding)} />
      </div>

      {showCampaign && (
        <CampaignModal
          onDone={(sent, skipped) => {
            setShowCampaign(false);
            setMsg(`Campaign sent to ${sent} customer(s) · ${skipped} skipped (no consent/mobile)`);
          }}
          onCancel={() => setShowCampaign(false)}
        />
      )}

      {/* Guest feedback — collected from the QR/link printed on POS bills. */}
      {fb && fb.count > 0 && (
        <Card className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold">Guest feedback</div>
            <div className="flex items-center gap-3 text-sm">
              <span>⭐ {fb.avg_rating}/5</span>
              <Badge tone={fb.nps >= 50 ? "pine" : fb.nps >= 0 ? "amber" : "clay"}>NPS {fb.nps}</Badge>
              <span className="text-muted text-xs">{fb.count} response(s) · {fb.pending} pending</span>
            </div>
          </div>
          <div className="space-y-1.5">
            {fb.recent.slice(0, 6).map((r) => (
              <div key={r.id} className="flex items-center gap-2 text-sm">
                <span className="w-16">{"⭐".repeat(r.rating)}</span>
                <span className="flex-1 truncate">{r.comment || <span className="text-muted">no comment</span>}</span>
                <span className="text-xs text-muted">{r.where}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex items-center gap-2 mb-4">
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`pill ${filter === k ? "bg-ink text-white" : "bg-hairline text-body"}`}>
            {label}{k === "due" && dueCount > 0 ? ` (${dueCount})` : ""}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-cream text-muted text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Mobile</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-left px-4 py-3">GSTIN</th>
              <th className="text-right px-4 py-3">Loyalty</th>
              <th className="text-right px-4 py-3">Outstanding</th>
              <th className="text-right px-4 py-3">DPDP</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-line">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 font-mono text-xs">{c.mobile}</td>
                <td className="px-4 py-3"><Badge tone={TONE[c.customer_type] ?? "pine"}>{c.type_label}</Badge></td>
                <td className="px-4 py-3 text-muted">{c.gstin || "—"}</td>
                <td className="px-4 py-3 text-right">{c.loyalty_points}</td>
                <td className="px-4 py-3 text-right">
                  <span className={Number(c.outstanding) > 0 ? "text-clay font-medium" : ""}>{money(c.outstanding)}</span>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {Number(c.outstanding) > 0 && (
                    <button className="btn-ghost text-xs py-1 text-pine" onClick={async () => {
                      const raw = await ask({ title: `Receive payment — ${c.name}`, label: `Outstanding ${money(c.outstanding)}`, defaultValue: c.outstanding, placeholder: "Amount received" });
                      const amount = amtFilter(raw ?? "");
                      if (amount && Number(amount) > 0) receive.mutate({ id: c.id, amount });
                    }}>Receive</button>
                  )}
                  <button className="btn-ghost text-xs py-1" onClick={() => exportData.mutate(c)}>Export</button>
                  <button className="btn-ghost text-xs py-1 text-clay" onClick={() => erase.mutate(c)}>Erase</button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted">
                {filter === "due" ? "Nothing to receive — all settled." : "No customers."}
              </td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function CampaignModal({ onDone, onCancel }: { onDone: (sent: number, skipped: number) => void; onCancel: () => void }) {
  const [f, setF] = useState({ segment: "all", channel: "sms", message: "Hi {name}! You have {points} loyalty points waiting. Visit us this week for 10% off." });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send() {
    setBusy(true); setError("");
    try {
      const r = await api.post("/customers/campaign/", f);
      onDone(r.data.sent, r.data.skipped);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Campaign failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="card p-5 w-[440px]" onClick={(e) => e.stopPropagation()}>
        <div className="font-display text-xl mb-1">New campaign</div>
        <div className="text-xs text-muted mb-4">
          Sent only to customers with marketing consent. Placeholders: {"{name}"}, {"{points}"}.
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <select className="input" value={f.segment} onChange={(e) => setF({ ...f, segment: e.target.value })}>
            <option value="all">All customers</option>
            <option value="guests">Guests only</option>
            <option value="corporate">Corporate only</option>
            <option value="loyal">Loyalty members (points &gt; 0)</option>
          </select>
          <select className="input" value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value })}>
            <option value="sms">SMS</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
        </div>
        <textarea className="input w-full mb-2" rows={4} maxLength={480}
          value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />
        {error && <div className="text-sm text-clay mb-2">{error}</div>}
        <div className="flex gap-2">
          <button className="btn-ghost flex-1" onClick={onCancel}>Cancel</button>
          <button className="btn-primary flex-1" disabled={!f.message.trim() || busy} onClick={send}>
            {busy ? "Sending…" : "Send campaign"}
          </button>
        </div>
      </div>
    </div>
  );
}
