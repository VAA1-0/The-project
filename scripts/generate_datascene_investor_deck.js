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
  slide.addText('Investor conversation deck', {
    x: 5.1, y: 7.15, w: 3.2, h: 0.18,
    fontFace: 'Aptos', fontSize: 7,
    color: dark ? '9EB3C2' : COLORS.muted,
    margin: 0, align: 'center',
  });
}

function title(slide, text, x, y, w, opts = {}) {
  slide.addText(text, {
    x, y, w, h: opts.h || 0.75,
    fontFace: 'Aptos Display',
    fontSize: opts.size || 30,
    bold: opts.bold !== false,
    color: opts.color || COLORS.primary,
    margin: 0,
    fit: 'shrink',
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

function copperRule(slide, x, y, h = 0.42) {
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
    line: { color: opts.line || COLORS.border, width: opts.lineWidth || 1 },
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
    x: x + 0.1, y: y + 0.08, w: w - 0.2, h: h - 0.16,
    fontFace: 'Aptos',
    fontSize: opts.size || 11,
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

function dot(slide, x, y, color = COLORS.copper, r = 0.08) {
  slide.addShape('ellipse', {
    x: x - r / 2, y: y - r / 2, w: r, h: r,
    fill: { color },
    line: { color },
  });
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
    x: 1.0, y: 2.42, w: 7.0, h: 0.75,
    fontFace: 'Aptos Display', fontSize: 27,
    color: COLORS.white, bold: false, margin: 0,
    fit: 'shrink',
  });
  copperRule(slide, 1.0, 3.55, 0.38);
  body(slide, 'Datascene makes audiovisual material searchable, analyzable, and reusable without losing the path back to the original evidence.', 1.18, 3.50, 6.7, 0.58, {
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
  copperRule(slide, 0.85, 0.72);
  title(slide, 'The problem', 1.05, 0.68, 5.5, { size: 31 });

  body(slide, 'Video is becoming institutional data, but most organizations still cannot analyze it at scale.', 1.05, 1.55, 8.7, 0.55, {
    size: 19, bold: true,
  });

  const cards = [
    ['Lots of video everywhere', 'Interviews, broadcasts, hearings, meetings, archives, fieldwork, security footage, social media, production material.'],
    ['Haphazard tooling', 'Search, transcription, annotation, metadata, and evidence handling are often split across fragile workflows.'],
    ['Large underserved market', 'Many organizations need automated video-data analysis, but do not have usable tools for traceable, scalable work.'],
  ];

  cards.forEach(([head, text], i) => {
    const x = 1.0 + i * 3.75;
    card(slide, x, 3.0, 3.25, 1.55);
    dot(slide, x + 0.24, 3.28, COLORS.copper, 0.1);
    body(slide, head, x + 0.42, 3.16, 2.45, 0.26, { size: 13.5, bold: true });
    body(slide, text, x + 0.42, 3.58, 2.55, 0.7, { size: 10.6, color: COLORS.muted });
  });

  node(slide, 'The gap: video is valuable, but not yet operational as reliable, reusable knowledge.', 2.1, 5.75, 8.8, 0.62, {
    fill: COLORS.white, line: COLORS.copper, color: COLORS.primary, size: 13, bold: true,
  });
}

function slide3() {
  const slide = darkSlide();
  addFooter(slide, true);
  eyebrow(slide, 'solution sample', 0.75, 0.55);
  title(slide, 'A working evidence workspace', 0.75, 0.85, 7.1, { size: 31, color: COLORS.white });

  placeholder(slide, 'VAA1 screenshot placeholder\nsource video + transcript + evidence panels', 0.75, 1.62, 7.0, 4.35, true);

  const wins = [
    ['Multimodal', 'Video, audio, transcript, objects, scenes, metadata, and meaning in one workspace.'],
    ['Traceable', 'Claims stay linked to timestamps, frames, annotations, and source material.'],
    ['Human-confirmed', 'Analyst corrections can cascade through the evidence model instead of being overwritten.'],
    ['Already working', 'Datascene already delivers source-linked multimodal analysis, not only a concept.'],
  ];

  wins.forEach(([head, text], i) => {
    const y = 1.66 + i * 0.94;
    dot(slide, 8.12, y + 0.12, i === 1 || i === 2 ? COLORS.copper : COLORS.teal, 0.11);
    body(slide, head, 8.35, y, 3.25, 0.25, { color: COLORS.white, size: 13.5, bold: true });
    body(slide, text, 8.35, y + 0.27, 3.25, 0.44, { color: 'AFC1CD', size: 9.4 });
  });

  node(slide, 'Why we win: Datascene does not hallucinate away from source. It turns audiovisual material into a navigable research and intelligence object.', 1.25, 6.25, 10.1, 0.58, {
    fill: COLORS.darkNavy, line: COLORS.copper, color: COLORS.white, size: 12.1, bold: true,
  });
}

function slide4() {
  const slide = lightSlide();
  addFooter(slide);
  copperRule(slide, 0.85, 0.72);
  title(slide, 'Where we are heading', 1.05, 0.68, 6.5, { size: 31 });

  body(slide, 'Datascene is being developed from a working local platform into deployable audiovisual knowledge infrastructure.', 1.05, 1.5, 8.8, 0.45, {
    size: 16, color: COLORS.muted,
  });

  const paths = [
    ['Video search engine', 'Search speech, scenes, objects, people, meaning, metadata, and confirmed evidence.'],
    ['Real-time analysis', 'Near-live analysis for monitoring, documentation, decision support, and media environments.'],
    ['Standalone units', 'Web-free deployments for sensitive users and closed environments.'],
    ['EU-compliant cloud', 'Hosted infrastructure aligned with European privacy, governance, and institutional needs.'],
    ['AI agents and spinoffs', 'Task-specific agents and sector products for archives, research, security, governance, and enterprise intelligence.'],
  ];

  paths.forEach(([head, text], i) => {
    const x = i < 3 ? 0.9 + i * 3.8 : 2.85 + (i - 3) * 3.8;
    const y = i < 3 ? 2.6 : 4.45;
    card(slide, x, y, 3.15, 1.22);
    dot(slide, x + 0.23, y + 0.26, i === 2 || i === 3 ? COLORS.copper : COLORS.teal, 0.1);
    body(slide, head, x + 0.42, y + 0.16, 2.45, 0.25, { size: 12.3, bold: true });
    body(slide, text, x + 0.42, y + 0.52, 2.45, 0.46, { size: 9.2, color: COLORS.muted });
  });

  node(slide, 'The same core asset scales: source-linked multimodal understanding of audiovisual material.', 2.1, 6.35, 8.8, 0.48, {
    fill: COLORS.white, line: COLORS.copper, color: COLORS.primary, size: 11.5, bold: true,
  });
}

function slide5() {
  const slide = darkSlide();
  addFooter(slide, true);
  eyebrow(slide, 'pre-seed plan', 0.75, 0.55);
  title(slide, 'What we are raising', 0.75, 0.85, 6.4, { size: 31, color: COLORS.white });

  slide.addText('200K', {
    x: 0.85, y: 2.0, w: 3.1, h: 0.9,
    fontFace: 'Aptos Display', fontSize: 52, bold: true,
    color: COLORS.white, margin: 0,
  });
  body(slide, 'pre-seed capital', 0.9, 2.9, 3.1, 0.28, { color: COLORS.pale, size: 15, bold: true });
  body(slide, 'Topped with Business Finland funding and operational customer cases.', 0.9, 3.38, 3.7, 0.65, { color: 'AFC1CD', size: 13.2 });

  card(slide, 5.0, 1.72, 2.9, 1.35, { fill: COLORS.darkNavy, line: COLORS.teal });
  body(slide, 'Deliverable 1', 5.25, 1.98, 2.2, 0.22, { color: COLORS.teal, size: 9.5, bold: true });
  body(slide, 'Web-free standalone units for sensitive users', 5.25, 2.32, 2.2, 0.36, { color: COLORS.white, size: 14, bold: true });

  card(slide, 8.35, 1.72, 2.9, 1.35, { fill: COLORS.darkNavy, line: COLORS.copper });
  body(slide, 'Deliverable 2', 8.6, 1.98, 2.2, 0.22, { color: COLORS.copper, size: 9.5, bold: true });
  body(slide, 'Global EU-compliant cloud-based service', 8.6, 2.32, 2.2, 0.36, { color: COLORS.white, size: 14, bold: true });

  node(slide, 'Target: by the end of the calendar year', 5.0, 3.8, 6.25, 0.55, {
    fill: COLORS.deepNavy, line: '6F8797', color: COLORS.white, size: 14, bold: true,
  });

  const uses = [
    ['Product hardening', 5.0, 5.18],
    ['Deployment packaging', 7.1, 5.18],
    ['Security-sensitive operation', 9.2, 5.18],
    ['Customer-case delivery', 6.05, 6.0],
    ['EU cloud readiness', 8.15, 6.0],
  ];
  uses.forEach(([label, x, y], i) => {
    dot(slide, x, y + 0.12, i % 2 ? COLORS.copper : COLORS.teal, 0.09);
    body(slide, label, x + 0.18, y, 1.65, 0.25, { color: COLORS.pale, size: 9.8, bold: true });
  });
}

slide1();
slide2();
slide3();
slide4();
slide5();

fs.mkdirSync(outDir, { recursive: true });
pptx.writeFile({ fileName: outFile }).then(() => {
  console.log(outFile);
});
