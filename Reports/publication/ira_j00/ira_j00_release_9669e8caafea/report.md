# Pronóstico — Infecciones respiratorias agudas (J00, J01, J03, J04, J05, J06, J20, J21)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `ira_j00_release_9669e8caafea`
- Lineage: forecast `ira_j00_forecast_h52_5b4bd4056a06_c0e9d9538bad` · refit `ira_j00_refit_final_9fe0414b00c7_5b4bd4056a06` · dataset `ira_j00_690eac1dc446`
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
- Gate congelado `f31a712ea011566783cc576239881b589e0198643c028b296eae60533ad51e15`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
