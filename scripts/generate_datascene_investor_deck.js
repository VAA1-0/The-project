const fs = require('fs');
const path = require('path');
const pptxgen = require('pptxgenjs');

const outDir = path.join(__dirname, '..', 'docs', 'investor_deck');
const outFile = path.join(outDir, 'datascene_investor_deck_editable_2026-06-06.pptx');

const COLORS = {
  deepNavy: '12354A',
  darkNavy: '0B2233',
  offWhite: 'F5F7F8',
  primary: '244056',
  muted: '647789',
  teal: '2F8F8C',
  copper: 'B66F3D',
  border: 'E2E8EC',
  white: 'FFFFFF',
  pale: 'D7E2EA',
};

const pptx = new pptxgen();
pptx.layout = 'LAYOUT_WIDE';
pptx.author = 'Datascene / VAA1';
pptx.subject = 'Investor deck';
pptx.title = 'Datascene investor deck';
pptx.company = 'Datascene / VAA1';
pptx.lang = 'en-US';
pptx.theme = {
  headFontFace: 'Aptos Display',
  bodyFontFace: 'Aptos',
  lang: 'en-US',
};
pptx.margin = 0;

function addFooter(slide, dark = false) {
  slide.addText('Datascene / VAA1', {
    x: 0.55, y: 7.15, w: 2.0, h: 0.18,
    fontFace: 'Aptos', fontSize: 7.5, bold: true,
    color: dark ? COLORS.pale : COLORS.primary,
    margin: 0,
  });
  slide.addText('Research-led multimodal intelligence for audiovisual collections', {
    x: 5.0, y: 7.15, w: 3.8, h: 0.18,
    fontFace: 'Aptos', fontSize: 7,
    color: dark ? '9EB3C2' : COLORS.muted,
    margin: 0, align: 'center',
  });
}

function title(slide, text, x, y, w, opts = {}) {
  slide.addText(text, {
    x, y, w, h: opts.h || 0.55,
    fontFace: 'Aptos Display',
    fontSize: opts.size || 30,
    bold: opts.bold !== false,
    color: opts.color || COLORS.primary,
    margin: 0,
    fit: 'shrink',
    breakLine: false,
  });
}

function body(slide, text, x, y, w, h, opts = {}) {
  slide.addText(text, {
    x, y, w, h,
    fontFace: 'Aptos',
    fontSize: opts.size || 13,
    color: opts.color || COLORS.primary,
    bold: opts.bold || false,
    margin: opts.margin ?? 0.03,
    breakLine: false,
    valign: opts.valign || 'top',
    fit: 'shrink',
    paraSpaceAfterPt: opts.paraSpaceAfterPt ?? 5,
    lineSpacingMultiple: opts.lineSpacingMultiple || 1.05,
  });
}

function eyebrow(slide, text, x, y, color = COLORS.teal) {
  slide.addText(text.toUpperCase(), {
    x, y, w: 5.2, h: 0.2,
    fontFace: 'Aptos',
    fontSize: 8.5,
    bold: true,
    charSpace: 1.2,
    color,
    margin: 0,
  });
}

function copperRule(slide, x, y, h = 0.35) {
  slide.addShape('rect', {
    x, y, w: 0.03, h,
    fill: { color: COLORS.copper },
    line: { color: COLORS.copper },
  });
}

function card(slide, x, y, w, h, opts = {}) {
  slide.addShape('roundRect', {
    x, y, w, h,
    rectRadius: 0.05,
    fill: { color: opts.fill || COLORS.white, transparency: opts.transparency || 0 },
    line: { color: opts.line || COLORS.border, width: 1 },
  });
}

