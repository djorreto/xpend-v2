/**
 * Alcance MVP producto (V3): una sola entrada de gasto vía Excel/CSV en Sourcing Intelligence;
 * resto del flujo operativo manual en app. Facturación y contratos fuera de alcance por ahora.
 *
 * Facturas: reactivar con NEXT_PUBLIC_FEATURE_INVOICES=true cuando entre en roadmap.
 */
export const featureInvoicesModule =
  typeof process !== 'undefined' && process.env.NEXT_PUBLIC_FEATURE_INVOICES === 'true'
