# Witme ↔ Coodelsur — Guía de integración completa

> **Para:** Equipo Witme (integrador) y equipo Coodelsur  
> **Producción:** https://solicitar-credito.coodelsursas.com.co  
> **Documento técnico formal:** [WITME-API-PARA-INTEGRADOR.md](./WITME-API-PARA-INTEGRADOR.md) (WITME-API-001 v2.0)  
> **Plantillas de entrega:** [WITME-MENSAJE-ENTREGA.md](./WITME-MENSAJE-ENTREGA.md)

---

## Resumen: dos formas de integrar

Coodelsur ofrece **dos opciones**. Ambas llevan leads al **mismo panel admin** (`/admin/leads`), pero se distinguen por el campo **Origen**.

| Opción | Cómo funciona | Origen en admin | Cuándo usarla |
|--------|---------------|-----------------|---------------|
| **A — Webhook API** | Witme envía `POST` JSON al terminar su formulario | `witme` | Lead completo en Witme; Coodelsur recibe datos sin que el usuario repita formulario |
| **B — Redirección URL** | Witme redirige al usuario al formulario web de Coodelsur | `witme` si lleva UTM/`ref=witme`; si no, `directo` | Usuario completa solicitud en la web de Coodelsur |

---

## Opción A — Webhook API (recomendada si Witme tiene el formulario)

### Endpoint

```
POST https://solicitar-credito.coodelsursas.com.co/api/leads/witme
Authorization: Bearer {WITME_API_KEY}
Content-Type: application/json
```

### Campos mínimos

```json
{
  "nombre": "María López García",
  "cedula": "1056523965",
  "telefono": "3001234567"
}
```

### Campos recomendados (producción)

Incluir **`witme_id`** y todo el formulario dentro de **`datos_formulario`**:

```json
{
  "witme_id": "WITME-12345",
  "tipo_credito": "microcredito_small",
  "nombre": "María López García",
  "cedula": "1056523965",
  "telefono": "3001234567",
  "email": "maria@ejemplo.com",
  "acepta_terminos": true,
  "datos_formulario": {
    "capital_solicitado": 400000,
    "cantidad_cuotas": 2,
    "departamento": "Huila",
    "municipio": "Neiva",
    "ingresos_mensuales": 1500000,
    "cedula_frontal": "https://...",
    "cedula_reverso": "https://...",
    "video_verificacion": "https://...",
    "firma": "data:image/png;base64,..."
  },
  "utm_source": "witme",
  "utm_campaign": "campana-marzo-2026"
}
```

### Respuesta exitosa

**HTTP 201**

```json
{
  "success": true,
  "id": "679a1ddc-8da7-4611-8ce9-808e1036881b",
  "origen": "witme",
  "storage": "database"
```

El lead aparece en **Admin → Solicitudes** con origen **Witme** y todos los campos mapeados. Campos extra de Witme se muestran en la sección **"Datos adicionales (Witme)"**.

### Verificación rápida (sin auth)

```bash
curl -s https://solicitar-credito.coodelsursas.com.co/api/leads/witme
curl -s https://solicitar-credito.coodelsursas.com.co/api/health
```

Esperado: `"configured": true` y `"witmeConfigured": true`.

### Credenciales

- La **`WITME_API_KEY`** la genera Coodelsur y se entrega por **canal privado** (no va en este documento).
- Se configura en cPanel → Setup Node.js App → Environment variables.

---

## Opción B — Redirección al formulario Coodelsur

Witme redirige al navegador del usuario a una URL de Coodelsur. El usuario completa el formulario multi-paso en nuestra web.

### URLs disponibles

| URL | Descripción |
|-----|-------------|
| `https://solicitar-credito.coodelsursas.com.co/` | Landing + selector de monto |
| `https://solicitar-credito.coodelsursas.com.co/solicitar?monto=400000` | Formulario con monto precargado |
| `https://solicitar-credito.coodelsursas.com.co/credito/microcredito_small` | Formulario directo Microcrédito Small |

### ⚠️ Importante: marcar tráfico como Witme

Para que el lead quede con **origen Witme** en el panel admin, Witme **debe** incluir parámetros de campaña en la URL:

**Formato recomendado (UTM estándar):**

```
https://solicitar-credito.coodelsursas.com.co/solicitar?monto=400000&utm_source=witme&utm_medium=redirect&utm_campaign={ID_CAMPANA}
```

