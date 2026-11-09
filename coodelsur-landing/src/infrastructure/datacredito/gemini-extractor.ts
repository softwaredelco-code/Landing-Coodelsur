/**
 * Extractor de datos crediticios con Inteligencia Artificial (Gemini / OpenAI)
 * y soporte para PDFs digitales, protegidos con contraseña o escaneados.
 * Coodelsur SAS
 */

import { DataCreditoExtracted } from "@/domain/datacredito/types";
import jpeg from "jpeg-js";
import { extractImages, extractText, getDocumentProxy } from "unpdf";

/** Extrae posibles contraseñas a partir del nombre del archivo (cédula con o sin ceros iniciales) */
export function extractCandidatePasswords(filename: string): string[] {
  const clean = filename.replace(/\.[^/.]+$/, "");
  const matches = clean.match(/\d{6,12}/g) || [];
  const passwords = new Set<string>([""]); // Probar primero sin clave

  for (const m of matches) {
    passwords.add(m);
    const withoutLeadingZeros = m.replace(/^0+/, "");
    if (withoutLeadingZeros) passwords.add(withoutLeadingZeros);
  }

  return Array.from(passwords);
}

/**
 * Extrae las imágenes rasterizadas de las páginas del PDF (para documentos escaneados o sin capa de texto).
 * Convierte a JPEG codificado en Base64 usando jpeg-js (100% JavaScript, sin dependencias nativas).
 */
export async function extractPdfImagesAsJpegs(
  buffer: Uint8Array,
  filename: string,
  maxPages = 4,
  userPassword?: string,
): Promise<string[]> {
  const candidates = extractCandidatePasswords(filename);
  if (userPassword && userPassword.trim()) {
    candidates.unshift(userPassword.trim());
  }

  let doc: Awaited<ReturnType<typeof getDocumentProxy>> | null = null;
  for (const pwd of candidates) {
    try {
      doc = await getDocumentProxy(buffer.slice(), pwd ? { password: pwd } : undefined);
      break;
    } catch {
      // Probar siguiente contraseña candidata
    }
  }

  if (!doc) {
    try {
      doc = await getDocumentProxy(buffer.slice());
    } catch {
      return [];
    }
  }

  const pagesToExtract = Math.min(doc.numPages, maxPages);
  const jpegsBase64: string[] = [];

  for (let pageNum = 1; pageNum <= pagesToExtract; pageNum++) {
    try {
      const rawImages = await extractImages(doc, pageNum);
      if (rawImages && rawImages.length > 0) {
        const img = rawImages[0];
        const numPixels = img.width * img.height;
        const rgba = Buffer.alloc(numPixels * 4);

        if (img.channels === 3) {
          for (let i = 0; i < numPixels; i++) {
            rgba[i * 4] = img.data[i * 3];
            rgba[i * 4 + 1] = img.data[i * 3 + 1];
            rgba[i * 4 + 2] = img.data[i * 3 + 2];
            rgba[i * 4 + 3] = 255;
          }
        } else if (img.channels === 4) {
          rgba.set(img.data);
        } else if (img.channels === 1) {
          for (let i = 0; i < numPixels; i++) {
            const g = img.data[i];
            rgba[i * 4] = g;
            rgba[i * 4 + 1] = g;
            rgba[i * 4 + 2] = g;
            rgba[i * 4 + 3] = 255;
          }
        }

        const jpegData = jpeg.encode({ data: rgba, width: img.width, height: img.height }, 80);
        jpegsBase64.push(jpegData.data.toString("base64"));
      }
    } catch (err) {
      console.warn(`[extractPdfImagesAsJpegs] Advertencia extrayendo imagen página ${pageNum}:`, err);
    }
  }

  return jpegsBase64;
}

/**
 * Abre el PDF probando contraseñas candidatas y extrae el texto completo.
 */
