# Pronóstico — Intoxicación por monóxido de carbono (T58)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `monoxido_t58_release_292de8154869`
- Lineage: forecast `monoxido_t58_forecast_h52_524123164c06_88616285e4b3` · refit `monoxido_t58_refit_final_9fe0414b00c7_524123164c06` · dataset `monoxido_t58_575c846b0585`
- Origen 2026-W42 → horizonte 52 semanas
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
- Gate congelado `431aedb73a3b84792cd40a37fd39f2d4b2c078b346d8b1a9e8d863f48b65cd3f`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
