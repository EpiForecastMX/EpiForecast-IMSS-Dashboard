# Pronóstico — Desnutrición moderada (E44.0)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `desnutricion_moderada_e440_release_c6ab8deedd22`
- Lineage: forecast `desnutricion_moderada_e440_forecast_h52_56c36ad3db27_dbabf3a735e2` · refit `desnutricion_moderada_e440_refit_final_9fe0414b00c7_56c36ad3db27` · dataset `desnutricion_moderada_e440_fd2ef44a4613`
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
- Gate congelado `9952db2708d0e382e387b201be365d603e3bcfcd49af548b3ddd30c4241fd276`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
