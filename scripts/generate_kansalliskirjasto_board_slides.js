const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");

const outDir = path.join(__dirname, "..", "docs", "board_meeting");
const outFile = path.join(
  outDir,
  "datascene_kansalliskirjasto_board_slides_2026-06-16.pptx",
);

const COLORS = {
  darkNavy: "0B2233",
  offWhite: "F5F7F8",
  white: "FFFFFF",
  teal: "2F8F8C",
  copper: "B66F3D",
  blue: "244056",
  muted: "647789",
  line: "C9D4DB",
  panel: "EAF0F4",
};

fs.mkdirSync(outDir, { recursive: true });

const pptx = new pptxgen();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "Datascene / VAA1";
pptx.company = "Datascene";
pptx.subject = "Board meeting slides";
pptx.title = "Datascene Kansalliskirjasto board slides";
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
  slide.addText("Kansalliskirjasto / hallituskeskustelu", {
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
  rule(slide, 0.78, 0.62, 0.44, dark ? COLORS.copper : COLORS.copper);
  slide.addText(value, {
    x: 1.0,
    y: 0.55,
    w: 10.8,
    h: 0.62,
    fontFace: "Aptos Display",
    fontSize: 27,
    bold: true,
    color: dark ? COLORS.white : COLORS.blue,
    margin: 0,
    fit: "shrink",
  });
}

function addBody(slide, value, x, y, w, h, opts = {}) {
  slide.addText(value, {
    x,
    y,
    w,
    h,
    fontFace: "Aptos",
    fontSize: opts.size || 14,
    bold: opts.bold || false,
    color: opts.color || COLORS.blue,
    margin: opts.margin ?? 0.05,
    fit: "shrink",
    breakLine: false,
    paraSpaceAfterPt: opts.paraSpaceAfterPt ?? 5,
    lineSpacingMultiple: opts.lineSpacingMultiple || 1.04,
    valign: opts.valign || "top",
  });
}

function slide1() {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.darkNavy };
  addFooter(slide, true);
  addTitle(slide, "Strateginen haaste: Suomalainen verkko on yhä audiovisuaalisempi", true);

  addBody(
    slide,
    "Kasvava osuus Suomen verkkomaailmasta koostuu videoista.\n" +
      "Kansalliskirjasto kerää ja säilyttää näitä aineistoja menestyksekkäästi.\n" +
      "Säilyttäminen ei kuitenkaan automaattisesti takaa aineiston löydettävyyttä.\n" +
      "Tulevilla tutkijoilla voi olla tallenteet hallussaan, mutta heiltä puuttuu käytännöllinen keino navigoida niitä.",
    1.02,
    1.62,
    7.1,
    2.35,
    { size: 18.5, bold: true, color: "D7E2EA", paraSpaceAfterPt: 10 },
  );

  slide.addShape("roundRect", {
    x: 1.02,
    y: 4.42,
    w: 10.65,
    h: 1.32,
    rectRadius: 0.06,
    fill: { color: "17394E" },
    line: { color: "46677A", width: 1 },
  });
  addBody(
    slide,
    "Strateginen kysymys: Pitäisikö audiovisuaalisten kokoelmien pysyä ensisijaisesti säilytettyinä omaisuutena vai avataanko ne löydettävissä oleviksi tietoresursseiksi?",
    1.35,
    4.73,
    9.9,
    0.65,
    { size: 19.5, bold: true, color: COLORS.white, paraSpaceAfterPt: 0 },
  );
}

function slide2() {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.offWhite };
  addFooter(slide);
  addTitle(slide, "Datascene: Säilyttämisestä ymmärtämiseen");

  addBody(
    slide,
    "Datascene ei korvaa arkistosäilytystä.\n\nLisäämme uuden kyvyn: Audiovisuaalisen selailtavuuden",
    1.02,
    1.55,
    10.4,
    1.05,
    { size: 21, bold: true, paraSpaceAfterPt: 8 },
  );

  addBody(slide, "Videokokoelmista tehdään:", 1.02, 3.05, 3.0, 0.3, {
    size: 16,
    bold: true,
  });

  const items = ["Haettavia", "Kuvailtavia", "Navigoitavia", "Vertailtavia", "Tutkittavia"];
  items.forEach((item, index) => {
    const x = 1.02 + (index % 3) * 3.25;
    const y = 3.72 + Math.floor(index / 3) * 0.82;
    slide.addShape("roundRect", {
      x,
      y,
      w: 2.65,
      h: 0.52,
      rectRadius: 0.06,
      fill: { color: index % 2 === 0 ? COLORS.teal : COLORS.blue },
      line: { color: index % 2 === 0 ? COLORS.teal : COLORS.blue },
    });
    addBody(slide, item, x + 0.15, y + 0.15, 2.35, 0.18, {
      size: 13,
      bold: true,
      color: COLORS.white,
      margin: 0,
      paraSpaceAfterPt: 0,
      valign: "mid",
    });
  });
}

