import React from "react";

export function Modal({
  open, title, children, onClose
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-lg card p-4 glow">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="text-lg font-semibold">{title}</div>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
        <div className="sep my-3" />
        {children}
      </div>
    </div>
  );
}
