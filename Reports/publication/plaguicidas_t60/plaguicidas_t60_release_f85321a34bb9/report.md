# Pronóstico — Intoxicación por plaguicidas (T60)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `plaguicidas_t60_release_f85321a34bb9`
- Lineage: forecast `plaguicidas_t60_forecast_h52_e2892a726558_5682ed4592d8` · refit `plaguicidas_t60_refit_final_9fe0414b00c7_e2892a726558` · dataset `plaguicidas_t60_8be179b9f409`
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
- Gate congelado `250d84d51c14ad790609f9e059c431ff6b3583c96fdafbbc54bd165f56e4a573`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
