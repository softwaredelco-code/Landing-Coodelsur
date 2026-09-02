# Integración Witme → Coodelsur (API)

**Fase posterior.** Este documento aplica cuando Coodelsur tenga la aplicación desplegada y se active la conexión con Witme.

Por ahora Witme debe usar solo el catálogo de campos del formulario:

- [formulario-microcredito-small-campos-witme.docx](./formulario-microcredito-small-campos-witme.docx)
- [WITME_FORMULARIO.md](./WITME_FORMULARIO.md)

---

## Endpoint (referencia futura)

| | |
|---|---|
| **Método** | `POST` |
| **URL** | `https://{dominio}/api/leads/witme` |
| **Auth** | `Authorization: Bearer {WITME_API_KEY}` |

Coodelsur entregará URL y credenciales al desplegar.

## Respuestas esperadas

| HTTP | Significado |
|------|-------------|
| `201` | Solicitud creada → `{ "success": true, "id": "uuid" }` |
| `401` | No autorizado |
| `422` | Payload inválido |
| `500` | Error interno |

Implementación: `src/app/api/leads/witme/route.ts`
