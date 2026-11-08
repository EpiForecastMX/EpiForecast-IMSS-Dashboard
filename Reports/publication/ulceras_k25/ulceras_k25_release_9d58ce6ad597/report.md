# Pronóstico — Úlceras, gastritis y duodenitis (K25, K26, K27, K28, K29)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `ulceras_k25_release_9d58ce6ad597`
- Lineage: forecast `ulceras_k25_forecast_h52_022d0a6b1f8b_81e1cdf68a04` · refit `ulceras_k25_refit_final_270b28206dc6_022d0a6b1f8b` · dataset `ulceras_k25_b42a8dd41073`
- Origen 2026-W41 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `ets_add_damped_log1p` | 40 |
| `ridge_harmonic_log1p` | 15 |
| `seasonal_mean_3y` | 3 |
| `seasonal_mean_5y` | 3 |
| `seasonal_naive_lag52` | 3 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `b2a7558aacb0f44bde020fd861791eb7a6e841b4a0543a2cb34268e9cbc046c6`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
