const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");

const outDir = path.join(__dirname, "..", "docs", "board_meeting");
const outFile = path.join(
  outDir,
  "datascene_yle_archive_search_slides_2026-06-22.pptx",
);

const COLORS = {
  darkNavy: "0B2233",
  offWhite: "F5F7F8",
  white: "FFFFFF",
  teal: "2F8F8C",
  copper: "B66F3D",
  gold: "D9A642",
  blue: "244056",
  muted: "647789",
  line: "C9D4DB",
  panel: "EAF0F4",
  darkPanel: "17394E",
};

fs.mkdirSync(outDir, { recursive: true });

const pptx = new pptxgen();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "Datascene / VAA1";
pptx.company = "Datascene";
pptx.subject = "YLE archive search presentation";
pptx.title = "Datascene YLE archive search slides";
pptx.lang = "fi-FI";
pptx.theme = {
  headFontFace: "Aptos Display",
  bodyFontFace: "Aptos",
  lang: "fi-FI",
};
pptx.margin = 0;

function addFooter(slide, dark = false) {
  slide.addText("Datascene", {
    x: 0.55,
    y: 7.15,
    w: 1.7,
    h: 0.16,
    fontFace: "Aptos",
    fontSize: 7.5,
    bold: true,
    color: dark ? "D7E2EA" : COLORS.blue,
    margin: 0,
  });
  slide.addText("YLE / audiovisuaalinen löydettävyys", {
    x: 4.65,
    y: 7.15,
    w: 4.0,
    h: 0.16,
    fontFace: "Aptos",
    fontSize: 7.2,
    color: dark ? "9EB3C2" : COLORS.muted,
    align: "center",
    margin: 0,
  });
}

function rule(slide, x, y, h = 0.44, color = COLORS.copper) {
  slide.addShape("rect", {
    x,
    y,
    w: 0.035,
    h,
    fill: { color },
    line: { color },
  });
}

function addTitle(slide, value, dark = false) {
  rule(slide, 0.78, 0.62, 0.44);
  slide.addText(value, {
    x: 1.0,
    y: 0.55,
    w: 10.95,
    h: 0.62,
    fontFace: "Aptos Display",
    fontSize: 26,
    bold: true,
    color: dark ? COLORS.white : COLORS.blue,
    margin: 0,
    fit: "shrink",
  });
}

function addText(slide, value, x, y, w, h, opts = {}) {
  slide.addText(value, {
    x,
    y,
    w,
    h,
    fontFace: "Aptos",
    fontSize: opts.size || 13,
    bold: opts.bold || false,
    color: opts.color || COLORS.blue,
    margin: opts.margin ?? 0.05,
    fit: "shrink",
    breakLine: false,
    paraSpaceAfterPt: opts.paraSpaceAfterPt ?? 4,
    lineSpacingMultiple: opts.lineSpacingMultiple || 1.02,
    valign: opts.valign || "top",
    align: opts.align || "left",
  });
}

function card(slide, title, body, x, y, w, h, accent, dark = false) {
  slide.addShape("roundRect", {
    x,
    y,
    w,
    h,
    rectRadius: 0.05,
    fill: { color: dark ? COLORS.darkPanel : COLORS.white },
    line: { color: dark ? "46677A" : COLORS.line, width: 1 },
  });
  slide.addShape("rect", {
    x,
    y,
    w,
    h: 0.08,
    fill: { color: accent },
    line: { color: accent },
  });
  addText(slide, title, x + 0.18, y + 0.24, w - 0.36, 0.28, {
    size: 13.2,
    bold: true,
    color: dark ? COLORS.white : accent,
    margin: 0,
  });
  addText(slide, body, x + 0.18, y + 0.68, w - 0.36, h - 0.86, {
    size: 10.4,
    color: dark ? "D7E2EA" : COLORS.blue,
    paraSpaceAfterPt: 2.5,
    lineSpacingMultiple: 0.96,
  });
}

