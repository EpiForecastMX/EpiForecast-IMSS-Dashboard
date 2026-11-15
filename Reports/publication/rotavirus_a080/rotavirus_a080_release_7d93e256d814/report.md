# Pronóstico — Enteritis debida a rotavirus (A08.0)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `rotavirus_a080_release_7d93e256d814`
- Lineage: forecast `rotavirus_a080_forecast_h52_97bc3e4ec865_bf75035a1de0` · refit `rotavirus_a080_refit_final_9fe0414b00c7_97bc3e4ec865` · dataset `rotavirus_a080_8a78480b5009`
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
- Gate congelado `86e81ad0ac30084bc2dc41be7f1714d3851da1e6791268ffae10b99778442872`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
