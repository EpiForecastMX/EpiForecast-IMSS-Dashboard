# Pronóstico — Diabetes mellitus tipo I (E10)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `diabetes_t1_release_2c4a288ee348`
- Lineage: forecast `diabetes_t1_forecast_h52_39882dc0ce2c_66ff57c8aa76` · refit `diabetes_t1_refit_final_b9f043c4718d_39882dc0ce2c` · dataset `diabetes_t1_65dc0372edb8`
- Origen 2026-W41 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_mean_3y` | 2 |
| `seasonal_mean_5y` | 12 |
| `seasonal_median_3y` | 10 |
| `seasonal_median_5y` | 38 |
| `seasonal_naive_lag52` | 2 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `2cfbb870ec61734e0015b589e56084fe32d38e07c2db5f7d570f8d3376c8b8fd`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
