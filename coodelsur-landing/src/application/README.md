# application/ — Casos de uso

Orquesta dominio + infraestructura. Aquí viven los flujos completos.

| Módulo | Casos de uso |
|--------|--------------|
| `lead/` | create-lead, save-draft-lead, delete-lead, export Excel, detalle admin |
| `credito/` | Cache runtime de parámetros de amortización |
| `identity/` | verify-document (local + Verifik) |

Las rutas en `app/api/` deben llamar a esta capa, no a Prisma directamente.
