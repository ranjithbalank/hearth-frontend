import { useQuery } from "@tanstack/react-query";

import { PageHeader, Spinner } from "../../design/ui";
import { api, getAccess } from "../../lib/api";
import { money } from "../../lib/money";

interface TaxRow { rate: string; taxable: string; cgst: string; sgst: string; tax: string; total: string }

export function TaxGst() {
  const { data, isLoading } = useQuery({
    queryKey: ["tax"],
    queryFn: async () => (await api.get<TaxRow[]>("/tax/")).data,
  });

  async function exportCsv() {
    const res = await fetch("/api/tax/gstr1/", { headers: { Authorization: `Bearer ${getAccess()}` } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gstr1.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading || !data) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Tax &amp; GST"
        subtitle="Output tax by slab · CGST + SGST"
        action={<button className="btn-primary" onClick={exportCsv}>Export GSTR-1</button>}
      />
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-cream text-muted text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Rate</th>
              <th className="text-right px-4 py-3">Taxable</th>
              <th className="text-right px-4 py-3">CGST</th>
              <th className="text-right px-4 py-3">SGST</th>
              <th className="text-right px-4 py-3">Total tax</th>
              <th className="text-right px-4 py-3">Gross</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.rate} className="border-t border-line">
                <td className="px-4 py-3 font-medium">{r.rate}%</td>
                <td className="px-4 py-3 text-right">{money(r.taxable)}</td>
                <td className="px-4 py-3 text-right">{money(r.cgst)}</td>
                <td className="px-4 py-3 text-right">{money(r.sgst)}</td>
                <td className="px-4 py-3 text-right">{money(r.tax)}</td>
                <td className="px-4 py-3 text-right font-medium">{money(r.total)}</td>
              </tr>
            ))}
            {!data.length && <tr><td colSpan={6} className="px-4 py-6 text-center text-muted">No taxable sales yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
