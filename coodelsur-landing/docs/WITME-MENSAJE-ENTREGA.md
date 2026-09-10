# Plantillas de entrega — Integración Witme

> Uso interno Coodelsur. Copiar, completar y enviar.

---

## A. Correo principal (con documento adjunto)

**Asunto:** Coodelsur — Documentación técnica API Webhook (Integración Witme)

**Cuerpo:**

Estimado equipo de Witme,

Por medio del presente les compartimos la documentación técnica oficial para la integración del webhook de recepción de solicitudes de crédito entre Witme y Coodelsur SAS.

**Documento adjunto:** WITME-API-PARA-INTEGRADOR.docx (Especificación WITME-API-001 v2.0)

**Resumen de la integración:**

- **Endpoint:** `POST https://solicitar-credito.coodelsursas.com.co/api/leads/witme`
- **Autenticación:** Bearer Token (API Key)
- **Formato:** JSON (`application/json`)
- **Resultado:** Cada solicitud exitosa crea un lead en el panel interno de Coodelsur con origen `witme`.

**Credenciales:**

La API Key de autenticación se enviará en un **correo separado** por seguridad. No está incluida en el documento adjunto.

**Próximos pasos sugeridos:**

1. Revisar la documentación adjunta.
2. Configurar el webhook en su plataforma con la URL indicada.
3. Solicitar o confirmar recepción de la API Key.
4. Ejecutar una prueba de integración (`POST` de prueba).
5. Confirmar recepción de respuesta `HTTP 201` y visibilidad del lead en nuestro sistema.

Quedamos atentos para coordinar la prueba de integración y el go-live.

Cordialmente,

[Nombre del responsable]  
Coodelsur SAS  
cartera@coodelsursas.com.co  
https://coodelsursas.com.co

---

## B. Correo de credenciales (enviar por separado)

**Asunto:** Coodelsur — Credenciales API Webhook Witme (CONFIDENCIAL)

**Cuerpo:**

Estimado equipo de Witme,

Como complemento a la documentación técnica enviada previamente, les compartimos las credenciales de autenticación para el webhook de producción.

**⚠️ INFORMACIÓN CONFIDENCIAL — No reenviar ni almacenar en canales no seguros.**

| Parámetro | Valor |
|-----------|--------|
| **URL del webhook** | `https://solicitar-credito.coodelsursas.com.co/api/leads/witme` |
| **Método** | `POST` |
| **Header de autenticación** | `Authorization: Bearer {API_KEY}` |
| **API Key** | `[PEGAR_AQUÍ_LA_WITME_API_KEY]` |

**Instrucciones de uso:**

1. Agregar el header en cada request:
   ```
   Authorization: Bearer [API_KEY]
   ```
2. Enviar el body en JSON según la documentación WITME-API-001.
3. Respuesta exitosa esperada: **HTTP 201** con campo `"success": true`.

**Verificación rápida:**

```bash
curl -X POST "https://solicitar-credito.coodelsursas.com.co/api/leads/witme" \
  -H "Authorization: Bearer [API_KEY]" \
  -H "Content-Type: application/json" \
  -d '{"witme_id":"TEST-001","nombre":"Prueba","cedula":"1234567890","telefono":"3001112233"}'
```

**Seguridad:**

- No incluir la API Key en URLs, logs ni repositorios de código.
- Notificar a Coodelsur de inmediato si la clave se ve comprometida para proceder con su rotación.

Quedamos atentos para confirmar la prueba exitosa.

Cordialmente,

[Nombre del responsable]  
Coodelsur SAS  
cartera@coodelsursas.com.co

---

## C. Mensaje WhatsApp — Documento

```
Buenos días, equipo Witme.

Les enviamos por correo la documentación técnica oficial (Word) para conectar su plataforma con Coodelsur vía webhook API.

Resumen:
• URL: https://solicitar-credito.coodelsursas.com.co/api/leads/witme
• Método: POST con JSON
• Auth: Bearer Token (API Key — se envía por separado)

Cuando la revisen, les compartimos la API Key por canal privado para hacer la prueba de integración.

Quedamos atentos.
Coodelsur SAS
```

---

## D. Mensaje WhatsApp — API Key (enviar aparte)

```
Equipo Witme — Credencial CONFIDENCIAL 🔐

API Key para webhook Coodelsur:

[PEGAR_API_KEY]

Uso:
Header: Authorization: Bearer [API_KEY]
URL: https://solicitar-credito.coodelsursas.com.co/api/leads/witme

Por favor no compartir esta clave. Avísenos cuando hagan la prueba para confirmar que el lead llegue a nuestro panel.

Gracias.
Coodelsur SAS
```

---

## E. Generar API Key segura (PowerShell)

Ejecutar en la máquina del responsable técnico:

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))
```

Configurar en el servidor (cPanel → Node.js → Environment variables):

```
WITME_API_KEY=[valor_generado]
```

Reiniciar la aplicación Node.js después de agregar la variable.
