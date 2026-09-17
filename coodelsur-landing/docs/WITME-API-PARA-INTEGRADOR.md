# Coodelsur — Especificación de Integración API
## Webhook de recepción de leads (Witme → Coodelsur)

---

| Campo | Valor |
|-------|--------|
| **Documento** | WITME-API-001 |
| **Versión** | 2.0 |
| **Estado** | Aprobado para integración |
| **Fecha de emisión** | 10 de septiembre de 2026 |
| **Clasificación** | Uso confidencial — Integrador autorizado |
| **Emisor** | Coodelsur SAS |
| **Contacto técnico** | cartera@coodelsursas.com.co |
| **Ambiente documentado** | Producción |

### Control de revisiones

| Versión | Fecha | Descripción |
|---------|-------|-------------|
| 1.0 | Sep 2026 | Versión inicial |
| 1.1 | 10 Sep 2026 | URL de producción y mapeo de campos |
| 2.0 | 10 Sep 2026 | Especificación formal para entrega a integrador |

---

## Tabla de contenido

1. [Propósito y alcance](#1-propósito-y-alcance)
2. [Arquitectura de la integración](#2-arquitectura-de-la-integración)
3. [Especificación del endpoint](#3-especificación-del-endpoint)
4. [Autenticación y seguridad](#4-autenticación-y-seguridad)
5. [Contrato de datos (Request)](#5-contrato-de-datos-request)
6. [Contrato de respuestas (Response)](#6-contrato-de-respuestas-response)
7. [Adjuntos y archivos](#7-adjuntos-y-archivos)
8. [Alternativa: redirección por URL](#8-alternativa-redirección-por-url)
9. [Pruebas de integración](#9-pruebas-de-integración)
10. [Política de reintentos e idempotencia](#10-política-de-reintentos-e-idempotencia)
11. [Entregables y credenciales](#11-entregables-y-credenciales)
12. [Soporte e incidencias](#12-soporte-e-incidencias)

---

## 1. Propósito y alcance

### 1.1 Propósito

Este documento define la interfaz técnica mediante la cual **Witme** notifica a **Coodelsur** la finalización de una solicitud de crédito originada en la plataforma Witme.

Coodelsur expone un **webhook HTTP REST** que:

- Recibe un payload JSON con los datos del solicitante.
- Valida autenticación mediante Bearer Token.
- Persiste el lead en base de datos PostgreSQL.
- Expone el lead en el panel interno de administración de Coodelsur.

### 1.2 Alcance

**Incluido en este documento:**

- Endpoint de recepción de leads (`POST /api/leads/witme`).
- Esquema de autenticación.
- Estructura del request y response.
- Códigos de estado HTTP.
- Mapeo de campos Witme → Coodelsur.
- Lineamientos de prueba e integración.

**Fuera de alcance:**

- Acceso al panel de administración de Coodelsur (uso exclusivo interno).
- APIs de consulta o modificación de leads por parte de Witme.
- Integración inversa (Coodelsur → Witme).

### 1.3 Resultado esperado

Tras un `POST` exitoso (`HTTP 201`):

| Atributo | Valor |
|----------|--------|
| Estado del lead | `recibido` |
| Origen | `witme` |
| Visibilidad | Panel `/admin/leads` de Coodelsur |
| Identificador | UUID retornado en el campo `id` |

---

## 2. Arquitectura de la integración

```
┌─────────────────┐         HTTPS POST JSON          ┌──────────────────────────┐
│  Plataforma     │  ───────────────────────────────►  │  API Coodelsur           │
│  Witme          │   /api/leads/witme                 │  (Next.js App Router)    │
│                 │   Authorization: Bearer {KEY}    │                          │
└─────────────────┘                                    └────────────┬─────────────┘
        │                                                             │
        │ Usuario completa formulario                                  │ Persistencia
        ▼                                                             ▼
   Lead en Witme                                              ┌─────────────────┐
                                                              │  PostgreSQL     │
                                                              │  (Supabase)     │
                                                              └────────┬────────┘
                                                                       │
                                                                       ▼
                                                              ┌─────────────────┐
                                                              │  Panel Admin    │
                                                              │  /admin/leads   │
                                                              └─────────────────┘
```

**Flujo operativo:**

1. El usuario finaliza el formulario de crédito en Witme.
2. Witme construye el payload JSON y ejecuta `POST` al webhook de Coodelsur.
3. Coodelsur valida token, parsea campos y crea el lead.
4. Coodelsur responde `201 Created` con el UUID del lead.
5. El equipo comercial de Coodelsur procesa la solicitud desde su panel interno.

---

## 3. Especificación del endpoint

### 3.1 Endpoint principal

| Propiedad | Valor |
|-----------|--------|
| **URL base** | `https://solicitar-credito.coodelsursas.com.co` |
| **Path** | `/api/leads/witme` |
| **URL completa** | `https://solicitar-credito.coodelsursas.com.co/api/leads/witme` |
| **Método HTTP** | `POST` |
| **Content-Type** | `application/json; charset=utf-8` |
| **Accept** | `application/json` |
| **Protocolo** | HTTPS (TLS 1.2+) — obligatorio |
| **Timeout recomendado** | 30 segundos |

### 3.2 Endpoints auxiliares (diagnóstico)

#### GET `/api/leads/witme`

Endpoint informativo **sin autenticación**. Retorna metadatos del servicio.

**Respuesta HTTP 200:**

```json
{
  "service": "witme-webhook",
  "configured": true,
  "method": "POST",
  "url": "https://solicitar-credito.coodelsursas.com.co/api/leads/witme",
  "auth": "Authorization: Bearer <WITME_API_KEY>",
  "requiredFields": ["nombre", "cedula|documento", "telefono|celular"],
  "optionalFields": [
    "email|correo",
    "tipo_credito|tipoCredito",
    "datos|datos_formulario",
    "witme_id",
    "acepta_terminos",
    "utm_source",
    "utm_campaign"
  ],
  "notes": [
    "Los campos pueden ir en el root del JSON o dentro de datos / datos_formulario.",
    "Acepta snake_case y camelCase.",
    "Cada lead aparece en el panel admin con origen witme."
  ]
}
```

#### GET `/api/health`

Endpoint de salud del servicio.

**Campo relevante:** `"witmeConfigured": true` — confirma que la variable `WITME_API_KEY` está configurada en el servidor.

---

## 4. Autenticación y seguridad

### 4.1 Esquema de autenticación

Tipo: **Bearer Token** (API Key estática).

```http
POST /api/leads/witme HTTP/1.1
Host: solicitar-credito.coodelsursas.com.co
Authorization: Bearer {WITME_API_KEY}
Content-Type: application/json
```

| Regla | Descripción |
|-------|-------------|
| Header requerido | `Authorization` |
| Formato | `Bearer {token}` (case-insensitive en prefijo "Bearer") |
| Emisor del token | Coodelsur SAS |
| Rotación | A solicitud del cliente; requiere coordinación previa |
| Almacenamiento | Variable de entorno segura del lado Witme |

### 4.2 Respuesta de autenticación fallida

**HTTP 401 Unauthorized**

```json
{
  "error": "No autorizado"
}
```

### 4.3 Lineamientos de seguridad

- La API Key **no debe** incluirse en URLs, logs, repositorios de código ni documentación pública.
- La API Key se entrega por **canal privado** (correo cifrado, WhatsApp directo o gestor de secretos).
- Solo se aceptan conexiones HTTPS en producción.
- Coodelsur registra IP de origen del request para auditoría interna.

---

## 5. Contrato de datos (Request)

### 5.1 Campos obligatorios

| Campo | Tipo | Descripción | Validación |
|-------|------|-------------|------------|
| `nombre` | string | Nombre completo del solicitante | No vacío |
| `cedula` | string | Número de documento | Se normaliza a dígitos |
| `telefono` | string | Número celular de contacto | No vacío |

**Alias aceptados:**

| Campo canónico | Alias |
|----------------|--------|
| `cedula` | `documento` |
| `telefono` | `celular` |
| `email` | `correo` |

### 5.2 Campos opcionales

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `witme_id` | string | Identificador único del lead en Witme (**recomendado**) |
| `tipo_credito` | string | Producto de crédito (ver §5.3) |
| `email` | string | Correo electrónico |
| `acepta_terminos` | boolean | Aceptación de términos y tratamiento de datos |
| `datos` | object | Contenedor de campos del formulario |
| `datos_formulario` | object | Sinónimo de `datos` |
| `utm_source` | string | Fuente UTM (default: `"witme"`) |
| `utm_campaign` | string | Campaña UTM |
| `utm_medium` | string | Medio UTM |
| `utm_term` | string | Término UTM |
| `utm_content` | string | Contenido UTM |

**Alias de identificador externo:**

| Campo canónico | Alias |
|----------------|--------|
| `witme_id` | `witmeId`, `id_externo`, `external_id` |

### 5.3 Catálogo de productos (`tipo_credito`)

| Valor enviado por Witme | Producto registrado en Coodelsur |
|-------------------------|----------------------------------|
| `microcredito_small`, `small`, `nanocredito` | Microcrédito Small |
| `microcredito_urbano`, `urbano` | Microcrédito urbano |
| `microcredito_rural`, `rural`, `microcredito` | Microcrédito rural |
| `consumo` | Crédito de consumo |
| `comercial` | Crédito comercial |
| `libranza` | Libranza |
| *(no enviado)* | Default: `microcredito_small` |

> Comparación case-insensitive.

### 5.4 Reglas de mapeo

1. Los campos del formulario pueden enviarse en el **nivel raíz** o dentro de **`datos`** / **`datos_formulario`**.
2. Se acepta **snake_case** (`capital_solicitado`) y **camelCase** (`capitalSeleccionado`).
3. Campos desconocidos se almacenan y se muestran en admin como **"Datos adicionales (Witme)"**.
4. Montos en COP, tipo numérico, sin separadores de miles.
5. El payload original completo se conserva en `payloadOriginal` para auditoría.
6. **No aplica** bloqueo por cédula duplicada en este endpoint.

### 5.5 Tabla de mapeo de campos

| Campo Witme (snake_case) | Alias | Campo interno |
|--------------------------|-------|---------------|
| `capital_solicitado` | `monto`, `monto_solicitado` | `capitalSeleccionado` |
| `cantidad_cuotas` | `cuotas` | `cantidadCuotas` |
| `valor_cuota` | — | `valorCuota` |
| `tipo_identificacion` | — | `tipoIdentificacion` |
| `estado_civil` | — | `estadoCivil` |
| `fecha_nacimiento` | — | `fechaNacimiento` |
| `fecha_expedicion` | — | `fechaExpedicion` |
| `personas_a_cargo` | — | `personasACargo` |
| `destino_credito` | — | `destinoCredito` |
| `mora_vigente` | — | `moraVigente` |
| `ingresos_mensuales` | — | `ingresosMensuales` |
| `otros_ingresos` | — | `otrosIngresos` |
| `origen_otros_ingresos` | — | `origenOtrosIngresos` |
| `sector_domicilio` | — | `sectorDomicilio` |
| `departamento`, `municipio`, `direccion`, `barrio` | — | Homónimos en camelCase |
| `tiene_vivienda`, `tiene_vehiculo`, `placa_vehiculo` | — | Patrimonio |
| `ocupacion`, `empresa`, `fecha_ingreso` | — | Datos laborales |
| `referencia_familiar_nombre`, `referencia_familiar_telefono` | — | Referencia |
| `tipo_cuenta`, `entidad_bancaria`, `numero_cuenta` | — | Datos bancarios |
| `cedula_frontal`, `cedula_reverso` | — | Adjuntos identificación |
| `video_verificacion` | — | Video verificación |
| `firma` | — | Firma digital |

> Otros campos snake_case se convierten automáticamente: `nombre_campo` → `nombreCampo`.

### 5.6 Ejemplos de request

**Mínimo viable:**

```json
{
  "nombre": "María López García",
  "cedula": "1056523965",
  "telefono": "3001234567"
}
```

**Recomendado (producción):**

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
    "destino_credito": "Capital de trabajo",
    "tipo_identificacion": "CC",
    "departamento": "Huila",
    "municipio": "Neiva",
    "direccion": "Calle 10 #5-20",
    "barrio": "Centro",
    "ingresos_mensuales": 1500000,
    "ocupacion": "Comerciante",
    "empresa": "Tienda La Esquina",
    "tipo_cuenta": "Ahorros",
    "entidad_bancaria": "Bancolombia",
    "numero_cuenta": "1234567890"
  },
  "utm_source": "witme",
  "utm_campaign": "campana-marzo-2026"
}
```

---

## 6. Contrato de respuestas (Response)

### 6.1 Éxito — HTTP 201 Created

```json
{
  "success": true,
  "id": "679a1ddc-8da7-4611-8ce9-808e1036881b",
  "origen": "witme",
  "storage": "database"
}
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `success` | boolean | Siempre `true` |
| `id` | string (UUID) | Identificador único del lead en Coodelsur |
| `origen` | string | Siempre `"witme"` |
| `storage` | string | `"database"` en producción |

### 6.2 Errores

| HTTP | Body | Causa |
|------|------|-------|
| `401` | `{ "error": "No autorizado" }` | Token ausente, mal formado o incorrecto |
| `422` | `{ "error": "Payload inválido", "details": "Se requieren al menos nombre, cedula/documento y telefono/celular" }` | Campos obligatorios faltantes o JSON inválido |
| `500` | `{ "error": "Error interno" }` | Error interno del servidor |

### 6.3 Ejemplo cURL

```bash
curl -X POST "https://solicitar-credito.coodelsursas.com.co/api/leads/witme" \
  -H "Authorization: Bearer {WITME_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "witme_id": "WITME-TEST-001",
    "tipo_credito": "microcredito_small",
    "nombre": "Prueba Integración",
    "cedula": "1234567890",
    "telefono": "3001112233",
    "email": "test@ejemplo.com",
    "acepta_terminos": true,
    "datos_formulario": {
      "capital_solicitado": 200000,
      "cantidad_cuotas": 2,
      "destino_credito": "Prueba webhook"
    },
    "utm_source": "witme",
    "utm_campaign": "prueba-integracion"
  }'
```

---

## 7. Adjuntos y archivos

Incluir dentro de `datos_formulario`:

| Clave | Descripción |
|-------|-------------|
| `cedulaFrontal` / `cedula_frontal` | Foto frontal cédula |
| `cedulaReverso` / `cedula_reverso` | Foto reverso cédula |
| `videoVerificacion` / `video_verificacion` | Video de verificación |
| `firma` | Firma del solicitante |

**Formatos soportados:**

| Formato | Estructura |
|---------|------------|
| Objeto FileCapture | `{ "fileName", "mimeType", "size", "preview" }` |
| Data URL base64 | `"data:image/jpeg;base64,..."` |
| URL HTTPS pública | `"https://..."` |

**Límites:**

| Tipo | Tamaño máximo |
|------|---------------|
| Imagen | 5 MB |
| Video | 15 MB |
| Firma | 2 MB |

---

## 8. Alternativa: redirección por URL

Además del webhook, Witme puede **redirigir usuarios** al formulario web de Coodelsur. El lead llega al mismo panel admin, pero el usuario completa el formulario en nuestra web.

### URLs base

| URL | Uso |
|-----|-----|
| `https://solicitar-credito.coodelsursas.com.co/` | Landing principal |
| `https://solicitar-credito.coodelsursas.com.co/solicitar?monto=400000` | Formulario con monto precargado |
| `https://solicitar-credito.coodelsursas.com.co/credito/microcredito_small` | Formulario Microcrédito Small |

### Tracking obligatorio para marcar origen Witme

**Sin parámetros de campaña**, el lead se registra como **web directo**. Para que aparezca como **Witme** en `/admin/leads`, incluir en la URL:

```
?utm_source=witme&utm_medium=redirect&utm_campaign={CAMPAIGN_ID}
```

**Alternativa corta:**

```
?ref=witme&utm_campaign={CAMPAIGN_ID}
```

**Ejemplo completo:**

```
https://solicitar-credito.coodelsursas.com.co/solicitar?monto=400000&utm_source=witme&utm_medium=redirect&utm_campaign=campana-marzo-2026
```

La atribución se guarda en cookie (30 días) y se persiste en el lead al enviar el formulario.

> Guía ampliada con tracking y admin: [WITME-INTEGRACION-COMPLETA.md](./WITME-INTEGRACION-COMPLETA.md)

---

## 9. Pruebas de integración

### 9.1 Checklist pre-producción

| # | Verificación | Resultado esperado |
|---|--------------|-------------------|
| 1 | `GET /api/health` | `"witmeConfigured": true` |
| 2 | `GET /api/leads/witme` | `"configured": true` |
| 3 | `POST` con token válido | HTTP `201` |
| 4 | `POST` sin token | HTTP `401` |
| 5 | `POST` sin campos obligatorios | HTTP `422` |
| 6 | Lead visible en panel Coodelsur | Origen = `witme` |

### 9.2 Datos de prueba sugeridos

Usar `witme_id` con prefijo `TEST-` para identificar leads de prueba. Coordinar con Coodelsur la eliminación posterior desde el panel admin.

---

## 10. Política de reintentos e idempotencia

| Escenario | Acción recomendada |
|-----------|-------------------|
| HTTP `201` | No reenviar. Guardar UUID retornado (`id`). |
| HTTP `401` | Verificar API Key. No reintentar hasta corregir credencial. |
| HTTP `422` | Corregir payload. No reintentar con el mismo body. |
| HTTP `500` o timeout | Reintentar hasta 3 veces con backoff exponencial (5s, 15s, 45s). |
| Duplicados | Coodelsur no rechaza cédulas duplicadas vía webhook. Witme debe controlar reenvíos. |

**Recomendación:** incluir siempre `witme_id` para trazabilidad cruzada.

---

## 11. Entregables y credenciales

| Entregable | Medio de entrega | Incluido en este documento |
|------------|------------------|----------------------------|
| Documentación API | Archivo Word / PDF | Sí |
| URL del webhook | Este documento | Sí |
| `WITME_API_KEY` | Canal privado separado | **No** |
| Confirmación go-live | Correo tras prueba exitosa | Pendiente |

---

## 12. Soporte e incidencias

**Coodelsur SAS**

- Correo: cartera@coodelsursas.com.co
- Sitio: https://coodelsursas.com.co

**Información requerida para reportar incidencias:**

1. `witme_id` del lead afectado
2. UUID Coodelsur (`id` de respuesta 201, si existe)
3. Timestamp del request (UTC-5)
4. Código HTTP recibido
5. Body de respuesta de error
6. Payload enviado (sin datos sensibles completos si aplica)

---

*Fin del documento WITME-API-001 v2.0 — Coodelsur SAS — Confidencial*
