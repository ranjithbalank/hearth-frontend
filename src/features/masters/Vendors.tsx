import { useQuery } from "@tanstack/react-query";
import { Handshake } from "lucide-react";

import { Badge, Card, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";

interface Vendor {
  id: number; name: string; category: string; contact: string;
  payment_terms: string; status: string;
}

export function Vendors() {
  const { data, isLoading } = useQuery({
    queryKey: ["vendors-master"],
    queryFn: async () => (await api.get<Vendor[]>("/vendors/")).data,
  });
  if (isLoading || !data) return <Spinner />;
  return (
    <div>
      <PageHeader icon={<Handshake size={20} />} title="Vendors" subtitle="Service vendors · contracts & terms" />
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="bg-cream text-muted text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Vendor</th>
              <th className="text-left px-4 py-3">Category</th>
              <th className="text-left px-4 py-3">Contact</th>
              <th className="text-left px-4 py-3">Terms</th>
              <th className="text-left px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((v) => (
              <tr key={v.id} className="border-t border-line hover:bg-cream/60 transition-colors">
                <td className="px-4 py-3 font-medium">{v.name}</td>
                <td className="px-4 py-3">{v.category}</td>
                <td className="px-4 py-3 text-muted">{v.contact}</td>
                <td className="px-4 py-3">{v.payment_terms}</td>
                <td className="px-4 py-3"><Badge tone="pine">{v.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </Card>
    </div>
  );
}
