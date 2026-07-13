import { useState } from "react";

import { Logo } from "../../design/ui";
import { useApp } from "../../lib/app-context";

const EDITIONS = [
  {
    key: "hotel",
    title: "Hotel",
    desc: "Full property operations — rooms, front office, revenue, distribution — with the in-house F&B outlet.",
  },
  {
    key: "restaurant",
    title: "Restaurant",
    desc: "Standalone restaurant POS (Petpooja-class). No rooms; bills settle at the outlet.",
  },
  {
    key: "both",
    title: "Hotel + Restaurant",
    desc: "Everything on one data core. Restaurant bills can post straight to the room folio.",
  },
];

export function Setup() {
  const { setup } = useApp();
  const [edition, setEdition] = useState("both");
  const [name, setName] = useState("Hearth Grand");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      await setup(edition, name);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-full flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-ink to-[#1E3A8A] p-6">
      <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-pine/20 blur-3xl pointer-events-none" />
      <div className="w-full max-w-2xl relative">
        <div className="flex items-center gap-3 mb-8 text-white">
          <Logo size={44} />
          <div>
            <div className="font-display text-3xl">Welcome to Hearth</div>
            <div className="text-sm text-white/50">One-time property setup · choose your edition</div>
          </div>
        </div>

        <div className="card p-6">
          <label className="block text-xs font-semibold text-muted mb-1">Property name</label>
          <input className="input mb-5" value={name} onChange={(e) => setName(e.target.value)} />

          <div className="grid gap-3">
            {EDITIONS.map((e) => (
              <button
                key={e.key}
                onClick={() => setEdition(e.key)}
                className={`text-left rounded-card border p-4 transition-colors ${
                  edition === e.key ? "border-pine bg-pine-50" : "border-hairline hover:bg-cream"
                }`}
              >
                <div className="font-semibold text-ink">{e.title}</div>
                <div className="text-sm text-body mt-1">{e.desc}</div>
              </button>
            ))}
          </div>

          <button className="btn-primary w-full mt-6" onClick={submit} disabled={saving}>
            {saving ? "Setting up…" : "Continue"}
          </button>
          <p className="text-xs text-muted mt-3 text-center">
            You can reconfigure entitlements later in Settings.
          </p>
        </div>
      </div>
    </div>
  );
}