function phaseCard(slide, title, body, x, y, w, h, color) {
  slide.addShape("roundRect", {
    x,
    y,
    w,
    h,
    rectRadius: 0.05,
    fill: { color: COLORS.white },
    line: { color: COLORS.line, width: 1 },
  });
  slide.addShape("rect", {
    x,
    y,
    w,
    h: 0.1,
    fill: { color },
    line: { color },
  });
  addBody(slide, title, x + 0.18, y + 0.24, w - 0.36, 0.32, {
    size: 14.5,
    bold: true,
    color,
    margin: 0,
  });
  addBody(slide, body, x + 0.18, y + 0.72, w - 0.36, h - 0.92, {
    size: 8.9,
    color: COLORS.blue,
    paraSpaceAfterPt: 3,
    lineSpacingMultiple: 0.96,
  });
}

function slide3() {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.offWhite };
  addFooter(slide);
  addTitle(slide, "Kolmivaiheinen etenemispolku");

  addBody(
    slide,
    "Aloitetaan ymmärtämisestä. — Laajennetaan löytämiseen. —\nKypsytetään infrastruktuuriksi.",
    1.02,
    1.22,
    10.5,
    0.5,
    { size: 15, bold: true, color: COLORS.muted },
  );

  phaseCard(
    slide,
    "A. Tiedustelu",
    "Tarkoitus: Ymmärtää, mitä audiovisuaaliarkiston sisällä on.\n\n" +
      "Toiminnot:\n" +
      "Edustava otos arkistosta\n" +
      "Automatisoitu metadatan poiminta\n" +
      "Kohtaustason kuvaukset\n" +
      "Aihe- ja sisältölöytö\n" +
      "Kokoelman yleiskatsaus\n\n" +
      "Tulos:\n\n" +
      "Kansalliskirjasto saa ensimmäisen näyttöön perustuvan ymmärryksen audiovisuaalisen kokoelman rakenteesta ja sisällöstä.\n\n" +
      "Viitteellinen mittakaava:\n" +
      "Määrä: +400 videota\n" +
      "Kesto: Viikkoja tai kuukausia\n" +
      "Kustannus: 20–30K",
    0.55,
    2.05,
    3.95,
    4.75,
    COLORS.teal,
  );

  phaseCard(
    slide,
    "B. Kokoelman selailtavuus",
    "Tarkoitus: Tehdä audiovisuaaliarkistosta löydettävä.\n\n" +
      "Toiminnot:\n" +
      "Laajempi, arkistonlaajuinen valikoima\n" +
      "Haettavat kohtauskortit\n" +
      "Aiheiden klusterointi\n" +
      "Genremäärittely\n" +
      "Tutkimuslähtöiset löytötyökalut\n\n" +
      "Tulos:\n\n" +
      "Tutkijat voivat hakea ja navigoida audiovisuaalisissa aineistoissa yksittäisten tiedostojen sijaan.\n\n" +
      "Viitteellinen mittakaava:\n" +
      "Määrä: Kymmeniä tuhansia videoita\n" +
      "Kesto: Kuukausia\n" +
      "Kustannus: 50–100K",
    4.7,
    2.05,
    3.95,
    4.75,
    COLORS.copper,
  );

  phaseCard(
    slide,
    "C. Kansallinen audiovisuaalinen tietoinfrastruktuuri",
    "Tarkoitus: Luoda pysyvä valmius suomalaisen audiovisuaalisen perinnön ymmärtämiseen.\n" +
      "Toiminnot:\n" +
      "Vuosittaisten keräysten käsittely\n" +
      "Pitkittäisvertailu vuosien välillä\n" +
      "Kertomus- ja kulttuuritrendianalyysi\n" +
      "Tutkimusrajapinnat ja API:t\n" +
      "Integrointi arkistointityönkulkuihin\n\n" +
      "Tulos:\n\n" +
      "Suomen verkkoarkistosta tulee elävä tietoinfrastruktuuri tulevaa tutkimusta varten.\n\n" +
      "Viitteellinen mittakaava:\n" +
      "Määrä: Vuosittaiset audiovisuaaliset keräykset\n" +
      "Kesto:Jatkuva toiminta\n" +
      "Kustannus: 300–500K",
    8.85,
    2.05,
    3.95,
    4.75,
    "D9A642",
  );
}

slide1();
slide2();
slide3();

pptx.writeFile({ fileName: outFile }).then(() => {
  console.log(`Wrote ${outFile}`);
});
