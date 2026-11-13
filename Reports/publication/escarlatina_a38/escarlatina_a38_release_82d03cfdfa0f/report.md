# Pronóstico — Escarlatina (A38)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `escarlatina_a38_release_82d03cfdfa0f`
- Lineage: forecast `escarlatina_a38_forecast_h52_16dc6075c0ae_57b9f464803d` · refit `escarlatina_a38_refit_final_9fe0414b00c7_16dc6075c0ae` · dataset `escarlatina_a38_536f06aba41f`
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
- Gate congelado `31ac790aee80ca0572df95869aed81295e1a72eb468902a37d35e510ad262526`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
