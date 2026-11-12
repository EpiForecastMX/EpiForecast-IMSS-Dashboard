# Pronóstico — Erisipela (A46)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `erisipela_a46_release_c7240805b2a2`
- Lineage: forecast `erisipela_a46_forecast_h52_41e9e306fedc_69bc3228ff18` · refit `erisipela_a46_refit_final_587f6de63158_41e9e306fedc` · dataset `erisipela_a46_d789f911b786`
- Origen 2026-W42 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_mean_3y` | 10 |
| `seasonal_mean_5y` | 3 |
| `seasonal_median_3y` | 18 |
| `seasonal_median_5y` | 29 |
| `seasonal_naive_lag52` | 4 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `1934034fda02802f2dbad275b9ccac0cdd6f51d59abbde50a0928ce951651b59`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
