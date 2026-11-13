# Pronóstico — Efectos del calor y de la luz (T67, X30)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `calor_t67_release_39efd657d7d7`
- Lineage: forecast `calor_t67_forecast_h52_2d683b02ea88_da3a2b8eb620` · refit `calor_t67_refit_final_34127b737986_2d683b02ea88` · dataset `calor_t67_daed95767476`
- Origen 2026-W42 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_mean_5y` | 1 |
| `seasonal_median_3y` | 24 |
| `seasonal_median_5y` | 32 |
| `seasonal_naive_lag52` | 7 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `1bfc85ea8a4f7a514d2b322a13e30cf833bed1129a8e1dca651f3f6cfb7f3b5d`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
