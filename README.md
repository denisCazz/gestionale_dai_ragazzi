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

Il database è SQLite (`prisma/dev.db`). Per ricaricare i dati di esempio:

```bash
npm run db:reset
```
