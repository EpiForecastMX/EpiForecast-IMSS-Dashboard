# Pronóstico — Leucemia (C91, C92, C93, C94, C95)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `leucemia_c91_release_0aa2412f36a6`
- Lineage: forecast `leucemia_c91_forecast_h52_92a9b6840d9e_653dccad91d8` · refit `leucemia_c91_refit_final_e4bf876b034e_92a9b6840d9e` · dataset `leucemia_c91_202c467800fe`
- Origen 2026-W41 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_mean_2y` | 18 |
| `seasonal_naive_lag52` | 46 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `8fb4dcacc67121fe37155435e8f36bf0a81b152a280efb8fe2588df1b737863e`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
