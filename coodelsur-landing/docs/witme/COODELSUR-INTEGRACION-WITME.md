# Coodelsur SAS
## Guía de integración técnica — Witme

---

| | |
|---|---|
| **Documento** | Integración Witme v1.0 |
| **Fecha** | Septiembre 2026 |
| **Ambiente** | Producción |
| **Sitio web** | https://solicitar-credito.coodelsursas.com.co |
| **Contacto** | cartera@coodelsursas.com.co |

---

## 1. Introducción

Coodelsur pone a disposición del equipo Witme **dos formas** de integración. Ambas registran solicitudes de crédito en el **mismo panel interno** de Coodelsur.

Pueden implementarse **una o las dos**, según el flujo de cada campaña.

| Método | Descripción breve |
|--------|-------------------|
| **A. API Webhook** | Witme envía los datos del lead en JSON cuando el usuario termina el formulario en Witme. |
| **B. Redirección URL** | Witme redirige al usuario al formulario web de Coodelsur para que complete la solicitud allí. |

En ambos casos, los leads quedan identificados como origen **Witme** en el panel de Coodelsur (si se siguen las indicaciones de este documento).

---

## 2. Método A — API Webhook

### 2.1 Datos de conexión

| Parámetro | Valor |
|-----------|--------|
| **URL** | `https://solicitar-credito.coodelsursas.com.co/api/leads/witme` |
| **Método** | `POST` |
| **Content-Type** | `application/json` |
| **Autenticación** | Header `Authorization: Bearer {API_KEY}` |

> La **API Key** la entrega Coodelsur por **correo separado**. No debe incluirse en este documento ni en código público.

### 2.2 Campos obligatorios

Enviar en el cuerpo JSON:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `nombre` | texto | Nombre completo del solicitante |
| `cedula` | texto | Número de documento (también acepta `documento`) |
| `telefono` | texto | Celular (también acepta `celular`) |

### 2.3 Campos recomendados

| Campo | Descripción |
|-------|-------------|
| `witme_id` | Identificador del lead en Witme (recomendado para trazabilidad) |
| `email` | Correo electrónico |
| `tipo_credito` | Producto: `microcredito_small` (default), `microcredito_urbano`, `microcredito_rural`, `consumo`, `comercial`, `libranza` |
| `acepta_terminos` | `true` si el usuario aceptó términos |
| `datos_formulario` | Objeto JSON con **todos los demás campos** del formulario Witme |

Los campos adicionales pueden enviarse también en el nivel raíz del JSON o dentro de `datos_formulario`. Coodelsur acepta nombres en **snake_case** (`capital_solicitado`) o **camelCase** (`capitalSeleccionado`).

**Ejemplos de campos que pueden incluirse en `datos_formulario`:**

- Datos del crédito: `capital_solicitado`, `cantidad_cuotas`, `destino_credito`
- Ubicación: `departamento`, `municipio`, `direccion`, `barrio`
- Laborales: `ocupacion`, `empresa`, `ingresos_mensuales`
- Bancarios: `tipo_cuenta`, `entidad_bancaria`, `numero_cuenta`
- Adjuntos (URL pública o base64): `cedula_frontal`, `cedula_reverso`, `video_verificacion`, `firma`

Campos no listados se almacenan igualmente y quedan disponibles en el panel de Coodelsur.

### 2.4 Ejemplo de envío

**Mínimo:**

```json
{
  "nombre": "María López García",
  "cedula": "1056523965",
  "telefono": "3001234567"
}
```

**Recomendado en producción:**

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
    "ingresos_mensuales": 1500000
  }
}
```

### 2.5 Respuestas del servidor

| Código | Significado | Acción de Witme |
|--------|-------------|-----------------|
| **201** | Lead creado correctamente | Continuar. Guardar el `id` retornado. |
| **401** | API Key inválida o ausente | Revisar credenciales con Coodelsur. No reintentar. |
| **422** | Faltan campos obligatorios | Corregir el JSON. No reintentar. |
| **500** | Error temporal del servidor | Reintentar: 5 s, 15 s, 45 s (máx. 3 veces). |

**Respuesta exitosa (201):**

```json
{
  "success": true,
  "id": "679a1ddc-8da7-4611-8ce9-808e1036881b",
  "origen": "witme",
  "storage": "database"
}
```

### 2.6 Prueba de integración

Coodelsur enviará la API Key por canal privado. Con ella, ejecutar:

```bash
curl -X POST "https://solicitar-credito.coodelsursas.com.co/api/leads/witme" \
  -H "Authorization: Bearer {API_KEY}" \
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

