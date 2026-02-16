import React, { createContext, useContext, useMemo, useState } from "react";

type Toast = { id: string; msg: string };

const Ctx = createContext<{ push: (msg: string) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const api = useMemo(() => ({
    push(msg: string) {
      const id = Math.random().toString(36).slice(2);
      setToasts(t => [...t, { id, msg }]);
      setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
    }
  }), []);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map(t => (
          <div key={t.id} className="card px-4 py-3 text-sm border-white/10 bg-black/40 backdrop-blur-xl">
            {t.msg}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const v = useContext(Ctx);
  if (!v) throw new Error("ToastProvider missing");
  return v;
}