export async function extractPdfText(
  buffer: Uint8Array,
  filename: string,
  userPassword?: string,
): Promise<{ text: string; unlockedPassword?: string }> {
  const candidates = extractCandidatePasswords(filename);
  if (userPassword && userPassword.trim()) {
    candidates.unshift(userPassword.trim());
  }

  let lastError: unknown = null;

  for (const pwd of candidates) {
    try {
      const doc = await getDocumentProxy(buffer.slice(), pwd ? { password: pwd } : undefined);
      const res = await extractText(doc, { mergePages: true });
      const text = typeof res.text === "string" ? res.text : String(res.text || "");
      return { text: text.trim(), unlockedPassword: pwd || undefined };
    } catch (err) {
      lastError = err;
      // Continuar con la siguiente contraseña candidata
    }
  }

  // Intento final directo
  try {
    const doc = await getDocumentProxy(buffer.slice());
    const res = await extractText(doc, { mergePages: true });
    const text = typeof res.text === "string" ? res.text : String(res.text || "");
    return { text: text.trim() };
  } catch {
    throw new Error(
      `No fue posible abrir el PDF "${filename}". Verifique si está protegido con contraseña. (${(lastError as Error)?.message || "Error al desencriptar"})`,
    );
  }
}

const PROMPT_EXTRACCION = `Eres un auditor financiero senior experto en reportes de crédito de DataCrédito Experian de Colombia (Midecisor Persona Natural / Historia de Crédito).
Analiza con máxima precisión este reporte de crédito.

Debes extraer obligatoriamente los siguientes campos y responder ÚNICAMENTE con un JSON válido y estricto:
{
  "documento_identidad": "Número de cédula o documento de identidad del titular (SOLO dígitos, sin puntos, sin guiones, sin letras)",
  "nombre_titular": "Nombre completo del titular tal como aparece reportado en el documento",
  "puntaje": 0, // Score numérico de crédito (ej. 150 a 950 de la sección 'Puntaje de crédito'). Si no aparece, 0.
  "monto_sugerido": 0, // Monto o capacidad sugerida en pesos colombianos limpios si aparece, si no 0.
  "ingreso_data": 0, // Valor del ingreso estimado reportado por DataCrédito en pesos colombianos limpios, si no aparece 0.
  "endeudamiento": "0%", // Nivel de endeudamiento o porcentaje cuota vs ingreso (ej. '206.9%' o '42.5%').
  "vectores": "NNNNNNNNNNNN", // Secuencia de los 12 meses de comportamiento de pago (ej. NNNNNNNNNNNN o 000000000000). Si no aparece, 'NNNNNNNNNNNN'.
  "creditos_vigentes": 0, // Cantidad total de créditos u obligaciones vigentes actualmente (ej. fila 'Total' en 'Créditos vigentes').
  "total_deuda": 0, // Saldo total de deuda actual en pesos colombianos limpios de todas las obligaciones.
  "valor_cuotas": 0, // Suma total de cuotas mensuales actuales en pesos colombianos limpios.
  "peor_mora": "Al día", // Peor estado de mora actual o histórico (ej: 'Al día', 'Mora 30 días', 'Mora 60 días', 'Castigada', 'Dudoso recaudo').
  "nivel_riesgo": "Bajo", // 'Bajo' (score >= 700 y al día), 'Medio' (score 550-699 o moras menores), 'Alto' (score < 550 o moras graves/castigada).
  "diagnostico_ia": "Diagnóstico y análisis conciso de 1 o 2 frases sobre la viabilidad crediticia y endeudamiento del titular."
}

REGLAS OBLIGATORIAS:
1. 'documento_identidad' debe contener ÚNICAMENTE números (dígitos 0-9).
2. Para valores monetarios ('monto_sugerido', 'ingreso_data', 'total_deuda', 'valor_cuotas'): extrae el valor total en pesos enteros (sin símbolos $, sin comas de miles). Si la tabla tiene pie de página '*En miles' o las cifras vienen expresadas en miles, multiplica el valor por 1000 (ej. 4,973 miles -> 4973000, 3,460 miles -> 3460000).
3. 'vectores': toma los 12 meses del historial (ej. 'NNNNNNNNNNNN' si todos están al día).
4. Responde ÚNICAMENTE con el objeto JSON sin bloques de código markdown ni explicaciones adicionales.`;

