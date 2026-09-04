"use client";

import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./button";

export function Dialog({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        aria-label="Chiudi"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-10 w-full max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-[var(--paper)] p-5 shadow-2xl",
          wide ? "max-w-2xl" : "max-w-lg"
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-[var(--espresso)]">
            {title}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Chiudi">
            <X className="h-4 w-4" />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
