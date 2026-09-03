# Formulario — Microcrédito Small

Producto activo: **`microcredito_small`** — montos **$200.000 – $600.000**, cuotas **1, 2 o 3**.

## Pasos (8)

| # | ID | Campos principales |
|---|-----|-------------------|
| 1 | `general` | Nombre, email, documento, celular, demografía |
| 2 | `credito` | Monto, cuotas, destino, ingresos, otros ingresos |
| 3 | `domicilio` | Departamento, municipio, dirección |
| 4 | `activos` | Vivienda, vehículo, **placa (obligatoria si tiene vehículo)** |
| 5 | `laboral` | Ocupación, empresa, cargo |
| 6 | `referencia` | Referencia familiar/personal |
| 7 | `bancarios` | Cuenta o llave Bre-B |
| 8 | `verificacion` | Fotos cédula, video, firma, hábeas data |

Definición de pasos: `NANOCREDITO_STEPS` en `src/shared/validation/nanocredito.ts`.

## Validaciones destacadas

### Cédula de ciudadanía (CC)

Solo **6, 7 o 10 dígitos** numéricos (`src/domain/identity/cedula.ts`).

### Celular

10 dígitos, inicia en **3** (formato Colombia).

### Campos condicionales

| Condición | Campo requerido |
|-----------|-----------------|
| `tieneVehiculo = si` | `placaVehiculo` (mín. 5 caracteres) |
| `referenciaParentesco = otro` | `referenciaParentescoOtro` |
| `tipoCuenta = llave` | Llave Bre-B (mín. 5 caracteres) |
| Otros ingresos indicados | Origen + monto |

Las reglas cruzadas se evalúan al pulsar **Continuar** (`collectCrossFieldErrors` + `collectStepCrossFieldErrors`).

## Borradores

| Capa | Almacenamiento | Clave |
|------|----------------|-------|
| Local | `localStorage` | Recuperación al reabrir navegador |
| Servidor | PostgreSQL (`incompleto`) | Visible en admin |

Guardado servidor: mínimo celular, cédula válida, o nombre+email.

## Adjuntos

| Campo | Límite | Storage |
|-------|--------|---------|
| Cédula frontal/reverso | 5 MB imagen | Supabase |
| Video verificación | 15 MB | Supabase |
| Firma | 2 MB | Supabase |

## Modo demo

`NEXT_PUBLIC_DEMO_MODE=true` — el formulario funciona pero **no envía** al backend (solo consola). Usar solo en demos locales.

## Archivos clave

```
src/presentation/components/forms/microcredito-small/FormularioMicrocreditoSmall.tsx
src/presentation/components/forms/microcredito-small/sections/
src/shared/validation/nanocredito.ts
src/presentation/hooks/useNanocreditoDraft.ts
src/presentation/hooks/useNanocreditoServerDraft.ts
```
