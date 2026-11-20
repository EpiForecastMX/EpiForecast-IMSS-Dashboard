# Pronóstico — Lepra (A30)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `lepra_a30_release_6466f4bf7835`
- Lineage: forecast `lepra_a30_forecast_h52_7f2bdc66d791_06f974a8e1ec` · refit `lepra_a30_refit_final_9fe0414b00c7_7f2bdc66d791` · dataset `lepra_a30_be2e2f57a320`
- Origen 2026-W44 → horizonte 52 semanas
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
- Gate congelado `815ccb78d461ca5f3cc3adea90d1d4ed48846abb0d67153f48d553f3bf0add4e`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
