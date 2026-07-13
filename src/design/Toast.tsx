import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type Kind = "success" | "error" | "info";
interface Toast { id: number; kind: Kind; message: string; onClick?: () => void }

const Ctx = createContext<(message: string, kind?: Kind, onClick?: () => void) => void>(() => {});

let seq = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback((message: string, kind: Kind = "success", onClick?: () => void) => {
    const id = seq++;
    setToasts((t) => [...t, { id, kind, message, onClick }]);
    // Errors linger longer — a vanished failure message is a missed failure.
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 6000 : 3500);
  }, []);

  return (
    <Ctx.Provider value={toast}>
      {children}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center gap-2">
        {toasts.map((t) => {
          const cls = `flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-pop text-sm font-medium text-white animate-[toastIn_.2s_ease] ${
            t.kind === "error" ? "bg-clay" : t.kind === "info" ? "bg-info" : "bg-success"
          }`;
          const x = (
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="opacity-60 hover:opacity-100 -mr-1 px-1"
            >
              ✕
            </button>
          );
          return t.onClick ? (
            <div key={t.id} className={cls}>
              <button onClick={t.onClick} className="hover:brightness-110 text-left">
                {t.message} <span className="opacity-80">→</span>
              </button>
              {x}
            </div>
          ) : (
            <div key={t.id} className={cls}>
              <span>{t.message}</span>
              {x}
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}
