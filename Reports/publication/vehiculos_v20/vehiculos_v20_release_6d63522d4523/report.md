# Pronóstico — Accidente de transporte en vehículos con motor (V20, V40)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `vehiculos_v20_release_6d63522d4523`
- Lineage: forecast `vehiculos_v20_forecast_h52_aa0abd2843d1_ac86b7589e08` · refit `vehiculos_v20_refit_final_37f5567cf3d1_aa0abd2843d1` · dataset `vehiculos_v20_d62f799adf95`
- Origen 2026-W42 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `ets_add_damped_log1p` | 37 |
| `ridge_harmonic_log1p` | 17 |
| `seasonal_mean_3y` | 1 |
| `seasonal_mean_5y` | 5 |
| `seasonal_median_5y` | 3 |
| `seasonal_naive_lag52` | 1 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `ec9a6b97496a36f5c9f7444cc829d13a02666a84a6cdae5d47b91b9fe10cd369`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
