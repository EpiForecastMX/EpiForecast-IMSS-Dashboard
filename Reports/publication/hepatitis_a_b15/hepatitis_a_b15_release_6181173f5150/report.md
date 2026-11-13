# Pronóstico — Hepatitis vírica A (B15)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `hepatitis_a_b15_release_6181173f5150`
- Lineage: forecast `hepatitis_a_b15_forecast_h52_0cfc7057a8ba_dc6764daef98` · refit `hepatitis_a_b15_refit_final_5df884c80201_0cfc7057a8ba` · dataset `hepatitis_a_b15_8984658283fd`
- Origen 2026-W42 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_mean_3y` | 2 |
| `seasonal_mean_5y` | 13 |
| `seasonal_median_3y` | 16 |
| `seasonal_median_5y` | 13 |
| `seasonal_naive_lag52` | 20 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `510613ddc032a479fa921ba0c7dffa772d828bb54e5d680cfa4b4648cd0237a6`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
