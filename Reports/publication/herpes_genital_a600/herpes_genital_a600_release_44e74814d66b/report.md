# Pronóstico — Herpes genital (A60.0)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `herpes_genital_a600_release_44e74814d66b`
- Lineage: forecast `herpes_genital_a600_forecast_h52_0e2050f7fe67_833a27eea659` · refit `herpes_genital_a600_refit_final_c2d5fb7d5280_0e2050f7fe67` · dataset `herpes_genital_a600_f667ad17ce0b`
- Origen 2026-W43 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_mean_3y` | 3 |
| `seasonal_mean_5y` | 24 |
| `seasonal_median_3y` | 11 |
| `seasonal_median_5y` | 22 |
| `seasonal_naive_lag52` | 4 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `3d8c67e3304f441259183ef991aef1a84230520ebb587882a766a8ea3794bad0`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