function node(slide, text, x, y, w, h, opts = {}) {
  slide.addShape('roundRect', {
    x, y, w, h,
    rectRadius: 0.08,
    fill: { color: opts.fill || COLORS.white, transparency: opts.transparency || 0 },
    line: { color: opts.line || COLORS.border, width: opts.lineWidth || 1.2 },
  });
  slide.addText(text, {
    x: x + 0.08, y: y + 0.06, w: w - 0.16, h: h - 0.12,
    fontFace: 'Aptos',
    fontSize: opts.size || 10,
    bold: opts.bold || false,
    color: opts.color || COLORS.primary,
    margin: 0.02,
    align: opts.align || 'center',
    valign: 'mid',
    fit: 'shrink',
  });
}

function line(slide, x1, y1, x2, y2, color = COLORS.border, width = 1) {
  slide.addShape('line', {
    x: x1, y: y1, w: x2 - x1, h: y2 - y1,
    line: { color, width, beginArrowType: 'none', endArrowType: 'triangle' },
  });
}

function dot(slide, x, y, color = COLORS.copper, r = 0.07) {
  slide.addShape('ellipse', {
    x: x - r / 2, y: y - r / 2, w: r, h: r,
    fill: { color },
    line: { color },
  });
}

function bulletList(slide, items, x, y, w, h, opts = {}) {
  const lines = items.map((item) => ({ text: item, options: { bullet: { type: 'ul' }, breakLine: true } }));
  slide.addText(lines, {
    x, y, w, h,
    fontFace: 'Aptos',
    fontSize: opts.size || 13,
    color: opts.color || COLORS.primary,
    margin: 0.04,
    paraSpaceAfterPt: opts.paraSpaceAfterPt || 6,
    fit: 'shrink',
  });
}

function darkSlide() {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.deepNavy };
  return slide;
}

function lightSlide() {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.offWhite };
  return slide;
}

function placeholder(slide, label, x, y, w, h, dark = false) {
  slide.addShape('rect', {
    x, y, w, h,
    fill: { color: dark ? COLORS.darkNavy : COLORS.white, transparency: 8 },
    line: { color: dark ? '46677A' : COLORS.border, width: 1, dash: 'dash' },
  });
  slide.addText(label, {
    x: x + 0.12, y: y + h / 2 - 0.15, w: w - 0.24, h: 0.3,
    fontFace: 'Aptos',
    fontSize: 10,
    color: dark ? COLORS.pale : COLORS.muted,
    margin: 0,
    align: 'center',
    valign: 'mid',
    fit: 'shrink',
  });
}

function slide1() {
  const slide = darkSlide();
  addFooter(slide, true);

  eyebrow(slide, 'research-led multimodal intelligence', 1.0, 1.25);
  slide.addText('Datascene', {
    x: 1.0, y: 1.75, w: 4.7, h: 0.6,
    fontFace: 'Aptos Display', fontSize: 38, bold: true,
    color: COLORS.white, margin: 0,
  });
  slide.addText('Turning audiovisual material into traceable knowledge', {
    x: 1.0, y: 2.42, w: 6.8, h: 0.75,
    fontFace: 'Aptos Display', fontSize: 27,
    color: COLORS.white, bold: false, margin: 0,
    fit: 'shrink',
  });
  copperRule(slide, 1.0, 3.55, 0.38);
  body(slide, 'Datascene makes audiovisual material searchable, analyzable, and reusable without losing the path back to the original evidence.', 1.18, 3.50, 6.5, 0.58, {
    color: COLORS.pale, size: 14.5,
  });

  node(slide, 'DATE / VENUE', 9.25, 1.25, 2.1, 0.45, {
    fill: COLORS.darkNavy, line: '46677A', color: COLORS.pale, size: 9,
  });

  const y = 5.15;
  ['Founder / research lead', 'Technical lead', 'Design / partnerships'].forEach((role, idx) => {
    const x = 1.0 + idx * 3.15;
    placeholder(slide, 'photo', x, y, 0.78, 0.78, true);
    body(slide, 'Name Surname', x + 0.95, y + 0.02, 1.65, 0.2, { color: COLORS.white, size: 10.8, bold: true });
    body(slide, role, x + 0.95, y + 0.27, 1.95, 0.24, { color: '9EB3C2', size: 8.5 });
    body(slide, 'email@example.com', x + 0.95, y + 0.51, 1.95, 0.22, { color: COLORS.teal, size: 8.5 });
  });
}

