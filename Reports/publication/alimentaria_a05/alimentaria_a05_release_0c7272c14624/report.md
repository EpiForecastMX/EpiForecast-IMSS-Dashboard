# Pronóstico — Intoxicación alimentaria bacteriana (A05)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `alimentaria_a05_release_0c7272c14624`
- Lineage: forecast `alimentaria_a05_forecast_h52_d7d823a85316_044d3b8faae1` · refit `alimentaria_a05_refit_final_2e62af0adb90_d7d823a85316` · dataset `alimentaria_a05_da7ae33f4055`
- Origen 2026-W42 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_mean_3y` | 3 |
| `seasonal_mean_5y` | 11 |
| `seasonal_median_3y` | 16 |
| `seasonal_median_5y` | 29 |
| `seasonal_naive_lag52` | 5 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `df9ff83739ffa71ab3142713e79e9c7e9cf4467b3995e4b5c107ae6addd3e770`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