**Formato corto (alternativa):**

```
https://solicitar-credito.coodelsursas.com.co/solicitar?monto=400000&ref=witme&utm_campaign={ID_CAMPANA}
```

También acepta: `origen=witme` o `source=witme` en lugar de `ref=witme`.

| Parámetro | Obligatorio | Descripción |
|-----------|-------------|-------------|
| `utm_source=witme` o `ref=witme` | **Sí** (para tracking Witme) | Marca el lead como origen Witme |
| `utm_medium=redirect` | Recomendado | Distingue redirect vs webhook |
| `utm_campaign` | Recomendado | ID de campaña Witme |
| `monto` | Opcional | Precarga el monto (ej. `400000`) |

**Sin `utm_source=witme` ni `ref=witme`**, el lead se guarda como **Web directo** y no se puede distinguir de tráfico orgánico.

### Qué ocurre técnicamente

1. El usuario llega con parámetros UTM/`ref`.
2. La web guarda la atribución en cookie (`coodelsur_utm`, 30 días).
3. Al enviar el formulario, el lead se guarda con `origen: witme` y campos UTM en PostgreSQL.
4. Google Analytics (si está configurado) recibe eventos `campaign_attribution`, `begin_form`, `generate_lead` con `origen` y UTM.

---

## Tracking y reportes en Coodelsur

### Panel de administración

- **URL:** `/admin/leads`
- **Filtro Origen:** Witme | Web directo | Orgánico | Referido
- **Columna Origen** en la tabla de solicitudes
- **Contadores** Witme vs Web directo (según filtros activos)

### En detalle de cada solicitud

- Campo **Origen** visible en "Contacto y origen"
- Leads webhook: sección **Datos adicionales (Witme)** con campos no mapeados
- Leads webhook: `datosFormulario.witmeLeadId` y `payloadOriginal` para auditoría

### Google Analytics (opcional)

Configurar en cPanel:

```env
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

Eventos enviados:

| Evento | Cuándo |
|--------|--------|
| `campaign_attribution` | Usuario llega con UTM/ref Witme |
| `begin_form` | Abre formulario Microcrédito Small |
| `generate_lead` | Envía solicitud completa |

Parámetros: `origen`, `utm_source`, `utm_campaign`, `tipo_credito`, `monto`.

---

## Comparación rápida

| | Webhook API | Redirección URL |
|---|-------------|-----------------|
| Usuario repite formulario | No | Sí (en Coodelsur) |
| Datos completos de Witme | Sí (vía JSON) | Solo lo que el usuario ingrese aquí |
| Adjuntos (cédula, video) | Sí (URL o base64 en JSON) | Captura en nuestra web |
| Origen en admin | `witme` automático | `witme` solo con UTM/ref |
| Requiere API Key | Sí | No |
| Ideal para | Witme ya tiene formulario completo | Usuario debe firmar/verificar en Coodelsur |

---

## Checklist go-live

### Coodelsur (antes de entregar a Witme)

- [ ] `WITME_API_KEY` configurada en cPanel
- [ ] `GET /api/health` → `witmeConfigured: true`
- [ ] `GET /api/leads/witme` → `configured: true`
- [ ] Prueba `POST` con curl → HTTP 201
- [ ] Lead visible en `/admin/leads` con origen Witme
- [ ] (Opcional) `NEXT_PUBLIC_GA_MEASUREMENT_ID` para analytics

### Witme — Opción A (webhook)

- [ ] Configurar URL y Bearer token
- [ ] Enviar `witme_id` en cada lead
- [ ] Enviar `datos_formulario` con todos los campos
- [ ] Manejar reintentos en HTTP 500 (backoff 5s, 15s, 45s)

### Witme — Opción B (redirect)

- [ ] Usar URLs con `utm_source=witme` o `ref=witme`
- [ ] Incluir `utm_campaign` con ID de campaña
- [ ] Probar flujo completo en móvil

---

## Soporte

- **Coodelsur:** cartera@coodelsursas.com.co
- **Documento formal API:** [WITME-API-PARA-INTEGRADOR.md](./WITME-API-PARA-INTEGRADOR.md)
- **Implementación código:** `src/app/api/leads/witme/route.ts`, `src/application/lead/map-witme-payload.ts`

---

*Coodelsur SAS — Confidencial*