function slide2() {
  const slide = lightSlide();
  addFooter(slide);
  copperRule(slide, 1.0, 0.75, 0.42);
  title(slide, 'What Datascene is', 1.18, 0.72, 5.5, { size: 28 });
  body(slide, 'Datascene is a research-led multimodal intelligence platform for audiovisual material.', 1.0, 1.55, 5.7, 0.38, { size: 14.5, color: COLORS.muted });

  node(slide, 'Audiovisual\nmaterial', 1.1, 3.0, 2.2, 0.95, { line: COLORS.border, size: 16, bold: true });
  node(slide, 'Multimodal\nanalysis', 4.8, 2.88, 2.4, 1.18, { fill: COLORS.teal, line: COLORS.teal, color: COLORS.white, size: 16, bold: true });
  node(slide, 'Source-linked\nknowledge', 8.8, 3.0, 2.35, 0.95, { line: COLORS.copper, lineWidth: 1.5, size: 16, bold: true });
  line(slide, 3.35, 3.47, 4.65, 3.47, COLORS.muted, 1.5);
  line(slide, 7.25, 3.47, 8.65, 3.47, COLORS.muted, 1.5);
  dot(slide, 8.72, 3.47, COLORS.copper, 0.12);

  bulletList(slide, [
    'searchable knowledge',
    'traceable evidence',
    'structured research data',
    'reusable institutional memory',
  ], 1.0, 5.05, 5.2, 1.0, { size: 14 });
  body(slide, 'Most organizations possess more video than they can meaningfully use.', 7.2, 5.2, 4.0, 0.5, { size: 16, bold: true });
}

function slide3() {
  const slide = darkSlide();
  addFooter(slide, true);
  eyebrow(slide, 'already delivered', 0.75, 0.55);
  title(slide, 'A navigable evidence workspace', 0.75, 0.85, 7.4, { size: 30, color: COLORS.white });

  placeholder(slide, 'VAA1 screenshot placeholder\nsource video + transcript + evidence panels', 0.75, 1.62, 7.05, 4.38, true);
  const callouts = [
    ['Source video', 8.15, 1.72, COLORS.teal],
    ['Transcript and timing', 8.15, 2.58, COLORS.copper],
    ['Evidence constellation', 8.15, 3.44, COLORS.teal],
    ['Human-confirmed knowledge', 8.15, 4.30, COLORS.copper],
  ];
  callouts.forEach(([label, x, y, color]) => {
    dot(slide, x, y + 0.15, color, 0.12);
    body(slide, label, x + 0.22, y, 3.2, 0.32, { color: COLORS.white, size: 14, bold: true });
    body(slide, 'editable callout', x + 0.22, y + 0.28, 2.8, 0.25, { color: '9EB3C2', size: 8.5 });
  });
  body(slide, 'Datascene brings video, transcript, metadata, annotation, and interpretation into one source-linked environment.', 0.75, 6.22, 6.5, 0.38, {
    color: COLORS.pale, size: 13,
  });
  node(slide, 'Datascene already delivers multimodal analysis without hallucinating away from the source.', 7.7, 6.08, 4.6, 0.62, {
    fill: COLORS.darkNavy, line: COLORS.copper, color: COLORS.white, size: 11.5, bold: true,
  });
}

