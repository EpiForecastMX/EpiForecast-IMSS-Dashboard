# Pronóstico — Linfoma de Hodgkin (C81)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `linfoma_hodgkin_c81_release_4ea7e36a6ed6`
- Lineage: forecast `linfoma_hodgkin_c81_forecast_h52_88b360a2524f_0d9d6c3d8c8f` · refit `linfoma_hodgkin_c81_refit_final_bb7200dc9609_88b360a2524f` · dataset `linfoma_hodgkin_c81_f775fd7755f8`
- Origen 2026-W41 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_mean_2y` | 12 |
| `seasonal_naive_lag52` | 52 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `4e74da65d64ab0fcd0abe0cfbffc64f7229f0824d0631e4bb41706e8a3a9fa50`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
