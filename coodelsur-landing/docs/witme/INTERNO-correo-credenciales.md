# Uso interno — Correos para Witme

> No enviar este archivo a Witme.

---

## Correo 1 — Documentación

**Asunto:** Coodelsur — Guía de integración Witme

**Adjunto:** `COODELSUR-INTEGRACION-WITME.pdf`

**Cuerpo:**

Estimado equipo de Witme,

Adjuntamos la guía oficial de integración con Coodelsur SAS (producción).

El documento describe las dos vías disponibles:

1. **API Webhook** — envío de leads en JSON a nuestro panel  
2. **Redirección URL** — envío de usuarios a nuestro formulario web  

La **API Key** (solo para la vía API) la enviamos en un correo separado.

Quedamos atentos para coordinar las pruebas de integración.

Cordialmente,  
[Nombre] — Coodelsur SAS  
cartera@coodelsursas.com.co

---

## Correo 2 — API Key (confidencial, aparte)

**Asunto:** Coodelsur — API Key Witme (CONFIDENCIAL)

| Parámetro | Valor |
|-----------|--------|
| URL | `https://solicitar-credito.coodelsursas.com.co/api/leads/witme` |
| Header | `Authorization: Bearer {API_KEY}` |
| API Key | [copiar de cPanel → WITME_API_KEY] |