function slide4() {
  const slide = lightSlide();
  addFooter(slide);
  copperRule(slide, 0.7, 0.55, 0.42);
  title(slide, 'What Datascene delivers', 0.9, 0.52, 5.6, { size: 27 });
  body(slide, 'Five customer segments, one shared problem: audiovisual collections and media environments are difficult to turn into usable, source-linked knowledge.', 0.7, 1.1, 9.5, 0.42, { size: 13.5, color: COLORS.muted });

  const rows = [
    ['Archives and memory institutions', 'Search beyond basic metadata', 'Searchable video evidence and active institutional memory'],
    ['Research and universities', 'Scalable multimodal analysis with transparent evidence links', 'Reusable audiovisual datasets and source-linked interpretation'],
    ['Creative industries', 'Retrieval of footage, themes, scenes, motifs, and production memory', 'Searchable production archives and story-development support'],
    ['Public governance organizations', 'Understanding media spheres, disinformation dynamics, hybrid threats, and cross-border narratives', 'Source-linked situational understanding for policy, diplomacy, and public communication'],
    ['Strategic enterprises', 'Interpreting strategic information environments', 'Evidence-based intelligence for communication, risk, reputation, and information operations'],
  ];
  const x = 0.7;
  const y0 = 1.78;
  const widths = [2.65, 4.1, 4.35];
  ['Segment', 'What they lack today', 'What Datascene delivers'].forEach((h, i) => {
    node(slide, h, x + widths.slice(0, i).reduce((a, b) => a + b, 0), y0, widths[i] - 0.05, 0.38, {
      fill: i === 2 ? COLORS.teal : COLORS.deepNavy,
      line: i === 2 ? COLORS.teal : COLORS.deepNavy,
      color: COLORS.white,
      size: 10.5,
      bold: true,
    });
  });
  rows.forEach((r, idx) => {
    const y = y0 + 0.52 + idx * 0.76;
    card(slide, x, y, 11.08, 0.62);
    dot(slide, x + 0.18, y + 0.2, COLORS.copper, 0.07);
    body(slide, r[0], x + 0.34, y + 0.1, widths[0] - 0.4, 0.35, { size: 9.5, bold: true });
    body(slide, r[1], x + widths[0] + 0.1, y + 0.08, widths[1] - 0.28, 0.4, { size: 8.6, color: COLORS.muted });
    body(slide, r[2], x + widths[0] + widths[1] + 0.1, y + 0.08, widths[2] - 0.28, 0.4, { size: 8.6, color: COLORS.primary, bold: true });
  });
  body(slide, 'Examples: EU-level disinformation work | foreign ministry media-sphere analysis | enterprise strategic information operations', 1.0, 6.35, 10.0, 0.28, { size: 10, color: COLORS.muted });
}

function iconNode(slide, label, x, y, kind) {
  card(slide, x, y, 1.55, 0.78);
  slide.addShape('ellipse', {
    x: x + 0.12, y: y + 0.18, w: 0.34, h: 0.34,
    fill: { color: 'FFFFFF', transparency: 100 },
    line: { color: COLORS.primary, width: 1.2 },
  });
  if (kind === 'law') {
    slide.addShape('line', { x: x + 0.29, y: y + 0.12, w: 0, h: 0.45, line: { color: COLORS.primary, width: 1.2 } });
    slide.addShape('line', { x: x + 0.18, y: y + 0.28, w: 0.22, h: 0, line: { color: COLORS.primary, width: 1.2 } });
  } else if (kind === 'bank') {
    slide.addShape('line', { x: x + 0.12, y: y + 0.52, w: 0.38, h: 0, line: { color: COLORS.primary, width: 1.2 } });
    slide.addShape('line', { x: x + 0.18, y: y + 0.26, w: 0, h: 0.25, line: { color: COLORS.primary, width: 1.2 } });
    slide.addShape('line', { x: x + 0.32, y: y + 0.26, w: 0, h: 0.25, line: { color: COLORS.primary, width: 1.2 } });
  } else if (kind === 'shield') {
    slide.addShape('arc', { x: x + 0.16, y: y + 0.16, w: 0.3, h: 0.34, line: { color: COLORS.primary, width: 1.2 } });
  } else {
    dot(slide, x + 0.29, y + 0.35, COLORS.copper, 0.09);
  }
  body(slide, label, x + 0.56, y + 0.16, 0.86, 0.38, { size: 8.5, bold: true });
}

