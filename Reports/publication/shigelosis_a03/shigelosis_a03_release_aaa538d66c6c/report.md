# Pronóstico — Shigelosis (A03)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `shigelosis_a03_release_aaa538d66c6c`
- Lineage: forecast `shigelosis_a03_forecast_h52_e5d40ff04ac4_57263b96169e` · refit `shigelosis_a03_refit_final_c765d8acc370_e5d40ff04ac4` · dataset `shigelosis_a03_895f89001458`
- Origen 2026-W42 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_mean_3y` | 1 |
| `seasonal_median_3y` | 19 |
| `seasonal_median_5y` | 38 |
| `seasonal_naive_lag52` | 6 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `b9cbed4e98eb635af4497df3f9c5c18c57c427c1d253d141f0e83d9ff619ba48`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
