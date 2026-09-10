# Integración Witme → Coodelsur

Witme envía cada lead completado a nuestro webhook. El lead se guarda en PostgreSQL y aparece en **`/admin/leads`** con origen **`witme`**.

Implementación: `src/app/api/leads/witme/route.ts`  
Mapeo de campos: `src/application/lead/map-witme-payload.ts`

---

## 1. Configuración en Coodelsur

### Paso A — Generar clave secreta

En `.env`, `.env.local` y **Vercel (producción)**:

```env
WITME_API_KEY="una-clave-larga-y-aleatoria-min-32-chars"
```

Generar una clave segura (PowerShell):

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

### Paso B — Verificar que está activo

```http
GET /api/health
```

Debe mostrar `"witmeConfigured": true`.

También:

```http
GET /api/leads/witme
```

Devuelve la URL del webhook y campos esperados (sin auth).

---

## 2. Datos para entregar al equipo Witme

Compartir con Witme **por canal privado**:

| Dato | Valor |
|------|--------|
| **URL del webhook** | `https://{tu-dominio}/api/leads/witme` |
| **Método** | `POST` |
| **Content-Type** | `application/json` |
| **Autenticación** | Header `Authorization: Bearer {WITME_API_KEY}` |

Ejemplo producción: `https://coodelsur.com/api/leads/witme`  
Ejemplo local (solo pruebas con túnel): `https://xxxx.ngrok.io/api/leads/witme`

---

## 3. Formato del JSON que Witme debe enviar

### Campos mínimos (obligatorios)

```json
{
  "nombre": "María López García",
  "cedula": "1056523965",
  "telefono": "3001234567"
}
```

También acepta alias: `documento` (cédula), `celular` (teléfono), `correo` (email).

### Ejemplo completo recomendado

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
    "departamento": "Huila",
    "municipio": "Neiva",
    "direccion": "Calle 10 #5-20",
    "barrio": "Centro",
    "ingresos_mensuales": 1500000,
    "ocupacion": "Comerciante"
  },
  "utm_source": "witme",
  "utm_campaign": "campana-marzo"
}
```

### Reglas de mapeo

- Los campos pueden ir en el **root** del JSON o dentro de **`datos`** / **`datos_formulario`**.
- Acepta **snake_case** (`capital_solicitado`) y **camelCase** (`capitalSeleccionado`).
- Productos soportados en `tipo_credito`:
  - `microcredito_small` (default)
  - `microcredito_urbano`
  - `microcredito_rural`
  - `consumo`, `comercial`, `libranza`
- Campos no reconocidos se guardan y se muestran en admin como **“Datos adicionales (Witme)”**.

---

## 4. Respuestas del webhook

| HTTP | Body | Significado |
|------|------|-------------|
| `201` | `{ "success": true, "id": "uuid" }` | Lead creado en Coodelsur |
| `401` | `{ "error": "No autorizado" }` | Bearer token incorrecto |
| `422` | `{ "error": "Payload inválido" }` | Faltan nombre/cédula/teléfono |
| `500` | `{ "error": "Error interno" }` | Error del servidor |

---

## 5. Probar localmente

Con el servidor corriendo (`npm run dev`):

```powershell
$headers = @{
  "Authorization" = "Bearer TU_WITME_API_KEY"
  "Content-Type"  = "application/json"
}
$body = @{
  witme_id = "test-001"
  tipo_credito = "microcredito_small"
  nombre = "Prueba Witme"
  cedula = "1234567890"
  telefono = "3001112233"
  email = "test@ejemplo.com"
  datos_formulario = @{
    capital_solicitado = 200000
    cantidad_cuotas = 2
    destino_credito = "Prueba integración"
  }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Uri "http://localhost:3000/api/leads/witme" -Method POST -Headers $headers -Body $body
```

Luego abrir **`/admin/leads`** → debe aparecer el lead con **Origen: witme**.

---

## 6. Qué ve el equipo en el panel admin

| Dónde | Qué muestra |
|-------|-------------|
| Listado `/admin/leads` | Nombre, producto, monto, estado **Recibida** |
| Detalle del lead | Secciones del formulario mapeadas + **Datos adicionales (Witme)** |
| Campo Origen | `witme` |
| Export Excel | Incluye todos los leads Witme |

---

## 7. Producción (Vercel)

1. Agregar `WITME_API_KEY` en Vercel → Environment Variables
2. Redeploy
3. Entregar a Witme la URL de producción: `https://{dominio-vercel}/api/leads/witme`
4. Witme configura el webhook apuntando a esa URL

---

## 8. Preguntas frecuentes

**¿Witme puede enviar adjuntos (fotos, video)?**  
Sí, si los envían como URLs o base64 dentro de `datos_formulario` con las claves `cedulaFrontal`, `cedulaReverso`, `videoVerificacion`, `firma`. Si usan otro formato, compartir un ejemplo y ajustamos el mapeo.

**¿Se valida cédula duplicada como en el formulario web?**  
No en el webhook Witme (por ahora). Los leads entran directo como `recibido`. Si necesitan la misma regla anti-duplicados, se puede activar.

**¿Necesitan importar contactos en Brevo?**  
No. Witme es independiente del correo al cliente.

---

## Checklist de integración

- [ ] `WITME_API_KEY` configurada en `.env` y Vercel
- [ ] Prueba local con `POST /api/leads/witme` → 201
- [ ] Lead visible en `/admin/leads`
- [ ] URL y clave compartidas con Witme (canal privado)
- [ ] Witme confirma primer envío real en producción
