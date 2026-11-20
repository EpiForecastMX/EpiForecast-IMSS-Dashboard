# Pronóstico — Meningitis meningocócica (A39.0)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `meningococica_a39_release_c3c7e1915698`
- Lineage: forecast `meningococica_a39_forecast_h52_d1f3ec7d2738_da36a813b339` · refit `meningococica_a39_refit_final_9fe0414b00c7_d1f3ec7d2738` · dataset `meningococica_a39_00785a71e727`
- Origen 2026-W44 → horizonte 52 semanas
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
- Gate congelado `5902114f41e267589a5c52d61fe98784df42932f4fbf25c00a3e161ce747da4c`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
