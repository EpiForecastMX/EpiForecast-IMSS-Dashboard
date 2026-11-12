# Pronóstico — Parotiditis infecciosa (B26)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `parotiditis_b26_release_703a6ec438ef`
- Lineage: forecast `parotiditis_b26_forecast_h52_a26ee2d5434b_80c9a8baae6f` · refit `parotiditis_b26_refit_final_9fe0414b00c7_a26ee2d5434b` · dataset `parotiditis_b26_e0e6fceef8f7`
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
- Gate congelado `141b41be6a054c4597f51b1ef515f1b0c5f5a9a5d3adc530dbc434e450eb9fd3`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
