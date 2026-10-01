"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchJson } from "@/lib/http";

type Foto = {
  id: string;
  alt: string;
  ordine: number;
  larghezza: number;
  altezza: number;
  updatedAt: string;
};

function photoSrc(foto: Foto) {
  return `/api/public/gallery/${foto.id}?v=${new Date(foto.updatedAt).getTime()}`;
}

export default function GalleryPage() {
  const [foto, setFoto] = useState<Foto[]>([]);
  const [uploading, setUploading] = useState(false);

  async function load() {
    try {
      const data = await fetchJson<{ foto?: Foto[] }>("/api/gallery");
      setFoto(data.foto ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore caricamento gallery");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        const body = new FormData();
        body.append("file", file);
        const res = await fetch("/api/gallery", { method: "POST", body });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          toast.error(typeof data.error === "string" ? data.error : `Foto non caricata: ${file.name}`);
        }
      }
      toast.success(files.length > 1 ? "Foto caricate" : "Foto caricata");
      await load();
    } finally {
      setUploading(false);
    }
  }

  async function saveAlt(item: Foto, alt: string) {
    const next = alt.trim();
    if (next === item.alt) return;
    const res = await fetch(`/api/gallery/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alt: next }),
    });
    if (!res.ok) {
      toast.error("Testo non salvato");
      return;
    }
    setFoto((current) => current.map((foto) => (foto.id === item.id ? { ...foto, alt: next } : foto)));
  }

  async function replace(item: Foto, file: File | undefined) {
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    const res = await fetch(`/api/gallery/${item.id}`, { method: "PATCH", body });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(typeof data.error === "string" ? data.error : "Sostituzione non riuscita");
      return;
    }
    toast.success("Foto sostituita");
    await load();
  }

  async function remove(item: Foto) {
    if (!confirm("Togliere questa foto dalla gallery del sito?")) return;
    const res = await fetch(`/api/gallery/${item.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Eliminazione non riuscita");
      return;
    }
    toast.success("Foto tolta");
    await load();
  }

  async function move(item: Foto, dir: -1 | 1) {
    const idx = foto.findIndex((foto) => foto.id === item.id);
    const swap = foto[idx + dir];
    if (!swap) return;
    await Promise.all([
      fetch(`/api/gallery/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordine: swap.ordine }),
      }),
      fetch(`/api/gallery/${swap.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordine: item.ordine }),
      }),
    ]);
    await load();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-4xl">Gallery</h1>
          <p className="text-sm text-stone-500">
            Queste foto compaiono nella gallery della home del sito. Puoi caricarne più di una,
            cambiarne l&apos;ordine e la didascalia.
          </p>
        </div>
        <label className="inline-flex cursor-pointer">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            disabled={uploading}
            onChange={(e) => {
              void upload(e.target.files);
              e.target.value = "";
            }}
          />
          <span className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--gold)] px-4 text-sm font-medium text-[var(--espresso)]">
            <ImagePlus className="h-4 w-4" />
            {uploading ? "Caricamento…" : "Aggiungi foto"}
          </span>
        </label>
      </div>

      {foto.length === 0 && (
        <p className="rounded-2xl border border-dashed border-[var(--line)] bg-white px-5 py-10 text-center text-sm text-stone-500">
          Nessuna foto. Finché la gallery è vuota, il sito continua a mostrare quelle già pubblicate.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {foto.map((item, idx) => (
          <article key={item.id} className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
            <img
              src={photoSrc(item)}
              alt={item.alt || "Foto gallery"}
              className="aspect-[4/3] w-full object-cover"
            />
            <div className="space-y-3 p-4">
              <div className="space-y-1.5">
                <Label>Didascalia sul sito</Label>
                <Input
                  defaultValue={item.alt}
                  key={`${item.id}-${item.alt}`}
                  onBlur={(e) => void saveAlt(item, e.target.value)}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="icon" variant="ghost" disabled={idx === 0} onClick={() => void move(item, -1)}>
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={idx === foto.length - 1}
                  onClick={() => void move(item, 1)}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <label className="inline-flex cursor-pointer">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(e) => {
                      void replace(item, e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                  <span className="inline-flex h-8 items-center rounded-xl border border-[var(--line)] px-3 text-xs normal-case tracking-normal">
                    Sostituisci
                  </span>
                </label>
                <Button size="icon" variant="ghost" className="ml-auto" onClick={() => void remove(item)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
