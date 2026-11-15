# Pronóstico — Tos ferina (A37)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `tos_ferina_a37_release_f9c47054e402`
- Lineage: forecast `tos_ferina_a37_forecast_h52_2ed0302add91_14a67df15be5` · refit `tos_ferina_a37_refit_final_9fe0414b00c7_2ed0302add91` · dataset `tos_ferina_a37_91b3d4f3392b`
- Origen 2026-W43 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_naive_lag52` | 64 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `81cd7161757f41fb3d039377d233f68f8068e3b0771638838b7ea0296d09da15`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
