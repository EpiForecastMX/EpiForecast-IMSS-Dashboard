# Pronóstico — Infección de vías urinarias (N30, N34, N39.0)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `ivu_n39_release_7d2b810a3793`
- Lineage: forecast `ivu_n39_forecast_h52_4bc662a85238_ee7aa62ab9e6` · refit `ivu_n39_refit_final_1445c163c5dc_4bc662a85238` · dataset `ivu_n39_0683429134d9`
- Origen 2026-W41 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `ets_add_damped_log1p` | 40 |
| `ridge_harmonic_log1p` | 3 |
| `seasonal_mean_5y` | 8 |
| `seasonal_median_5y` | 1 |
| `seasonal_naive_lag52` | 12 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `0449df672d318f96159c0558de2a9439832b581e187bdbd519b623b29c4ad268`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
