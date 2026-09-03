/**
 * Genera el documento de capacitación para desarrolladores en Word (.docx).
 * Fuente: docs/CAPACITACION-DEV.md
 * Ejecutar: npm run docs:capacitacion
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { bullet, coverBlock, heading, p, tableFromRows } from "./docx-helpers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS = path.join(__dirname, "..", "docs");
const INPUT = path.join(DOCS, "CAPACITACION-DEV.md");
const OUTPUT = path.join(DOCS, "capacitacion-desarrolladores-coodelsur.docx");

/** Convierte markdown inline a TextRun[] (negrita, cursiva, código, enlaces). */
function inlineRuns(text, baseSize = 21) {
  const runs = [];
  const re =
    /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|[^*`[\n]+)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const token = m[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      runs.push(
        new TextRun({ text: token.slice(2, -2), bold: true, size: baseSize }),
      );
    } else if (token.startsWith("*") && token.endsWith("*") && !token.startsWith("**")) {
      runs.push(
        new TextRun({ text: token.slice(1, -1), italics: true, size: baseSize }),
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      runs.push(
        new TextRun({
          text: token.slice(1, -1),
          font: "Consolas",
          size: baseSize - 2,
        }),
      );
    } else if (token.startsWith("[") && token.includes("](")) {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (linkMatch) {
        runs.push(
          new TextRun({
            text: `${linkMatch[1]} (${linkMatch[2]})`,
            size: baseSize,
            color: "0563C1",
            underline: {},
          }),
        );
      }
    } else if (token.length > 0) {
      runs.push(new TextRun({ text: token, size: baseSize }));
    }
  }
  if (runs.length === 0 && text) {
    runs.push(new TextRun({ text, size: baseSize }));
  }
  return runs;
}

function paragraphFromInline(text, opts = {}) {
  return new Paragraph({
    spacing: { after: opts.after ?? 120, before: opts.before ?? 0 },
    bullet: opts.bullet ? { level: opts.bulletLevel ?? 0 } : undefined,
    children: inlineRuns(text, opts.size ?? 21),
  });
}

function codeBlock(lines, language) {
  const label =
    language === "mermaid"
      ? "(Diagrama — abrir CAPACITACION-DEV.md en GitHub/VS Code para ver renderizado)"
      : language
        ? `Código (${language}):`
        : "Código:";
  const children = [
    new Paragraph({
      spacing: { before: 120, after: 60 },
      children: [
        new TextRun({ text: label, italics: true, size: 18, color: "666666" }),
      ],
    }),
  ];
  for (const line of lines) {
    children.push(
      new Paragraph({
        spacing: { after: 40 },
        children: [
          new TextRun({
            text: line || " ",
            font: "Consolas",
            size: 18,
          }),
        ],
      }),
    );
  }
  children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
  return children;
}

function isTableRow(line) {
  return line.trim().startsWith("|") && line.trim().endsWith("|");
}

function parseTableRow(line) {
  return line
    .trim()
    .slice(1, -1)
    .split("|")
    .map((c) => c.trim());
}

function isTableSeparator(line) {
  const cells = parseTableRow(line);
  return cells.every((c) => /^:?-+:?$/.test(c));
}

function parseMarkdown(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const children = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Bloque de código
    if (trimmed.startsWith("```")) {
      const lang = trimmed.slice(3).trim();
      const codeLines = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i += 1;
      }
      children.push(...codeBlock(codeLines, lang));
      i += 1;
      continue;
    }

    // Tabla
    if (isTableRow(line)) {
      const tableLines = [];
      while (i < lines.length && isTableRow(lines[i])) {
        tableLines.push(lines[i]);
        i += 1;
      }
      const dataRows = tableLines.filter((l) => !isTableSeparator(l));
      if (dataRows.length >= 1) {
        const headers = parseTableRow(dataRows[0]).map(stripCellMarkdown);
        const rows = dataRows.slice(1).map((r) =>
          parseTableRow(r).map(stripCellMarkdown),
        );
        children.push(tableFromRows(headers, rows));
        children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
      }
      continue;
    }

    // HR
    if (trimmed === "---" || trimmed === "***") {
      i += 1;
      continue;
    }

    // Encabezados
    const h4 = trimmed.match(/^#### (.+)$/);
    const h3 = trimmed.match(/^### (.+)$/);
    const h2 = trimmed.match(/^## (.+)$/);
    const h1 = trimmed.match(/^# (.+)$/);
    if (h4) {
      children.push(heading(stripCellMarkdown(h4[1]), HeadingLevel.HEADING_4));
      i += 1;
      continue;
    }
    if (h3) {
      children.push(heading(stripCellMarkdown(h3[1]), HeadingLevel.HEADING_3));
      i += 1;
      continue;
    }
    if (h2) {
      children.push(heading(stripCellMarkdown(h2[1]), HeadingLevel.HEADING_2));
      i += 1;
      continue;
    }
    if (h1) {
      children.push(heading(stripCellMarkdown(h1[1]), HeadingLevel.HEADING_1));
      i += 1;
      continue;
    }

    // Blockquote
    if (trimmed.startsWith("> ")) {
      children.push(
        paragraphFromInline(trimmed.slice(2), { italics: true, after: 100 }),
      );
      i += 1;
      continue;
    }

    // Lista numerada
    const numbered = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (numbered) {
      children.push(
        paragraphFromInline(`${numbered[1]}. ${numbered[2]}`, { after: 80 }),
      );
      i += 1;
      continue;
    }

    // Checkbox / bullet
    const checkbox = trimmed.match(/^- \[ \]\s+(.+)$/);
    if (checkbox) {
      children.push(bullet(`☐ ${stripCellMarkdown(checkbox[1])}`));
      i += 1;
      continue;
    }
    const checkboxDone = trimmed.match(/^- \[x\]\s+(.+)$/i);
    if (checkboxDone) {
      children.push(bullet(`☑ ${stripCellMarkdown(checkboxDone[1])}`));
      i += 1;
      continue;
    }
    if (trimmed.startsWith("- ")) {
      children.push(bullet(stripCellMarkdown(trimmed.slice(2))));
      i += 1;
      continue;
    }

    // Párrafo vacío
    if (trimmed === "") {
      i += 1;
      continue;
    }

    // Párrafo normal
    children.push(paragraphFromInline(trimmed));
    i += 1;
  }

  return children;
}

function stripCellMarkdown(text) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

async function main() {
  if (!fs.existsSync(INPUT)) {
    console.error("No se encontró:", INPUT);
    process.exit(1);
  }

  const md = fs.readFileSync(INPUT, "utf8");

  // Omitir título H1 del markdown — la portada lo reemplaza
  const bodyMd = md.replace(/^# Capacitación para desarrolladores[^\n]*\n\n/, "");

  const date = new Date().toLocaleDateString("es-CO", { dateStyle: "long" });
  const children = [
    ...coverBlock(
      "Capacitación para desarrolladores",
      "Coodelsur Landing — Guion de onboarding (cero → avanzado)",
      "1.0",
    ),
    p(
      "Documento generado automáticamente desde docs/CAPACITACION-DEV.md. " +
        "Para diagramas Mermaid interactivos, consulte la versión Markdown en el repositorio.",
      { italics: true, after: 200 },
    ),
    p(`Fecha de generación: ${date}`),
    ...parseMarkdown(bodyMd),
  ];

  const doc = new Document({
    creator: "Coodelsur",
    title: "Capacitación para desarrolladores — Coodelsur Landing",
    description:
      "Guion de capacitación para el equipo de desarrollo de formularios urbano/rural",
    sections: [{ properties: {}, children }],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(OUTPUT, buffer);
  console.log("Generado:", OUTPUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
