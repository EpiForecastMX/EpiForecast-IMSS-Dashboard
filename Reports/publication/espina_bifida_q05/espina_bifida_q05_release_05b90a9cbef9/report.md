# Pronóstico — Espina bífida (Q05)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `espina_bifida_q05_release_05b90a9cbef9`
- Lineage: forecast `espina_bifida_q05_forecast_h52_18971a866bca_4a44e009e9f6` · refit `espina_bifida_q05_refit_final_9fe0414b00c7_18971a866bca` · dataset `espina_bifida_q05_ee364ae199af`
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
- Gate congelado `45f95a9b41eaac918572510d6f94083b31503575fe97dd52132a79c91e94eb65`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
