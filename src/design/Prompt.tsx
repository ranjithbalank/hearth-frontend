import { TriangleAlert } from "lucide-react";
import { createContext, useContext, useRef, useState, type ReactNode } from "react";

import { Modal } from "./ui";

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
      <Modal
        open={!!opts}
        onClose={() => close(null)}
        maxWidth="max-w-[340px]"
        title={
          <span className="flex items-center gap-2">
            {opts?.danger && <TriangleAlert size={18} className="text-clay shrink-0" />}
            {opts?.title}
          </span>
        }
        footer={
          <>
            <button className="btn-ghost flex-1" onClick={() => close(null)}>Cancel</button>
            <button
              className={`flex-1 ${opts?.danger ? "btn-outline text-clay border-clay hover:bg-clay-50" : "btn-primary"}`}
              onClick={() => close(opts?.confirm ? "yes" : value)}
            >
              {opts?.confirmLabel ?? "OK"}
            </button>
          </>
        }
      >
        {opts?.confirm ? (
          opts.message && <p className="text-sm text-body">{opts.message}</p>
        ) : (
          <>
            {opts?.label && <label className="block text-xs font-semibold text-muted mb-1">{opts.label}</label>}
            <input
              autoFocus
              type={opts?.password ? "password" : "text"}
              className="input"
              placeholder={opts?.placeholder}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") close(value); if (e.key === "Escape") close(null); }}
            />
          </>
        )}
      </Modal>
    </Ctx.Provider>
  );
}

export function usePrompt() {
  return useContext(Ctx);
}
