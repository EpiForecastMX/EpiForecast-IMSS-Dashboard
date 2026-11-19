# Pronóstico — Tricomoniasis urogenital (A59.0)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `tricomoniasis_a590_release_8f50a2144dd3`
- Lineage: forecast `tricomoniasis_a590_forecast_h52_9c88906e9b18_07649965e9ee` · refit `tricomoniasis_a590_refit_final_3108464b3ffd_9c88906e9b18` · dataset `tricomoniasis_a590_4af440b1edcc`
- Origen 2026-W43 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_mean_3y` | 9 |
| `seasonal_mean_5y` | 4 |
| `seasonal_median_3y` | 18 |
| `seasonal_median_5y` | 22 |
| `seasonal_naive_lag52` | 11 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `02a2614a57e8d39c0aaa05f87e134d7a5913e745305f39c8a40a818e8267dc27`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
