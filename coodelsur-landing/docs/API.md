# API REST

Base URL: `{NEXT_PUBLIC_SITE_URL}` (ej. `http://localhost:3000`).

## Públicas

### `GET /api/health`

Diagnóstico del backend.

```json
{
  "ok": true,
  "demoMode": false,
  "database": true,
  "storageConfigured": true,
  "adminConfigured": true,
  "emailConfigured": false,
  "cedulaVerifyConfigured": false
}
```

---

### `POST /api/verify-cedula`

Validación de documento en tiempo real (paso 1 del formulario).

**Body:**

```json
{
  "documentType": "CC",
  "documentNumber": "1045678231",
  "nombre": "María López García",
  "fechaNacimiento": "1992-05-14",
  "fechaExpedicion": "2010-06-20"
}
```

**Respuesta:** `{ ok, verification: { status, message, registeredName?, localChecks? } }`

Estados: `valid_local`, `valid`, `not_found`, `name_mismatch`, `duplicate`, `invalid_format`, `not_configured`, `service_unavailable`.

---

### `POST /api/leads/draft`

Guarda borrador incompleto. Requiere datos mínimos de contacto (celular 10 dígitos, cédula válida, o nombre+email).

**Body:** `{ draftId?, step, values, utm? }`

**Respuesta:** `{ saved: true, draftId, porcentajeCompletado, pasoActual }` o `{ saved: false, reason }`.

---

### `POST /api/leads`

Envía solicitud completa.

**Body:** objeto `NanocreditoFormValues` + `utm`, `geoCliente`, `draftLeadId?`.

**Respuesta éxito:** `{ success: true, id }`

**Errores:** `400` validación, `409` cédula duplicada, `422` verificación documento.

---

### `POST /api/leads/witme`

Webhook externo Witme. Header: `Authorization: Bearer {WITME_API_KEY}`.

---

## Admin (requieren cookie `coodelsur_admin`)

Login: `POST /api/admin/login` con `{ password }`.

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/admin/leads` | Listado (`?estado`, `?q`, `?take`, `?skip`) |
| `GET` | `/api/admin/leads/export` | Excel (`.xlsx`) — ver abajo |
| `PATCH` | `/api/admin/leads` | `{ id, estado }` |
| `GET` | `/api/admin/leads/:id` | Detalle liviano (sin JSON pesado) |
| `DELETE` | `/api/admin/leads/:id` | Elimina solicitud + adjuntos Storage |
| `GET` | `/api/admin/leads/:id/attachments/:field` | Stream de adjunto (`cedulaFrontal`, `cedulaReverso`, `videoVerificacion`, `firma`) |

### `GET /api/admin/leads/export`

Descarga Excel con información completa de solicitudes.

**Query params:**

| Param | Descripción |
|-------|-------------|
| `ids` | UUIDs separados por coma (exportación de selección) |
| `q` | Búsqueda (mismo criterio del listado) |
| `estado` | Filtro por estado |
| `tipoCredito` | Filtro por producto |

**Respuesta:** `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

**Errores:** `401` no autorizado, `404` sin resultados.

Límite: 5.000 filas por exportación.

### Estados de lead (`LeadEstado`)

| Valor | Significado |
|-------|-------------|
| `incompleto` | Borrador abandonado |
| `recibido` | Solicitud enviada |
| `revisado` | Revisada por equipo |
| `contactado` | Asesor contactó al cliente |
| `descartado` | No procede |

## Caché

Las rutas admin envían `Cache-Control: no-store` para datos siempre frescos.
