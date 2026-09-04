"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Banknote,
  LayoutDashboard,
  LogOut,
  Package,
  ScanLine,
  UtensilsCrossed,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/magazzino", label: "Magazzino", icon: Package },
  { href: "/magazzino/scansione", label: "Scanner", icon: ScanLine },
  { href: "/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/dipendenti", label: "Dipendenti", icon: Users },
  { href: "/cassa", label: "Cassa", icon: Banknote },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="min-h-full bg-[var(--paper)] text-[var(--ink)]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/5 bg-[var(--espresso)] px-4 py-6 text-[var(--cream)] lg:flex">
        <Link href="/" className="px-2">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--gold)]">Bar</p>
          <p className="font-[family-name:var(--font-display)] text-3xl leading-none text-[var(--cream)]">
            Dai Ragazzi
          </p>
          <p className="mt-1 text-xs text-[var(--cream-muted)]">Gestionale</p>
        </Link>
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href ||
                  (item.href !== "/magazzino/scansione" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                  active
                    ? "bg-[var(--gold)] text-[var(--espresso)]"
                    : "text-[var(--cream-muted)] hover:bg-white/5 hover:text-[var(--cream)]"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <p className="px-2 text-[11px] text-[var(--cream-muted)]">
          Piazza Garavella, 7 · Carmagnola
        </p>
        <Button
          type="button"
          variant="ghost"
          className="mt-3 justify-start text-[var(--cream-muted)] hover:bg-white/5 hover:text-[var(--cream)]"
          onClick={() => void logout()}
        >
          <LogOut className="h-4 w-4" />
          Esci
        </Button>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[var(--line)] bg-[var(--paper)]/90 px-4 py-3 backdrop-blur lg:hidden">
          <p className="font-[family-name:var(--font-display)] text-xl">Dai Ragazzi</p>
          <Button type="button" variant="ghost" size="sm" onClick={() => void logout()}>
            <LogOut className="h-4 w-4" />
            Esci
          </Button>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-5 pb-24 sm:px-6 sm:py-8">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-[var(--line)] bg-[var(--espresso)] text-[var(--cream)] lg:hidden">
        {NAV.filter((n) => n.href !== "/magazzino/scansione").map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[10px]",
                active ? "text-[var(--gold-bright)]" : "text-[var(--cream-muted)]"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
