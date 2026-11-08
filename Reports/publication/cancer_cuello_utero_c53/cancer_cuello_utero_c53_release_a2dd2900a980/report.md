# Pronóstico — Tumor maligno del cuello del útero (C53)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `cancer_cuello_utero_c53_release_a2dd2900a980`
- Lineage: forecast `cancer_cuello_utero_c53_forecast_h52_0d6b065264f8_71417f56ebea` · refit `cancer_cuello_utero_c53_refit_final_49988b9fcead_0d6b065264f8` · dataset `cancer_cuello_utero_c53_4ad50c282abf`
- Origen 2026-W41 → horizonte 52 semanas
- 32 modelos finales sobre 32 series base; 5 productos derivados por suma → 37 productos, 1924 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_mean_3y` | 4 |
| `seasonal_mean_5y` | 11 |
| `seasonal_median_3y` | 6 |
| `seasonal_median_5y` | 9 |
| `seasonal_naive_lag52` | 2 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 5 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `c6575ca4bf1b6f341f701b6cee288abbc6cb3bb89114ec0d81af1b69ca4baa12`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
