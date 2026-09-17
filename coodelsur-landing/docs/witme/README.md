# Documentación Witme — Coodelsur

## Para entregar a Witme (oficial)

| Archivo | Uso |
|---------|-----|
| **[COODELSUR-INTEGRACION-WITME.pdf](./COODELSUR-INTEGRACION-WITME.pdf)** | **Único documento para Witme** — API + redirección URL |
| [COODELSUR-INTEGRACION-WITME.md](./COODELSUR-INTEGRACION-WITME.md) | Fuente editable (mismo contenido) |

**Enviar por correo:** adjuntar solo el PDF. La API Key va en **correo aparte** (ver plantilla interna).

---

## Uso interno Coodelsur (no enviar a Witme)

| Archivo | Uso |
|---------|-----|
| [INTERNO-correo-credenciales.md](./INTERNO-correo-credenciales.md) | Plantillas de correo y WhatsApp |

---

## Regenerar PDF

Desde la raíz del proyecto:

```bash
cd docs/witme
npx md-to-pdf COODELSUR-INTEGRACION-WITME.md
```
