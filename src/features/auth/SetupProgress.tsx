import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { api } from "../../lib/api";
import { useApp } from "../../lib/app-context";

interface Step {
  key: string;
  label: string;
  hint: string;
  where: string;
  done: boolean;
  required: boolean;
}

interface Checklist {
  steps: Step[];
  done: number;
  total: number;
  pct: number;
  blocking: string[];
  ready_to_operate: boolean;
}

const DISMISS_KEY = "hearth_setup_dismissed";

/** Setup progress, carried into the app instead of trapped in the wizard.
 *
 *  Onboarding deliberately doesn't block on a full twenty-step configuration —
 *  an owner should be able to take their first booking before they've decided
 *  on rate plans. The unfinished remainder has to live somewhere visible
 *  though, or it never gets done, so it lands here until it's complete.
 *
 *  Hidden once everything is done, once dismissed, and for anyone who couldn't
 *  action it anyway (a cashier can't invite staff).
 */
export function SetupProgress() {
  const { canAccess } = useApp();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() => !!localStorage.getItem(DISMISS_KEY));

  const { data } = useQuery<Checklist>({
    queryKey: ["setup-checklist"],
    queryFn: async () => (await api.get("/auth/setup/checklist/")).data.checklist,
    staleTime: 60_000,
    enabled: canAccess("settings"),
  });

  if (!canAccess("settings") || dismissed || !data || data.pct >= 100) return null;

  const remaining = data.steps.filter((s) => !s.done);
  const blocking = remaining.filter((s) => s.required);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  return (
    <div className="card p-4 mb-4 border-l-4 border-l-pine">
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-ink">Finish setting up Hearth</span>
            <span className="text-xs text-muted tabular-nums">
              {data.done} of {data.total} done
            </span>
            {blocking.length > 0 && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-clay">
                {blocking.length} still needed
              </span>
            )}
          </div>

          <div className="h-1.5 rounded-full bg-hairline overflow-hidden my-2.5 max-w-md">
            <div className="h-full bg-pine transition-all" style={{ width: `${data.pct}%` }} />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {remaining.slice(0, 4).map((s) => (
              <button
                key={s.key}
                onClick={() => navigate(s.where)}
                title={s.hint}
                className={`text-xs rounded-full px-3 py-1 border transition-colors inline-flex
                  items-center gap-1 hover:bg-cream ${
                    s.required ? "border-clay/40 text-ink" : "border-hairline text-body"}`}
              >
                {s.label}
                <ArrowRight size={11} />
              </button>
            ))}
            {remaining.length > 4 && (
              <span className="text-xs text-muted self-center">+{remaining.length - 4} more</span>
            )}
          </div>
        </div>

        <button onClick={dismiss} title="Hide this" className="text-muted hover:text-ink shrink-0">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
