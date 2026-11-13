# Pronóstico — Otras hepatitis víricas (B17.0, B17.2, B17.8, B17.9, B18.0, B18.1, B18.8, B18.9, B19)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `otras_hepatitis_b17_release_08de6f7ff77b`
- Lineage: forecast `otras_hepatitis_b17_forecast_h52_a107823a5ace_14ea655a4b49` · refit `otras_hepatitis_b17_refit_final_d8b065b55da0_a107823a5ace` · dataset `otras_hepatitis_b17_3d4b3d92218c`
- Origen 2026-W42 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_mean_3y` | 2 |
| `seasonal_mean_5y` | 3 |
| `seasonal_median_3y` | 18 |
| `seasonal_median_5y` | 38 |
| `seasonal_naive_lag52` | 3 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `5952bd98f8fe7421d08d4f0ddc002837b455b686b9ffcbefd9ca862fc5ff2113`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
