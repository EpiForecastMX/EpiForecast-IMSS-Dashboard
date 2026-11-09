# Pronóstico — Tumor maligno del riñón (C64)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `cancer_rinon_c64_release_2cbedc349fbf`
- Lineage: forecast `cancer_rinon_c64_forecast_h52_6d9a62e74e78_fc90c523e50f` · refit `cancer_rinon_c64_refit_final_9fe0414b00c7_6d9a62e74e78` · dataset `cancer_rinon_c64_e239827ca925`
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
- Gate congelado `09e3354c2211a01c428ef89b15cd2ea55896ac140be9cc20bae3019f500beafc`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
