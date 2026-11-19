# Pronóstico — Intoxicación aguda por alcohol (F10.0)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `intox_alcohol_f100_release_84f8eb61d01b`
- Lineage: forecast `intox_alcohol_f100_forecast_h52_6eb243d76865_74292e2d64fb` · refit `intox_alcohol_f100_refit_final_a17325e9fa53_6eb243d76865` · dataset `intox_alcohol_f100_74454bc6852d`
- Origen 2026-W43 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_mean_3y` | 10 |
| `seasonal_mean_5y` | 27 |
| `seasonal_median_3y` | 5 |
| `seasonal_median_5y` | 20 |
| `seasonal_naive_lag52` | 2 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `bf9c2ace2b0c03c880872f9a66e5b2e7871acfe9345e7a8ee744d407502becd2`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