function metricPill(slide, label, x, y, w, color) {
  slide.addShape("roundRect", {
    x,
    y,
    w,
    h: 0.42,
    rectRadius: 0.06,
    fill: { color },
    line: { color },
  });
  addText(slide, label, x + 0.12, y + 0.13, w - 0.24, 0.16, {
    size: 8.8,
    bold: true,
    color: COLORS.white,
    margin: 0,
    align: "center",
  });
}

function slide1() {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.darkNavy };
  addFooter(slide, true);
  addTitle(slide, "YLE:n arkisto – valtava resurssi, piilevä pullonkaula", true);

  addText(
    slide,
    "YLE on rakentanut vuosikymmenten aikana yhden Suomen arvokkaimmista audiovisuaalisista tietovarannoista.\n\n" +
      "Haaste on aineiston löytäminen tehokkaasti silloin, kun sitä tarvitaan.",
    1.02,
    1.45,
    7.35,
    1.25,
    { size: 19, bold: true, color: "D7E2EA", paraSpaceAfterPt: 8 },
  );

  card(
    slide,
    "Tänään",
    "Toimittaja, tuottaja tai tutkija joutuu usein:\n\n" +
      "• Etsimään oikean ohjelman\n" +
      "• Selaamaan tunteja materiaalia\n" +
      "• Tarkistamaan sisältöä käsin",
    0.78,
    3.05,
    3.55,
    1.92,
    COLORS.copper,
    true,
  );

  card(
    slide,
    "Datascene",
    "Luo jokaisesta videosta haettavia kohtauskortteja:\n\n" +
      "henkilöt • paikat • aiheet • tapahtumat\n" +
      "transkriptiot • grafiikat • esineet",
    4.55,
    3.05,
    3.55,
    1.92,
    COLORS.teal,
    true,
  );

  card(
    slide,
    "Strateginen kysymys",
    "Kuinka paljon aikaa, luovuutta ja olemassa olevan arkiston arvoa vapautuu, kun siirrytään tiedostojen selaamisesta sisällön löytämiseen?",
    8.32,
    3.05,
    3.55,
    1.92,
    COLORS.gold,
    true,
  );
}

function slide2() {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.offWhite };
  addFooter(slide);
  addTitle(slide, "Datascene – älykäs hakukerros, joka tehostaa jälleenkäyttöä");

  addText(
    slide,
    "Datascene ei korvaa YLE:n nykyisiä järjestelmiä.\nLisäämme niiden päälle audiovisuaalisen löydettävyyden ja sisältöhaun.",
    1.02,
    1.34,
    10.6,
    0.68,
    { size: 17.5, bold: true, color: COLORS.muted, paraSpaceAfterPt: 4 },
  );

  card(
    slide,
    "Toimituksille",
    "• Löydä aikaisemmat haastattelut sekunneissa\n" +
      "• Hae henkilöitä, aiheita ja tapahtumia\n" +
      "• Vähennä taustatyöhön kuluvaa aikaa",
    0.78,
    2.55,
    3.85,
    2.95,
    COLORS.teal,
  );

  card(
    slide,
    "Sisällöntuotannolle",
    "• Löydä käyttökelpoista arkistomateriaalia uusiin tuotantoihin\n" +
      "• Tunnista aiemmin hyödyntämättömiä sisältöjä\n" +
      "• Nopeuta tuotantoprosessia",
    4.75,
    2.55,
    3.85,
    2.95,
    COLORS.copper,
  );

  card(
    slide,
    "Arkistoille",
    "• Syvempi kuvailu ilman massiivista käsityötä\n" +
      "• Parempi löydettävyys\n" +
      "• Korkeampi käyttöaste jo olemassa oleville aineistoille",
    8.72,
    2.55,
    3.85,
    2.95,
    COLORS.gold,
  );

  slide.addShape("roundRect", {
    x: 1.02,
    y: 5.92,
    w: 10.55,
    h: 0.6,
    rectRadius: 0.05,
    fill: { color: COLORS.panel },
    line: { color: COLORS.line, width: 1 },
  });
  addText(
    slide,
    "Tavoite: arkiston arvo ei jää tiedostojen sisään, vaan muuttuu toimitukselliseksi ja tuotannolliseksi toimintakyvyksi.",
    1.26,
    6.11,
    10.05,
    0.16,
    { size: 11.6, bold: true, color: COLORS.blue, margin: 0, align: "center" },
  );
}

