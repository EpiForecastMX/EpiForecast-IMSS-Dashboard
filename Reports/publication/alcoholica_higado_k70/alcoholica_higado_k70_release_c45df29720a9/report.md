# Pronóstico — Enfermedad alcohólica del hígado (K70)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `alcoholica_higado_k70_release_c45df29720a9`
- Lineage: forecast `alcoholica_higado_k70_forecast_h52_bae69435be68_594e1044d288` · refit `alcoholica_higado_k70_refit_final_9fe0414b00c7_bae69435be68` · dataset `alcoholica_higado_k70_fe87182bbe1b`
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
- Gate congelado `6d92fbeca88bc13becb0e981738d5189d2aa6563aec156f4536a4fd168b694e3`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
