/**
 * API Route para el Cruce Automatizado de Reportes DataCrédito con IA.
 * Soporta streaming Server-Sent Events (SSE) y respuesta JSON directa.
 * Coodelsur SAS
 */

import {
  buildCoodelsurTemplateExcelBuffer,
  processCruceData,
} from "@/application/datacredito/cruce-service";
import { LeadExportRecord } from "@/application/lead/export-leads-excel";
import { fetchLeadsForExport } from "@/application/lead/fetch-leads-for-export";
import { CruceStreamMessage, DataCreditoExtracted } from "@/domain/datacredito/types";
import { adminUnauthorizedResponse, isAdminRequest } from "@/infrastructure/auth/require-admin";
import { extractDataCreditoFromPdf } from "@/infrastructure/datacredito/gemini-extractor";
import { File as NodeFile } from "node:buffer";
import { NextResponse } from "next/server";

// Polyfill seguro de File en Node.js 18
if (typeof globalThis.File === "undefined" && typeof NodeFile !== "undefined") {
  (globalThis as unknown as { File: typeof NodeFile }).File = NodeFile;
}

interface UploadedFileLike {
  name: string;
  size?: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

function isUploadedFile(entry: unknown): entry is UploadedFileLike {
  if (!entry || typeof entry !== "object") return false;
  if (typeof File !== "undefined" && entry instanceof File) return true;
  const item = entry as { name?: unknown; arrayBuffer?: unknown };
  return typeof item.name === "string" && typeof item.arrayBuffer === "function";
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300; // Hasta 5 minutos para procesamiento de lotes grandes

function generateCruceFilename(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || "";
  const year = getPart("year");
  const month = getPart("month");
  const day = getPart("day");
  const hour = getPart("hour");
  const minute = getPart("minute");
  const second = getPart("second");
  return `cruce-datacredito-coodelsur-${year}-${month}-${day}_${hour}-${minute}-${second}.xlsx`;
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return adminUnauthorizedResponse();
  }

  try {
    const formData = await request.formData();

    const rawExcel = formData.get("excel");
    const excelFile = isUploadedFile(rawExcel) ? rawExcel : null;
    const leadIdsRaw = formData.get("leadIds") as string | null;
    const apiKey = (formData.get("apiKey") as string | null) || undefined;
    const pdfPassword = (formData.get("pdfPassword") as string | null) || undefined;
    const mode = (formData.get("mode") as string | null) || undefined;
    const extractedPdfsJson = (formData.get("extractedPdfsJson") as string | null) || undefined;
    const isStream = formData.get("stream") !== "false";

    // Recoger todos los archivos PDF enviados
    const pdfFiles: UploadedFileLike[] = [];
    const allEntries = formData.getAll("pdfs");
    for (const entry of allEntries) {
      if (isUploadedFile(entry) && entry.name.toLowerCase().endsWith(".pdf")) {
        pdfFiles.push(entry);
      }
    }

    // Modo extracción individual por archivo (óptimo para cPanel: procesa 1 PDF por petición JSON sin SSE buffering ni saturar 512MB RAM)
    if (mode === "extract-single") {
      if (pdfFiles.length === 0) {
        return NextResponse.json(
          { error: "No se adjuntó archivo PDF válido para analizar." },
          { status: 400 },
        );
      }
      const pdf = pdfFiles[0];
      const bytes = new Uint8Array(await pdf.arrayBuffer());
      const extracted = await extractDataCreditoFromPdf(bytes, pdf.name, {
        openaiApiKey: apiKey,
        pdfPassword,
      });
      return NextResponse.json({
        extracted,
        filename: pdf.name,
      });
    }

    let preExtractedPdfs: Array<{ extracted: DataCreditoExtracted; filename: string }> | null = null;
    if (extractedPdfsJson) {
      try {
        const parsed = JSON.parse(extractedPdfsJson) as Array<{
          extracted: DataCreditoExtracted;
          filename: string;
        }>;
        if (Array.isArray(parsed) && parsed.length > 0) {
          preExtractedPdfs = parsed;
        }
      } catch {
        return NextResponse.json(
          { error: "Datos de extracción previa inválidos." },
          { status: 400 },
        );
      }
    }

    if (!preExtractedPdfs && pdfFiles.length === 0) {
      return NextResponse.json(
        { error: "No se adjuntaron archivos PDF de DataCrédito válidos." },
        { status: 400 },
      );
    }

    // 1. Obtener o generar el Excel base de solicitudes
    let excelBuffer: Uint8Array;
    let leadsSourceDescription = "Archivo Excel adjunto";

    if (excelFile && (typeof excelFile.size === "number" ? excelFile.size > 0 : true)) {
      const arrayBuf = await excelFile.arrayBuffer();
      excelBuffer = new Uint8Array(arrayBuf);
    } else {
      // Buscar solicitudes en la base de datos de Coodelsur
      let targetLeads: LeadExportRecord[] = [];

      if (leadIdsRaw && leadIdsRaw.trim()) {
        const ids = leadIdsRaw
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean);
        if (ids.length > 0) {
          targetLeads = await fetchLeadsForExport({ ids });
        }
      }

      if (targetLeads.length === 0) {
        // Cruce contra las solicitudes recientes registradas en Coodelsur (acotado para proteger RAM en cPanel)
        targetLeads = await fetchLeadsForExport({
          take: 500,
        });
      }

      if (targetLeads.length === 0) {
        return NextResponse.json(
          {
            error:
              "No se encontraron solicitudes registradas en Coodelsur para realizar el cruce. Selecciona personas en la tabla o adjunta un archivo Excel.",
          },
          { status: 400 },
        );
      }

      leadsSourceDescription = `${targetLeads.length} solicitud(es) seleccionada(s) de Coodelsur`;
      excelBuffer = buildCoodelsurTemplateExcelBuffer(targetLeads);
    }

    // Si ya vienen los PDFs pre-extraídos (cruce rápido JSON) o si no se pide stream
    if (preExtractedPdfs || !isStream) {
      const extractedPdfs: Array<{ extracted: DataCreditoExtracted; filename: string }> =
        preExtractedPdfs ? [...preExtractedPdfs] : [];

      if (!preExtractedPdfs) {
        for (const pdf of pdfFiles) {
          const bytes = new Uint8Array(await pdf.arrayBuffer());
          const extracted = await extractDataCreditoFromPdf(bytes, pdf.name, {
            openaiApiKey: apiKey,
            pdfPassword,
          });
          extractedPdfs.push({ extracted, filename: pdf.name });
        }
      }

      const cruce = processCruceData(excelBuffer, extractedPdfs);
      const downloadFilename = generateCruceFilename();

      return NextResponse.json({
        kpis: cruce.kpis,
        records: cruce.records,
        excelBase64: Buffer.from(cruce.excelBuffer).toString("base64"),
        downloadFilename,
      });
    }

    // Modo Streaming SSE en tiempo real
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (msg: CruceStreamMessage) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(msg)}\n\n`));
          } catch {
            // El cliente pudo cerrar la conexión
          }
        };

        try {
          // Flush inicial de 2KB para desbordar y omitir buffering de Apache/LiteSpeed/Nginx en cPanel
          controller.enqueue(encoder.encode(`: ${" ".repeat(2048)}\n\n`));

          send({
            type: "start",
            total: pdfFiles.length,
            message: `Iniciando análisis de ${pdfFiles.length} reporte(s) DataCrédito...`,
          });

          const extractedPdfs: Array<{ extracted: DataCreditoExtracted; filename: string }> = [];

          for (let i = 0; i < pdfFiles.length; i++) {
            const pdf = pdfFiles[i];
            const currentIdx = i + 1;

            send({
              type: "progress",
              current: currentIdx,
              total: pdfFiles.length,
              filename: pdf.name,
              message: `Analizando [${currentIdx}/${pdfFiles.length}]: ${pdf.name}...`,
            });

            try {
              const bytes = new Uint8Array(await pdf.arrayBuffer());
              const extracted = await extractDataCreditoFromPdf(bytes, pdf.name, {
                openaiApiKey: apiKey,
                pdfPassword,
                onProgress: (stepMsg) => {
                  send({
                    type: "log",
                    message: `[${currentIdx}/${pdfFiles.length}] ${stepMsg}`,
                  });
                },
              });

              extractedPdfs.push({ extracted, filename: pdf.name });

              send({
                type: "log",
                message: `[OK] ${pdf.name} -> C.C. ${extracted.documento_identidad} | ${extracted.nombre_titular} | Score: ${extracted.puntaje} (${extracted.nivel_riesgo})`,
              });
            } catch (fileErr) {
              const errMsg = fileErr instanceof Error ? fileErr.message : "Error desconocido";
              send({
                type: "log",
                message: `[AVISO] Error procesando ${pdf.name}: ${errMsg}`,
              });
            }
          }

          send({
            type: "log",
            message: `Cruzando información con ${leadsSourceDescription}...`,
          });

          const cruce = processCruceData(excelBuffer, extractedPdfs);
          const downloadFilename = generateCruceFilename();

          send({
            type: "done",
            kpis: cruce.kpis,
            records: cruce.records,
            excelBase64: Buffer.from(cruce.excelBuffer).toString("base64"),
            downloadFilename,
            message: `Cruce completado con éxito. ${cruce.kpis.coincidencias} coincidencias encontradas (${cruce.kpis.tasaCoincidencia}%).`,
          });

          controller.close();
        } catch (fatalErr) {
          const errMsg = fatalErr instanceof Error ? fatalErr.message : "Error fatal en el cruce";
          send({
            type: "error",
            error: errMsg,
          });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    console.error("[POST /api/admin/datacredito/cruce]", err);
    const message = err instanceof Error ? err.message : "Error procesando cruce de DataCrédito";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
