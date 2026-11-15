# Pronóstico — Leptospirosis (A27)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `leptospirosis_a27_release_5c71dba18511`
- Lineage: forecast `leptospirosis_a27_forecast_h52_e3949f1cc8c0_28493d3f3725` · refit `leptospirosis_a27_refit_final_9fe0414b00c7_e3949f1cc8c0` · dataset `leptospirosis_a27_53cf7e5705d3`
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
- Gate congelado `ed287ddffe7c40f84ba306f3497cb58055420a1ae3cd6de3f886892dfbac0fc1`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
