# Pronóstico — Triquinosis (B75)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `triquinosis_b75_release_e73fafd6857f`
- Lineage: forecast `triquinosis_b75_forecast_h52_9ed45427ba2d_6baf5cd5c375` · refit `triquinosis_b75_refit_final_9fe0414b00c7_9ed45427ba2d` · dataset `triquinosis_b75_9c09043f99c7`
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
- Veredicto `INCOMPLETE` · 1 de 4 semanas objetivo con verdad disponible.
- Gate congelado `73295e4873f78445e20cdd8fc22c709595f2d4eb75ba03c3343772eb0cf91875`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
