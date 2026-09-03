import type { CreditoConfig } from "@/shared/types/credito";

/** Props comunes de todos los orquestadores de formulario por producto. */
export interface CreditoFormProps {
  config: CreditoConfig;
  /** Monto elegido en el selector unificado; precarga capital si aplica. */
  initialMonto?: number;
}