function slide5() {
  const slide = lightSlide();
  addFooter(slide);
  copperRule(slide, 0.75, 0.57, 0.42);
  title(slide, 'Who Datascene serves', 0.95, 0.54, 5.5, { size: 27 });
  body(slide, 'Datascene is relevant wherever audiovisual material becomes evidence, knowledge, or institutional memory.', 0.75, 1.1, 8.8, 0.35, { size: 13.5, color: COLORS.muted });

  node(slide, 'Datascene\nsource-linked audiovisual knowledge', 5.05, 3.0, 2.15, 1.05, {
    fill: COLORS.teal, line: COLORS.teal, color: COLORS.white, bold: true, size: 13,
  });
  const icons = [
    ['Law', 1.0, 1.95, 'law'],
    ['Journalism', 5.05, 1.65, 'press'],
    ['Public governance', 9.0, 1.95, 'gov'],
    ['Finance', 2.35, 3.0, 'bank'],
    ['Security', 8.35, 3.0, 'shield'],
    ['Academy', 1.0, 4.45, 'academy'],
    ['Defence', 9.0, 4.45, 'shield'],
    ['Archives', 2.35, 5.55, 'archive'],
    ['Business intelligence', 5.05, 5.85, 'chart'],
    ['Decision makers', 8.35, 5.55, 'decision'],
  ];
  icons.forEach(([label, x, y, kind]) => {
    iconNode(slide, label, x, y, kind);
    line(slide, x + 0.78, y + 0.39, 6.12, 3.52, COLORS.border, 0.7);
  });
  node(slide, 'Institutions that need audiovisual material to become inspectable, trustworthy, and reusable.', 3.65, 6.55, 5.0, 0.45, {
    fill: COLORS.white, line: COLORS.copper, color: COLORS.primary, size: 10.5, bold: true,
  });
}

function slide6() {
  const slide = darkSlide();
  addFooter(slide, true);
  eyebrow(slide, 'development direction', 0.75, 0.55);
  title(slide, 'Where Datascene is going', 0.75, 0.85, 6.4, { size: 30, color: COLORS.white });
  body(slide, 'Datascene is being developed from a working analysis platform into broader audiovisual knowledge infrastructure.', 0.75, 1.42, 7.4, 0.34, { color: COLORS.pale, size: 12.5 });

  node(slide, 'Datascene core\nsource-linked multimodal understanding', 0.9, 3.05, 2.35, 1.05, {
    fill: COLORS.teal, line: COLORS.teal, color: COLORS.white, bold: true, size: 11.5,
  });
  const branches = [
    ['Video search engine', 4.15, 1.9, COLORS.white],
    ['Real-time analysis', 7.15, 1.9, COLORS.white],
    ['Secure standalone units', 9.95, 1.9, COLORS.white],
    ['EU-compliant cloud', 4.15, 3.25, COLORS.white],
    ['AI agent implementations', 7.15, 3.25, COLORS.white],
    ['Situational cultures', 9.95, 3.25, COLORS.copper],
    ['Digital human sciences skills', 4.15, 4.6, COLORS.copper],
    ['Sector-specific spinoffs', 7.15, 4.6, COLORS.white],
    ['Global markets', 9.95, 4.6, COLORS.white],
  ];
  branches.forEach(([label, x, y, accent]) => {
    line(slide, 3.3, 3.58, x - 0.15, y + 0.38, '6F8797', 0.8);
    node(slide, label, x, y, 2.0, 0.72, {
      fill: COLORS.darkNavy,
      line: accent,
      color: COLORS.white,
      size: 10.2,
      bold: accent === COLORS.copper,
    });
    dot(slide, x, y + 0.36, accent, 0.08);
  });
  node(slide, 'The reusable core: source-linked multimodal understanding of audiovisual material.', 2.35, 6.28, 7.65, 0.5, {
    fill: COLORS.darkNavy, line: COLORS.copper, color: COLORS.white, size: 11.5, bold: true,
  });
}

