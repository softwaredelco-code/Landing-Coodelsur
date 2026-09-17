# Witme ↔ Coodelsur — Documentación de integración

| Campo | Valor |
|-------|--------|
| **Documento** | WITME-INT-001 |
| **Versión** | 3.0 |
| **Fecha** | 17 de septiembre de 2026 |
| **Estado** | Producción activa |
| **Emisor** | Coodelsur SAS |
| **Contacto** | cartera@coodelsursas.com.co |
| **URL producción** | https://solicitar-credito.coodelsursas.com.co |

**Documento técnico formal (API):** [WITME-API-PARA-INTEGRADOR.md](./WITME-API-PARA-INTEGRADOR.md) (WITME-API-001 v2.0)

---

## 1. Alcance

Coodelsur y Witme integrarán solicitudes de crédito por **dos vías en paralelo**. Ambas registran leads en el **mismo panel de administración** (`/admin/leads`).

| Vía | Descripción | Origen en admin |
|-----|-------------|-----------------|
| **A — Webhook API** | Witme envía un `POST` JSON cuando el usuario termina su formulario en Witme | `witme` (automático) |
| **B — Redirección URL** | Witme redirige al usuario al formulario web de Coodelsur | `witme` si la URL incluye UTM/`ref=witme`; si no, `directo` |

Witme puede usar **una o ambas** vías según el flujo de cada campaña.

---

## 2. Opción A — Webhook API

### 2.1 Endpoint

```http
POST https://solicitar-credito.coodelsursas.com.co/api/leads/witme
Authorization: Bearer {WITME_API_KEY}
Content-Type: application/json
```

La **API Key** la entrega Coodelsur por **canal privado** (correo aparte). No va en este documento.

### 2.2 Campos obligatorios

| Campo | Alias | Descripción |
|-------|-------|-------------|
| `nombre` | — | Nombre completo |
| `cedula` | `documento` | Número de identificación |
| `telefono` | `celular` | Celular de contacto |

### 2.3 Campos recomendados

| Campo | Descripción |
|-------|-------------|
| `witme_id` | ID del lead en Witme (`witmeId`, `id_externo`, `external_id`) |
| `tipo_credito` | Producto (default: `microcredito_small`) |
| `email` / `correo` | Correo electrónico |
| `acepta_terminos` | `true` si aceptó términos |
| `datos_formulario` o `datos` | Objeto con **todos** los campos del formulario Witme |
| `utm_source`, `utm_campaign`, … | Metadatos de campaña (default source: `witme`) |

### 2.4 Ejemplo mínimo

```json
{
  "nombre": "María López García",
  "cedula": "1056523965",
  "telefono": "3001234567"
}
```

### 2.5 Ejemplo recomendado (producción)

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
    "valor_cuota": 215000,
    "tipo_identificacion": "CC",
    "departamento": "Huila",
    "municipio": "Neiva",
    "direccion": "Calle 10 #5-20",
    "ingresos_mensuales": 1500000,
    "ocupacion": "Comerciante",
    "tipo_cuenta": "Ahorros",
    "entidad_bancaria": "Bancolombia",
    "numero_cuenta": "1234567890",
    "cedula_frontal": "https://storage.ejemplo.com/front.jpg",
    "cedula_reverso": "https://storage.ejemplo.com/back.jpg",
    "video_verificacion": "https://storage.ejemplo.com/video.mp4",
    "firma": "data:image/png;base64,..."
  },
  "utm_source": "witme",
  "utm_campaign": "campana-sept-2026"
}
```

### 2.6 Respuestas HTTP

| HTTP | Body | Significado |
|------|------|-------------|
| **201** | `{ "success": true, "id": "uuid", "origen": "witme", "storage": "database" }` | Lead creado |
| **401** | `{ "error": "No autorizado" }` | API Key inválida o ausente |
| **422** | `{ "error": "Payload inválido", "details": "..." }` | Faltan nombre/cédula/teléfono |
| **500** | `{ "error": "Error interno" }` | Error del servidor — reintentar |

### 2.7 Reglas de mapeo

1. Campos en **raíz** o dentro de **`datos`** / **`datos_formulario`**.
2. Acepta **snake_case** (`capital_solicitado`) y **camelCase** (`capitalSeleccionado`).
3. Campos desconocidos se guardan y aparecen en admin como **"Datos adicionales (Witme)"**.
4. El JSON original se conserva en `payloadOriginal` para auditoría.
5. Adjuntos: URL pública (`https://...`) o base64 (`data:image/...`).

