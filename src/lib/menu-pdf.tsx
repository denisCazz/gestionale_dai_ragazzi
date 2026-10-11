import path from "node:path";
import {
  Document,
  Font,
  Page,
  renderToBuffer,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

const COLORS = {
  paper: "#F7F1E6",
  espresso: "#140C08",
  gold: "#B8925A",
  goldDeep: "#8C6A38",
  ink: "#1C120C",
  muted: "#6E5848",
  line: "#E4D5C2",
  frame: "#D9C4A4",
};

export type MenuPdfVoce = {
  nome: string;
  descrizione: string | null;
  prezzo: number;
};

export type MenuPdfSezione = {
  nome: string;
  sottotitolo: string | null;
  voci: MenuPdfVoce[];
};

export type MenuPdfModel = {
  scope: "menu" | "sezione";
  titolo: string;
  sottotitolo: string | null;
  sezioni: MenuPdfSezione[];
  aggiornato: string;
};

const FONT_DIR = path.join(process.cwd(), "public", "fonts");

let fontsReady = false;

function ensureFonts() {
  if (fontsReady) return;
  Font.register({
    family: "Cormorant",
    fonts: [
      { src: path.join(FONT_DIR, "CormorantGaramond-Regular.ttf"), fontWeight: 400 },
      { src: path.join(FONT_DIR, "CormorantGaramond-Medium.ttf"), fontWeight: 500 },
      { src: path.join(FONT_DIR, "CormorantGaramond-SemiBold.ttf"), fontWeight: 600 },
      {
        src: path.join(FONT_DIR, "CormorantGaramond-Italic.ttf"),
        fontWeight: 400,
        fontStyle: "italic",
      },
      {
        src: path.join(FONT_DIR, "CormorantGaramond-MediumItalic.ttf"),
        fontWeight: 500,
        fontStyle: "italic",
      },
    ],
  });
  Font.register({
    family: "Outfit",
    fonts: [
      { src: path.join(FONT_DIR, "Outfit-Regular.ttf"), fontWeight: 400 },
      { src: path.join(FONT_DIR, "Outfit-Medium.ttf"), fontWeight: 500 },
      { src: path.join(FONT_DIR, "Outfit-SemiBold.ttf"), fontWeight: 600 },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
  fontsReady = true;
}

export function formatPrezzoMenu(prezzo: number) {
  if (!(prezzo > 0)) return null;
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(prezzo);
}

export function menuPdfFilename(model: Pick<MenuPdfModel, "scope" | "titolo">) {
  if (model.scope === "menu") return "Menu Dai Ragazzi.pdf";
  const safe = model.titolo.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  return `Menu Dai Ragazzi - ${safe}.pdf`;
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: COLORS.paper,
    paddingTop: 40,
    paddingBottom: 64,
    paddingHorizontal: 46,
    fontFamily: "Outfit",
    color: COLORS.ink,
  },
  frameOuter: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
    bottom: 16,
    borderWidth: 0.9,
    borderColor: COLORS.gold,
  },
  frameInner: {
    position: "absolute",
    top: 20,
    left: 20,
    right: 20,
    bottom: 20,
    borderWidth: 0.35,
    borderColor: COLORS.frame,
  },
  running: {
    position: "absolute",
    top: 26,
    left: 46,
    right: 46,
    textAlign: "center",
    fontFamily: "Outfit",
    fontSize: 8,
    letterSpacing: 1.6,
    color: COLORS.goldDeep,
    textTransform: "uppercase",
  },
  kicker: {
    fontFamily: "Outfit",
    fontWeight: 500,
    fontSize: 8.5,
    letterSpacing: 4.2,
    textAlign: "center",
    color: COLORS.goldDeep,
    textTransform: "uppercase",
  },
  brand: {
    marginTop: 1,
    fontFamily: "Cormorant",
    fontWeight: 600,
    fontSize: 34,
    textAlign: "center",
    color: COLORS.espresso,
    lineHeight: 1,
  },
  place: {
    marginTop: 4,
    fontFamily: "Outfit",
    fontSize: 8.5,
    letterSpacing: 0.6,
    textAlign: "center",
    color: COLORS.muted,
  },
  title: {
    marginTop: 12,
    fontFamily: "Cormorant",
    fontWeight: 600,
    fontSize: 24,
    textAlign: "center",
    color: COLORS.espresso,
  },
  titleAiry: {
    fontSize: 32,
  },
  subtitle: {
    marginTop: 3,
    fontFamily: "Cormorant",
    fontStyle: "italic",
    fontWeight: 500,
    fontSize: 12,
    textAlign: "center",
    color: COLORS.muted,
  },
  ornament: {
    marginTop: 10,
    marginBottom: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  ornamentLine: {
    width: 42,
    height: 0.6,
    backgroundColor: COLORS.gold,
  },
  ornamentDiamond: {
    width: 5,
    height: 5,
    marginHorizontal: 8,
    backgroundColor: COLORS.gold,
    transform: "rotate(45deg)",
  },
  updated: {
    marginTop: 6,
    fontFamily: "Outfit",
    fontSize: 8,
    letterSpacing: 0.4,
    textAlign: "center",
    color: COLORS.muted,
  },
  sections: {
    marginTop: 12,
  },
  section: {
    marginTop: 12,
  },
  sectionTitle: {
    fontFamily: "Cormorant",
    fontWeight: 600,
    fontSize: 18,
    color: COLORS.espresso,
  },
  sectionSubtitle: {
    marginTop: 1,
    fontFamily: "Cormorant",
    fontStyle: "italic",
    fontWeight: 500,
    fontSize: 11,
    color: COLORS.muted,
  },
  sectionRule: {
    marginTop: 5,
    marginBottom: 2,
    width: 36,
    height: 0.7,
    backgroundColor: COLORS.gold,
  },
  item: {
    paddingTop: 6,
    paddingBottom: 5,
    borderBottomWidth: 0.4,
    borderBottomColor: COLORS.line,
  },
  itemAiry: {
    paddingTop: 12,
    paddingBottom: 11,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  itemName: {
    flex: 1,
    paddingRight: 12,
    fontFamily: "Cormorant",
    fontWeight: 600,
    fontSize: 14.5,
    color: COLORS.ink,
    lineHeight: 1.15,
  },
  itemNameAiry: {
    fontSize: 17,
  },
  itemPrice: {
    flexShrink: 0,
    paddingTop: 2,
    fontFamily: "Outfit",
    fontWeight: 500,
    fontSize: 10,
    color: COLORS.goldDeep,
  },
  itemPriceAiry: {
    fontSize: 11,
    paddingTop: 4,
  },
  itemDesc: {
    marginTop: 2,
    paddingRight: 56,
    fontFamily: "Cormorant",
    fontStyle: "italic",
    fontWeight: 500,
    fontSize: 10.5,
    lineHeight: 1.35,
    color: COLORS.muted,
  },
  empty: {
    marginTop: 28,
    fontFamily: "Cormorant",
    fontStyle: "italic",
    fontSize: 13,
    textAlign: "center",
    color: COLORS.muted,
  },
  footer: {
    position: "absolute",
    left: 46,
    right: 46,
    bottom: 28,
    alignItems: "center",
  },
  footerRule: {
    width: 28,
    height: 0.6,
    marginBottom: 5,
    backgroundColor: COLORS.gold,
  },
  footerPlace: {
    fontFamily: "Outfit",
    fontSize: 7.5,
    letterSpacing: 0.5,
    color: COLORS.muted,
    textAlign: "center",
  },
  footerHours: {
    marginTop: 2,
    paddingHorizontal: 28,
    fontFamily: "Outfit",
    fontSize: 7,
    color: COLORS.muted,
    textAlign: "center",
  },
  footerPage: {
    position: "absolute",
    right: 0,
    bottom: 0,
    fontFamily: "Outfit",
    fontSize: 7.5,
    color: COLORS.goldDeep,
  },
});

function Ornament() {
  return (
    <View style={styles.ornament}>
      <View style={styles.ornamentLine} />
      <View style={styles.ornamentDiamond} />
      <View style={styles.ornamentLine} />
    </View>
  );
}

function VoceRow({ voce, airy }: { voce: MenuPdfVoce; airy: boolean }) {
  const prezzo = formatPrezzoMenu(voce.prezzo);
  return (
    <View style={airy ? [styles.item, styles.itemAiry] : styles.item} wrap={false}>
      <View style={styles.itemRow}>
        <Text style={airy ? [styles.itemName, styles.itemNameAiry] : styles.itemName}>{voce.nome}</Text>
        {prezzo ? (
          <Text style={airy ? [styles.itemPrice, styles.itemPriceAiry] : styles.itemPrice}>{prezzo}</Text>
        ) : null}
      </View>
      {voce.descrizione ? <Text style={styles.itemDesc}>{voce.descrizione}</Text> : null}
    </View>
  );
}

function SectionBlock({ sezione }: { sezione: MenuPdfSezione }) {
  const [first, ...rest] = sezione.voci;
  if (!first) return null;
  return (
    <View style={styles.section}>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{sezione.nome}</Text>
        {sezione.sottotitolo ? (
          <Text style={styles.sectionSubtitle}>{sezione.sottotitolo}</Text>
        ) : null}
        <View style={styles.sectionRule} />
        <VoceRow voce={first} airy={false} />
      </View>
      {rest.map((voce, index) => (
        <VoceRow key={`${sezione.nome}-${index}`} voce={voce} airy={false} />
      ))}
    </View>
  );
}

function MenuDocument({ data }: { data: MenuPdfModel }) {
  const vociTotali = data.sezioni.reduce((sum, sezione) => sum + sezione.voci.length, 0);
  const airy = data.scope === "sezione" && vociTotali > 0 && vociTotali <= 8;
  const running =
    data.scope === "sezione" ? `Dai Ragazzi  ·  ${data.titolo}` : "Dai Ragazzi  ·  Menu";

  return (
    <Document
      title={data.scope === "menu" ? "Menu Dai Ragazzi" : `Menu Dai Ragazzi — ${data.titolo}`}
      author="Bar Dai Ragazzi"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.frameOuter} fixed />
        <View style={styles.frameInner} fixed />
        <Text
          style={styles.running}
          fixed
          render={({ pageNumber }) => (pageNumber > 1 ? running : "")}
        />

        <Text style={styles.kicker}>Bar</Text>
        <Text style={styles.brand}>Dai Ragazzi</Text>
        <Text style={styles.place}>Piazza Garavella, 7 · Carmagnola</Text>
        <Text style={airy ? [styles.title, styles.titleAiry] : styles.title}>{data.titolo}</Text>
        {data.sottotitolo ? <Text style={styles.subtitle}>{data.sottotitolo}</Text> : null}
        <Ornament />
        <Text style={styles.updated}>Carta del {data.aggiornato}</Text>

        {data.scope === "menu" ? (
          <View style={styles.sections}>
            {data.sezioni.map((sezione, index) => (
              <SectionBlock key={`${sezione.nome}-${index}`} sezione={sezione} />
            ))}
          </View>
        ) : (
          <View style={airy ? [styles.sections, { marginTop: 22 }] : styles.sections}>
            {data.sezioni[0]?.voci.length ? (
              data.sezioni[0].voci.map((voce, index) => (
                <VoceRow key={`${voce.nome}-${index}`} voce={voce} airy={airy} />
              ))
            ) : (
              <Text style={styles.empty}>Nessuna voce in questa sezione.</Text>
            )}
          </View>
        )}

        <View style={styles.footer} fixed>
          <View style={styles.footerRule} />
          <Text style={styles.footerPlace}>Piazza Garavella, 7 · Carmagnola (TO)</Text>
          <Text style={styles.footerHours}>
            Lun 7:00–19:00 · Mar–Sab 7:00–21:00 · Dom 8:00–13:00 e 17:30–21:00
          </Text>
          <Text
            style={styles.footerPage}
            render={({ pageNumber, totalPages }) => (totalPages > 1 ? String(pageNumber) : "")}
          />
        </View>
      </Page>
    </Document>
  );
}

export function renderMenuPdf(data: MenuPdfModel) {
  ensureFonts();
  return renderToBuffer(<MenuDocument data={data} />);
}
