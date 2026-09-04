import { cn } from "@/lib/utils";
import type { InputHTMLAttributes } from "react";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm text-[var(--ink)] outline-none placeholder:text-stone-400 focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30",
        className
      )}
      {...props}
    />
  );
}