**Alias de campos frecuentes:**

| Witme (snake_case) | Alias | Campo interno |
|--------------------|-------|---------------|
| `capital_solicitado` | `monto`, `monto_solicitado` | Monto del crédito |
| `cantidad_cuotas` | `cuotas` | Plazo |
| `cedula_frontal` / `cedula_reverso` | — | Fotos cédula |
| `video_verificacion` | — | Video verificación |
| `firma` | — | Firma digital |

> Tabla completa en [WITME-API-PARA-INTEGRADOR.md](./WITME-API-PARA-INTEGRADOR.md) §5.5.

### 2.8 Productos (`tipo_credito`)

| Valor Witme | Producto Coodelsur |
|-------------|-------------------|
| `microcredito_small`, `small`, `nanocredito` | Microcrédito Small |
| `microcredito_urbano`, `urbano` | Microcrédito urbano |
| `microcredito_rural`, `rural` | Microcrédito rural |
| `consumo`, `comercial`, `libranza` | Homónimos |
| *(omitido)* | Default: `microcredito_small` |

### 2.9 Reintentos (Witme)

Ante **HTTP 500**, reintentar con backoff: **5 s → 15 s → 45 s** (máx. 3 intentos). No reintentar **401** ni **422**.

### 2.10 Prueba cURL

```bash
curl -X POST "https://solicitar-credito.coodelsursas.com.co/api/leads/witme" \
  -H "Authorization: Bearer {WITME_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "witme_id": "WITME-TEST-001",
    "nombre": "Prueba Integración",
    "cedula": "1234567890",
    "telefono": "3001112233",
    "email": "test@ejemplo.com",
    "datos_formulario": { "capital_solicitado": 400000 }
  }'
```

### 2.11 Autodiagnóstico (sin auth)

```bash
curl -s https://solicitar-credito.coodelsursas.com.co/api/leads/witme
curl -s https://solicitar-credito.coodelsursas.com.co/api/health
```

Esperado: `"configured": true`, `"witmeConfigured": true`.

---

## 3. Opción B — Redirección URL

Witme redirige el navegador del usuario a Coodelsur. El usuario completa el formulario multi-paso en nuestra web (cédula, video, firma, etc.).

### 3.1 URLs base

| URL | Uso |
|-----|-----|
| `https://solicitar-credito.coodelsursas.com.co/` | Landing + selector de monto |
| `https://solicitar-credito.coodelsursas.com.co/solicitar?monto=400000` | Formulario con monto precargado |
| `https://solicitar-credito.coodelsursas.com.co/credito/microcredito_small` | Formulario directo Microcrédito Small |

### 3.2 URLs con tracking Witme (obligatorio para identificar origen)

**Formato recomendado:**

```
https://solicitar-credito.coodelsursas.com.co/solicitar?monto=400000&utm_source=witme&utm_medium=redirect&utm_campaign={ID_CAMPANA}
```

**Formato corto:**

```
https://solicitar-credito.coodelsursas.com.co/solicitar?monto=400000&ref=witme&utm_campaign={ID_CAMPANA}
```

También válido: `origen=witme` o `source=witme` en lugar de `ref=witme`.

### 3.3 Parámetros

