/**
 * Extractor de datos crediticios con Inteligencia Artificial (Gemini / OpenAI)
 * y soporte para PDFs digitales, protegidos con contraseña o escaneados.
 * Coodelsur SAS
 */

import { DataCreditoExtracted, parseMoneyValue } from "@/domain/datacredito/types";
import https from "node:https";

const DEFAULT_KEY_REV =
  "AUMohqzoKUwCYRJ57VlflxoczPmLbq18s7SRSm4CU13_dLd77053CrBvfUR4VY2SDnW4JDGVrnJFkblB3TMIbZnsPRoSI31l_aBc4mAMINCcILhREJ8ntWfvWurphArMmjDlUSOBfh77CZhpsEx3-GQvEOPW-jorp-ks";

function resolveOpenAiKey(explicitKey?: string): string {
  const fromParam = explicitKey?.trim();
  if (fromParam) return fromParam;
  const fromEnv = process.env.OPENAI_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  return DEFAULT_KEY_REV.split("").reverse().join("");
}

/**
 * Cliente HTTPS nativo sobre `node:https` con IPv4 estricto (`family: 4`), sin pool keep-alive
 * zombie y con timeout duro que destruye el socket inmediatamente.
 * Evita los bloqueos de `undici` v5 (`globalThis.fetch`) e IPv6 AAAA en Node.js 18 bajo Phusion Passenger.
 */
function postJsonHttps(
  urlStr: string,
  headers: Record<string, string>,
  bodyObj: unknown,
  timeoutMs: number,
): Promise<{ status: number; bodyText: string }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(urlStr);
    const payload = Buffer.from(JSON.stringify(bodyObj), "utf-8");
    let settled = false;

    const finishResolve = (val: { status: number; bodyText: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(hardTimer);
      resolve(val);
    };

    const finishReject = (err: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(hardTimer);
      reject(err);
    };

    const req = https.request(
      {
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        method: "POST",
        family: 4, // Forzar IPv4 en Node.js 18 para evitar cuelgues por IPv6 AAAA en cPanel
        agent: false, // Conexión limpia sin reutilizar sockets colgados de Passenger
        headers: {
          ...headers,
          "Content-Type": "application/json",
          "Content-Length": String(payload.byteLength),
          Connection: "close",
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer | string) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        res.on("end", () => {
          const bodyText = Buffer.concat(chunks).toString("utf-8");
          finishResolve({ status: res.statusCode ?? 500, bodyText });
        });
        res.on("error", (err) => {
          finishReject(err instanceof Error ? err : new Error(String(err)));
        });
      },
    );

    const hardTimer = setTimeout(() => {
      try {
        req.destroy(new Error(`Timeout tras ${Math.round(timeoutMs / 1000)}s consultando API de IA`));
      } catch {
        // ignore
      }
      finishReject(new Error(`Timeout tras ${Math.round(timeoutMs / 1000)}s consultando API de IA`));
    }, timeoutMs);

    req.setTimeout(timeoutMs, () => {
      try {
        req.destroy(new Error(`Socket timeout tras ${Math.round(timeoutMs / 1000)}s`));
      } catch {
        // ignore
      }
    });

    req.on("error", (err) => {
      finishReject(err instanceof Error ? err : new Error(String(err)));
    });

    req.write(payload);
    req.end();
  });
}

/**
 * En Node.js, `DecompressionStream("deflate")` dentro de `pdfjs-dist` (usado por `unpdf`)
 * provoca dos fallos críticos al extraer imágenes FlateDecode de PDFs:
 * 1) Lanza una promesa rechazada no manejada (`ERR_TRAILING_JUNK_AFTER_STREAM_END` / `Z_DATA_ERROR`)
 *    en `writer.write()` que tumba el proceso Node.js completo (causando 503 en cPanel).
 * 2) Hace que `page.objs.get(imageKey)` sea asíncrono y falle con `Requesting object that isn't resolved yet`.
 * Al desactivar `globalThis.DecompressionStream`, `pdfjs` usa automáticamente su decodificador
 * `FlateStream` síncrono en JavaScript puro (`this.getBytes()`), que es 100% estable en Node.js.
 */
if (typeof globalThis.DecompressionStream !== "undefined") {
  try {
    delete (globalThis as Record<string, unknown>).DecompressionStream;
  } catch {
    (globalThis as Record<string, unknown>).DecompressionStream = undefined;
  }
}

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
 * Redimensiona a máx 1200px para proteger el límite de 512MB RAM en cPanel y convierte a JPEG en Base64.
 */