function slide7() {
  const slide = lightSlide();
  addFooter(slide);
  copperRule(slide, 0.8, 0.7, 0.42);
  title(slide, 'What we need', 1.0, 0.67, 4.6, { size: 28 });
  body(slide, 'We are looking for the right people around the table, not generic acceleration.', 1.0, 1.28, 7.0, 0.35, { size: 14, color: COLORS.muted });

  card(slide, 1.0, 2.0, 5.0, 3.95);
  card(slide, 6.5, 2.0, 5.0, 3.95);
  body(slide, 'People we need around the table', 1.28, 2.28, 4.2, 0.3, { size: 15, bold: true });
  body(slide, 'Support the work needs', 6.78, 2.28, 4.2, 0.3, { size: 15, bold: true });
  bulletList(slide, [
    'knowledge infrastructure',
    'research technology',
    'institutional software',
    'audiovisual archives',
    'long-term defensibility',
  ], 1.28, 2.9, 4.3, 2.2, { size: 13.2 });
  bulletList(slide, [
    'continued development',
    'technical hardening',
    'research collaborations',
    'consulting and applied projects',
    'deployment readiness',
    'commercial structuring',
  ], 6.78, 2.9, 4.3, 2.45, { size: 13.2 });
  node(slide, 'No pilots. Research collaboration, consulting, applied work, and careful operational deployment.', 2.2, 6.28, 8.7, 0.48, {
    fill: COLORS.white, line: COLORS.copper, color: COLORS.primary, size: 11, bold: true,
  });
}

function slide8() {
  const slide = darkSlide();
  addFooter(slide, true);
  title(slide, 'Datascene turns audiovisual collections from passive storage into active knowledge infrastructure.', 1.0, 1.05, 9.2, {
    size: 31,
    color: COLORS.white,
    h: 1.15,
  });
  node(slide, 'Audiovisual material', 1.45, 3.5, 2.35, 0.7, { fill: COLORS.darkNavy, line: '6F8797', color: COLORS.white, size: 13, bold: true });
  node(slide, 'Datascene', 5.05, 3.34, 2.05, 1.0, { fill: COLORS.teal, line: COLORS.teal, color: COLORS.white, size: 18, bold: true });
  node(slide, 'Traceable institutional knowledge', 8.65, 3.5, 2.8, 0.7, { fill: COLORS.darkNavy, line: COLORS.copper, color: COLORS.white, size: 13, bold: true });
  line(slide, 3.85, 3.85, 4.85, 3.85, COLORS.pale, 1.5);
  line(slide, 7.15, 3.85, 8.45, 3.85, COLORS.pale, 1.5);
  dot(slide, 7.82, 3.85, COLORS.copper, 0.12);

  body(slide, 'What exists now: a functioning multimodal analysis platform.', 1.45, 5.4, 3.4, 0.35, { color: COLORS.pale, size: 12.5 });
  body(slide, 'Where we are going: a trusted infrastructure layer for audiovisual knowledge.', 4.8, 5.4, 3.9, 0.35, { color: COLORS.pale, size: 12.5 });
  body(slide, 'What we need: strategic support to harden, focus, and scale carefully.', 8.35, 5.4, 3.4, 0.35, { color: COLORS.pale, size: 12.5 });
}

slide1();
slide2();
slide3();
slide4();
slide5();
slide6();
slide7();
slide8();

fs.mkdirSync(outDir, { recursive: true });
pptx.writeFile({ fileName: outFile }).then(() => {
  console.log(outFile);
});
