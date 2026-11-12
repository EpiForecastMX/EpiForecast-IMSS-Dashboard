# Pronóstico — Displasia cervical leve y moderada (N87.0, N87.1)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `displasia_leve_n87_release_df5afab4a165`
- Lineage: forecast `displasia_leve_n87_forecast_h52_7223bba1daed_a546339278f8` · refit `displasia_leve_n87_refit_final_30e6b4ef89df_7223bba1daed` · dataset `displasia_leve_n87_9598d047995c`
- Origen 2026-W42 → horizonte 52 semanas
- 32 modelos finales sobre 32 series base; 5 productos derivados por suma → 37 productos, 1924 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_naive_lag52` | 32 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 5 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `e599d7b81244c5097c6b6114f9b86b181864a079fa6bc42425a6dc41655fbd0b`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
