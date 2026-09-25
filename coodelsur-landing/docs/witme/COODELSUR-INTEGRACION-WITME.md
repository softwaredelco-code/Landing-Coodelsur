# Coodelsur SAS
## Guía de integración técnica — Witme

---

| | |
|---|---|
| **Documento** | Integración Witme v1.0 |
| **Fecha** | Septiembre 2026 |
| **Ambiente** | Producción — activo |
| **Sitio web** | https://solicitar-credito.coodelsursas.com.co |
| **Contacto técnico** | softwaredelco@gmail.com |

**Documento complementario:** *COODELSUR-CREDENCIALES-WITME.pdf* (API Key y datos de autenticación)

---

## 1. Introducción

Coodelsur habilita **dos formas** de integración con Witme. Ambas registran solicitudes en el **mismo panel de administración** de Coodelsur.

| Método | Descripción |
|--------|-------------|
| **A. API Webhook** | Witme envía los datos del lead en JSON al completar su formulario. |
| **B. Redirección URL** | Witme redirige al usuario al formulario web de Coodelsur. |

Pueden usarse **una o las dos** según cada campaña.

El webhook API está **activo en producción** y listo para recibir solicitudes `POST` autenticadas.

---

## 2. Método A — API Webhook

### 2.1 Conexión

| Parámetro | Valor |
|-----------|--------|
| **URL** | `https://solicitar-credito.coodelsursas.com.co/api/leads/witme` |
| **Método** | `POST` |
| **Content-Type** | `application/json` |
| **Autenticación** | `Authorization: Bearer {API_KEY}` |

La **API Key** está en el documento *COODELSUR-CREDENCIALES-WITME.pdf*.

### 2.2 Campos obligatorios

| Campo | Descripción |
|-------|-------------|
| `nombre` | Nombre completo |
| `cedula` | Documento (alias: `documento`) |
| `telefono` | Celular (alias: `celular`) |

### 2.3 Campos recomendados

| Campo | Descripción |
|-------|-------------|
| `witme_id` | ID del lead en Witme |
| `email` | Correo electrónico |
| `tipo_credito` | `microcredito_small` (default), `microcredito_urbano`, `libranza`, `consumo`, `comercial`, `libranza` |
| `acepta_terminos` | `true` si aceptó términos |
| `datos_formulario` | Objeto JSON con **todos** los campos del formulario Witme |

Campos extra en snake_case o camelCase. Adjuntos por URL (`https://...`) o base64 (`data:image/...`): `cedula_frontal`, `cedula_reverso`, `video_verificacion`, `firma`.

### 2.4 Ejemplo JSON (producción)

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
  }
}
```

### 2.5 Respuestas HTTP

| Código | Significado |
|--------|-------------|
| **201** | Lead creado — body: `{ "success": true, "id": "uuid", "origen": "witme" }` |
| **401** | API Key inválida |
| **422** | Faltan nombre, cédula o teléfono |
| **500** | Error temporal — reintentar a 5 s, 15 s y 45 s |

### 2.6 Prueba

Ver comando cURL en *COODELSUR-CREDENCIALES-WITME.pdf*. Resultado esperado: **HTTP 201**.

---

## 3. Método B — Redirección URL

Witme redirige al usuario a Coodelsur. **No requiere API Key.**

### 3.1 URL recomendada

Reemplazar `{ID_CAMPANA}` por el ID de campaña Witme:

```
https://solicitar-credito.coodelsursas.com.co/solicitar?monto=400000&utm_source=witme&utm_medium=redirect&utm_campaign={ID_CAMPANA}
```

**Monto $600.000:**

```
https://solicitar-credito.coodelsursas.com.co/solicitar?monto=600000&utm_source=witme&utm_medium=redirect&utm_campaign={ID_CAMPANA}
```

**Formato corto:**

```
https://solicitar-credito.coodelsursas.com.co/solicitar?monto=400000&ref=witme&utm_campaign={ID_CAMPANA}
```

### 3.2 Obligatorio para tracking Witme

Incluir **`utm_source=witme`** o **`ref=witme`**. Sin esto, el lead queda como tráfico directo.

| Parámetro | Uso |
|-----------|-----|
| `utm_source=witme` | Marca origen Witme |
| `utm_campaign` | ID de campaña |
| `monto` | Precarga monto (400000, 600000, etc.) |

### 3.3 Otras URLs

| Destino | URL |
|---------|-----|
| Landing | `https://solicitar-credito.coodelsursas.com.co/?utm_source=witme&utm_campaign={ID_CAMPANA}` |
| Formulario directo | `https://solicitar-credito.coodelsursas.com.co/credito/microcredito_small?utm_source=witme` |

---

## 4. Comparación

| | API | Redirect |
|---|-----|----------|
| Envío JSON desde Witme | Sí | No |
| Usuario llena formulario Coodelsur | No | Sí |
| Requiere API Key | Sí | No |
| Origen Witme en panel | Automático | Con UTM/`ref=witme` |

---

## 5. Checklist Witme

**API:** configurar webhook → enviar `witme_id` + `datos_formulario` → prueba POST → HTTP 201.

**Redirect:** URL con `utm_source=witme` → prueba móvil → confirmar origen Witme con Coodelsur.

---

## 6. Soporte

**Correo:** softwaredelco@gmail.com  
**Empresa:** Coodelsur SAS

Incluir en consultas: fecha, método (API/redirect), `witme_id` o URL usada, código HTTP recibido.

---

*Documento confidencial — Integrador autorizado Witme / Coodelsur SAS*
