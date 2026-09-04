"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, Textarea } from "@/components/ui/select";
import { formatEuro } from "@/lib/format";
import { fetchJson } from "@/lib/http";

type Articolo = { id: string; nome: string; quantita: number; unitaMisura: string };
type Ingrediente = {
  articoloId: string;
  quantitaNecessaria: number;
  articolo: Articolo;
};
type Voce = {
  id: string;
  nome: string;
  descrizione: string | null;
  prezzo: number;
  attivo: boolean;
  disponibile: boolean;
  mancanti: { nome: string }[];
  categoria: { id: string; nome: string };
  ingredienti: Ingrediente[];
};
type Categoria = {
  id: string;
  slug: string;
  nome: string;
  sottotitolo: string | null;
  ordine: number;
  pubblicata: boolean;
  voci: Voce[];
};

const EMPTY_VOCE = {
  categoriaId: "",
  nome: "",
  descrizione: "",
  prezzo: "",
  ingredienti: [] as { articoloId: string; quantitaNecessaria: string }[],
};

const EMPTY_CAT = {
  nome: "",
  sottotitolo: "",
  pubblicata: true,
};

export default function MenuPage() {
  const [categorie, setCategorie] = useState<Categoria[]>([]);
  const [articoli, setArticoli] = useState<Articolo[]>([]);
  const [soloDisponibili, setSoloDisponibili] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Voce | null>(null);
  const [form, setForm] = useState(EMPTY_VOCE);
  const [catOpen, setCatOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Categoria | null>(null);
  const [catForm, setCatForm] = useState(EMPTY_CAT);

  async function load() {
    try {
      const data = await fetchJson<{ categorie?: Categoria[]; articoli?: Articolo[] }>(
        `/api/menu${soloDisponibili ? "?disponibili=1" : ""}`
      );
      setCategorie(data.categorie ?? []);
      setArticoli(data.articoli ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore caricamento menu");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soloDisponibili]);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_VOCE, categoriaId: categorie[0]?.id ?? "" });
    setOpen(true);
  }

  function openEdit(voce: Voce) {
    setEditing(voce);
    setForm({
      categoriaId: voce.categoria.id,
      nome: voce.nome,
      descrizione: voce.descrizione ?? "",
      prezzo: String(voce.prezzo),
      ingredienti: voce.ingredienti.map((i) => ({
        articoloId: i.articoloId,
        quantitaNecessaria: String(i.quantitaNecessaria),
      })),
    });
    setOpen(true);
  }

  function openCreateCat() {
    setEditingCat(null);
    setCatForm(EMPTY_CAT);
    setCatOpen(true);
  }

  function openEditCat(cat: Categoria) {
    setEditingCat(cat);
    setCatForm({
      nome: cat.nome,
      sottotitolo: cat.sottotitolo ?? "",
      pubblicata: cat.pubblicata,
    });
    setCatOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      categoriaId: form.categoriaId,
      nome: form.nome,
      descrizione: form.descrizione || null,
      prezzo: Number(form.prezzo) || 0,
      ingredienti: form.ingredienti
        .filter((i) => i.articoloId)
        .map((i) => ({
          articoloId: i.articoloId,
          quantitaNecessaria: Number(i.quantitaNecessaria) || 1,
        })),
    };
    const res = await fetch(editing ? `/api/menu/${editing.id}` : "/api/menu", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      toast.error("Errore salvataggio voce");
      return;
    }
    toast.success(editing ? "Voce aggiornata" : "Voce creata");
    setOpen(false);
    await load();
  }

  async function saveCat(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      nome: catForm.nome,
      sottotitolo: catForm.sottotitolo || null,
      pubblicata: catForm.pubblicata,
    };
    const res = await fetch(
      editingCat ? `/api/menu/categorie/${editingCat.id}` : "/api/menu/categorie",
      {
        method: editingCat ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(typeof data.error === "string" ? data.error : "Errore categoria");
      return;
    }
    toast.success(editingCat ? "Categoria aggiornata" : "Categoria creata");
    setCatOpen(false);
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Eliminare questa voce dal menu?")) return;
    await fetch(`/api/menu/${id}`, { method: "DELETE" });
    toast.success("Voce eliminata");
    await load();
  }

  async function removeCat(cat: Categoria) {
    if (
      !confirm(
        cat.voci.length
          ? `Eliminare «${cat.nome}» e le ${cat.voci.length} voci collegate?`
          : `Eliminare la categoria «${cat.nome}»?`
      )
    ) {
      return;
    }
    await fetch(`/api/menu/categorie/${cat.id}`, { method: "DELETE" });
    toast.success("Categoria eliminata");
    await load();
  }

  async function moveCat(cat: Categoria, dir: -1 | 1) {
    const idx = categorie.findIndex((c) => c.id === cat.id);
    const swap = categorie[idx + dir];
    if (!swap) return;
    await Promise.all([
      fetch(`/api/menu/categorie/${cat.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordine: swap.ordine }),
      }),
      fetch(`/api/menu/categorie/${swap.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordine: cat.ordine }),
      }),
    ]);
    await load();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-4xl">Menu</h1>
          <p className="text-sm text-stone-500">
            Categorie e titoli finiscono sul sito pubblico. Se manca un prodotto, le voci spariscono
            dal menu operativo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={soloDisponibili ? "secondary" : "outline"}
            onClick={() => setSoloDisponibili((v) => !v)}
          >
            {soloDisponibili ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            {soloDisponibili ? "Solo disponibili" : "Tutte le voci"}
          </Button>
          <Button variant="outline" onClick={openCreateCat}>
            <Plus className="h-4 w-4" />
            Categoria
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nuova voce
          </Button>
        </div>
      </div>

      {categorie.map((cat, idx) => (
        <section key={cat.id} className="rounded-2xl border border-[var(--line)] bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-2xl">{cat.nome}</h2>
              {cat.sottotitolo && <p className="text-sm text-stone-400">{cat.sottotitolo}</p>}
              <p className="mt-1 font-mono text-[11px] text-stone-400">#{cat.slug}</p>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {!cat.pubblicata && <Badge tone="warn">Nascosta dal sito</Badge>}
              <Button size="icon" variant="ghost" disabled={idx === 0} onClick={() => void moveCat(cat, -1)}>
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                disabled={idx === categorie.length - 1}
                onClick={() => void moveCat(cat, 1)}
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => openEditCat(cat)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => void removeCat(cat)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="mt-4 divide-y divide-[var(--line)]">
            {cat.voci.length === 0 && (
              <p className="py-4 text-sm text-stone-400">Nessuna voce visibile in questa sezione.</p>
            )}
            {cat.voci.map((v) => (
              <div
                key={v.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{v.nome}</p>
                  {v.descrizione && <p className="text-sm text-stone-500">{v.descrizione}</p>}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {v.ingredienti.map((i) => (
                      <Badge key={i.articoloId}>{i.articolo.nome}</Badge>
                    ))}
                    {!v.disponibile && (
                      <Badge tone="danger">
                        Nascosto · manca {v.mancanti.map((m) => m.nome).join(", ")}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold tabular-nums">
                    {v.prezzo > 0 ? formatEuro(v.prezzo) : "—"}
                  </span>
                  <Button size="sm" variant="outline" onClick={() => openEdit(v)}>
                    Modifica
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => void remove(v.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <Dialog open={open} onClose={() => setOpen(false)} title={editing ? "Modifica voce" : "Nuova voce"} wide>
        <form onSubmit={save} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select
                value={form.categoriaId}
                onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}
              >
                {categorie.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prezzo (0 = senza prezzo sul sito)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                required
                value={form.prezzo}
                onChange={(e) => setForm({ ...form, prezzo: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input
              required
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Descrizione</Label>
            <Textarea
              value={form.descrizione}
              onChange={(e) => setForm({ ...form, descrizione: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Prodotti di magazzino</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setForm({
                    ...form,
                    ingredienti: [
                      ...form.ingredienti,
                      { articoloId: articoli[0]?.id ?? "", quantitaNecessaria: "1" },
                    ],
                  })
                }
              >
                Aggiungi prodotto
              </Button>
            </div>
            {form.ingredienti.map((ing, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_6rem_auto] gap-2">
                <Select
                  value={ing.articoloId}
                  onChange={(e) => {
                    const ingredienti = [...form.ingredienti];
                    ingredienti[idx] = { ...ing, articoloId: e.target.value };
                    setForm({ ...form, ingredienti });
                  }}
                >
                  {articoli.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nome} ({a.quantita} {a.unitaMisura})
                    </option>
                  ))}
                </Select>
                <Input
                  type="number"
                  min="0.001"
                  step="any"
                  value={ing.quantitaNecessaria}
                  onChange={(e) => {
                    const ingredienti = [...form.ingredienti];
                    ingredienti[idx] = { ...ing, quantitaNecessaria: e.target.value };
                    setForm({ ...form, ingredienti });
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setForm({
                      ...form,
                      ingredienti: form.ingredienti.filter((_, i) => i !== idx),
                    })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <p className="text-xs text-stone-400">
              Se uno di questi prodotti arriva a giacenza 0, la voce non viene mostrata sul sito.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annulla
            </Button>
            <Button type="submit">Salva</Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={catOpen}
        onClose={() => setCatOpen(false)}
        title={editingCat ? "Modifica categoria" : "Nuova categoria"}
      >
        <form onSubmit={saveCat} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Titolo (come sul sito)</Label>
            <Input
              required
              value={catForm.nome}
              onChange={(e) => setCatForm({ ...catForm, nome: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Sottotitolo</Label>
            <Input
              value={catForm.sottotitolo}
              onChange={(e) => setCatForm({ ...catForm, sottotitolo: e.target.value })}
              placeholder="Es. Less stress, more spritz."
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={catForm.pubblicata}
              onChange={(e) => setCatForm({ ...catForm, pubblicata: e.target.checked })}
            />
            Visibile sul sito pubblico
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setCatOpen(false)}>
              Annulla
            </Button>
            <Button type="submit">Salva</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
