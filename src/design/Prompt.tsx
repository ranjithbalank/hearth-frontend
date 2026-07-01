import { createContext, useContext, useRef, useState, type ReactNode } from "react";

interface Opts {
  title: string; label?: string; defaultValue?: string; placeholder?: string; password?: boolean;
  /** Confirm mode: show a message and Confirm/Cancel instead of a text input.
   *  Resolves "yes" on confirm, null on cancel. */
  message?: string; confirm?: boolean; confirmLabel?: string; danger?: boolean;
}
type Ask = (opts: Opts) => Promise<string | null>;

const Ctx = createContext<Ask>(async () => null);

/** Styled, promise-based replacement for window.prompt(). */
export function PromptProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<Opts | null>(null);
  const [value, setValue] = useState("");
  const resolver = useRef<(v: string | null) => void>(() => {});

  const ask: Ask = (o) =>
    new Promise((resolve) => {
      resolver.current = resolve;
      setValue(o.defaultValue ?? "");
      setOpts(o);
    });

  const close = (v: string | null) => {
    resolver.current(v);
    setOpts(null);
  };

  return (
    <Ctx.Provider value={ask}>
      {children}
      {opts && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-[70]" onClick={() => close(null)}>
          <div className="card p-5 w-[340px]" onClick={(e) => e.stopPropagation()}>
            <div className="font-display text-lg mb-3">{opts.title}</div>
            {opts.confirm ? (
              opts.message && <p className="text-sm text-body mb-4">{opts.message}</p>
            ) : (
              <>
                {opts.label && <label className="block text-xs font-semibold text-muted mb-1">{opts.label}</label>}
                <input
                  autoFocus
                  type={opts.password ? "password" : "text"}
                  className="input mb-4"
                  placeholder={opts.placeholder}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") close(value); if (e.key === "Escape") close(null); }}
                />
              </>
            )}
            <div className="flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => close(null)}>Cancel</button>
              <button
                className={`flex-1 ${opts.danger ? "btn-outline text-clay border-clay" : "btn-primary"}`}
                onClick={() => close(opts.confirm ? "yes" : value)}
              >
                {opts.confirmLabel ?? "OK"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function usePrompt() {
  return useContext(Ctx);
}
