/**
 * Genera Manual de Usuario y Manual Técnico en Word (.docx).
 * Ejecutar: npm run docs:manuales
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Document, Packer } from "docx";
import {
  bullet,
  coverBlock,
  heading,
  p,
  tableFromRows,
} from "./docx-helpers.mjs";
import { HeadingLevel } from "docx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS = path.join(__dirname, "..", "docs");
const OUT_USUARIO = path.join(DOCS, "manual-usuario-coodelsur.docx");
const OUT_TECNICO = path.join(DOCS, "manual-tecnico-coodelsur.docx");

function buildManualUsuario() {
  const c = [
    ...coverBlock(
      "Manual de Usuario",
      "Plataforma web de solicitudes de Microcrédito Small — Coodelsur",
      "1.0",
    ),

    heading("Tabla de contenido (resumen)", HeadingLevel.HEADING_2),
    bullet("1. Introducción"),
    bullet("2. Sitio público y solicitud de crédito"),
    bullet("3. Formulario paso a paso (solicitante)"),
    bullet("4. Panel de administración"),
    bullet("5. Gestión de solicitudes"),
    bullet("6. Detalle de una solicitud"),
    bullet("7. Exportación a Excel"),
    bullet("8. Tasas y parámetros de crédito"),
    bullet("9. Estados de una solicitud"),
    bullet("10. Preguntas frecuentes y solución de problemas"),

    heading("1. Introducción", HeadingLevel.HEADING_2),
    p(
      "Este manual describe cómo utilizar la plataforma web de Coodelsur para solicitar un Microcrédito Small y cómo operar el panel de administración donde el equipo interno revisa, gestiona y exporta las solicitudes recibidas.",
    ),
    p(
      "La plataforma consta de dos partes: (1) el sitio público, accesible para cualquier persona que desee aplicar a un crédito; y (2) el panel administrativo, protegido con contraseña, destinado al equipo de cartera, crédito o comercial de Coodelsur.",
    ),
    p("Producto activo en producción: Microcrédito Small."),
    p("Montos disponibles: $200.000 a $600.000 COP."),
    p("Plazos: 1, 2 o 3 cuotas (según parametrización vigente)."),

    heading("2. Sitio público y solicitud de crédito", HeadingLevel.HEADING_2),
    p("URL principal: la dirección configurada del sitio (por ejemplo https://tudominio.com)."),
    bullet("Página de inicio: presentación de Coodelsur, productos y acceso al formulario."),
    bullet("Formulario de solicitud: flujo guiado en 8 pasos con validaciones en tiempo real."),
    bullet("Sección de contacto: datos de la cooperativa y canales de atención."),
    bullet("WhatsApp flotante: acceso rápido a asesoría (si está configurado)."),
    p(
      "El solicitante puede abandonar el formulario y retomarlo más tarde: el sistema guarda un borrador local en el navegador y, cuando hay datos mínimos de contacto, también un borrador en el servidor visible para el equipo comercial.",
    ),

    heading("3. Formulario paso a paso (solicitante)", HeadingLevel.HEADING_2),
    p(
      "El formulario se divide en 8 pasos. Debe completarse en orden; el botón Continuar valida los campos del paso actual antes de avanzar. Al finalizar, el usuario recibe una pantalla de confirmación con el resumen de su solicitud.",
    ),
    tableFromRows(
      ["Paso", "Sección", "Qué se solicita"],
      [
        ["1", "Datos generales", "Nombre, email, tipo y número de documento, celular, género, estado civil, fechas de nacimiento y expedición, estrato, personas a cargo."],
        ["2", "Datos del crédito", "Monto solicitado, número de cuotas, destino del crédito, ingresos mensuales y otros ingresos (si aplica)."],
        ["3", "Domicilio", "Departamento, municipio, sector (urbano/rural), dirección y barrio."],
        ["4", "Activos propios", "Si tiene vivienda propia, si tiene vehículo y placa (obligatoria si tiene vehículo), mora vigente."],
        ["5", "Información laboral", "Ocupación, empresa, cargo, antigüedad, tipo de contrato."],
        ["6", "Referencia", "Nombre, parentesco o tipo de relación, teléfono de referencia personal o familiar."],
        ["7", "Datos bancarios", "Entidad financiera, tipo de cuenta (ahorros, corriente o llave Bre-B) y número de cuenta o llave."],
        ["8", "Verificación", "Fotos de cédula (frontal y reverso), video corto de verificación, firma digital, aceptación de términos y hábeas data."],
      ],
    ),
    p("Validaciones importantes para el solicitante:", { bold: true }),
    bullet("Cédula de ciudadanía (CC): 6, 7 o 10 dígitos numéricos."),
    bullet("Celular Colombia: 10 dígitos, debe iniciar en 3."),
    bullet("Si indica que tiene vehículo, debe digitar la placa."),
    bullet("Si el parentesco de la referencia es «otro», debe especificar cuál."),
    bullet("La firma solo se habilita después de aceptar términos y tratamiento de datos."),
    p("Límites de archivos adjuntos:"),
    bullet("Fotos de cédula: máximo 5 MB cada una."),
    bullet("Video de verificación: máximo 15 MB."),
    bullet("Firma digital: máximo 2 MB."),
    p(
      "Tras enviar la solicitud, si el correo está configurado en el servidor, el solicitante puede recibir un email de confirmación. La cooperativa revisará la solicitud desde el panel admin.",
    ),

    heading("4. Panel de administración", HeadingLevel.HEADING_2),
    p("Acceso: URL del sitio + /admin (ejemplo: https://tudominio.com/admin)."),
    p("Credencial: contraseña definida por el administrador del sistema (variable ADMIN_PASSWORD)."),
    p("Duración de sesión: 12 horas. Pasado ese tiempo debe iniciar sesión nuevamente."),
    p("Navegación principal (barra superior del panel):"),
    bullet("Solicitudes — listado y gestión de todas las solicitudes."),
    bullet("Tasas y parámetros — configuración de tasas, fianza, plazos y costos del producto."),
    bullet("Salir — cierra la sesión administrativa."),
    p(
      "Recomendación de seguridad: no compartir la contraseña admin por correo ni mensajería. Rotarla periódicamente desde la configuración del servidor (Vercel u hosting).",
    ),

    heading("5. Gestión de solicitudes", HeadingLevel.HEADING_2),
    p("Ruta: Panel → Solicitudes (/admin/leads)."),
    p("En la parte superior se muestran tarjetas resumen: total en vista, recibidas, incompletas, revisadas y contactadas."),
    p("Filtros disponibles:"),
    bullet("Buscar: nombre, cédula, teléfono o email. Escriba el criterio y pulse «Aplicar filtros» o Enter."),
    bullet("Estado: filtra por incompleta, recibida, revisada, contactada o descartada. El cambio de estado aplica automáticamente."),
    p("Columnas de la tabla:"),
    bullet("Fecha de creación."),
    bullet("Nombre del solicitante."),
    bullet("Progreso (% y último paso) — especialmente útil para solicitudes incompletas."),
    bullet("Monto solicitado."),
    bullet("Teléfono."),
    bullet("Estado actual."),
    bullet("Acción «Ver detalle» para abrir la ficha completa."),
    p("Selección múltiple:"),
    bullet("Marque una o varias filas con los checkboxes."),
    bullet("Use «Seleccionar todas» para las filas visibles en la página actual."),
    bullet("Con selección activa puede exportar solo esas solicitudes a Excel."),

    heading("6. Detalle de una solicitud", HeadingLevel.HEADING_2),
    p("Desde el listado, pulse «Ver detalle» en la fila deseada."),
    p("Información mostrada:"),
    bullet("Resumen: monto, cuotas, valor de cuota estimado, teléfono."),
    bullet("Contacto y origen: datos personales, email, origen de la solicitud (web, campaña, etc.), aceptación de hábeas data."),
    bullet("Secciones del formulario: crédito, domicilio, activos, laboral, referencia, bancarios — organizadas en tarjetas legibles."),
    bullet("Documentación: cédula frontal, cédula reverso, video de verificación (carga bajo demanda al pulsar reproducir) y firma."),
    bullet("Ubicación: dirección registrada, mapa GPS si el usuario autorizó geolocalización, y ubicación aproximada por IP."),
    p("Acciones en detalle:"),
    bullet("Cambiar estado: selector en la esquina superior derecha (incompleta, recibida, revisada, contactada, descartada)."),
    bullet("Eliminar solicitud: borra el registro y los archivos adjuntos en almacenamiento. Acción irreversible — confirme antes de proceder."),
    bullet("Volver al listado: botón al pie de la página."),
    p("Solicitudes incompletas:"),
    p(
      "Si el usuario abandonó el formulario pero dejó celular, cédula o nombre+email, aparecerá con estado «Incompleta», barra de progreso y último paso alcanzado. Use esta información para contactarlo y retomar la gestión comercial.",
    ),

    heading("7. Exportación a Excel", HeadingLevel.HEADING_2),
    p("Desde el listado de solicitudes hay dos opciones de exportación:"),
    bullet("Exportar seleccionadas: genera un Excel solo con las filas marcadas con checkbox."),
    bullet("Exportar informe general: exporta todas las solicitudes que coincidan con los filtros de búsqueda y estado actuales (hasta 5.000 registros)."),
    p("El archivo descargado incluye:"),
    bullet("Datos administrativos: ID, fechas, estado, origen, UTM de campaña, geolocalización."),
    bullet("Campos principales del formulario: identidad, crédito, domicilio, laboral, referencia, bancarios."),
    bullet("Metadatos de adjuntos (nombre de archivo), sin imágenes embebidas."),
    p("Los encabezados de columnas aparecen en negrita. Nombre sugerido del archivo: solicitudes-coodelsur-informe-general-AAAA-MM-DD.xlsx"),

    heading("8. Tasas y parámetros de crédito", HeadingLevel.HEADING_2),
    p("Ruta: Panel → Tasas y parámetros (/admin/parametros)."),
    p(
      "Permite ajustar los valores financieros del Microcrédito Small sin modificar código. Los cambios aplican al formulario público y a los cálculos de cuota mostrados al solicitante.",
    ),
    p("Parámetros editables:"),
    bullet("Tasa mensual (%)."),
    bullet("Estudio de crédito: valor fijo en pesos o porcentaje sobre el monto."),
    bullet("Fianza mensual (% sobre el capital)."),
    bullet("Vida deudores (% sobre el valor del crédito)."),
    bullet("Plazos permitidos en cuotas (1, 2, 3, etc.)."),
    p("Funciones adicionales:"),
    bullet("Vista previa: simula el desglose de cuota con un monto de ejemplo antes de guardar."),
    bullet("Guardar cambios: persiste en base de datos y actualiza el formulario en minutos."),
    bullet("Restaurar defaults: vuelve a los valores definidos originalmente en el sistema."),
    p(
      "Productos urbano y rural aparecen listados como «próximamente»; solo Microcrédito Small está activo para edición.",
    ),

    heading("9. Estados de una solicitud", HeadingLevel.HEADING_2),
    tableFromRows(
      ["Estado", "Significado", "Acción recomendada"],
      [
        ["Incompleta", "Borrador abandonado; formulario no enviado.", "Contactar al solicitante para retomar."],
        ["Recibida", "Solicitud enviada correctamente.", "Revisar documentación y datos."],
        ["Revisada", "Equipo interno completó la revisión.", "Decidir contacto o descarte."],
        ["Contactada", "Asesor ya contactó al cliente.", "Seguimiento comercial."],
        ["Descartada", "No procede la solicitud.", "Archivar; no requiere más gestión."],
      ],
    ),

    heading("10. Preguntas frecuentes y solución de problemas", HeadingLevel.HEADING_2),
    p("No puedo iniciar sesión en /admin", { bold: true }),
    bullet("Verifique que la contraseña sea la correcta (consulte al responsable técnico)."),
    bullet("Pruebe en ventana de incógnito por si hay cookies antiguas."),
    p("El listado aparece vacío pero hay solicitudes", { bold: true }),
    bullet("Revise filtros de búsqueda y estado; pulse «Aplicar filtros» con campos vacíos."),
    bullet("Recargue con Ctrl+Shift+R para evitar caché del navegador."),
    p("No se ven las fotos o el video en detalle", { bold: true }),
    bullet("Compruebe que Supabase Storage esté configurado (responsable técnico)."),
    bullet("Para video, pulse «Reproducir video» — no se carga automáticamente para ahorrar datos."),
    p("El solicitante dice que envió pero no aparece", { bold: true }),
    bullet("Busque por cédula o teléfono; puede estar como «Incompleta» si no terminó el paso 8."),
    bullet("Revise filtros; pruebe estado «Todos»."),
    p("Los cambios de tasas no se reflejan en el formulario", { bold: true }),
    bullet("Espere unos segundos y recargue la página pública."),
    bullet("Confirme que guardó en Tasas y parámetros sin mensaje de error."),
    p("Contacto soporte técnico", { bold: true }),
    p("Para incidencias de servidor, base de datos o despliegue, contacte al equipo de desarrollo o al administrador del proyecto con: URL afectada, captura de pantalla, fecha/hora y descripción del problema."),
  ];

  return c;
}

function buildManualTecnico() {
  const c = [
    ...coverBlock(
      "Manual Técnico",
      "Coodelsur Landing — Arquitectura, desarrollo y operación",
      "1.0",
    ),

    heading("Tabla de contenido (resumen)", HeadingLevel.HEADING_2),
    bullet("1. Visión general y stack tecnológico"),
    bullet("2. Estructura del repositorio"),
    bullet("3. Configuración del entorno"),
    bullet("4. Modelo de datos (Prisma)"),
    bullet("5. Flujos de negocio"),
    bullet("6. API REST"),
    bullet("7. Formulario y validación"),
    bullet("8. Almacenamiento de adjuntos"),
    bullet("9. Panel admin y autenticación"),
    bullet("10. Parámetros de crédito"),
    bullet("11. Email y verificación de identidad"),
    bullet("12. Despliegue y mantenimiento"),
    bullet("13. Rendimiento y buenas prácticas"),
    bullet("14. Seguridad"),
    bullet("15. Extensión futura (urbano / rural / Witme)"),

    heading("1. Visión general y stack tecnológico", HeadingLevel.HEADING_2),
    p(
      "Coodelsur Landing es una aplicación Next.js 14 (App Router) que captura solicitudes de Microcrédito Small, las persiste en PostgreSQL (Supabase), almacena adjuntos en Supabase Storage y expone un panel admin protegido por contraseña.",
    ),
    tableFromRows(
      ["Componente", "Tecnología", "Versión / notas"],
      [
        ["Framework", "Next.js (App Router)", "14.x"],
        ["Lenguaje", "TypeScript", "5.x"],
        ["UI", "React 18 + Tailwind CSS", "Componentes propios"],
        ["Formularios", "React Hook Form + Zod", "Validación cliente/servidor"],
        ["ORM", "Prisma", "5.x — PostgreSQL"],
        ["Base de datos", "Supabase PostgreSQL", "Pooler :6543 en producción"],
        ["Archivos", "Supabase Storage", "Bucket lead-attachments"],
        ["Excel admin", "xlsx-js-style", "Exportación con headers en negrita"],
        ["Email", "Nodemailer / Resend", "Opcional"],
        ["Despliegue", "Vercel (recomendado)", "Serverless Node.js"],
      ],
    ),

    heading("2. Estructura del repositorio", HeadingLevel.HEADING_2),
    tableFromRows(
      ["Ruta", "Descripción"],
      [
        ["src/app/", "Páginas y API Routes (App Router)"],
        ["src/app/api/", "Endpoints REST públicos y admin"],
        ["src/components/", "UI: landing, formulario, admin"],
        ["src/lib/", "Lógica de negocio (leads, identity, storage, email)"],
        ["src/config/creditos/", "Montos, amortización, opciones de formulario"],
        ["src/hooks/", "Borradores local y servidor"],
        ["src/contexts/", "Parámetros de amortización en cliente"],
        ["prisma/schema.prisma", "Modelos Lead y CreditoParametros"],
        ["docs/", "Documentación Markdown y manuales Word"],
        ["scripts/", "Utilidades (verify-backend, generación docx)"],
      ],
    ),
    p("Páginas principales:"),
    tableFromRows(
      ["Ruta", "Archivo", "Función"],
      [
        ["/", "src/app/page.tsx", "Landing + formulario unificado"],
        ["/admin", "src/app/admin/page.tsx", "Login admin"],
        ["/admin/leads", "src/app/admin/leads/page.tsx", "Listado solicitudes"],
        ["/admin/leads/[id]", "src/app/admin/leads/[id]/page.tsx", "Detalle solicitud"],
        ["/admin/parametros", "src/app/admin/parametros/page.tsx", "Edición tasas/plazos"],
      ],
    ),

    heading("3. Configuración del entorno", HeadingLevel.HEADING_2),
    p("Copiar .env.example a .env.local y completar variables."),
    tableFromRows(
      ["Variable", "Obligatoria", "Descripción"],
      [
        ["DATABASE_URL", "Sí", "PostgreSQL — pooler Supabase puerto 6543 + ?pgbouncer=true"],
        ["DIRECT_URL", "Sí (Supabase)", "Session pooler puerto 5432 — migraciones Prisma"],
        ["SUPABASE_URL", "Sí", "URL del proyecto Supabase"],
        ["SUPABASE_SERVICE_ROLE_KEY", "Sí", "Secret key (sb_secret_… o legacy JWT)"],
        ["SUPABASE_STORAGE_BUCKET", "Sí", "Nombre bucket (lead-attachments)"],
        ["ADMIN_PASSWORD", "Sí", "Contraseña panel /admin"],
        ["NEXT_PUBLIC_SITE_URL", "Sí", "URL pública del sitio"],
        ["NEXT_PUBLIC_DEMO_MODE", "Sí", "false en producción"],
        ["SMTP_* / RESEND_*", "No", "Email confirmación al solicitante"],
        ["VERIFIK_API_KEY", "No", "Verificación CC Registraduría"],
        ["WITME_API_KEY", "No", "Webhook externo Witme"],
        ["DUPLICATE_CEDULA_DAYS", "No", "Ventana anti-duplicados (default 30)"],
        ["LEAD_STORE", "No", "file = JSON local (solo dev); vacío = PostgreSQL"],
      ],
    ),
    p("Comandos de desarrollo:"),
    bullet("npm install — instalar dependencias"),
    bullet("npm run db:push — sincronizar schema Prisma con BD"),
    bullet("npm run dev — servidor local http://localhost:3000"),
    bullet("npm run build — build producción (incluye prisma generate)"),
    bullet("npm run verify:backend — health check local"),
    bullet("npm run docs:manuales — regenerar manuales Word"),

    heading("4. Modelo de datos (Prisma)", HeadingLevel.HEADING_2),
    p("Modelo Lead — solicitud de crédito:"),
    bullet("Campos desnormalizados: capitalSolicitado, progresoFormulario, pasoActualFormulario (listados rápidos)."),
    bullet("datosFormulario (Json): payload completo + metadata adjuntos (paths/url, sin binarios tras upload)."),
    bullet("estado (enum LeadEstado): incompleto | recibido | revisado | contactado | descartado"),
    bullet("Índices: tipoCredito, origen, estado, cedula, fechaCreacion, utmSource"),
    p("Modelo CreditoParametros — tasas editables desde admin:"),
    bullet("PK: tipoCredito (microcredito_small, microcredito_urbano, microcredito_rural)"),
    bullet("tasaMensual, estudioCreditoModo/Valor, fianza, vida deudores, plazosPermitidos[]"),
    p("Archivo: prisma/schema.prisma"),

    heading("5. Flujos de negocio", HeadingLevel.HEADING_2),
    p("5.1 Solicitud completa", { bold: true }),
    bullet("Usuario completa 8 pasos → POST /api/leads"),
    bullet("Validación Zod + coherencia monto/tipoCredito"),
    bullet("verifyDocumentComplete: validación local + duplicados + Verifik opcional"),
    bullet("processFileFields: subida paralela a Supabase Storage"),
    bullet("createLead: insert/update Prisma (promueve borrador incompleto si draftLeadId)"),
    bullet("Email confirmación async (si SMTP/Resend configurado)"),
    p("5.2 Borrador incompleto", { bold: true }),
    bullet("useNanocreditoServerDraft: debounce 3s + guardado al cambiar paso"),
    bullet("POST /api/leads/draft → saveDraftLead → estado incompleto"),
    bullet("Deduplicación por cédula/teléfono; adjuntos pesados excluidos del borrador"),
    p("5.3 Detalle admin optimizado", { bold: true }),
    bullet("load-admin-lead-detail.ts: SQL jsonb excluye binarios del payload principal"),
    bullet("URLs firmadas Supabase para adjuntos; proxy solo si inline base64"),
    bullet("Cache en memoria por solicitud para lecturas de adjuntos"),

    heading("6. API REST", HeadingLevel.HEADING_2),
    p("Base: {NEXT_PUBLIC_SITE_URL}"),
    p("Endpoints públicos:", { bold: true }),
    tableFromRows(
      ["Método", "Ruta", "Descripción"],
      [
        ["GET", "/api/health", "Diagnóstico: DB, storage, demo mode, email"],
        ["GET", "/api/creditos/parametros", "Parámetros amortización activos (cache HTTP 2 min)"],
        ["POST", "/api/verify-cedula", "Validación documento en tiempo real"],
        ["POST", "/api/leads/draft", "Guardar borrador incompleto"],
        ["POST", "/api/leads", "Enviar solicitud completa"],
        ["POST", "/api/leads/witme", "Webhook Witme — Bearer WITME_API_KEY"],
      ],
    ),
    p("Endpoints admin (cookie coodelsur_admin):", { bold: true }),
    tableFromRows(
      ["Método", "Ruta", "Descripción"],
      [
        ["POST", "/api/admin/login", "Body: { password } — emite cookie 12h"],
        ["GET", "/api/admin/leads", "?estado, ?q, ?take, ?skip"],
        ["PATCH", "/api/admin/leads", "{ id, estado }"],
        ["GET", "/api/admin/leads/export", "Excel — ?ids o filtros q/estado"],
        ["GET", "/api/admin/leads/:id", "Detalle liviano"],
        ["DELETE", "/api/admin/leads/:id", "Elimina lead + Storage"],
        ["GET", "/api/admin/leads/:id/attachments/:field", "Adjunto o redirect Supabase"],
        ["GET", "/api/admin/creditos/parametros", "Lista parámetros productos"],
        ["PUT", "/api/admin/creditos/parametros/:tipo", "Actualizar parámetros"],
        ["POST", "/api/admin/creditos/parametros/:tipo", "Reset a defaults"],
      ],
    ),
    p("Documentación ampliada: docs/API.md"),

    heading("7. Formulario y validación", HeadingLevel.HEADING_2),
    p("Orquestador: src/components/forms/FormularioCredito.tsx"),
    p("Schema Zod: src/lib/validation/nanocredito.ts — NANOCREDITO_STEPS, nanocreditoSchema"),
    p("Reglas cruzadas: collectCrossFieldErrors / collectStepCrossFieldErrors"),
    p("Parámetros dinámicos: ParametrosAmortizacionContext carga GET /api/creditos/parametros; defaults inmediatos sin bloquear UI"),
    p("Identidad CC: src/lib/identity/cedula.ts — 6/7/10 dígitos; Verifik timeout 4s"),
    p("Modo demo: NEXT_PUBLIC_DEMO_MODE=true — no envía al backend (solo consola)"),

    heading("8. Almacenamiento de adjuntos", HeadingLevel.HEADING_2),
    p("Módulo: src/lib/storage/upload.ts"),
    tableFromRows(
      ["Campo", "Límite", "Destino"],
      [
        ["cedulaFrontal / cedulaReverso", "5 MB imagen", "Supabase Storage"],
        ["videoVerificacion", "15 MB video", "Supabase Storage"],
        ["firma", "2 MB imagen", "Supabase Storage"],
      ],
    ),
    p("Tras upload exitoso, datosFormulario guarda { path, url, fileName, mimeType, uploaded: true }."),
    p("Si falla Storage, conserva preview base64 con uploaded: false (admin usa proxy)."),
    p("delete-lead.ts elimina objetos Storage al borrar solicitud."),

    heading("9. Panel admin y autenticación", HeadingLevel.HEADING_2),
    p("Auth: src/lib/admin/auth.ts — HMAC-SHA256 sobre ADMIN_PASSWORD, cookie HttpOnly coodelsur_admin"),
    p("Shell: src/components/admin/AdminShell.tsx — navegación Solicitudes | Tasas y parámetros"),
    p("Export Excel: src/lib/leads/export-leads-excel.ts"),
    p("Detalle: src/lib/leads/admin-lead-detail.ts + load-admin-lead-detail.ts"),

    heading("10. Parámetros de crédito", HeadingLevel.HEADING_2),
    p("Store: src/lib/credito/parametros-store.ts — cache en memoria, seed solo si tabla vacía"),
    p("Runtime cliente: src/lib/credito/parametros-runtime.ts (evita dependencia circular)"),
    p("Defaults código: src/config/creditos/amortizacion.ts"),
    p("warmParametrosCache() en POST /api/leads para validar con tasas de BD"),

    heading("11. Email y verificación de identidad", HeadingLevel.HEADING_2),
    p("Email: src/lib/email/lead-confirmation.ts — fire-and-forget tras createLead"),
    p("Verificación: src/lib/identity/verify-document.ts — local → duplicados → Verifik"),
    p("Duplicados: src/lib/leads/duplicate-cedula.ts — ventana DUPLICATE_CEDULA_DAYS"),
    p("Geo IP: src/lib/geo/ipapi.ts — timeout 2s; omitida si cliente envió geoCliente"),

    heading("12. Despliegue y mantenimiento", HeadingLevel.HEADING_2),
    p("Guía completa: docs/DESPLIEGUE.md y docs/BACKEND_SETUP.md"),
    p("Checklist producción:"),
    bullet("NEXT_PUBLIC_DEMO_MODE=false"),
    bullet("LEAD_STORE vacío"),
    bullet("DATABASE_URL con pooler :6543"),
    bullet("npm run db:push contra BD producción (una vez)"),
    bullet("Verificar GET /api/health → database: true, demoMode: false"),
    p("Mantenimiento:"),
    bullet("Rotar ADMIN_PASSWORD en Vercel + redeploy"),
    bullet("Backup: Supabase Backups (plan Pro)"),
    bullet("Prisma Studio: npm run db:studio (solo desarrollo)"),

    heading("13. Rendimiento y buenas prácticas", HeadingLevel.HEADING_2),
    bullet("Formulario: render inmediato con defaults; parámetros en background"),
    bullet("Admin listado: filtros búsqueda con «Aplicar filtros», no por tecla"),
    bullet("Admin detalle: SQL jsonb liviano; adjuntos vía Supabase signed URL"),
    bullet("Borradores: stripHeavyFieldsForDraft en cliente y servidor"),
    bullet("Parametros API: Cache-Control s-maxage=120"),
    bullet("Convención: lógica en src/lib/, no en componentes ni routes"),

    heading("14. Seguridad", HeadingLevel.HEADING_2),
    tableFromRows(
      ["Recurso", "Protección"],
      [
        ["Panel admin", "Cookie firmada + ADMIN_PASSWORD"],
        ["APIs admin", "isAdminRequest en cada route"],
        ["Storage", "Service role solo servidor; signed URLs temporales"],
        ["Webhook Witme", "Bearer WITME_API_KEY"],
        ["Validación", "Zod servidor en todos los POST de leads"],
        ["Secrets", "Nunca commitear .env — usar Vercel env vars"],
      ],
    ),

    heading("15. Extensión futura", HeadingLevel.HEADING_2),
    bullet("microcredito_urbano / microcredito_rural: schemas y formularios pendientes; parámetros ya sembrados en BD"),
    bullet("Integración Witme: docs/WITME_FORMULARIO.md, docs/WITME_API.md, POST /api/leads/witme"),
    bullet("Índice compuesto (estado, fechaCreacion) recomendado si crece volumen de leads"),
    p("Referencia código: docs/CODEBASE.md, docs/ARCHITECTURE.md"),
  ];

  return c;
}

async function writeDoc(children, meta, outPath) {
  const doc = new Document({
    creator: "Coodelsur",
    ...meta,
    sections: [{ properties: {}, children }],
  });
  const buffer = await Packer.toBuffer(doc);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, buffer);
  console.log("Generado:", outPath);
}

const usuarioChildren = buildManualUsuario();
const tecnicoChildren = buildManualTecnico();

await writeDoc(usuarioChildren, {
  title: "Manual de Usuario — Coodelsur Landing",
  description: "Guía operativa para solicitantes y equipo admin",
}, OUT_USUARIO);

await writeDoc(tecnicoChildren, {
  title: "Manual Técnico — Coodelsur Landing",
  description: "Arquitectura, API, despliegue y desarrollo",
}, OUT_TECNICO);

console.log("\nManuales generados correctamente en docs/");
