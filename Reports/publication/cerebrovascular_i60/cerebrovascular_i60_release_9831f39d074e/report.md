# Pronóstico — Enfermedad cerebrovascular (I60, I61, I62, I63, I64, I65, I66, I67, I69)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `cerebrovascular_i60_release_9831f39d074e`
- Lineage: forecast `cerebrovascular_i60_forecast_h52_00a883ae9bab_6a73b07a9460` · refit `cerebrovascular_i60_refit_final_9fe0414b00c7_00a883ae9bab` · dataset `cerebrovascular_i60_27c378786e46`
- Origen 2026-W41 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_naive_lag52` | 64 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `c6b0f7a841b82d3ab206c4d11f69b697f1d2b515a7d9caeb71f05cf47f302638`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
