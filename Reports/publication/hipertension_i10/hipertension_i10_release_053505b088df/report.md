# Pronóstico — Hipertensión arterial (I10, I11, I12, I13, I14, I15)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `hipertension_i10_release_053505b088df`
- Lineage: forecast `hipertension_i10_forecast_h52_ce7a1a0df050_c46385c639ae` · refit `hipertension_i10_refit_final_77c2913a54c0_ce7a1a0df050` · dataset `hipertension_i10_3de6618f4158`
- Origen 2026-W41 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `ets_add_damped_log1p` | 29 |
| `ridge_harmonic_log1p` | 19 |
| `seasonal_mean_3y` | 1 |
| `seasonal_mean_5y` | 9 |
| `seasonal_median_5y` | 5 |
| `seasonal_naive_lag52` | 1 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `b97a2cf4412fd7a7b66186da0f246566c6ebff5b9e920553579f504df3e2dc10`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