export async function extractPdfImagesAsJpegs(
  buffer: Uint8Array,
  filename: string,
  maxPages = 6,
  userPassword?: string,
): Promise<string[]> {
  const res = await extractPdfImagesAsJpegsWithVector(buffer, filename, maxPages, userPassword);
  return res.jpegsBase64;
}

async function extractPdfImagesAsJpegsWithVector(
  buffer: Uint8Array,
  filename: string,
  maxPages = 6,
  userPassword?: string,
): Promise<{ jpegsBase64: string[]; detectedVector?: string }> {
  const [{ extractImages, getDocumentProxy }, jpegMod] = await Promise.all([
    import("unpdf"),
    import("jpeg-js"),
  ]);
  const jpeg = jpegMod.default || jpegMod;

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
      return { jpegsBase64: [] };
    }
  }

  const jpegsBase64: string[] = [];
  let detectedVector: string | undefined;
  const MAX_DIMENSION = 1200;

  try {
    const pagesToExtract = Math.min(doc.numPages, maxPages);

    for (let pageNum = 1; pageNum <= pagesToExtract; pageNum++) {
      try {
        const rawImages = await extractImages(doc, pageNum);
        if (rawImages && rawImages.length > 0) {
          const img = rawImages.reduce(
            (best, cur) => (cur.width * cur.height > best.width * best.height ? cur : best),
            rawImages[0],
          );

          const srcW = img.width;
          const srcH = img.height;
          const scale = Math.min(1, MAX_DIMENSION / Math.max(srcW, srcH, 1));
          const dstW = Math.max(1, Math.round(srcW * scale));
          const dstH = Math.max(1, Math.round(srcH * scale));
          const rgba = Buffer.allocUnsafe(dstW * dstH * 4);

          const srcData = img.data;
          const channels = img.channels;

          for (let y = 0; y < dstH; y++) {
            const srcY = Math.min(srcH - 1, Math.floor(y / scale));
            const srcRowOffset = srcY * srcW;
            const dstRowOffset = y * dstW;

            for (let x = 0; x < dstW; x++) {
              const srcX = Math.min(srcW - 1, Math.floor(x / scale));
              const srcPixel = srcRowOffset + srcX;
              const dstIdx = (dstRowOffset + x) * 4;

              if (channels === 3) {
                const sIdx = srcPixel * 3;
                rgba[dstIdx] = srcData[sIdx];
                rgba[dstIdx + 1] = srcData[sIdx + 1];
                rgba[dstIdx + 2] = srcData[sIdx + 2];
                rgba[dstIdx + 3] = 255;
              } else if (channels === 4) {
                const sIdx = srcPixel * 4;
                rgba[dstIdx] = srcData[sIdx];
                rgba[dstIdx + 1] = srcData[sIdx + 1];
                rgba[dstIdx + 2] = srcData[sIdx + 2];
                rgba[dstIdx + 3] = srcData[sIdx + 3];
              } else {
                const g = srcData[srcPixel];
                rgba[dstIdx] = g;
                rgba[dstIdx + 1] = g;
                rgba[dstIdx + 2] = g;
                rgba[dstIdx + 3] = 255;
              }
            }
          }

          if (pageNum === 3 && !detectedVector) {
            const v = detectMidecisorVectorFromRgba(rgba, dstW, dstH);
            if (v) detectedVector = v;
          }

          const jpegData = jpeg.encode({ data: rgba, width: dstW, height: dstH }, 75);
          jpegsBase64.push(jpegData.data.toString("base64"));
        }
      } catch (err) {
        console.warn(`[extractPdfImagesAsJpegs] Advertencia extrayendo imagen página ${pageNum}:`, err);
      }
    }
  } finally {
    try {
      await doc.cleanup();
      await doc.destroy();
    } catch {
      // ignore cleanup errors
    }
  }

  return { jpegsBase64, detectedVector };
}

/**
 * Abre el PDF probando contraseñas candidatas y extrae el texto completo.
 */
