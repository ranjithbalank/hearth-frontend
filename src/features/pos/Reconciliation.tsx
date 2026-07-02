import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useToast } from "../../design/Toast";
import { Badge, Card, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { inr } from "../../lib/money";

interface ReconDay {
  date: string;
  tenders: { tender: string; amount: string; count: number }[];
  aggregators: { platform: string; pos_amount: string; payout_amount: string | null; variance: string | null }[];
}
interface Recon {
  days: number;
  rows: ReconDay[];
  unmatched_payouts: { date: string; platform: string; payout_amount: string }[];
}

/** Payment reconciliation: what the POS recorded vs what platforms paid out.
 *  Variances surface pilferage and missed orders at day-end. */
export function Reconciliation() {
  const qc = useQueryClient();
  const toast = useToast();
  const [days, setDays] = useState(7);
  const [showImport, setShowImport] = useState(false);
  const [raw, setRaw] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["recon", days],
    queryFn: async () => (await api.get<Recon>(`/pos/reconciliation/?days=${days}`)).data,
  });

  const importPayouts = useMutation({
    mutationFn: async () => {
      // Paste format: platform,date,amount,reference — one line per payout.
      const rows = raw.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
        const [platform, date, amount, reference] = l.split(",").map((x) => x.trim());
        return { platform, date, amount, reference: reference ?? "" };
      });
      return (await api.post("/pos/reconciliation/import_payouts/", { rows })).data;
    },
    onSuccess: (d: { created: number; skipped: number }) => {
      toast(`Imported ${d.created} payout line(s), ${d.skipped} skipped`);
      setShowImport(false);
      setRaw("");
      qc.invalidateQueries({ queryKey: ["recon"] });
    },
    onError: () => toast("Import failed — check the format", "error"),
  });

  if (isLoading || !data) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Payment reconciliation"
        subtitle="POS settlements vs platform payouts — variances flag pilferage"
        action={
          <div className="flex gap-2">
            {[7, 30].map((d) => (
              <button key={d} onClick={() => setDays(d)}
                className={`pill ${days === d ? "bg-ink text-white" : "bg-hairline text-body"}`}>
                {d} days
              </button>
            ))}
            <button className="btn-primary text-sm" onClick={() => setShowImport(true)}>Import payouts</button>
          </div>
        }
      />

      {data.unmatched_payouts.length > 0 && (
        <Card className="mb-4 bg-clay/10 border-clay/40">
          <div className="font-semibold text-clay mb-2">⚠ Payouts with no matching POS settlement</div>
          {data.unmatched_payouts.map((p, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span>{p.date} · {p.platform}</span><span>{inr(p.payout_amount)}</span>
            </div>
          ))}
          <div className="text-xs text-muted mt-2">The platform paid for orders the POS never recorded — investigate.</div>
        </Card>
      )}

      <div className="space-y-4">
        {data.rows.map((d) => (
          <Card key={d.date}>
            <div className="font-semibold mb-2">{d.date}</div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted mb-1">Settlements by tender</div>
                {d.tenders.map((t) => (
                  <div key={t.tender} className="flex justify-between text-sm py-0.5">
                    <span>{t.tender} <span className="text-muted text-xs">× {t.count}</span></span>
                    <span>{inr(t.amount)}</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted mb-1">Aggregator reconciliation</div>
                {d.aggregators.length ? d.aggregators.map((a) => (
                  <div key={a.platform} className="flex items-center justify-between text-sm py-0.5">
                    <span className="capitalize">{a.platform}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-muted text-xs">POS {inr(a.pos_amount)}</span>
                      {a.payout_amount === null ? (
                        <Badge tone="amber">no payout imported</Badge>
                      ) : Number(a.variance) === 0 ? (
                        <Badge tone="pine">matched</Badge>
                      ) : (
                        <Badge tone="clay">variance {inr(a.variance!)}</Badge>
                      )}
                    </span>
                  </div>
                )) : <div className="text-sm text-muted">No aggregator settlements.</div>}
              </div>
            </div>
          </Card>
        ))}
        {!data.rows.length && <Card><div className="text-sm text-muted py-6 text-center">No settlements in this period.</div></Card>}
      </div>

      {showImport && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50" onClick={() => setShowImport(false)}>
          <div className="card p-5 w-[480px]" onClick={(e) => e.stopPropagation()}>
            <div className="font-display text-xl mb-2">Import platform payouts</div>
            <div className="text-xs text-muted mb-3">
              Paste one line per payout: <code className="bg-cream px-1 rounded">platform, date, amount, reference</code>
              <br />e.g. <code className="bg-cream px-1 rounded">swiggy, 2026-07-03, 1954.50, UTR12345</code>
            </div>
            <textarea className="input w-full font-mono text-xs" rows={7} value={raw}
              onChange={(e) => setRaw(e.target.value)} placeholder="swiggy, 2026-07-03, 1954.50, UTR12345" />
            <div className="flex gap-2 mt-3">
              <button className="btn-ghost flex-1" onClick={() => setShowImport(false)}>Cancel</button>
              <button className="btn-primary flex-1" disabled={!raw.trim() || importPayouts.isPending}
                onClick={() => importPayouts.mutate()}>
                Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
