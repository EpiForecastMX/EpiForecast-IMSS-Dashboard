# Pronóstico — Chancro blando (A57)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `chancro_blando_a57_release_45732e3c94c8`
- Lineage: forecast `chancro_blando_a57_forecast_h52_5e52806326de_26221cb9e8b9` · refit `chancro_blando_a57_refit_final_9fe0414b00c7_5e52806326de` · dataset `chancro_blando_a57_4e3557090c3f`
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
- Gate congelado `b24abcca996fc2753dd589f77a66565a028b6a6751f980804810bd0325005b4d`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
