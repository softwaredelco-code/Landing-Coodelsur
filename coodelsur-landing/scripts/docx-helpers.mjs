import {
  HeadingLevel,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

export function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: opts.after ?? 120 },
    children: [new TextRun({ text, size: opts.size ?? 21, bold: opts.bold ?? false, italics: opts.italics ?? false })],
  });
}

export function bullet(text) {
  return new Paragraph({
    spacing: { after: 80 },
    bullet: { level: 0 },
    children: [new TextRun({ text, size: 21 })],
  });
}

export function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({
    heading: level,
    spacing: { before: level === HeadingLevel.HEADING_1 ? 0 : 240, after: 120 },
    children: [new TextRun({ text, bold: true })],
  });
}

export function cell(text, bold = false) {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text: String(text ?? "—"), bold, size: 18 })],
      }),
    ],
  });
}

export function tableFromRows(headers, rows) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h) => cell(h, true)),
  });
  const bodyRows = rows.map(
    (row) =>
      new TableRow({
        children: row.map((col) => cell(col)),
      }),
  );
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...bodyRows],
  });
}

export function coverBlock(title, subtitle, version = "1.0") {
  const date = new Date().toLocaleDateString("es-CO", { dateStyle: "long" });
  return [
    heading(title),
    heading(subtitle, HeadingLevel.HEADING_2),
    p("Coodelsur SAS — Landing de solicitud de crédito"),
    p(`Versión del documento: ${version}`),
    p(`Fecha de generación: ${date}`),
    p("Confidencial — uso interno y operativo", { italics: true }),
    p(""),
  ];
}
