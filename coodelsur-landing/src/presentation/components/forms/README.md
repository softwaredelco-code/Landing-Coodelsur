# Formularios por producto

Cada tipo de crédito tiene **su propia carpeta** con orquestador, secciones y validación.

## Estructura

```
forms/
├── registry.tsx              ← Mapa tipo → componente (FormularioPorTipo)
├── types.ts                  ← CreditoFormProps compartido
├── FormularioEnDesarrollo.tsx
├── microcredito-small/       ✅ IMPLEMENTADO
│   ├── FormularioMicrocreditoSmall.tsx
│   └── sections/
├── microcredito-urbano/      🔜 Por implementar
├── microcredito-rural/       🔜 Por implementar
├── consumo/
├── comercial/
└── libranza/
```

Componentes compartidos (cámara, firma, file upload): en la raíz de `forms/`.

## Rutas públicas

| Producto | Ruta |
|----------|------|
| Microcrédito Small | `/credito/microcredito_small` |
| Microcrédito urbano | `/credito/microcredito_urbano` |
| Crédito Libranza | `/credito/libranza` |
| Consumo | `/credito/consumo` |
| Comercial | `/credito/comercial` |
| Libranza | `/credito/libranza` |

Registro central: `shared/config/creditos/formularios.ts`

## Checklist al implementar un formulario nuevo

1. **UI** — Reemplazar stub en `forms/<producto>/Formulario*.tsx` y crear `sections/`
2. **Validación** — `shared/validation/<producto>/schema.ts`
3. **Config** — `shared/config/creditos/<producto>.ts` → `disponible: true`
4. **Montos** — `montos.ts` → `formularioDisponible: true`
5. **Registro** — `formularios.ts` → `implementado: true`
6. **API** — Branch en `app/api/leads/route.ts` y `draft/route.ts`

Guía completa: [docs/GUIA-NUEVO-FORMULARIO.md](../../../docs/GUIA-NUEVO-FORMULARIO.md)
