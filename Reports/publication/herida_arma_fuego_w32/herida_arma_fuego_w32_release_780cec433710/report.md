# Pronóstico — Herida por arma de fuego (W32, W33, W34)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `herida_arma_fuego_w32_release_780cec433710`
- Lineage: forecast `herida_arma_fuego_w32_forecast_h52_8afb619e507c_70af7cca3b6f` · refit `herida_arma_fuego_w32_refit_final_a7796578244d_8afb619e507c` · dataset `herida_arma_fuego_w32_7b7f65b008a6`
- Origen 2026-W43 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_mean_3y` | 17 |
| `seasonal_mean_5y` | 27 |
| `seasonal_median_3y` | 9 |
| `seasonal_median_5y` | 10 |
| `seasonal_naive_lag52` | 1 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `217db62c333fb2448bcc31f2f9690e64d30afac936d2b1c299bb6ee3eded96d8`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