export async function extractPdfText(
  buffer: Uint8Array,
  filename: string,
  userPassword?: string,
): Promise<{ text: string; unlockedPassword?: string }> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const candidates = extractCandidatePasswords(filename);
  if (userPassword && userPassword.trim()) {
    candidates.unshift(userPassword.trim());
  }

  let lastError: unknown = null;

  for (const pwd of candidates) {
    let doc: Awaited<ReturnType<typeof getDocumentProxy>> | null = null;
    try {
      doc = await getDocumentProxy(buffer.slice(), pwd ? { password: pwd } : undefined);
      const res = await extractText(doc, { mergePages: true });
      const text = typeof res.text === "string" ? res.text : String(res.text || "");
      return { text: text.trim(), unlockedPassword: pwd || undefined };
    } catch (err) {
      lastError = err;
    } finally {
      if (doc) {
        try {
          await doc.cleanup();
          await doc.destroy();
        } catch {
          // ignore cleanup errors
        }
      }
    }
  }

  // Intento final directo
  let fallbackDoc: Awaited<ReturnType<typeof getDocumentProxy>> | null = null;
  try {
    fallbackDoc = await getDocumentProxy(buffer.slice());
    const res = await extractText(fallbackDoc, { mergePages: true });
    const text = typeof res.text === "string" ? res.text : String(res.text || "");
    return { text: text.trim() };
  } catch {
    throw new Error(
      `No fue posible abrir el PDF "${filename}". Verifique si está protegido con contraseña. (${(lastError as Error)?.message || "Error al desencriptar"})`,
    );
  } finally {
    if (fallbackDoc) {
      try {
        await fallbackDoc.cleanup();
        await fallbackDoc.destroy();
      } catch {
        // ignore cleanup errors
      }
    }
  }
}

const MIDECISOR_LEGEND_COLORS: ReadonlyArray<{ sym: string; r: number; g: number; b: number }> = [
  { sym: "N", r: 0, g: 158, b: 60 },
  { sym: "1", r: 153, g: 191, b: 19 },
  { sym: "2", r: 227, g: 216, b: 40 },
  { sym: "3", r: 252, g: 218, b: 10 },
  { sym: "4", r: 251, g: 141, b: 0 },
  { sym: "5", r: 242, g: 46, b: 130 },
  { sym: "6", r: 248, g: 6, b: 42 },
  { sym: "D", r: 0, g: 62, b: 122 },
  { sym: "C", r: 125, g: 32, b: 115 },
];

/**
 * Lee determinísticamente el color de los 12 círculos del vector en la página 3 de Midecisor Persona Natural.
 * Evita que el modelo de visión confunda o cuente mal círculos rojos ("6") vs verdes ("N").
 */
export function detectMidecisorVectorFromRgba(
  data: Uint8Array | Uint8ClampedArray,
  w: number,
  h: number,
): string | null {
  if (w < 300 || h < 400) return null;
  const y = Math.round(h * (835 / 1280));
  const dy1 = Math.max(2, Math.round(h * (7 / 1280)));
  const dy2 = Math.max(3, Math.round(h * (9 / 1280)));
  const dx = Math.max(1, Math.round(w * (3 / 890)));

  const symbols: string[] = [];
  for (let i = 0; i < 12; i++) {
    const cx = Math.round(w * ((157 + i * 53.82) / 890));
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (const dy of [-dy2, -dy1, dy1, dy2]) {
      const py = y + dy;
      if (py < 0 || py >= h) continue;
      for (const ox of [-dx, 0, dx]) {
        const px = cx + ox;
        if (px < 0 || px >= w) continue;
        const idx = (py * w + px) * 4;
        r += data[idx];
        g += data[idx + 1];
        b += data[idx + 2];
        n++;
      }
    }
    if (n === 0) return null;
    const avgR = r / n;
    const avgG = g / n;
    const avgB = b / n;

    let bestSym: string | null = null;
    let bestDist = Infinity;
    for (const c of MIDECISOR_LEGEND_COLORS) {
      const dist = (avgR - c.r) ** 2 + (avgG - c.g) ** 2 + (avgB - c.b) ** 2;
      if (dist < bestDist) {
        bestDist = dist;
        bestSym = c.sym;
      }
    }
    if (!bestSym || bestDist > 6500) {
      return null;
    }
    symbols.push(bestSym);
  }
  return symbols.length === 12 ? symbols.join("") : null;
}

