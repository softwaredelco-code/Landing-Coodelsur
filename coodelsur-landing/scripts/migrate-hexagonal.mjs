/**
 * Migra el proyecto a arquitectura hexagonal.
 * Ejecutar una sola vez: node scripts/migrate-hexagonal.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "src");

/** [fromRelativeToSrc, toRelativeToSrc] — archivos o carpetas */
const MOVES = [
  ["components", "presentation/components"],
  ["hooks", "presentation/hooks"],
  ["contexts", "presentation/contexts"],
  ["types", "shared/types"],
  ["config", "shared/config"],
  ["content", "shared/content"],
  ["data", "shared/data"],
  ["lib/utils.ts", "shared/utils.ts"],
  ["lib/validation", "shared/validation"],
  ["lib/prisma.ts", "infrastructure/database/prisma.ts"],
  ["lib/credito/amortizacion.ts", "domain/credito/amortizacion.ts"],
  ["lib/credito/parametros-runtime.ts", "application/credito/parametros-runtime.ts"],
  ["lib/credito/parametros-store.ts", "infrastructure/database/parametros-store.ts"],
  ["lib/leads/form-progress.ts", "domain/lead/form-progress.ts"],
  ["lib/leads/lead-summary.ts", "domain/lead/lead-summary.ts"],
  ["lib/leads/lead-summary-fields.ts", "domain/lead/lead-summary-fields.ts"],
  ["lib/leads/duplicate-cedula.ts", "domain/lead/duplicate-cedula.ts"],
  ["lib/leads/attachments.ts", "domain/lead/attachments.ts"],
  ["lib/leads/file-store.ts", "infrastructure/persistence/file-store.ts"],
  ["lib/leads/create-lead.ts", "application/lead/create-lead.ts"],
  ["lib/leads/save-draft-lead.ts", "application/lead/save-draft-lead.ts"],
  ["lib/leads/delete-lead.ts", "application/lead/delete-lead.ts"],
  ["lib/leads/export-leads-excel.ts", "application/lead/export-leads-excel.ts"],
  ["lib/leads/fetch-leads-for-export.ts", "application/lead/fetch-leads-for-export.ts"],
  ["lib/leads/admin-lead-detail.ts", "application/lead/admin-lead-detail.ts"],
  ["lib/leads/admin-lead-sections.ts", "application/lead/admin-lead-sections.ts"],
  ["lib/leads/load-lead-attachment.ts", "application/lead/load-lead-attachment.ts"],
  ["lib/leads/load-admin-lead-detail.ts", "application/lead/load-admin-lead-detail.ts"],
  ["lib/identity/cedula.ts", "domain/identity/cedula.ts"],
  ["lib/identity/cedula-local.ts", "domain/identity/cedula-local.ts"],
  ["lib/identity/verify-document.ts", "application/identity/verify-document.ts"],
  ["lib/admin", "infrastructure/auth"],
  ["lib/storage", "infrastructure/storage"],
  ["lib/email", "infrastructure/email"],
  ["lib/geo", "infrastructure/geo"],
  ["lib/media", "infrastructure/media"],
  ["lib/forms", "presentation/forms"],
  ["lib/tracking", "presentation/tracking"],
];

const IMPORT_REPLACEMENTS = [
  ["@/lib/leads/form-progress", "@/domain/lead/form-progress"],
  ["@/lib/leads/lead-summary-fields", "@/domain/lead/lead-summary-fields"],
  ["@/lib/leads/lead-summary", "@/domain/lead/lead-summary"],
  ["@/lib/leads/duplicate-cedula", "@/domain/lead/duplicate-cedula"],
  ["@/lib/leads/attachments", "@/domain/lead/attachments"],
  ["@/lib/leads/file-store", "@/infrastructure/persistence/file-store"],
  ["@/lib/leads/", "@/application/lead/"],
  ["@/lib/credito/amortizacion", "@/domain/credito/amortizacion"],
  ["@/lib/credito/parametros-runtime", "@/application/credito/parametros-runtime"],
  ["@/lib/credito/parametros-store", "@/infrastructure/database/parametros-store"],
  ["@/lib/identity/cedula-local", "@/domain/identity/cedula-local"],
  ["@/lib/identity/cedula", "@/domain/identity/cedula"],
  ["@/lib/identity/verify-document", "@/application/identity/verify-document"],
  ["@/lib/validation/", "@/shared/validation/"],
  ["@/lib/prisma", "@/infrastructure/database/prisma"],
  ["@/lib/admin/", "@/infrastructure/auth/"],
  ["@/lib/storage/", "@/infrastructure/storage/"],
  ["@/lib/email/", "@/infrastructure/email/"],
  ["@/lib/geo/", "@/infrastructure/geo/"],
  ["@/lib/media/", "@/infrastructure/media/"],
  ["@/lib/forms/", "@/presentation/forms/"],
  ["@/lib/tracking/", "@/presentation/tracking/"],
  ["@/lib/utils", "@/shared/utils"],
  ["@/components/", "@/presentation/components/"],
  ["@/hooks/", "@/presentation/hooks/"],
  ["@/contexts/", "@/presentation/contexts/"],
  ["@/types/", "@/shared/types/"],
  ["@/config/", "@/shared/config/"],
  ["@/content/", "@/shared/content/"],
  ["@/data/", "@/shared/data/"],
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function movePath(fromRel, toRel) {
  const from = path.join(SRC, fromRel);
  const to = path.join(SRC, toRel);
  if (!fs.existsSync(from)) {
    console.log("  skip (missing):", fromRel);
    return;
  }
  if (fs.existsSync(to)) {
    console.log("  skip (exists):", toRel);
    return;
  }
  ensureDir(path.dirname(to));
  fs.cpSync(from, to, { recursive: true });
  fs.rmSync(from, { recursive: true, force: true });
  console.log("  moved:", fromRel, "→", toRel);
}

function walkFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    if (entry.isDirectory()) walkFiles(full, acc);
    else if (/\.(ts|tsx|js|mjs|md)$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

function rewriteImports(filePath) {
  let content = fs.readFileSync(filePath, "utf8");
  let changed = false;
  for (const [from, to] of IMPORT_REPLACEMENTS) {
    if (content.includes(from)) {
      content = content.split(from).join(to);
      changed = true;
    }
  }
  if (changed) fs.writeFileSync(filePath, content, "utf8");
}

function removeEmptyDirs(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) removeEmptyDirs(path.join(dir, entry.name));
  }
  if (dir !== SRC && fs.readdirSync(dir).length === 0) {
    fs.rmdirSync(dir);
  }
}

console.log("1/3 Moviendo archivos...");
for (const [from, to] of MOVES) {
  movePath(from, to);
}

console.log("2/3 Actualizando imports...");
const files = walkFiles(ROOT).filter(
  (f) =>
    !f.includes("node_modules") &&
    !f.includes(".next") &&
    !f.includes("migrate-hexagonal.mjs"),
);
for (const file of files) rewriteImports(file);

console.log("3/3 Limpiando carpetas vacías...");
removeEmptyDirs(path.join(SRC, "lib"));

console.log("\nMigración completada. Ejecuta: npm run build");