| Parámetro | Obligatorio | Descripción |
|-----------|-------------|-------------|
| `utm_source=witme` o `ref=witme` | **Sí** | Marca el lead como Witme |
| `utm_medium=redirect` | Recomendado | Distingue redirect vs webhook |
| `utm_campaign` | Recomendado | ID de campaña Witme |
| `monto` | Opcional | Precarga monto en COP (ej. `400000`, `600000`) |

**Sin `utm_source=witme` ni `ref=witme`**, el lead queda como **Web directo**.

### 3.4 Ejemplos listos para copiar

**Monto $400.000:**
```
https://solicitar-credito.coodelsursas.com.co/solicitar?monto=400000&utm_source=witme&utm_medium=redirect&utm_campaign=CAMPAÑA_WITME
```

**Monto $600.000:**
```
https://solicitar-credito.coodelsursas.com.co/solicitar?monto=600000&utm_source=witme&utm_medium=redirect&utm_campaign=CAMPAÑA_WITME
```

**Landing sin monto fijo:**
```
https://solicitar-credito.coodelsursas.com.co/?utm_source=witme&utm_medium=redirect&utm_campaign=CAMPAÑA_WITME
```

### 3.5 Flujo técnico

1. Usuario llega con UTM/`ref` en la URL.
2. Coodelsur guarda atribución en cookie `coodelsur_utm` (30 días).
3. Al enviar el formulario, el lead se guarda con `origen: witme` y campos UTM.
4. Google Analytics recibe eventos `campaign_attribution`, `begin_form`, `generate_lead`.

---

## 4. Panel de administración Coodelsur

Todos los leads (API y redirect) aparecen en:

**https://solicitar-credito.coodelsursas.com.co/admin/leads**

| Función | Descripción |
|---------|-------------|
| Columna **Origen** | Witme, Web directo, Orgánico, Referido |
| **Filtro Origen** | Filtrar solo leads Witme |
| **Exportar Excel/CSV** | Export con filtro por origen |
| Detalle del lead | Origen, UTM, datos completos del formulario |
| Leads vía API | Sección **"Datos adicionales (Witme)"** + `witmeLeadId` |

---

## 5. Comparación de vías

| | Webhook API (A) | Redirección URL (B) |
|---|-----------------|---------------------|
| Usuario repite formulario | No | Sí (en Coodelsur) |
| Datos completos de Witme | Sí (JSON) | Lo que el usuario ingrese aquí |
| Adjuntos (cédula, video, firma) | URL o base64 en JSON | Captura en nuestra web |
| Origen en admin | `witme` automático | `witme` solo con UTM/ref |
| Requiere API Key | Sí | No |
| Ideal cuando | Witme ya tiene formulario completo | Usuario debe verificar/firmar en Coodelsur |

---

## 6. Checklist go-live

### Coodelsur

- [x] Producción activa: https://solicitar-credito.coodelsursas.com.co
- [x] Webhook configurado (`witmeConfigured: true`)
- [x] Google Analytics activo
- [ ] Entregar API Key a Witme (correo aparte)
- [ ] Coordinar prueba API (`POST` → HTTP 201)
- [ ] Coordinar prueba redirect (URL con `utm_source=witme`)

### Witme — Opción A (API)

- [ ] Configurar webhook con URL y Bearer token
- [ ] Enviar `witme_id` en cada lead
- [ ] Enviar `datos_formulario` con todos los campos
- [ ] Manejar reintentos en HTTP 500

### Witme — Opción B (redirect)

- [ ] Configurar URLs con `utm_source=witme` o `ref=witme`
- [ ] Incluir `utm_campaign` por campaña
- [ ] Probar flujo completo en móvil

---

## 7. Soporte

| Canal | Contacto |
|-------|----------|
| Correo técnico | cartera@coodelsursas.com.co |
| Especificación API formal | WITME-API-PARA-INTEGRADOR.pdf |
| Código fuente | `src/app/api/leads/witme/route.ts`, `src/application/lead/map-witme-payload.ts` |

---

*Coodelsur SAS — Documento confidencial para integrador autorizado*
