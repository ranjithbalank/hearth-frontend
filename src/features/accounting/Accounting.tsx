import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Card, PageHeader, Spinner, Stat } from "../../design/ui";
import { api } from "../../lib/api";
import { useApp } from "../../lib/app-context";
import { fmtDate } from "../../lib/date";
import { money } from "../../lib/money";
import { printZReport, type ZReport } from "../print/documents";

interface Customer { id: number; name: string; customer_type: string; outstanding: string }
interface NightAudit { id: number; business_date: string; rooms_posted: number; room_revenue: string; tax_posted: string; completed: boolean }

export function Accounting() {
  const qc = useQueryClient();
  const { property } = useApp();
  const [msg, setMsg] = useState<string | null>(null);

  const { data: customers, isLoading } = useQuery({
    queryKey: ["ar"],
    queryFn: async () => (await api.get<Customer[]>("/customers/")).data,
  });
  const { data: dayend } = useQuery({
    queryKey: ["dayend"],
    queryFn: async () => (await api.get<ZReport>("/reports/dayend/")).data,
  });
  const { data: audits } = useQuery({
    queryKey: ["night-audit"],
    queryFn: async () => (await api.get<NightAudit[]>("/night-audit/")).data,
  });

  const runAudit = useMutation({
    mutationFn: async () => (await api.post<NightAudit>("/night-audit/")).data,
    onSuccess: (r) => {
      setMsg(`Night audit ${fmtDate(r.business_date)}: ${r.rooms_posted} rooms posted, ${money(r.room_revenue)} revenue`);
      qc.invalidateQueries({ queryKey: ["night-audit"] });
    },
  });

  if (isLoading) return <Spinner />;
  const ar = (customers ?? []).filter((c) => Number(c.outstanding) > 0);
  const totalAr = ar.reduce((s, c) => s + Number(c.outstanding), 0);

  return (
    <div>
      <PageHeader
        title="Accounting"
        subtitle="City ledger &amp; day-end close"
        action={<button data-tour="landing-accounting" className="btn-primary" onClick={() => runAudit.mutate()} disabled={runAudit.isPending}>Run night audit</button>}
      />
      {msg && <div className="card p-3 mb-4 bg-pine-50 text-pine font-medium">{msg}</div>}

      <div className="grid grid-cols-3 gap-4 mb-4">
        <Stat tone="dark" label="Total receivables" value={money(totalAr)} />
        <Stat label="AR accounts" value={ar.length} />
        <Stat label="Audits run" value={audits?.length ?? 0} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <div className="font-semibold mb-3">City ledger / AR aging</div>
          {ar.map((c) => (
            <div key={c.id} className="flex justify-between py-2 border-t border-line text-sm">
              <span>{c.name} <span className="text-muted">· {c.customer_type}</span></span>
              <span className="font-medium">{money(c.outstanding)}</span>
            </div>
          ))}
          {!ar.length && <div className="text-sm text-muted py-4">No outstanding balances.</div>}
        </Card>
        <Card>
          <div className="font-semibold mb-3">Night audit runs</div>
          {audits?.map((a) => (
            <div key={a.id} className="flex justify-between py-2 border-t border-line text-sm">
              <span>{fmtDate(a.business_date)}</span>
              <span className="text-muted">{a.rooms_posted} rooms · {money(a.room_revenue)}</span>
            </div>
          ))}
          {!audits?.length && <div className="text-sm text-muted py-4">No audits yet.</div>}
        </Card>
      </div>

      {dayend && (
        <Card className="mt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold">Day-end (Z) — collections by tender</div>
            <button className="btn-outline text-xs py-1" onClick={() => printZReport(dayend, property?.name ?? "Hearth")}>
              Print Z-report
            </button>
          </div>
          <table className="w-full text-sm">
            <thead className="text-muted text-xs uppercase">
              <tr><th className="text-left py-2">Tender</th><th className="text-right py-2">Txns</th><th className="text-right py-2">Tips</th><th className="text-right py-2">Amount</th></tr>
            </thead>
            <tbody>
              {dayend.tenders.map((t) => (
                <tr key={t.tender} className="border-t border-line">
                  <td className="py-2">{t.tender}</td>
                  <td className="py-2 text-right">{t.count}</td>
                  <td className="py-2 text-right">{money(t.tip)}</td>
                  <td className="py-2 text-right font-medium">{money(t.amount)}</td>
                </tr>
              ))}
              {!dayend.tenders.length && <tr><td colSpan={4} className="py-3 text-center text-muted">No collections yet.</td></tr>}
            </tbody>
          </table>
          <div className="flex justify-between border-t border-hairline pt-3 mt-2 font-semibold">
            <span>Total collected</span><span>{money(dayend.total)}</span>
          </div>
        </Card>
      )}
    </div>
  );
}
