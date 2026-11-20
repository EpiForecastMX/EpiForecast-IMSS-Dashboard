# Pronóstico — Otros síntomas y signos que involucran el estado emocional (ideación suicida) (R45.8)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `ideacion_suicida_r458_release_7c08365e2e32`
- Lineage: forecast `ideacion_suicida_r458_forecast_h52_0a48f3625536_7402bd71c32e` · refit `ideacion_suicida_r458_refit_final_9fe0414b00c7_0a48f3625536` · dataset `ideacion_suicida_r458_0c67aa6c3488`
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
- Gate congelado `7191dc462b73ef559cb7c89a2baad555603803b5960c9090ffbd197ca011d8bc`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
