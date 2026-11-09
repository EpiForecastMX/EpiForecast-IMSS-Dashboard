# Pronóstico — Tumor maligno del hígado y de las vías biliares intrahepáticas (C22)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `cancer_higado_c22_release_0340c3e974c5`
- Lineage: forecast `cancer_higado_c22_forecast_h52_abdd07455a8c_5bdac1b43132` · refit `cancer_higado_c22_refit_final_9fe0414b00c7_abdd07455a8c` · dataset `cancer_higado_c22_c8d94e2a6a95`
- Origen 2026-W41 → horizonte 52 semanas
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
- Gate congelado `5881d9a418c16578ca26942abc7a9da59d5c3fc3438787c48d8562976706d88e`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
