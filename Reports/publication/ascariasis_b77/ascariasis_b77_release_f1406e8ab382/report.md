# Pronóstico — Ascariasis (B77)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `ascariasis_b77_release_f1406e8ab382`
- Lineage: forecast `ascariasis_b77_forecast_h52_219e43f413c9_e12385006ba2` · refit `ascariasis_b77_refit_final_05beef53925a_219e43f413c9` · dataset `ascariasis_b77_a19f446056a4`
- Origen 2026-W42 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_mean_3y` | 14 |
| `seasonal_mean_5y` | 3 |
| `seasonal_median_3y` | 17 |
| `seasonal_median_5y` | 21 |
| `seasonal_naive_lag52` | 9 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `8b795ca29f1638ac6721317c1509eb2cc1b41ded81ba2a9ee94525d92aace591`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