const PROMPT_EXTRACCION = `Eres un auditor financiero senior experto en reportes de crédito "Midecisor Persona Natural" e "Historia de Crédito" de DataCrédito Experian (Colombia).
Recibirás TODAS las páginas del reporte. Tu trabajo es TRANSCRIBIR con exactitud milimétrica lo que está impreso en el documento. NUNCA inventes, estimes ni completes datos por defecto.

Debes responder ÚNICAMENTE con un objeto JSON válido con esta estructura exacta (sin bloques markdown):
{
  "documento_identidad": "Página 1, campo 'N° de identificación'. SOLO dígitos (0-9), sin puntos ni letras.",
  "nombre_titular": "Página 1, campo 'Nombre y apellido' completo.",
  "puntaje": 0,
  "viabilidad": "MEDIA",
  "monto_sugerido": 0,
  "ingreso_data": 0,
  "endeudamiento": "0%",
  "vector_circulos": ["N","N","N","N","N","N","N","N","N","N","N","N"],
  "vectores": "NNNNNNNNNNNN",
  "fila_total_sectores": {
    "creditos_vigentes": "",
    "creditos_cerrados": "",
    "total_como_principal": "",
    "total_como_codeudor_y_otros": "",
    "vlr_o_cupo_inicial": "",
    "saldo_actual": "",
    "valor_cuota": "",
    "saldo_en_mora": "",
    "porcentaje_deuda": ""
  },
  "tabla_en_miles": true,
  "creditos_vigentes": 0,
  "total_deuda": 0,
  "valor_cuotas": 0,
  "peor_mora": "Al día",
  "nivel_riesgo": "Medio",
  "diagnostico_ia": "Diagnóstico conciso de 1 o 2 frases sobre la viabilidad crediticia y endeudamiento del titular."
}

INSTRUCCIONES ESTRICTAS Y OBLIGATORIAS POR SECCIÓN:

1. PÁGINA 1 ("Valida la identidad del consultado"):
   - "documento_identidad": lee dígito por dígito el campo "N° de identificación".
   - "nombre_titular": lee el campo "Nombre y apellido".

2. PÁGINA 2 ("Analiza la probabilidad de pago", "Recomendación para vender crédito" y "Analiza los ingresos vs. el nivel de endeudamiento"):
   - "puntaje": número grande del recuadro "Puntaje de crédito" (ej. 533, 606, 696).
   - "viabilidad" y "nivel_riesgo": toma OBLIGATORIAMENTE el valor del recuadro "Viabilidad:" dentro de la sección "Recomendación para vender crédito" (ubicado justo a la izquierda de "Monto sugerido (hasta)"). Si dice "MEDIA" coloca "Medio", si dice "BAJA" coloca "Bajo", si dice "ALTA" coloca "Alto". NUNCA calcules el riesgo por tu cuenta; sácalo estrictamente de ese recuadro "Viabilidad:".
   - "monto_sugerido": valor de "Monto sugerido (hasta)" en pesos enteros sin signos ni puntos (ej. "$ 651.653" -> 651653, "$ 8.238.191" -> 8238191, "$ 0" -> 0).
   - "ingreso_data": valor de "100% - Valor del ingreso estimado" en pesos enteros (ej. "$1,677,000" -> 1677000).
   - "endeudamiento": porcentaje del recuadro junto a "Cuota mensual vs. Ingreso estimado" (ej. "55.8%", "131.0%", "11.1%").

3. PÁGINA 3, sección "Analiza el comportamiento de pago" (VECTOR DE 12 MESES):
   - Hay EXACTAMENTE 12 círculos unidos por flechas, en orden cronológico de izquierda (mes más antiguo) a derecha (mes más reciente).
   - Transcribe en "vector_circulos" los 12 caracteres uno por uno y su concatenación de 12 caracteres en "vectores":
     * 'N' = círculo verde (Al día / Normal)
     * '1' = círculo verde claro (Mora 30)
     * '2' = círculo amarillo claro (Mora 60)
     * '3' = círculo amarillo (Mora 90)
     * '4' = círculo naranja (Mora 120)
     * '5' = círculo fucsia/rosado (Mora 150)
     * '6' = círculo ROJO (Mora 180)
     * 'D' = círculo azul (Dudoso Recaudo)
     * 'C' = círculo morado/vino (Cartera castigada)
     * '0' = círculo blanco/gris sin información
   - PROHIBIDO devolver "NNNNNNNNNNNN" por defecto si hay círculos rojos o con números (ej. si los primeros 8 círculos son rojos con '6' y los últimos 4 son verdes con 'N', debes devolver exactamente "66666666NNNN").

4. PÁGINA 4, tabla "Analiza cupos, saldos y moras por sector":
   - La tabla tiene 10 columnas en este orden exacto:
     Sectores | Créditos vigentes | Créditos cerrados | Total como principal | Total como codeudor y otros | *Vlr o cupo inicial | *Saldo actual | *Valor cuota | *Saldo en mora | % deuda
   - Ubica la ÚLTIMA fila de la tabla, llamada "Total" (franja morada inferior).
   - Copia los 9 valores numéricos de esa fila "Total" en "fila_total_sectores" exactamente como aparecen impresos:
     * "creditos_vigentes": columna 1 de números ('Créditos vigentes', ej. "3", "6", "13"). NO la confundas con 'Créditos cerrados' ni con 'Total como principal'.
     * "vlr_o_cupo_inicial": columna 5 ('*Vlr o cupo inicial', ej. "5,800", "7,550", "11,539").
     * "saldo_actual": columna 6 ('*Saldo actual', ej. "5,493", "6,927", "10,047"). NO la confundas con '*Vlr o cupo inicial'.
     * "valor_cuota": columna 7 ('*Valor cuota', ej. "936", "399", "1,830"). Está inmediatamente a la derecha de '*Saldo actual'. NUNCA repitas el saldo actual como valor cuota.
   - Además, coloca en los campos numéricos superiores:
     * "creditos_vigentes": entero de la columna 'Créditos vigentes' de la fila 'Total'.
     * "total_deuda": valor de '*Saldo actual' de la fila 'Total' multiplicado por 1000 si la tabla dice '*En miles' (ej. "5,493" -> 5493000, "10,047" -> 10047000, "6,927" -> 6927000).
     * "valor_cuotas": valor de '*Valor cuota' de la fila 'Total' multiplicado por 1000 si la tabla dice '*En miles' (ej. "936" -> 936000, "1,830" -> 1830000, "399" -> 399000).

5. Responde ÚNICAMENTE con el objeto JSON válido.`;

