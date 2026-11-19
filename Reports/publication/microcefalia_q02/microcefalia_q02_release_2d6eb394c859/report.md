# Pronóstico — Microcefalia (Q02)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `microcefalia_q02_release_2d6eb394c859`
- Lineage: forecast `microcefalia_q02_forecast_h52_84d3c17b9ccf_4f6fe1f26d22` · refit `microcefalia_q02_refit_final_9fe0414b00c7_84d3c17b9ccf` · dataset `microcefalia_q02_09f9354bf30e`
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
- Gate congelado `dd9f8e4df5d7111563df8ca19c0e28eea5de169aee693071fb6189ee917595e2`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
