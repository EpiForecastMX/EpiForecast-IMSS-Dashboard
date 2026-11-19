# Pronóstico — Violencia intrafamiliar (Y07.0, Y07.1, Y07.2)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `violencia_intrafamiliar_y07_release_c56e23ab2467`
- Lineage: forecast `violencia_intrafamiliar_y07_forecast_h52_feb0307ca230_079a992c7397` · refit `violencia_intrafamiliar_y07_refit_final_63d78a05a4d5_feb0307ca230` · dataset `violencia_intrafamiliar_y07_f872e6e9115c`
- Origen 2026-W43 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_mean_3y` | 11 |
| `seasonal_mean_5y` | 15 |
| `seasonal_median_3y` | 17 |
| `seasonal_median_5y` | 17 |
| `seasonal_naive_lag52` | 4 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `f1959126d770b663b660f92d2174e0bd21e63871ff57c00f5c4f875473f3f43c`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