Resultado esperado: **HTTP 201**. Coodelsur confirmará que el lead aparece en su panel.

---

## 3. Método B — Redirección URL

### 3.1 Descripción

Witme redirige el navegador del usuario a una URL de Coodelsur. El usuario completa el formulario de solicitud en nuestro sitio (incluye captura de cédula, video y firma).

**No requiere API Key.**

### 3.2 URLs disponibles

| Destino | URL base |
|---------|----------|
| Landing (selector de monto) | `https://solicitar-credito.coodelsursas.com.co/` |
| Formulario con monto | `https://solicitar-credito.coodelsursas.com.co/solicitar?monto={MONTO}` |
| Formulario Microcrédito Small | `https://solicitar-credito.coodelsursas.com.co/credito/microcredito_small` |

`{MONTO}` = valor en pesos colombianos sin puntos ni comas (ej. `400000`, `600000`).

### 3.3 Parámetros de tracking (obligatorio)

Para que el lead quede registrado como **origen Witme**, la URL **debe incluir** uno de estos parámetros:

- `utm_source=witme` **(recomendado)**, o
- `ref=witme`, o
- `origen=witme`, o
- `source=witme`

**Sin estos parámetros**, el lead se registrará como tráfico directo y no podrá identificarse como Witme.

### 3.4 URL recomendada (copiar y configurar)

Reemplazar `{ID_CAMPANA}` por el identificador de la campaña en Witme:

```
https://solicitar-credito.coodelsursas.com.co/solicitar?monto=400000&utm_source=witme&utm_medium=redirect&utm_campaign={ID_CAMPANA}
```

**Otros montos:**

```
https://solicitar-credito.coodelsursas.com.co/solicitar?monto=600000&utm_source=witme&utm_medium=redirect&utm_campaign={ID_CAMPANA}
```

**Formato alternativo corto:**

```
https://solicitar-credito.coodelsursas.com.co/solicitar?monto=400000&ref=witme&utm_campaign={ID_CAMPANA}
```

### 3.5 Parámetros opcionales

| Parámetro | Descripción |
|-----------|-------------|
| `utm_campaign` | Identificador de campaña Witme (recomendado) |
| `utm_medium` | Medio; sugerido: `redirect` |
| `monto` | Precarga el monto en el formulario |

### 3.6 Prueba de integración

1. Configurar la URL de redirección con `utm_source=witme`.
2. Abrir la URL en un navegador (preferible móvil).
3. Completar el formulario de prueba.
4. Coodelsur verificará en su panel que el lead tiene origen **Witme**.

---

## 4. Resumen comparativo

| | API Webhook | Redirección URL |
|---|-------------|-----------------|
| El usuario llena formulario en Witme | Sí | No — lo hace en Coodelsur |
| Witme envía datos por JSON | Sí | No |
| Requiere API Key | Sí | No |
| Origen Witme en panel Coodelsur | Automático | Solo con UTM/`ref=witme` en la URL |
| Adjuntos (cédula, video, firma) | Enviar URL o base64 en JSON | El usuario los captura en Coodelsur |

---

## 5. Go-live — Checklist

**Witme — API:**
- [ ] Recibir API Key de Coodelsur (correo privado)
- [ ] Configurar webhook con URL y header Bearer
- [ ] Enviar `witme_id` en cada lead
- [ ] Incluir `datos_formulario` con todos los campos disponibles
- [ ] Ejecutar prueba POST → confirmar HTTP 201 con Coodelsur

**Witme — Redirect:**
- [ ] Configurar URL con `utm_source=witme` (o `ref=witme`)
- [ ] Incluir `utm_campaign` por campaña
- [ ] Probar flujo completo en móvil
- [ ] Confirmar con Coodelsur que el lead aparece con origen Witme

---

## 6. Soporte

| | |
|---|---|
| **Correo** | cartera@coodelsursas.com.co |
| **Empresa** | Coodelsur SAS |
| **Sitio** | https://coodelsursas.com.co |

Para incidencias de integración, incluir: fecha/hora, método (API o redirect), `witme_id` o URL usada, y respuesta HTTP recibida.

---

*Documento confidencial — Uso exclusivo del integrador autorizado por Coodelsur SAS.*
