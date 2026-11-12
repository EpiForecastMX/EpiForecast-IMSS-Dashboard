# Pronóstico — Candidiasis urogenital (B37.3, B37.4)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `candidiasis_b37_release_8f4852b71575`
- Lineage: forecast `candidiasis_b37_forecast_h52_5b97cd9cc039_8eae52889016` · refit `candidiasis_b37_refit_final_2308c0eac8eb_5b97cd9cc039` · dataset `candidiasis_b37_6e4dfd284f90`
- Origen 2026-W42 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_mean_3y` | 12 |
| `seasonal_mean_5y` | 14 |
| `seasonal_median_3y` | 4 |
| `seasonal_median_5y` | 17 |
| `seasonal_naive_lag52` | 17 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `b4cd0cfe4ca9409d5857b7abe403b1b2995ab5f7a214e1f87c306e3db695dea4`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
