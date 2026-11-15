# Pronóstico — Síndrome meníngeo (G00.2, G00.3, G00.8, G00.9, G01, G02, G03)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `sindrome_meningeo_g00_release_7fd7ccde48c7`
- Lineage: forecast `sindrome_meningeo_g00_forecast_h52_8d8d5afee9b9_8cd754509ce7` · refit `sindrome_meningeo_g00_refit_final_9fe0414b00c7_8d8d5afee9b9` · dataset `sindrome_meningeo_g00_756c8842f986`
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
- Gate congelado `e9165e617d1de13580c31f67c6d568fa992037f1f2ccc5f3dc08fa83346c1002`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