function slide3() {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.offWhite };
  addFooter(slide);
  addTitle(slide, "Kolme yhteistyöpolkua");

  card(
    slide,
    "A. Kohdennettu käyttötapaus",
    "Valitaan yksi YLE:n aineistokokonaisuus.\n\n" +
      "Tavoite:\n" +
      "Todentaa käytännön hyöty\n" +
      "Mitata ajansäästö\n" +
      "Arvioida uudelleenkäyttöpotentiaali\n\n" +
      "Aikataulu: 2–3 kuukautta\n" +
      "Investointi: 20–40K€",
    0.55,
    1.52,
    3.95,
    4.55,
    COLORS.teal,
  );

  card(
    slide,
    "B. Toimitusten löydettävyysratkaisu",
    "Laajempi aineistokokonaisuus ja integroitu sisältöhaku.\n\n" +
      "Tavoite:\n" +
      "Tehostaa AV-toimitusten päivittäistä työtä\n" +
      "Parantaa arkistomateriaalin hyödyntämistä\n" +
      "Luoda uusi tapa hakea sisältöjä\n\n" +
      "Aikataulu: n. 6 kuukautta\n" +
      "Investointi: 50–150K€",
    4.7,
    1.52,
    3.95,
    4.55,
    COLORS.copper,
  );

  card(
    slide,
    "C. Strateginen kehityskumppanuus",
    "YLE osallistuu uuden sukupolven audiovisuaalisen hakemisen, analyysin ja uudelleenkäytön kehittämiseen.\n\n" +
      "Tavoite:\n" +
      "Toimitukset • Arkistot • Sisällöntuotanto\n" +
      "Tulevaisuuden AI-avusteiset työnkulut\n\n" +
      "Aikataulu: 12 kuukautta +\n" +
      "Investointi: 300–500K€+",
    8.85,
    1.52,
    3.95,
    4.55,
    COLORS.gold,
  );

  slide.addShape("roundRect", {
    x: 0.78,
    y: 6.36,
    w: 11.75,
    h: 0.58,
    rectRadius: 0.05,
    fill: { color: COLORS.darkNavy },
    line: { color: COLORS.darkNavy },
  });
  addText(
    slide,
    "Keskustelukysymys: Missä YLE näkisi suurimman välittömän liiketoiminnallisen ja toimituksellisen arvon — toimituksissa, tuotannoissa vai arkistojen hyödyntämisessä?",
    1.02,
    6.55,
    11.25,
    0.18,
    { size: 10.8, bold: true, color: COLORS.white, margin: 0, align: "center" },
  );

  metricPill(slide, "2–3 kk", 1.3, 5.42, 0.82, COLORS.teal);
  metricPill(slide, "20–40K€", 2.2, 5.42, 1.05, COLORS.teal);
  metricPill(slide, "n. 6 kk", 5.38, 5.42, 0.82, COLORS.copper);
  metricPill(slide, "50–150K€", 6.28, 5.42, 1.08, COLORS.copper);
  metricPill(slide, "12 kk +", 9.56, 5.42, 0.82, COLORS.gold);
  metricPill(slide, "300–500K€+", 10.46, 5.42, 1.22, COLORS.gold);
}

slide1();
slide2();
slide3();

pptx.writeFile({ fileName: outFile }).then(() => {
  console.log(`Wrote ${outFile}`);
});
