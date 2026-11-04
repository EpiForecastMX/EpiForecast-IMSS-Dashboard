# Pronóstico — Obesidad (E66)

**Validación prospectiva superada (4/4 semanas) · pronóstico puntual sin intervalos**

- Release: `obesidad_release_2517e7858901`
- Lineage: forecast `obesidad_forecast_h52_ff249060018a_92d446b6df8f` · refit `obesidad_refit_final_91590fa7452f_ff249060018a` · dataset `obesidad_1502d1a25b48`
- Origen 2026-W26 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `ets_add_damped_log1p` | 16 |
| `prophet_count_log1p` | 5 |
| `prophet_rate_log1p` | 5 |
| `ridge_harmonic_log1p` | 12 |
| `seasonal_mean_5y` | 16 |
| `seasonal_median_5y` | 10 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva superada (4/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `PASS` · 4 de 4 semanas objetivo con verdad disponible.
- Gate congelado `5bc39aa5d44f5e62062775dc09a0366ac856f47e5444fbb52ca07e608e61b65d`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
