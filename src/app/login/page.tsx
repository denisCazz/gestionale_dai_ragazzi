"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function requestBrowserCoords(timeoutMs = 3500): Promise<{ lat: number; lng: number } | null> {
  if (typeof window === "undefined" || !("geolocation" in navigator)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, timeoutMs);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        }
      },
      () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(null);
        }
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60000 }
    );
  });
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [cachedCoords, setCachedCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    void requestBrowserCoords(4000).then((c) => {
      if (c) setCachedCoords(c);
    });
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const coords = cachedCoords ?? (await requestBrowserCoords(2500));
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        password,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      toast.error(typeof data.error === "string" ? data.error : "Accesso non riuscito");
      return;
    }
    if (data.role === "DIPENDENTE") {
      router.replace("/timbratura");
    } else {
      router.replace(searchParams.get("from") || data.redirectTo || "/");
    }
    router.refresh();
  }

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-10">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm"
      >
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--gold-dim)]">Bar</p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl text-[var(--espresso)]">
            Garavella 7
          </h1>
          <p className="mt-1 text-sm text-stone-500">Accedi al gestionale o al registro presenze</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="username">Utente</Label>
          <Input
            id="username"
            autoComplete="username"
            placeholder="es. nome.cognome o admin"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? "Accesso…" : "Entra"}
        </Button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="p-10 text-center text-sm text-stone-500">Caricamento…</p>}>
      <LoginForm />
    </Suspense>
  );
}
