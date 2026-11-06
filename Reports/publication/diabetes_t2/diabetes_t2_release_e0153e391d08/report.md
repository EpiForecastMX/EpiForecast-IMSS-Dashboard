# Pronóstico — Diabetes mellitus tipo II (E11, E12, E13, E14)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `diabetes_t2_release_e0153e391d08`
- Lineage: forecast `diabetes_t2_forecast_h52_2a570102fc55_2e1b428ff7ba` · refit `diabetes_t2_refit_final_e256d411c6cd_2a570102fc55` · dataset `diabetes_t2_053735c306d1`
- Origen 2026-W41 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `ets_add_damped_log1p` | 34 |
| `ridge_harmonic_log1p` | 20 |
| `seasonal_mean_3y` | 2 |
| `seasonal_mean_5y` | 5 |
| `seasonal_median_5y` | 3 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `4a8e4403994ba11536175f5b62455e136db32514197e67bb31023463a76de819`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