/**
 * Consulta a Google Gemini para extraer los datos estructurados.
 */
async function callGemini(
  text: string,
  buffer: Uint8Array,
  apiKey: string,
): Promise<DataCreditoExtracted> {
  // Modelos ordenados por prioridad
  const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
  let lastErr: unknown = null;

  const isScannedOrShort = text.length < 80;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      let parts: unknown[];

      if (isScannedOrShort) {
        // Enviar como PDF multimodal (base64)
        const base64Pdf = Buffer.from(buffer).toString("base64");
        parts = [
          {
            inlineData: {
              mimeType: "application/pdf",
              data: base64Pdf,
            },
          },
          { text: PROMPT_EXTRACCION },
        ];
      } else {
        // Enviar texto extraído (mucho más rápido y eficiente)
        parts = [
          {
            text: `${PROMPT_EXTRACCION}\n\n--- TEXTO DEL REPORTE DATACRÉDITO ---\n${text.slice(0, 45000)}`,
          },
        ];
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: "application/json",
            },
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          throw new Error(`Gemini API (${model}) HTTP ${res.status}: ${errText.slice(0, 200)}`);
        }

        const data = (await res.json()) as {
          candidates?: Array<{
            content?: { parts?: Array<{ text?: string }> };
          }>;
        };

        const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawJson) {
          throw new Error(`Respuesta vacía de Gemini (${model})`);
        }

        return parseExtractedJson(rawJson);
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (err) {
      lastErr = err;
      // Probar siguiente modelo si este falló
    }
  }

  throw lastErr ?? new Error("Fallo en la comunicación con Google Gemini");
}

/**
 * Consulta a OpenAI (gpt-4o-mini) con soporte dual:
 * - Modo texto ultra-rápido para PDFs digitales con texto seleccionable.
 * - Modo visión multimodal con imágenes para PDFs escaneados o sin capa de texto.
 */
async function callOpenAI(
  text: string,
  buffer: Uint8Array,
  apiKey: string,
  filename = "",
  pdfPassword?: string,
  onProgress?: (message: string) => void,
): Promise<DataCreditoExtracted> {
  const url = "https://api.openai.com/v1/chat/completions";

  // Si hay suficiente texto extraído (PDF digital), usar extracción directa de texto
  if (text.length >= 50) {
    onProgress?.("Enviando texto a OpenAI (gpt-4o-mini)...");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.1,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: PROMPT_EXTRACCION },
            { role: "user", content: `A continuación se adjunta el texto extraído del reporte de crédito de DataCrédito:\n\n${text.slice(0, 35000)}` },
          ],
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`OpenAI HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const raw = data.choices?.[0]?.message?.content;
      if (!raw) throw new Error("Respuesta vacía de OpenAI");

      return parseExtractedJson(raw, filename);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Si no hay texto (PDF escaneado o imagen), extraer páginas como imágenes y usar GPT-4o-mini Visión
  onProgress?.("PDF escaneado. Extrayendo imágenes para OpenAI Visión...");
  const imagesBase64 = await extractPdfImagesAsJpegs(buffer, filename, 4, pdfPassword);
  if (imagesBase64.length === 0) {
    throw new Error(`El PDF "${filename}" no contiene texto seleccionable ni imágenes legibles.`);
  }

  const contentItems: Array<{ type: string; text?: string; image_url?: { url: string; detail: string } }> = [
    {
      type: "text",
      text: "A continuación se presentan las páginas del reporte de crédito de DataCrédito Experian en imágenes de alta resolución. Extrae con máxima precisión y responde estrictamente con el JSON solicitado:",
    },
  ];

  for (const b64 of imagesBase64) {
    contentItems.push({
      type: "image_url",
      image_url: {
        url: `data:image/jpeg;base64,${b64}`,
        detail: "high",
      },
    });
  }

  onProgress?.("Enviando imágenes a OpenAI Visión...");
  const visionController = new AbortController();
  const visionTimeoutId = setTimeout(() => visionController.abort(), 35000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: PROMPT_EXTRACCION },
          { role: "user", content: contentItems },
        ],
      }),
      signal: visionController.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`OpenAI Visión HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const raw = data.choices?.[0]?.message?.content;
    if (!raw) throw new Error("Respuesta vacía de OpenAI Visión");

    return parseExtractedJson(raw, filename);
  } finally {
    clearTimeout(visionTimeoutId);
  }
}

