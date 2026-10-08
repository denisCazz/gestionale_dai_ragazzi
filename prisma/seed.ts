import { PrismaClient, TipoMovimentoCassa, TipoMovimentoMagazzino, TipoPresenza } from "@prisma/client";
import { format, startOfMonth, subDays } from "date-fns";
import { applyDatabaseUrl } from "../src/lib/db-url";

applyDatabaseUrl();
const prisma = new PrismaClient();

async function main() {
  await prisma.presenza.deleteMany();
  await prisma.movimentoCassa.deleteMany();
  await prisma.categoriaCassa.deleteMany();
  await prisma.ingredienteMenu.deleteMany();
  await prisma.voceMenu.deleteMany();
  await prisma.categoriaMenu.deleteMany();
  await prisma.movimentoMagazzino.deleteMany();
  await prisma.articolo.deleteMany();
  await prisma.dipendente.deleteMany();

  const articoliData = [
    { codice: "CAFFE", ean: "8001234567001", nome: "Caffè in grani", unitaMisura: "kg", quantita: 8, sogliaMinima: 2, ubicazione: "Bar" },
    { codice: "LATTE", ean: "8001234567002", nome: "Latte fresco", unitaMisura: "L", quantita: 12, sogliaMinima: 4, ubicazione: "Frigo" },
    { codice: "BRIOCHE", ean: "8001234567003", nome: "Brioche", unitaMisura: "pz", quantita: 24, sogliaMinima: 10, ubicazione: "Banco" },
    { codice: "APEROL", ean: "8001234567004", nome: "Aperol", unitaMisura: "bt", quantita: 6, sogliaMinima: 2, ubicazione: "Bancone" },
    { codice: "PROSECCO", ean: "8001234567005", nome: "Prosecco", unitaMisura: "bt", quantita: 10, sogliaMinima: 3, ubicazione: "Cantina" },
    { codice: "GIN", ean: "8001234567006", nome: "Gin", unitaMisura: "bt", quantita: 3, sogliaMinima: 1, ubicazione: "Bancone" },
    { codice: "TONICA", ean: "8001234567007", nome: "Acqua tonica", unitaMisura: "bt", quantita: 18, sogliaMinima: 6, ubicazione: "Frigo" },
    { codice: "PANE-HB", ean: "8001234567008", nome: "Pane hamburger", unitaMisura: "pz", quantita: 20, sogliaMinima: 8, ubicazione: "Cucina" },
    { codice: "CARNE-HB", ean: "8001234567009", nome: "Carne hamburger", unitaMisura: "pz", quantita: 16, sogliaMinima: 6, ubicazione: "Frigo" },
    { codice: "FORMAGGIO", ean: "8001234567010", nome: "Formaggi misti", unitaMisura: "kg", quantita: 2.5, sogliaMinima: 1, ubicazione: "Frigo" },
    { codice: "SALUMI", ean: "8001234567011", nome: "Salumi misti", unitaMisura: "kg", quantita: 1.8, sogliaMinima: 1, ubicazione: "Frigo" },
    { codice: "PATATINE", ean: "8001234567012", nome: "Patatine fritte", unitaMisura: "kg", quantita: 0, sogliaMinima: 2, ubicazione: "Freezer" },
    { codice: "OLIVE", ean: "8001234567013", nome: "Olive", unitaMisura: "kg", quantita: 1.2, sogliaMinima: 0.4, ubicazione: "Frigo" },
    { codice: "BIRRA", ean: "8001234567014", nome: "Birra alla spina", unitaMisura: "L", quantita: 22, sogliaMinima: 8, ubicazione: "Cantina" },
  ];

  const articoli = [];
  for (const data of articoliData) {
    const articolo = await prisma.articolo.create({ data });
    if (data.quantita > 0) {
      await prisma.movimentoMagazzino.create({
        data: {
          articoloId: articolo.id,
          tipo: TipoMovimentoMagazzino.RETTIFICA,
          quantita: data.quantita,
          note: "Giacenza iniziale",
        },
      });
    }
    articoli.push(articolo);
  }

  const byCode = Object.fromEntries(articoli.map((a) => [a.codice, a]));

  const categorie = await Promise.all(
    [
      { nome: "Colazione", slug: "colazione", sottotitolo: "Dolce, salato, farcito al momento.", ordine: 1 },
      { nome: "Pausa pranzo", slug: "pausa-pranzo", sottotitolo: "Panini, focacce, hamburger e tavola calda.", ordine: 2 },
      { nome: "Aperitivi", slug: "aperitivi", sottotitolo: "Less stress, more spritz.", ordine: 3 },
      { nome: "Cocktail & spritz", slug: "cocktail-e-spritz", sottotitolo: "Dal classico allo spritz fatto con la birra.", ordine: 4 },
      { nome: "Cantina", slug: "cantina", sottotitolo: "Etichette che ruotiamo spesso.", ordine: 5 },
    ].map((c) => prisma.categoriaMenu.create({ data: c }))
  );

  const cat = Object.fromEntries(categorie.map((c) => [c.nome, c]));

  async function voce(
    categoria: string,
    nome: string,
    prezzo: number,
    ingredienti: { code: string; qty?: number }[],
    descrizione?: string
  ) {
    const created = await prisma.voceMenu.create({
      data: {
        categoriaId: cat[categoria].id,
        nome,
        prezzo,
        descrizione,
        ingredienti: {
          create: ingredienti.map((ing) => ({
            articoloId: byCode[ing.code].id,
            quantitaNecessaria: ing.qty ?? 1,
          })),
        },
      },
    });
    return created;
  }

  await voce("Colazione", "Espresso", 1.2, [{ code: "CAFFE", qty: 0.01 }]);
  await voce("Colazione", "Cappuccino", 1.6, [
    { code: "CAFFE", qty: 0.01 },
    { code: "LATTE", qty: 0.15 },
  ]);
  await voce("Colazione", "Brioche vuota", 1.5, [{ code: "BRIOCHE", qty: 1 }]);
  await voce("Pausa pranzo", "Hamburger classico", 8.5, [
    { code: "PANE-HB", qty: 1 },
    { code: "CARNE-HB", qty: 1 },
    { code: "FORMAGGIO", qty: 0.05 },
  ]);
  await voce("Pausa pranzo", "Patatine", 3.5, [{ code: "PATATINE", qty: 0.15 }], "Porzione di patatine fritte.");
  await voce(
    "Aperitivi",
    "Aperitivo a buffet",
    13,
    [],
    "Venerdì, 17:00 – 20:30. Compresa la prima consumazione."
  );
  await voce(
    "Aperitivi",
    "Aperitivo con tagliere",
    8.5,
    [
      { code: "FORMAGGIO", qty: 0.08 },
      { code: "SALUMI", qty: 0.08 },
    ],
    "Formaggi, salumi, finger food. Compresa la prima consumazione."
  );
  await voce("Cocktail & spritz", "Spritz", 5, [
    { code: "APEROL", qty: 0.08 },
    { code: "PROSECCO", qty: 0.08 },
  ]);
  await voce("Cocktail & spritz", "Gin tonic", 7, [
    { code: "GIN", qty: 0.05 },
    { code: "TONICA", qty: 1 },
  ]);
  await voce("Cocktail & spritz", "Birra alla spina", 4.5, [{ code: "BIRRA", qty: 0.4 }]);
  await voce("Cantina", "Prosecco calice", 4, [{ code: "PROSECCO", qty: 0.12 }]);
  await voce(
    "Cantina",
    "Nebbiolo d’Alba DOC «Valdolmo»",
    0,
    [],
    "Fine e delicato, con note di vaniglia, liquirizia e grafite."
  );
  await voce(
    "Cantina",
    "Roero Arneis DOCG «Villata»",
    0,
    [],
    "Complesso e intenso, con note di vaniglia, cipria e zucchero filato."
  );

  const dipendenti = await Promise.all([
    prisma.dipendente.create({
      data: {
        nome: "Luca",
        cognome: "Ferrero",
        ruolo: "Gestione",
        telefono: "3331112233",
        email: "luca@bardairagazzi.it",
        dataAssunzione: new Date("2021-04-01"),
        retribuzione: 2100,
      },
    }),
    prisma.dipendente.create({
      data: {
        nome: "Giulia",
        cognome: "Martini",
        ruolo: "Barista",
        telefono: "3334455667",
        email: "giulia@bardairagazzi.it",
        dataAssunzione: new Date("2023-06-15"),
        retribuzione: 1450,
      },
    }),
    prisma.dipendente.create({
      data: {
        nome: "Marco",
        cognome: "Bianchi",
        ruolo: "Cucina",
        telefono: "3339988776",
        dataAssunzione: new Date("2024-02-01"),
        retribuzione: 1550,
      },
    }),
    prisma.dipendente.create({
      data: {
        nome: "Sara",
        cognome: "Conti",
        ruolo: "Sala",
        telefono: "3335566778",
        dataAssunzione: new Date("2025-09-01"),
        retribuzione: 1300,
      },
    }),
  ]);

  const monthStart = startOfMonth(new Date());
  for (const d of dipendenti) {
    for (let i = 0; i < 10; i++) {
      const day = new Date(monthStart);
      day.setDate(i + 1);
      if (day.getDay() === 0) continue;
      const riposo = day.getDay() === 1 && d.ruolo === "Sala";
      await prisma.presenza.create({
        data: {
          dipendenteId: d.id,
          data: format(day, "yyyy-MM-dd"),
          tipo: riposo ? TipoPresenza.RIPOSO : TipoPresenza.PRESENTE,
          oraIngresso: riposo ? null : d.ruolo === "Cucina" ? "09:00" : "08:00",
          oraUscita: riposo ? null : d.ruolo === "Cucina" ? "17:00" : "16:00",
        },
      });
    }
  }

  for (const [tipo, nomi] of [
    ["ENTRATA", ["Carte - Bancomat", "Satispay", "Contanti"]],
    ["USCITA", ["Contanti"]],
  ] as const) {
    let ordine = 1;
    for (const nome of nomi) {
      await prisma.categoriaCassa.create({ data: { tipo, nome, ordine } });
      ordine += 1;
    }
  }

  const oggi = new Date();
  const giornate = [
    { daysAgo: 0, carte: 640, satispay: 120, contanti: 340, uscite: 85 },
    { daysAgo: 1, carte: 820, satispay: 95, contanti: 725, uscite: 40 },
    { daysAgo: 2, carte: 560, satispay: 80, contanti: 210, uscite: 210 },
    { daysAgo: 3, carte: 390, satispay: 45, contanti: 510, uscite: 0 },
    { daysAgo: 4, carte: 310, satispay: 60, contanti: 475, uscite: 0 },
    { daysAgo: 5, carte: 480, satispay: 70, contanti: 260, uscite: 1450 },
    { daysAgo: 7, carte: 350, satispay: 40, contanti: 190, uscite: 320 },
  ];
  const movimentiCassa: { tipo: TipoMovimentoCassa; importo: number; categoria: string; descrizione: string; daysAgo: number }[] = [];
  for (const giorno of giornate) {
    const voci = [
      { tipo: "ENTRATA" as const, importo: giorno.carte, categoria: "Carte - Bancomat", descrizione: "Incasso carte e bancomat" },
      { tipo: "ENTRATA" as const, importo: giorno.satispay, categoria: "Satispay", descrizione: "Incasso Satispay" },
      { tipo: "ENTRATA" as const, importo: giorno.contanti, categoria: "Contanti", descrizione: "Incasso contanti" },
      { tipo: "USCITA" as const, importo: giorno.uscite, categoria: "Contanti", descrizione: "Uscita contanti" },
    ];
    for (const voce of voci) {
      if (voce.importo <= 0) continue;
      movimentiCassa.push({ ...voce, daysAgo: giorno.daysAgo });
    }
  }

  for (const m of movimentiCassa) {
    await prisma.movimentoCassa.create({
      data: {
        tipo: m.tipo,
        importo: m.importo,
        categoria: m.categoria,
        descrizione: m.descrizione,
        data: subDays(oggi, m.daysAgo),
      },
    });
  }

  console.log("Seed completato: magazzino, menu, dipendenti e cassa.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