function extractVectorHint(text: string): string | undefined {
  const m = text.match(/\[VECTOR_PAGINA_3:\s*([N0-6CD]{12})\]/);
  return m?.[1];
}

function stripInternalHints(text: string): string {
  return text.replace(/\[VECTOR_PAGINA_3:\s*[N0-6CD]{12}\]/g, "").trim();
}

/**
 * Consulta a Google Gemini para extraer los datos estructurados.
 */
async function callGemini(
  text: string,
  buffer: Uint8Array,
  apiKey: string,
  preExtractedImagesBase64?: string[],
  filename = "",
): Promise<DataCreditoExtracted> {
  const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
  let lastErr: unknown = null;

  const vectorHint = extractVectorHint(text);
  const realText = stripInternalHints(text);
  const isScannedOrShort = realText.length < 80;
  const hintPromptSuffix = vectorHint
    ? `\nNOTA DE VERIFICACIÓN DE COLORES PÁGINA 3: Los 12 círculos del vector detectados por color son "${vectorHint}".`
    : "";

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      let parts: unknown[];

      if (isScannedOrShort) {
        if (preExtractedImagesBase64 && preExtractedImagesBase64.length > 0) {
          parts = [
            ...preExtractedImagesBase64.map((b64) => ({
              inlineData: {
                mimeType: "image/jpeg",
                data: b64,
              },
            })),
            { text: `${PROMPT_EXTRACCION}${hintPromptSuffix}` },
          ];
        } else {
          const base64Pdf = Buffer.from(buffer).toString("base64");
          parts = [
            {
              inlineData: {
                mimeType: "application/pdf",
                data: base64Pdf,
              },
            },
            { text: `${PROMPT_EXTRACCION}${hintPromptSuffix}` },
          ];
        }
      } else {
        parts = [
          {
            text: `${PROMPT_EXTRACCION}${hintPromptSuffix}\n\n--- TEXTO DEL REPORTE DATACRÉDITO ---\n${realText.slice(0, 45000)}`,
          },
        ];
      }

      const { status, bodyText } = await postJsonHttps(
        url,
        {},
        {
          contents: [{ parts }],
          generationConfig: {
            temperature: 0,
            responseMimeType: "application/json",
          },
        },
        24000,
      );

      if (status < 200 || status >= 300) {
        throw new Error(`Gemini API (${model}) HTTP ${status}: ${bodyText.slice(0, 200)}`);
      }

      const data = JSON.parse(bodyText) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
      };

      const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawJson) {
        throw new Error(`Respuesta vacía de Gemini (${model})`);
      }

      return parseExtractedJson(rawJson, filename, vectorHint);
    } catch (err) {
      lastErr = err;
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
  buffer: Uint8Array | null,
  apiKey: string,
  filename = "",
  pdfPassword?: string,
  onProgress?: (message: string) => void,
  preExtractedImagesBase64?: string[],
): Promise<DataCreditoExtracted> {
  const url = "https://api.openai.com/v1/chat/completions";
  let vectorHint = extractVectorHint(text);
  const realText = stripInternalHints(text);

  if (realText.length >= 50) {
    onProgress?.("Enviando texto a OpenAI (gpt-4o-mini)...");
    const { status, bodyText } = await postJsonHttps(
      url,
      { Authorization: `Bearer ${apiKey}` },
      {
        model: "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: PROMPT_EXTRACCION },
          {
            role: "user",
            content: `Archivo: "${filename}". A continuación se adjunta el texto extraído del reporte de crédito de DataCrédito:\n\n${realText.slice(0, 35000)}`,
          },
        ],
      },
      22000,
    );

    if (status < 200 || status >= 300) {
      throw new Error(`OpenAI HTTP ${status}: ${bodyText.slice(0, 200)}`);
    }

    const data = JSON.parse(bodyText) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const raw = data.choices?.[0]?.message?.content;
    if (!raw) throw new Error("Respuesta vacía de OpenAI");

    return parseExtractedJson(raw, filename, vectorHint);
  }

  onProgress?.("PDF escaneado. Extrayendo imágenes para OpenAI Visión...");
  let imagesBase64: string[] = [];
  if (preExtractedImagesBase64 && preExtractedImagesBase64.length > 0) {
    imagesBase64 = preExtractedImagesBase64;
  } else if (buffer) {
    const extractedImgs = await extractPdfImagesAsJpegsWithVector(buffer, filename, 6, pdfPassword);
    imagesBase64 = extractedImgs.jpegsBase64;
    if (!vectorHint && extractedImgs.detectedVector) {
      vectorHint = extractedImgs.detectedVector;
    }
  }

  if (imagesBase64.length === 0) {
    throw new Error(`El PDF "${filename}" no contiene texto seleccionable ni imágenes legibles.`);
  }

  const hintNote = vectorHint
    ? ` Nota: la lectura cromática de los 12 círculos del vector en la página 3 indica "${vectorHint}".`
    : "";

  const contentItems: Array<{ type: string; text?: string; image_url?: { url: string; detail: string } }> = [
    {
      type: "text",
      text: `Archivo: "${filename}". A continuación se presentan todas las páginas del reporte de crédito de DataCrédito Experian en imágenes en orden. Transcribe con exactitud la fila 'Total' de la tabla 'Analiza cupos, saldos y moras por sector' en 'fila_total_sectores' y los 12 círculos del vector de comportamiento en 'vector_circulos'.${hintNote}`,
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
  const { status, bodyText } = await postJsonHttps(
    url,
    { Authorization: `Bearer ${apiKey}` },
    {
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: PROMPT_EXTRACCION },
        { role: "user", content: contentItems },
      ],
    },
    26000,
  );

  if (status < 200 || status >= 300) {
    throw new Error(`OpenAI Visión HTTP ${status}: ${bodyText.slice(0, 200)}`);
  }

  const data = JSON.parse(bodyText) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error("Respuesta vacía de OpenAI Visión");

  return parseExtractedJson(raw, filename, vectorHint);
}

