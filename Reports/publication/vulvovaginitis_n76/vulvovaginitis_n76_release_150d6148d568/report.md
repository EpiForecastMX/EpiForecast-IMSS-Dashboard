# Pronóstico — Vulvovaginitis (N76)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `vulvovaginitis_n76_release_150d6148d568`
- Lineage: forecast `vulvovaginitis_n76_forecast_h52_55d0ae1fcad6_30b79e92ed6b` · refit `vulvovaginitis_n76_refit_final_b285fa90be89_55d0ae1fcad6` · dataset `vulvovaginitis_n76_e1fa30413736`
- Origen 2026-W42 → horizonte 52 semanas
- 32 modelos finales sobre 32 series base; 5 productos derivados por suma → 37 productos, 1924 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `ets_add_damped_log1p` | 17 |
| `ridge_harmonic_log1p` | 6 |
| `seasonal_mean_5y` | 5 |
| `seasonal_median_5y` | 1 |
| `seasonal_naive_lag52` | 3 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 5 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `54fd0b9cd268ddfe47b2812064a7cd20a6dcb7a7640043cc023772d9d1d27302`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
