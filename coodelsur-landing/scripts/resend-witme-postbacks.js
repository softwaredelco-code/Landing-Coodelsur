/**
 * Script para conciliar y reenviar postbacks a Witme de leads desembolsados.
 *
 * Uso 1 (Un solo lead):
 *   node scripts/resend-witme-postbacks.js --cedula 1005785366 --cid wudo2e1afr3jl09mjunl4eai
 *
 * Uso 2 (Lote desde archivo JSON 'scripts/witme_cids.json'):
 *   Formato de witme_cids.json:
 *   [
 *     { "cedula": "1005785366", "witme_id": "wudo2e1afr3jl09mjunl4eai" },
 *     { "cedula": "1113309230", "witme_id": "w80d0cp6iqk4uu9mjrkv6bn2" }
 *   ]
 *   Ejecutar:
 *   node scripts/resend-witme-postbacks.js --batch
 *
 * Uso 3 (Reintentar leads de octubre/noviembre que ya tienen witme_id pero fallaron o están pendientes):
 *   node scripts/resend-witme-postbacks.js --retry-pending
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

const DEFAULT_POSTBACK_URL_NANO =
  process.env.WITME_POSTBACK_URL_NANOCREDITO?.trim() ||
  'https://go.servy.es/postback?cid=%7Bwitme_id%7D&payout=%7Bsum%7D&currency=USD&param1=COODELSUR_CO_API_NANO';

const DEFAULT_POSTBACK_URL_MICRO =
  process.env.WITME_POSTBACK_URL_MICROCREDITO?.trim() ||
  'https://go.servy.es/postback?cid=%7Bwitme_id%7D&payout=%7Bsum%7D&currency=USD&param1=COODELSUR_CO_API_MICRO';

function buildUrl(baseUrl, witmeId, payout) {
  let clean = baseUrl.trim();
  clean = clean
    .replace(/(?:\{witme_id\}|%7Bwitme_id%7D)/gi, encodeURIComponent(witmeId))
    .replace(/(?:\{click_id\}|%7Bclick_id%7D)/gi, encodeURIComponent(witmeId))
    .replace(/(?:\{cid\}|%7Bcid%7D)/gi, encodeURIComponent(witmeId));

  if (payout != null && payout !== '') {
    clean = clean
      .replace(/(?:\{sum\}|%7Bsum%7D)/gi, encodeURIComponent(payout))
      .replace(/(?:\{payout\}|%7Bpayout%7D)/gi, encodeURIComponent(payout));
  }

  if (!clean.includes('cid=') && !clean.includes('witme_id=')) {
    const sep = clean.includes('?') ? '&' : '?';
    clean = `${clean}${sep}cid=${encodeURIComponent(witmeId)}`;
  }
  return clean;
}

async function sendPostbackCall(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Coodelsur-Postback/1.0',
          Accept: 'application/json, text/plain, */*',
        },
      });

      if (res.ok) {
        return { success: true, status: 'success', httpStatus: res.status, attempts: attempt };
      }
      if (res.status >= 400 && res.status < 500) {
        return { success: false, status: 'error', httpStatus: res.status, attempts: attempt, error: `HTTP ${res.status}` };
      }
    } catch (err) {
      if (attempt === 3) {
        return { success: false, status: 'error', httpStatus: null, attempts: attempt, error: err.message };
      }
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

async function processSingle(cedula, witmeId) {
  const cleanCedula = String(cedula).replace(/\D/g, '');
  const cleanId = String(witmeId).trim();

  const lead = await prisma.lead.findFirst({
    where: {
      cedula: cleanCedula,
      estado: 'desembolsado',
    },
    orderBy: { fechaCreacion: 'desc' },
  });

  if (!lead) {
    console.warn(`[WARN] No se encontró lead desembolsado para cédula ${cleanCedula}`);
    return;
  }

  const isNano =
    lead.tipoCredito === 'microcredito_small' ||
    lead.tipoCredito.includes('small') ||
    lead.tipoCredito.includes('nano');
  const baseUrl = isNano ? DEFAULT_POSTBACK_URL_NANO : DEFAULT_POSTBACK_URL_MICRO;
  const payout = isNano ? '1.5' : '2.5';
  const targetUrl = buildUrl(baseUrl, cleanId, payout);

  console.log(`Disparando postback para ${lead.nombre} (CC ${cleanCedula}) -> ${targetUrl}`);
  const callResult = await sendPostbackCall(targetUrl);

  const updatedDatos = {
    ...(lead.datosFormulario || {}),
    witme_id: cleanId,
    witmeLeadId: cleanId,
    witmePostback: {
      ...callResult,
      product: isNano ? 'nanocredito' : 'microcredito',
      witmeId: cleanId,
      payout,
      url: targetUrl,
      triggeredAt: new Date().toISOString(),
    },
  };

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      origen: 'witme',
      datosFormulario: updatedDatos,
    },
  });

  console.log(
    `✅ Postback procesado: status=${callResult.status}, HTTP=${callResult.httpStatus}, leadId=${lead.id}`
  );
}

async function retryPendingLeads() {
  const leads = await prisma.lead.findMany({
    where: {
      estado: 'desembolsado',
    },
    select: {
      id: true,
      nombre: true,
      cedula: true,
      tipoCredito: true,
      datosFormulario: true,
    },
  });

  const pending = [];
  for (const l of leads) {
    const d = l.datosFormulario || {};
    const witmeId = d.witme_id || d.witmeLeadId || d.witmeId || d.click_id;
    const postback = d.witmePostback;

    if (witmeId && (!postback || postback.status !== 'success')) {
      pending.push({ lead: l, witmeId });
    }
  }

  console.log(`Encontrados ${pending.length} leads con witmeId pendiente de postback exitoso.`);
  for (const item of pending) {
    await processSingle(item.lead.cedula, item.witmeId);
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--retry-pending')) {
    await retryPendingLeads();
    return;
  }

  const cedulaIdx = args.indexOf('--cedula');
  const cidIdx = args.indexOf('--cid');
  if (cedulaIdx !== -1 && cidIdx !== -1) {
    const cedula = args[cedulaIdx + 1];
    const cid = args[cidIdx + 1];
    await processSingle(cedula, cid);
    return;
  }

  if (args.includes('--batch')) {
    const batchPath = path.join(process.cwd(), 'scripts', 'witme_cids.json');
    if (!fs.existsSync(batchPath)) {
      console.error(`No existe el archivo ${batchPath}`);
      return;
    }
    const list = JSON.parse(fs.readFileSync(batchPath, 'utf8'));
    console.log(`Procesando lote de ${list.length} registros...`);
    for (const item of list) {
      if (item.cedula && (item.witme_id || item.cid)) {
        await processSingle(item.cedula, item.witme_id || item.cid);
      }
    }
    return;
  }

  console.log(`
Uso del script de postback Witme:
  1. Un solo lead:
     node scripts/resend-witme-postbacks.js --cedula <CEDULA> --cid <WITME_ID>
  2. Reintentar leads pendientes con witme_id:
     node scripts/resend-witme-postbacks.js --retry-pending
  3. Lote desde scripts/witme_cids.json:
     node scripts/resend-witme-postbacks.js --batch
`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

