import { prisma } from "./db";

let ensuredPromise: Promise<void> | null = null;

async function safeExec(sql: string) {
  try {
    await prisma.$executeRawUnsafe(sql);
  } catch {
    /* ignore if column/table/index already exists */
  }
}

export function ensureExtendedSchema(): Promise<void> {
  if (!ensuredPromise) {
    ensuredPromise = (async () => {
      await safeExec(`ALTER TABLE \`Dipendente\` ADD COLUMN \`username\` VARCHAR(191) NULL`);
      await safeExec(`ALTER TABLE \`Dipendente\` ADD COLUMN \`passwordHash\` VARCHAR(191) NULL`);
      await safeExec(`CREATE UNIQUE INDEX \`Dipendente_username_key\` ON \`Dipendente\`(\`username\`)`);

      await safeExec(`ALTER TABLE \`Presenza\` ADD COLUMN \`fuoriPerimetro\` BOOLEAN NOT NULL DEFAULT false`);
      await safeExec(`ALTER TABLE \`Presenza\` ADD COLUMN \`metodoVerifica\` VARCHAR(191) NULL`);
      await safeExec(`ALTER TABLE \`Presenza\` ADD COLUMN \`ipRegistrazione\` VARCHAR(191) NULL`);
      await safeExec(`ALTER TABLE \`Presenza\` ADD COLUMN \`latRegistrazione\` DOUBLE NULL`);
      await safeExec(`ALTER TABLE \`Presenza\` ADD COLUMN \`lngRegistrazione\` DOUBLE NULL`);
      await safeExec(`ALTER TABLE \`Presenza\` ADD COLUMN \`distanzaMetri\` INTEGER NULL`);

      await safeExec(`
        CREATE TABLE IF NOT EXISTS \`AnomaliaPresenza\` (
          \`id\` VARCHAR(191) NOT NULL,
          \`dipendenteId\` VARCHAR(191) NOT NULL,
          \`data\` VARCHAR(191) NOT NULL,
          \`ora\` VARCHAR(191) NOT NULL,
          \`azione\` VARCHAR(191) NOT NULL,
          \`motivo\` VARCHAR(500) NOT NULL,
          \`ip\` VARCHAR(191) NULL,
          \`lat\` DOUBLE NULL,
          \`lng\` DOUBLE NULL,
          \`distanzaMetri\` INTEGER NULL,
          \`userAgent\` VARCHAR(500) NULL,
          \`emailInviata\` BOOLEAN NOT NULL DEFAULT false,
          \`letta\` BOOLEAN NOT NULL DEFAULT false,
          \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          PRIMARY KEY (\`id\`),
          INDEX \`AnomaliaPresenza_dipendenteId_idx\`(\`dipendenteId\`),
          INDEX \`AnomaliaPresenza_letta_idx\`(\`letta\`),
          INDEX \`AnomaliaPresenza_createdAt_idx\`(\`createdAt\`)
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
      `);

      await safeExec(`
        CREATE TABLE IF NOT EXISTS \`ImpostazioniPresenze\` (
          \`id\` VARCHAR(191) NOT NULL DEFAULT 'default',
          \`ipNegozio\` VARCHAR(500) NOT NULL DEFAULT '',
          \`latNegozio\` DOUBLE NOT NULL DEFAULT 44.84655,
          \`lngNegozio\` DOUBLE NOT NULL DEFAULT 7.720389,
          \`raggioMetri\` INTEGER NOT NULL DEFAULT 120,
          \`emailTitolari\` VARCHAR(500) NOT NULL DEFAULT '',
          \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
          PRIMARY KEY (\`id\`)
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
      `);

      await safeExec(`
        CREATE TABLE IF NOT EXISTS \`Promozione\` (
          \`id\` VARCHAR(191) NOT NULL,
          \`titolo\` VARCHAR(191) NOT NULL,
          \`titoloEn\` VARCHAR(191) NULL,
          \`quando\` VARCHAR(191) NOT NULL,
          \`quandoEn\` VARCHAR(191) NULL,
          \`orario\` VARCHAR(191) NULL,
          \`prezzo\` DOUBLE NOT NULL,
          \`nota\` TEXT NULL,
          \`notaEn\` TEXT NULL,
          \`evidenza\` BOOLEAN NOT NULL DEFAULT false,
          \`attiva\` BOOLEAN NOT NULL DEFAULT true,
          \`ordine\` INTEGER NOT NULL DEFAULT 0,
          \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
          PRIMARY KEY (\`id\`),
          INDEX \`Promozione_attiva_ordine_idx\`(\`attiva\`, \`ordine\`)
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
      `);

      try {
        const count = await prisma.promozione.count();
        if (count === 0) {
          await prisma.promozione.createMany({
            data: [
              {
                id: "promo-buffet-venerdi",
                titolo: "Aperitivo a buffet",
                titoloEn: "Buffet aperitivo",
                quando: "Tutti i venerdì",
                quandoEn: "Every Friday",
                orario: "17:30 – 20:30",
                prezzo: 13,
                nota: "Compresa la prima consumazione",
                notaEn: "First drink included",
                evidenza: true,
                attiva: true,
                ordine: 1,
              },
              {
                id: "promo-tagliere",
                titolo: "Aperitivo con tagliere",
                titoloEn: "Aperitivo with a board",
                quando: "Dal giovedì alla domenica, escluso il venerdì",
                quandoEn: "Thursday to Sunday, except Friday",
                orario: "17:30 – 20:30",
                prezzo: 8.5,
                nota: "Finger food, sfiziosità fritte, pizza. Può variare in base alle disponibilità. Compresa la prima consumazione",
                notaEn:
                  "Finger food, fried bites, pizza. It can change with what’s available. First drink included",
                evidenza: false,
                attiva: true,
                ordine: 2,
              },
            ],
          });
        }
      } catch {
        /* ignore if DB offline */
      }
    })();
  }
  return ensuredPromise;
}
