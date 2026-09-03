# infrastructure/ — Adaptadores técnicos

Detalles de implementación: base de datos, storage, servicios externos.

| Carpeta | Responsabilidad |
|---------|-----------------|
| `database/` | Cliente Prisma, parametros-store |
| `persistence/` | Fallback JSON local (solo dev) |
| `storage/` | Supabase Storage |
| `email/` | SMTP / Resend |
| `geo/` | Geolocalización por IP |
| `auth/` | Sesión admin |
| `media/` | Normalización de archivos |

Schema DB: `database/prisma/schema.prisma` (raíz del repo).
