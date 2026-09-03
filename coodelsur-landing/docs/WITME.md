# Integración Witme

Referencia para el webhook Witme → Coodelsur. Implementación: `src/app/api/leads/witme/route.ts`.

## Endpoint

| | |
|---|---|
| **Método** | `POST` |
| **URL** | `https://{dominio}/api/leads/witme` |
| **Auth** | `Authorization: Bearer {WITME_API_KEY}` |

## Respuestas

| HTTP | Significado |
|------|-------------|
| `201` | Solicitud creada → `{ "success": true, "id": "uuid" }` |
| `401` | No autorizado |
| `422` | Payload inválido |
| `500` | Error interno |

## Campos del formulario Small

Catálogo de campos (8 pasos, validaciones, adjuntos): ver [FORMULARIO.md](./FORMULARIO.md).

Para nuevos productos (urbano/rural), definir campos con negocio antes de integrar con Witme.