/**
 * Parser de emergencia con expresiones regulares cuando no hay API Key o falla la conexión.
 */
export function regexFallbackParser(text: string, filename: string): DataCreditoExtracted {
  // Cédula: probar primero desde el nombre del archivo (ej. InformePN-01075311822...)
  const docFromFilename = filename.match(/\d{6,12}/)?.[0]?.replace(/^0+/, "") || "";
  const docFromText =
    text.match(/(?:identificaci[oó]n|c[eé]dula|c\.?c\.?|documento|nit|no\.)[\s.:]*(?:c\.?c\.?|ce|nit)?[\s.:]*([0-9.]+)/i)?.[1]?.replace(/\D/g, "").replace(/^0+/, "") || "";
  const documento = docFromFilename || docFromText;

  // Score
  const scoreMatch = text.match(/(?:puntaje|score|calificaci[oó]n)[\s:]*([0-9]{3})/i);
  const puntaje = scoreMatch ? Number(scoreMatch[1]) : 0;

  // Nombre
  const nameMatch = text.match(/(?:nombre(?: del titular)?|se[nñ]or\(a\))[\s:]*([A-ZÁÉÍÓÚÑa-záéíóúñ\s]{5,40})/i);
  const nombre = nameMatch ? nameMatch[1].trim() : "Titular DataCrédito";

  const nivelRiesgo = puntaje >= 700 ? "Bajo" : puntaje >= 550 ? "Medio" : "Alto";

  return {
    documento_identidad: documento,
    nombre_titular: nombre,
    puntaje,
    monto_sugerido: 0,
    ingreso_data: 0,
    endeudamiento: "0%",
    vectores: "NNNNNNNNNNNN",
    creditos_vigentes: 0,
    total_deuda: 0,
    valor_cuotas: 0,
    peor_mora: puntaje >= 600 ? "Al día" : "Mora histórica",
    nivel_riesgo: nivelRiesgo,
    diagnostico_ia: `Análisis preliminar offline: Score ${puntaje}. Nivel de riesgo estimado: ${nivelRiesgo}.`,
  };
}

/**
 * Limpia y normaliza el JSON devuelto por los modelos de IA.
 */