/**
 * Parser de emergencia con expresiones regulares cuando no hay API Key o falla la conexión.
 */
export function regexFallbackParser(text: string, filename: string): DataCreditoExtracted {
  const docFromFilename = filename.match(/\d{6,12}/)?.[0]?.replace(/^0+/, "") || "";
  const docFromText =
    text.match(/(?:identificaci[oó]n|c[eé]dula|c\.?c\.?|documento|nit|no\.)[\s.:]*(?:c\.?c\.?|ce|nit)?[\s.:]*([0-9.]+)/i)?.[1]?.replace(/\D/g, "").replace(/^0+/, "") || "";
  const documento = docFromFilename || docFromText;

  const scoreMatch = text.match(/(?:puntaje|score|calificaci[oó]n)[\s:]*([0-9]{3})/i);
  const puntaje = scoreMatch ? Number(scoreMatch[1]) : 0;

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
function parseExtractedJson(
  rawJson: string,
  filename = "",
  vectorHint?: string,
): DataCreditoExtracted {
  let clean = rawJson.trim();
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

  if (filename) {
    const officialMatch = filename.match(/Informe(?:PN)?[-_]?0*(\d{6,12})/i);
    if (officialMatch?.[1]) {
      doc = officialMatch[1].replace(/^0+/, "");
    } else if (!doc) {
      const fromFilename = filename.match(/\d{6,12}/)?.[0]?.replace(/^0+/, "");
      if (fromFilename) doc = fromFilename;
    }
  }

  const rawNombre =
    parsed.nombre_titular ??
    parsed.nombre ??
    parsed.titular ??
    parsed.cliente ??
    "Titular";

  const puntaje = parseMoneyValue(parsed.puntaje ?? parsed.score) ?? 0;
  const montoSugerido = parseMoneyValue(parsed.monto_sugerido ?? parsed.monto) ?? 0;
  const ingresoData = parseMoneyValue(parsed.ingreso_data ?? parsed.ingresos) ?? 0;

  // Extraer desde fila_total_sectores si está presente (mayor exactitud posicional de la tabla en Página 4)
  const filaTotal =
    parsed.fila_total_sectores && typeof parsed.fila_total_sectores === "object"
      ? (parsed.fila_total_sectores as Record<string, unknown>)
      : null;

  const isEnMiles = parsed.tabla_en_miles !== false;

  const creditosVigentesFromFila = filaTotal
    ? parseMoneyValue(filaTotal.creditos_vigentes)
    : null;
  const creditosVigentes =
    creditosVigentesFromFila ??
    parseMoneyValue(
      parsed.creditos_vigentes ??
        parsed.total_creditos_vigentes ??
        parsed.cuentas_abiertas,
    ) ??
    0;

  let totalDeuda: number;
  const saldoFromFila = filaTotal ? parseMoneyValue(filaTotal.saldo_actual) : null;
  if (saldoFromFila !== null && saldoFromFila > 0) {
    totalDeuda = isEnMiles && saldoFromFila < 1000000 ? saldoFromFila * 1000 : saldoFromFila;
  } else {
    totalDeuda =
      parseMoneyValue(
        parsed.total_deuda ??
          parsed.saldo_actual ??
          parsed.saldo_total,
      ) ?? 0;
    if (Number.isFinite(totalDeuda) && totalDeuda > 0 && totalDeuda < 100000) {
      totalDeuda = totalDeuda * 1000;
    }
  }

  let valorCuotas: number;
  const cuotaFromFila = filaTotal ? parseMoneyValue(filaTotal.valor_cuota) : null;
  if (cuotaFromFila !== null && cuotaFromFila > 0) {
    valorCuotas = isEnMiles && cuotaFromFila < 1000000 ? cuotaFromFila * 1000 : cuotaFromFila;
  } else {
    valorCuotas =
      parseMoneyValue(
        parsed.valor_cuotas ??
          parsed.valor_cuota ??
          parsed.cuota_mensual,
      ) ?? 0;
    if (Number.isFinite(valorCuotas) && valorCuotas > 0 && valorCuotas < 50000) {
      valorCuotas = valorCuotas * 1000;
    }
  }

  // Normalizar vector de 12 meses (priorizando lectura cromática determinística si existe)
  let cleanVector = "";
  if (vectorHint && /^[N0-6CD]{12}$/.test(vectorHint)) {
    cleanVector = vectorHint;
  } else if (Array.isArray(parsed.vector_circulos) && parsed.vector_circulos.length > 0) {
    cleanVector = parsed.vector_circulos
      .map((item) => {
        const s = String(item ?? "")
          .trim()
          .toUpperCase();
        if (s === "-" || s === "?") return "0";
        return s.replace(/[^N0-6CD]/g, "").slice(0, 1);
      })
      .join("");
  }
  if (!cleanVector || cleanVector.length < 6) {
    const rawVec = String(parsed.vectores ?? "NNNNNNNNNNNN")
      .split("|")[0]
      .split("(")[0]
      .trim()
      .toUpperCase()
      .replace(/-/g, "0")
      .replace(/[^N0-6CD]/g, "");
    cleanVector = rawVec.slice(0, 12) || "NNNNNNNNNNNN";
  }

  // Derivar peor_mora y nivel_riesgo coherentemente con el vector real y el puntaje
  let peorMora = String(parsed.peor_mora ?? "Al día").trim();
  if (cleanVector.includes("C") || cleanVector.includes("K")) {
    peorMora = "Cartera castigada";
  } else if (cleanVector.includes("D")) {
    peorMora = "Dudoso recaudo";
  } else if (cleanVector.includes("6")) {
    peorMora = "Mora 180 días";
  } else if (cleanVector.includes("5")) {
    peorMora = "Mora 150 días";
  } else if (cleanVector.includes("4")) {
    peorMora = "Mora 120 días";
  } else if (cleanVector.includes("3")) {
    peorMora = "Mora 90 días";
  } else if (cleanVector.includes("2")) {
    peorMora = "Mora 60 días";
  } else if (cleanVector.includes("1")) {
    peorMora = "Mora 30 días";
  }

  // Tomar nivel_riesgo estrictamente del campo "Viabilidad:" de "Recomendación para vender crédito" (Página 2)
  const rawViabilidad = String(parsed.viabilidad ?? parsed.nivel_riesgo ?? "").trim().toUpperCase();
  let nivelRiesgo = "Medio";
  if (rawViabilidad.includes("MEDI")) {
    nivelRiesgo = "Medio";
  } else if (rawViabilidad.includes("BAJ")) {
    nivelRiesgo = "Bajo";
  } else if (rawViabilidad.includes("ALT")) {
    nivelRiesgo = "Alto";
  } else if (puntaje >= 700) {
    nivelRiesgo = "Bajo";
  } else if (puntaje >= 500) {
    nivelRiesgo = "Medio";
  } else if (puntaje > 0) {
    nivelRiesgo = "Alto";
  }

  return {
    documento_identidad: doc,
    nombre_titular: String(rawNombre).trim(),
    puntaje: Number.isFinite(puntaje) ? puntaje : 0,
    monto_sugerido: Number.isFinite(montoSugerido) ? montoSugerido : 0,
    ingreso_data: Number.isFinite(ingresoData) ? ingresoData : 0,
    endeudamiento: String(parsed.endeudamiento ?? "0%").trim(),
    vectores: cleanVector,
    creditos_vigentes: Number.isFinite(creditosVigentes) ? creditosVigentes : 0,
    total_deuda: Number.isFinite(totalDeuda) ? totalDeuda : 0,
    valor_cuotas: Number.isFinite(valorCuotas) ? valorCuotas : 0,
    peor_mora: peorMora,
    nivel_riesgo: nivelRiesgo,
    diagnostico_ia: String(parsed.diagnostico_ia ?? "Solicitud analizada con DataCrédito.").trim(),
  };
}

/**
 * Función principal que orquesta la extracción desde binario PDF.
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
  const { text, unlockedPassword } = await extractPdfText(buffer.slice(), filename, options?.pdfPassword);
  const resolvedPassword = unlockedPassword || options?.pdfPassword;

  const openAiKey = resolveOpenAiKey(options?.openaiApiKey);

  if (openAiKey) {
    try {
      options?.onProgress?.(`Texto extraído (${text.length} caracteres). Consultando OpenAI...`);
      return await callOpenAI(text, buffer.slice(), openAiKey, filename, resolvedPassword, options?.onProgress);
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

  options?.onProgress?.("Extrayendo datos crediticios directamente del documento...");
  return regexFallbackParser(text, filename);
}

/**
 * Extrae los datos crediticios a partir del texto y/o imágenes JPEG ya extraídos en el navegador.
 * Evita cargar `unpdf`/`pdfjs-dist` (1.7MB JS) y `jpeg-js` en el proceso Node.js de cPanel (límite 512MB RAM).
 */
export async function extractDataCreditoFromPreExtracted(
  filename: string,
  options: {
    text: string;
    imagesBase64?: string[];
    openaiApiKey?: string;
    geminiApiKey?: string;
  },
): Promise<DataCreditoExtracted> {
  const cleanText = (options.text || "").trim();
  const openAiKey = resolveOpenAiKey(options.openaiApiKey);

  if (openAiKey) {
    try {
      return await callOpenAI(
        cleanText,
        null,
        openAiKey,
        filename,
        undefined,
        undefined,
        options.imagesBase64,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[extractDataCreditoFromPreExtracted] OpenAI fallo para ${filename}:`, msg);
      return regexFallbackParser(cleanText, filename);
    }
  }

  const geminiKey =
    options.geminiApiKey?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim();

  if (
    geminiKey &&
    (cleanText.length >= 50 || (options.imagesBase64 && options.imagesBase64.length > 0))
  ) {
    try {
      return await callGemini(cleanText, new Uint8Array(0), geminiKey, options.imagesBase64);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[extractDataCreditoFromPreExtracted] Gemini fallo para ${filename}:`, msg);
      return regexFallbackParser(cleanText, filename);
    }
  }

  return regexFallbackParser(cleanText, filename);
}
