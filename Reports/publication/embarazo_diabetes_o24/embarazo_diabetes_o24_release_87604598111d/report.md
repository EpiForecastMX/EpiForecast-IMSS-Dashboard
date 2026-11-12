# Pronóstico — Diabetes mellitus en el embarazo (O24.4)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `embarazo_diabetes_o24_release_87604598111d`
- Lineage: forecast `embarazo_diabetes_o24_forecast_h52_44c7cce1a7be_d997e88ca8b3` · refit `embarazo_diabetes_o24_refit_final_4d328188cbcb_44c7cce1a7be` · dataset `embarazo_diabetes_o24_da850db74ab8`
- Origen 2026-W42 → horizonte 52 semanas
- 32 modelos finales sobre 32 series base; 5 productos derivados por suma → 37 productos, 1924 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_mean_3y` | 13 |
| `seasonal_mean_5y` | 11 |
| `seasonal_median_5y` | 2 |
| `seasonal_naive_lag52` | 6 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 5 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `7c496f9ba2392efb3f16a4615cd5249ea9275ef5c04758d12a4dd63ccf187b9a`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
