# Pronóstico — Absceso hepático amebiano (A06.4)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `absceso_hepatico_a064_release_0ec9c6dfc5f8`
- Lineage: forecast `absceso_hepatico_a064_forecast_h52_03fece3e0c02_49059cd58bb2` · refit `absceso_hepatico_a064_refit_final_9fe0414b00c7_03fece3e0c02` · dataset `absceso_hepatico_a064_d5ac40e1a65d`
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
- Gate congelado `eb7c144520342c24ead29250c0b62508a932200e91143a857d943b034128eaf0`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
