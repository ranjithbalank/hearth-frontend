import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Field, Logo } from "../../design/ui";
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
  { username: "hr", role: "HR Manager" },
];

function EyeIcon({ off }: { off?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  );
}

export function Login() {
  const { login, property } = useApp();
  const nav = useNavigate();
  const [username, setUsername] = useState("gm");
  const [password, setPassword] = useState("hearth123");
  const [showPw, setShowPw] = useState(false);
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
    <div className="min-h-full flex">
      {/* Brand panel — desktop only */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] relative overflow-hidden bg-gradient-to-br from-ink to-[#1E3A8A] p-12 text-white">
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-pine/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-info/10 blur-3xl pointer-events-none" />
        <div className="relative flex items-center gap-3">
          <Logo size={36} />
          <span className="font-display text-xl font-semibold">Hearth</span>
        </div>
        <div className="relative">
          <div className="font-display text-4xl font-semibold leading-tight tracking-tight">
            Run the whole property
            <br />
            from one screen.
          </div>
          <div className="text-white/60 mt-3 text-sm max-w-md">
            Front desk, restaurant, kitchen, housekeeping and accounts — one OS for the entire operation.
          </div>
        </div>
        <div className="relative text-white/40 text-xs">
          © {new Date().getFullYear()} Hearth · Hotel &amp; Restaurant OS
        </div>
      </div>

      {/* Form side */}
      <div className="flex-1 flex items-center justify-center bg-cream p-6">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center gap-3 mb-8">
            {property?.logo
              ? <img src={property.logo} alt="" className="h-14 w-14 rounded-2xl object-cover bg-hairline" />
              : <Logo size={52} />}
            <div className="font-display text-3xl text-center text-ink tracking-tight">{property?.name || "Hearth"}</div>
            <div className="text-sm text-muted">
              {property?.name ? "powered by Hearth" : "Hotel & Restaurant OS"}
            </div>
          </div>

          <div className="card p-6">
            <div className="mb-4">
              <Field label="Username">
                <input className="input" value={username} autoFocus
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()} />
              </Field>
            </div>
            <div className="mb-4">
              <Field label="Password">
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    className="input pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? "Hide password" : "Show password"}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-body p-1"
                  >
                    <EyeIcon off={showPw} />
                  </button>
                </div>
              </Field>
            </div>
            {mfaNeeded && (
              <div className="mb-4">
                <Field label="Authenticator code">
                  <input
                    className="input"
                    placeholder="6-digit code"
                    inputMode="numeric"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                  />
                </Field>
              </div>
            )}
            {error && (
              <div className="text-sm text-clay bg-clay-50 border border-clay/20 rounded-lg px-3 py-2 mb-3">
                {error}
              </div>
            )}
            <button className="btn-primary w-full" onClick={() => submit()} disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <button
              className="text-xs text-muted hover:text-ink w-full text-center mt-3"
              onClick={() => nav("/forgot-password")}
            >
              Forgot password?
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
    </div>
  );
}
