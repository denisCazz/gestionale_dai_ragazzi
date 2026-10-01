# Gestionale Dai Ragazzi

Gestionale interno del Bar Dai Ragazzi: magazzino, menu, dipendenti e cassa.

## Avvio

```bash
npm install
npx prisma db push
npx tsx prisma/seed.ts
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000).

Il menu pubblico per il sito è su `GET /api/public/menu` (solo voci disponibili, categorie pubblicate).

Le foto delle voci si caricano dal menu del gestionale. Vengono ridotte in WebP e salvate nel database, poi il sito le mostra da `GET /api/public/menu/immagini/:id` (lo stesso percorso già inoltrato dal sito).

Il database è SQLite (`prisma/dev.db`). Per ricaricare i dati di esempio:

```bash
npm run db:reset
```
