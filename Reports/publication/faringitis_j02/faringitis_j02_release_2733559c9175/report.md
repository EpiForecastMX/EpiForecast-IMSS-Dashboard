# Pronóstico — Faringitis y amigdalitis estreptocócicas (J02.0, J03.0)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `faringitis_j02_release_2733559c9175`
- Lineage: forecast `faringitis_j02_forecast_h52_bbb188de53b3_785544542479` · refit `faringitis_j02_refit_final_9fe0414b00c7_bbb188de53b3` · dataset `faringitis_j02_75e7d9f4be07`
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
- Gate congelado `30eb656bfbeaef7ab66660311852dddd7839d61701f70b4bfb3de5b63fccd551`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
