# Pronóstico — Conjuntivitis (H10)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `conjuntivitis_h10_release_f16745bc73a4`
- Lineage: forecast `conjuntivitis_h10_forecast_h52_7b8020abd25c_1bde761d119c` · refit `conjuntivitis_h10_refit_final_52417197b687_7b8020abd25c` · dataset `conjuntivitis_h10_631e8317331c`
- Origen 2026-W42 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `ets_add_damped_log1p` | 61 |
| `ridge_harmonic_log1p` | 1 |
| `seasonal_mean_3y` | 1 |
| `seasonal_mean_5y` | 1 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `0cb235f7078b3ef4344cd2443a3d0240fa55338d9307a4859c55e31b82347963`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