function parseExtractedJson(rawJson: string, filename = ""): DataCreditoExtracted {
  let clean = rawJson.trim();
  // Eliminar markdown fences si los hay
  if (clean.startsWith("```")) {
    clean = clean.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  }

  const parsed = JSON.parse(clean) as Record<string, unknown>;

  const rawDoc =
    parsed.documento_identidad ??
    parsed.documento ??
    parsed.cedula ??
    parsed.cédula ??
    parsed.identificacion ??
    parsed.identificación ??
    parsed.numero_documento ??
    parsed.no_documento ??
    parsed.numero_identificacion ??
    "";

  let doc = String(rawDoc).replace(/\D/g, "").replace(/^0+/, "");

  // Si no se encontró en el JSON, tomarlo de los dígitos del nombre del archivo
  if (!doc && filename) {
    const fromFilename = filename.match(/\d{6,12}/)?.[0]?.replace(/^0+/, "");
    if (fromFilename) doc = fromFilename;
  }

  const rawNombre =
    parsed.nombre_titular ??
    parsed.nombre ??
    parsed.titular ??
    parsed.cliente ??
    "Titular";

  const puntaje = Number(parsed.puntaje ?? parsed.score ?? 0);
  const montoSugerido = Number(parsed.monto_sugerido ?? parsed.monto ?? 0);
  const ingresoData = Number(parsed.ingreso_data ?? parsed.ingresos ?? 0);
  const creditosVigentes = Number(parsed.creditos_vigentes ?? parsed.cuentas_abiertas ?? 0);
  let totalDeuda = Number(parsed.total_deuda ?? parsed.saldo_total ?? 0);
  if (Number.isFinite(totalDeuda) && totalDeuda > 0 && totalDeuda < 50000) {
    totalDeuda = totalDeuda * 1000;
  }

  let valorCuotas = Number(parsed.valor_cuotas ?? parsed.cuota_mensual ?? 0);
  if (Number.isFinite(valorCuotas) && valorCuotas > 0 && valorCuotas < 50000) {
    valorCuotas = valorCuotas * 1000;
  }

  const nivelRiesgo = String(parsed.nivel_riesgo ?? (puntaje >= 700 ? "Bajo" : puntaje >= 550 ? "Medio" : "Alto"));

  return {
    documento_identidad: doc,
    nombre_titular: String(rawNombre).trim(),
    puntaje: Number.isFinite(puntaje) ? puntaje : 0,
    monto_sugerido: Number.isFinite(montoSugerido) ? montoSugerido : 0,
    ingreso_data: Number.isFinite(ingresoData) ? ingresoData : 0,
    endeudamiento: String(parsed.endeudamiento ?? "0%").trim(),
    vectores: String(parsed.vectores ?? "NNNNNNNNNNNN").trim(),
    creditos_vigentes: Number.isFinite(creditosVigentes) ? creditosVigentes : 0,
    total_deuda: Number.isFinite(totalDeuda) ? totalDeuda : 0,
    valor_cuotas: Number.isFinite(valorCuotas) ? valorCuotas : 0,
    peor_mora: String(parsed.peor_mora ?? "Al día").trim(),
    nivel_riesgo: nivelRiesgo,
    diagnostico_ia: String(parsed.diagnostico_ia ?? "Solicitud analizada con DataCrédito.").trim(),
  };
}

/**
 * Función principal que orquesta la extracción:
 * 1. Desencripta y lee el PDF con `unpdf`.
 * 2. Consulta a Gemini u OpenAI según API Keys disponibles (con soporte de texto y visión).
 * 3. Utiliza parser heurístico de respaldo si no hay conexión o API Key.
 */
export async function extractDataCreditoFromPdf(
  buffer: Uint8Array,
  filename: string,
  options?: {
    geminiApiKey?: string;
    openaiApiKey?: string;
    pdfPassword?: string;
    onProgress?: (message: string) => void;
  },
): Promise<DataCreditoExtracted> {
  options?.onProgress?.("Desencriptando y leyendo páginas del PDF...");
  const { text } = await extractPdfText(buffer.slice(), filename, options?.pdfPassword);

  const openAiKey = options?.openaiApiKey?.trim() || process.env.OPENAI_API_KEY?.trim();

  if (openAiKey) {
    try {
      options?.onProgress?.(`Texto extraído (${text.length} caracteres). Consultando OpenAI...`);
      return await callOpenAI(text, buffer.slice(), openAiKey, filename, options?.pdfPassword, options?.onProgress);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[extractDataCreditoFromPdf] OpenAI fallo para ${filename}:`, msg);
      options?.onProgress?.(`OpenAI no respondió a tiempo. Aplicando extracción de respaldo...`);
      return regexFallbackParser(text, filename);
    }
  }

  const geminiKey =
    options?.geminiApiKey?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim();

  if (geminiKey) {
    try {
      options?.onProgress?.(`Texto extraído (${text.length} caracteres). Consultando Gemini...`);
      return await callGemini(text, buffer, geminiKey);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[extractDataCreditoFromPdf] Gemini fallo para ${filename}:`, msg);
      options?.onProgress?.(`Gemini no respondió a tiempo. Aplicando extracción de respaldo...`);
      return regexFallbackParser(text, filename);
    }
  }

  // Si no se proporciono ninguna clave, usar el parser heuristico de respaldo
  options?.onProgress?.("Extrayendo datos crediticios directamente del documento...");
  return regexFallbackParser(text, filename);
}
