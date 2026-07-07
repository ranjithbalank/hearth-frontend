import { useState } from "react";

import { Logo } from "../../design/ui";
import { useApp } from "../../lib/app-context";

const DEMO = [
  { username: "superadmin", role: "Super Admin" },
  { username: "admin", role: "Admin" },
  { username: "md", role: "Managing Director" },
  { username: "ceo", role: "CEO" },
  { username: "gm", role: "General Manager" },
  { username: "finance", role: "Finance" },
  { username: "restmanager", role: "Restaurant Manager" },
  { username: "hotelmanager", role: "Hotel Manager" },
  { username: "frontoffice", role: "Front Office" },
  { username: "cashier", role: "F&B Cashier" },
  { username: "captain", role: "Captain" },
  { username: "housekeeping", role: "Housekeeping" },
  { username: "chef", role: "Chef / Kitchen" },
  { username: "store", role: "Store Keeper" },
  { username: "barcaptain", role: "Bar Captain" },
  { username: "barcashier", role: "Bar Cashier" },
];

export function Login() {
  const { login, property } = useApp();
  const [username, setUsername] = useState("gm");
  const [password, setPassword] = useState("hearth123");
  const [otp, setOtp] = useState("");
  const [mfaNeeded, setMfaNeeded] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(u = username, p = password) {
    setBusy(true);
    setError("");
    try {
      await login(u, p, otp || undefined);
    } catch (e: any) {
      const data = e?.response?.data;
      if (data?.mfa_required) {
        setMfaNeeded(true);
        setError(data.detail || "Enter your authenticator code");
      } else {
        setError("Invalid credentials");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-full flex items-center justify-center bg-ink p-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8 text-white">
          {property?.logo
            ? <img src={property.logo} alt="" className="h-14 w-14 rounded-2xl object-cover bg-white/10" />
            : <Logo size={52} />}
          <div className="font-display text-3xl text-center">{property?.name || "Hearth"}</div>
          <div className="text-sm text-white/50">
            {property?.name ? "powered by Hearth" : "Hotel & Restaurant OS"}
          </div>
        </div>

        <div className="card p-6">
          <label className="block text-xs font-semibold text-muted mb-1">Username</label>
          <input className="input mb-4" value={username} autoFocus
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()} />
          <label className="block text-xs font-semibold text-muted mb-1">Password</label>
          <input
            type="password"
            className="input mb-4"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          {mfaNeeded && (
            <>
              <label className="block text-xs font-semibold text-muted mb-1">Authenticator code</label>
              <input
                className="input mb-4"
                placeholder="6-digit code"
                inputMode="numeric"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
            </>
          )}
          {error && <div className="text-sm text-clay mb-3">{error}</div>}
          <button className="btn-primary w-full" onClick={() => submit()} disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>

          <div className="mt-5 border-t border-hairline pt-4">
            <div className="text-[11px] uppercase tracking-wide text-muted mb-2">Demo roles — tap to sign in</div>
            <div className="flex flex-wrap gap-1.5">
              {DEMO.map((d) => (
                <button
                  key={d.username}
                  disabled={busy}
                  onClick={() => {
                    setUsername(d.username);
                    setPassword("hearth123");
                    submit(d.username, "hearth123");
                  }}
                  className="pill bg-hairline text-body hover:bg-pine-50 hover:text-pine disabled:opacity-50"
                >
                  {d.role}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
