# Pronóstico — Otras salmonelosis (A02)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `salmonelosis_a02_release_0f0ca5f81ea8`
- Lineage: forecast `salmonelosis_a02_forecast_h52_3facf4ad2605_158ecfae97ad` · refit `salmonelosis_a02_refit_final_9fe0414b00c7_3facf4ad2605` · dataset `salmonelosis_a02_77c3a9dc8643`
- Origen 2026-W42 → horizonte 52 semanas
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
- Gate congelado `70184b2775556358d104f0155a9b6ce61fd2c1f32d5f79617904f709c0e68aab`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
