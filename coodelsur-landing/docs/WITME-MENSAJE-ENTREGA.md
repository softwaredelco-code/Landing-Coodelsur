# Plantillas de entrega — Integración Witme (API + Redirect)

> Uso interno Coodelsur. Copiar, completar y enviar.

---

## A. Correo principal — Documentación (2 PDF adjuntos)

**Asunto:** Coodelsur — Documentación integración Witme (API + Redirección URL)

**Adjuntos:**
- `WITME-INTEGRACION-COMPLETA.pdf` (guía principal — ambas vías)
- `WITME-API-PARA-INTEGRADOR.pdf` (especificación formal webhook)

**Cuerpo:**

Estimado equipo de Witme,

Por medio del presente les compartimos la documentación técnica oficial para integrar solicitudes de crédito con Coodelsur SAS en **producción**.

**URL de producción:** https://solicitar-credito.coodelsursas.com.co

Coodelsur soporta **dos vías de integración** (pueden usarse en paralelo):

---

**Opción A — Webhook API** (Witme envía leads a nuestro panel)

- **Endpoint:** `POST https://solicitar-credito.coodelsursas.com.co/api/leads/witme`
- **Autenticación:** `Authorization: Bearer {API_KEY}`
- **Formato:** JSON (`application/json`)
- **Resultado:** HTTP 201 — lead en panel admin con origen `witme`

---

**Opción B — Redirección URL** (usuario completa formulario en Coodelsur)

- **URL ejemplo:**
  ```
  https://solicitar-credito.coodelsursas.com.co/solicitar?monto=400000&utm_source=witme&utm_medium=redirect&utm_campaign={ID_CAMPANA}
  ```
- **Importante:** incluir `utm_source=witme` o `ref=witme` para identificar el lead como Witme

---

**Credenciales API:** la API Key se envía en un **correo separado** por seguridad.

**Próximos pasos:**

1. Revisar documentación adjunta.
2. Confirmar qué vías implementarán (API, redirect, o ambas).
3. Recibir API Key (correo aparte) si usan webhook.
4. Ejecutar prueba de integración (POST de prueba y/o redirect de prueba).
5. Confirmar leads visibles en nuestro panel con origen Witme.

Quedamos atentos para coordinar pruebas y go-live.

Cordialmente,

[Nombre del responsable]  
Coodelsur SAS  
cartera@coodelsursas.com.co  
https://coodelsursas.com.co

---

## B. Correo de credenciales API (enviar por separado)

**Asunto:** Coodelsur — Credenciales API Webhook Witme (CONFIDENCIAL)

**Cuerpo:**

Estimado equipo de Witme,

Complemento a la documentación enviada, credenciales del webhook de producción (Opción A).

**⚠️ CONFIDENCIAL — No reenviar por canales no seguros.**

| Parámetro | Valor |
|-----------|--------|
| **URL** | `https://solicitar-credito.coodelsursas.com.co/api/leads/witme` |
| **Método** | `POST` |
| **Header** | `Authorization: Bearer {API_KEY}` |
| **API Key** | `[PEGAR_AQUÍ_LA_WITME_API_KEY]` |

**Prueba rápida:**

```bash
curl -X POST "https://solicitar-credito.coodelsursas.com.co/api/leads/witme" \
  -H "Authorization: Bearer [API_KEY]" \
  -H "Content-Type: application/json" \
  -d '{"witme_id":"TEST-001","nombre":"Prueba","cedula":"1234567890","telefono":"3001112233"}'
```

Respuesta esperada: **HTTP 201** con `"success": true`.

Cordialmente,  
Coodelsur SAS

---

## C. WhatsApp — Documentación

```
Buenos días, equipo Witme.

Les enviamos por correo la documentación para integrar con Coodelsur (producción):

• Opción A — API webhook: POST /api/leads/witme (JSON + API Key)
• Opción B — Redirect URL al formulario con utm_source=witme

Adjuntos: guía completa + especificación API.

La API Key va en correo aparte.

Quedamos atentos para la prueba de integración.
Coodelsur SAS
```

---

## D. WhatsApp — API Key (aparte)

```
Equipo Witme — Credencial CONFIDENCIAL

API Key webhook Coodelsur:
[PEGAR_API_KEY]

Header: Authorization: Bearer [API_KEY]
URL: https://solicitar-credito.coodelsursas.com.co/api/leads/witme

Avísenos cuando hagan la prueba POST para confirmar el lead en nuestro panel.
Coodelsur SAS
```
